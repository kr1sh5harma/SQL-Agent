"""
agent.py — The SQL ReAct Agent.

How it works (ReAct = Reasoning + Acting):
  1. User asks a natural language question.
  2. Agent is given a system prompt explaining the tools.
  3. Agent thinks: "Thought: I need to list tables first."
  4. Agent acts:  "Action: list_tables()"
  5. We execute the tool and feed the result back as an "Observation".
  6. Agent repeats steps 3-5 until it has enough info to answer.
  7. Agent writes the final answer: "Final Answer: ..."

This loop runs up to MAX_AGENT_ITERATIONS times.
Each step is yielded as a Server-Sent Event so the frontend can stream it live.

Why ReAct instead of LangGraph?
  LangGraph is powerful but adds a lot of graph-definition boilerplate.
  For a 3-tool agent, a simple while-loop is clearer and 10x easier to debug.
"""

import json
import re
from typing import Generator, Any
from groq import Groq

from app.config import GROQ_API_KEY, GROQ_MODEL, MAX_AGENT_ITERATIONS
from app.database import DatabaseManager
from app.tools import TOOLS, TOOL_DESCRIPTIONS


# ── System Prompt ─────────────────────────────────────────────────────────────

def build_system_prompt() -> str:
    return f"""You are an expert SQL agent. Your job is to answer user questions about a database.

You have access to tools that let you explore and query the database.
Always think step-by-step before writing SQL. Never guess column names — always describe tables first.

{TOOL_DESCRIPTIONS}

RESPONSE FORMAT (strictly follow this):
  Thought: <your reasoning>
  Action: <tool_name>(<args as JSON or plain values>)

OR when you have the final answer:
  Thought: I now have all the information needed.
  Final Answer: <your complete answer in plain English, including key numbers/data>

RULES:
- You MUST call at least one tool before giving a Final Answer.
- For run_sql, write clean SQLite-compatible SQL. Quote string values correctly.
- If a query returns an error, fix the SQL and try again.
- Keep Final Answer concise but complete. Include actual data values.
- Never make up data. Only state what the query returned.
"""


# ── Tool call parser ──────────────────────────────────────────────────────────

def parse_action(action_str: str) -> tuple[str, list]:
    """
    Parse 'tool_name(arg1, arg2, ...)' or 'tool_name({"key": "val"})' 
    into (tool_name, args_list).
    
    Examples:
      "list_tables()"               → ("list_tables", [])
      "describe_table(orders)"      → ("describe_table", ["orders"])
      'run_sql(SELECT * FROM t)'    → ("run_sql", ["SELECT * FROM t"])
    """
    # Match: tool_name(content)
    match = re.match(r"^(\w+)\((.*)\)$", action_str.strip(), re.DOTALL)
    if not match:
        raise ValueError(f"Cannot parse action: '{action_str}'")

    tool_name = match.group(1)
    args_str = match.group(2).strip()

    if not args_str:
        return tool_name, []

    # Try JSON first (handles cases where agent formats as JSON dict/array)
    try:
        parsed = json.loads(args_str)
        if isinstance(parsed, dict):
            return tool_name, [parsed]
        elif isinstance(parsed, list):
            return tool_name, parsed
        else:
            return tool_name, [parsed]
    except json.JSONDecodeError:
        pass

    # If not JSON, treat the whole thing as a single string argument
    # Strip surrounding quotes if present
    args_str = args_str.strip('"\'')
    return tool_name, [args_str]


# ── Tool dispatcher ───────────────────────────────────────────────────────────

def dispatch_tool(db: DatabaseManager, tool_name: str, args: list) -> dict:
    """Call the right tool function with the right arguments."""
    if tool_name not in TOOLS:
        return {"error": f"Unknown tool: '{tool_name}'. Available: {list(TOOLS.keys())}"}

    fn = TOOLS[tool_name]
    try:
        if tool_name == "list_tables":
            return fn(db)
        elif tool_name == "describe_table":
            table = args[0] if args else ""
            return fn(db, table)
        elif tool_name == "run_sql":
            sql = args[0] if args else ""
            return fn(db, sql)
    except Exception as e:
        return {"error": str(e)}


# ── Main Agent Loop ───────────────────────────────────────────────────────────

def run_agent(
    question: str,
    db: DatabaseManager,
) -> Generator[dict, None, None]:
    """
    Run the ReAct agent loop and yield step events.
    
    Each yielded dict has this shape:
      {
        "type": "thought" | "action" | "observation" | "answer" | "error",
        "content": <string or dict>
      }
    
    The frontend renders each event as it arrives (SSE streaming).
    """
    client = Groq(api_key=GROQ_API_KEY)
    
    # Build conversation history (multi-turn so Groq remembers context)
    messages = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": question},
    ]

    for iteration in range(MAX_AGENT_ITERATIONS):
        # ── Call Groq ──────────────────────────────────────────────────────────
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0,          # deterministic SQL generation
            max_tokens=1024,
            stop=["Observation:"],  # stop BEFORE writing its own observation
        )
        
        assistant_text = response.choices[0].message.content.strip()
        messages.append({"role": "assistant", "content": assistant_text})

        # ── Parse Final Answer ─────────────────────────────────────────────────
        if "Final Answer:" in assistant_text:
            # Extract everything after "Final Answer:"
            answer = assistant_text.split("Final Answer:", 1)[1].strip()
            
            # Also extract the thought before the answer if present
            thought_match = re.search(r"Thought:\s*(.+?)(?=Final Answer:|$)", 
                                      assistant_text, re.DOTALL)
            if thought_match:
                yield {"type": "thought", "content": thought_match.group(1).strip()}
            
            yield {"type": "answer", "content": answer}
            return

        # ── Parse Thought + Action ─────────────────────────────────────────────
        thought_match = re.search(r"Thought:\s*(.+?)(?=Action:|$)", 
                                   assistant_text, re.DOTALL)
        action_match = re.search(r"Action:\s*(.+?)$", 
                                  assistant_text, re.DOTALL)

        if thought_match:
            yield {"type": "thought", "content": thought_match.group(1).strip()}

        if not action_match:
            # Agent gave a response with no Action and no Final Answer
            # Treat the whole response as the final answer
            yield {"type": "answer", "content": assistant_text}
            return

        action_str = action_match.group(1).strip()
        yield {"type": "action", "content": action_str}

        # ── Execute Tool ───────────────────────────────────────────────────────
        try:
            tool_name, args = parse_action(action_str)
            result = dispatch_tool(db, tool_name, args)
        except ValueError as e:
            result = {"error": str(e)}

        observation = json.dumps(result, ensure_ascii=False, indent=2)
        
        # Limit observation size to avoid huge token payloads
        if len(observation) > 4000:
            # Truncate rows but keep structure
            if "rows" in result:
                result["rows"] = result["rows"][:50]
                result["note"] = "Rows truncated to 50 for context length."
                observation = json.dumps(result, ensure_ascii=False, indent=2)

        yield {"type": "observation", "content": observation}

        # Feed the observation back into the conversation
        messages.append({
            "role": "user", 
            "content": f"Observation: {observation}\n\nContinue."
        })

    # Exceeded max iterations
    yield {
        "type": "error", 
        "content": f"Agent exceeded {MAX_AGENT_ITERATIONS} iterations without a final answer."
    }
