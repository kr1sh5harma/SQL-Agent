"""
tools.py — The three tools available to the SQL agent.

Tools are plain Python functions. The agent decides which to call using
a ReAct (Reasoning + Acting) loop. Each function takes the DatabaseManager
as its first argument plus tool-specific args, and returns a JSON-serializable result.

Why not LangChain tools?
  LangChain tools add a heavy abstraction layer. Since we only have 3 tools,
  plain functions are clearer, faster, and easier to debug.
"""

import json
from app.database import DatabaseManager


# ── Tool definitions ──────────────────────────────────────────────────────────

def list_tables(db: DatabaseManager) -> dict:
    """
    Tool: list_tables
    Returns all table names in the connected database.
    The agent calls this first to understand what data is available.
    """
    tables = db.list_tables()
    return {"tables": tables, "count": len(tables)}


def describe_table(db: DatabaseManager, table_name: str) -> dict:
    """
    Tool: describe_table
    Returns column names, types, and 3 sample rows for a given table.
    The agent uses this to understand what columns exist before writing SQL.
    """
    try:
        schema = db.describe_table(table_name)
        samples = db.sample_rows(table_name, n=3)
        return {
            "table": table_name,
            "columns": [{"name": c["name"], "type": c["type"]} for c in schema],
            "sample_rows": samples,
        }
    except ValueError as e:
        return {"error": str(e)}


def run_sql(db: DatabaseManager, sql: str) -> dict:
    """
    Tool: run_sql
    Executes a SQL query and returns the result rows (up to 200 rows).
    For SELECT queries → returns rows as list of dicts.
    For other queries → returns rowcount.
    """
    try:
        rows = db.execute_query(sql)
        # Cap at 200 rows to keep token usage sane
        truncated = len(rows) > 200
        return {
            "sql": sql,
            "rows": rows[:200],
            "total_rows": len(rows),
            "truncated": truncated,
        }
    except RuntimeError as e:
        return {"error": str(e), "sql": sql}


# ── Tool registry ─────────────────────────────────────────────────────────────
# The agent uses this to look up tool functions by name.

TOOLS = {
    "list_tables": list_tables,
    "describe_table": describe_table,
    "run_sql": run_sql,
}

# Human-readable tool descriptions injected into the system prompt
TOOL_DESCRIPTIONS = """
You have access to the following tools:

1. list_tables()
   → Lists all tables in the database.
   → Use this first if you don't know the schema.
   → Returns: {"tables": [...], "count": N}

2. describe_table(table_name: str)
   → Returns column names, types, and 3 sample rows for a table.
   → Use this before writing SQL to understand the structure.
   → Returns: {"table": "...", "columns": [...], "sample_rows": [...]}

3. run_sql(sql: str)
   → Executes a SQL query and returns the result.
   → Use this to get the final answer.
   → Returns: {"rows": [...], "total_rows": N, "truncated": bool}
   → On error: {"error": "...", "sql": "..."}
""".strip()
