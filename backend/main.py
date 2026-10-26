"""
main.py — FastAPI server for the SQL Agent.

Endpoints:
  POST /query          → Stream agent steps as Server-Sent Events (SSE)
  POST /upload-csv     → Upload a CSV file and load it as a table
  GET  /tables         → List all tables in the active database
  GET  /tables/{name}  → Describe a specific table (columns + samples)
  GET  /health         → Health check

SSE (Server-Sent Events):
  We use SSE instead of WebSockets because:
  - It's one-directional (server → client), which is all we need
  - Works natively in browsers with EventSource API
  - Simpler to implement and debug than WebSockets

The frontend receives a stream of JSON events:
  data: {"type": "thought", "content": "I should list tables first."}
  data: {"type": "action", "content": "list_tables()"}
  data: {"type": "observation", "content": "{\"tables\": [...]}"}
  data: {"type": "answer", "content": "There are 5 products..."}
"""

import os
import re
import json
import uuid
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.database import DatabaseManager
from app.agent import run_agent
from app.config import DEFAULT_DB_PATH, DATA_DIR


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database connection when the server starts."""
    os.makedirs(DATA_DIR, exist_ok=True)
    app.state.db = DatabaseManager(DEFAULT_DB_PATH)
    print(f"[OK] Database connected: {DEFAULT_DB_PATH}")
    yield
    app.state.db.close()
    print("Database connection closed.")


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="SQL Agent API",
    description="Natural language to SQL powered by Groq llama-3.1-70b",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response models ───────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str


class ColumnDef(BaseModel):
    name: str
    type: str = "TEXT"


class CreateTableRequest(BaseModel):
    table_name: str
    columns: list[ColumnDef]


# ── SSE helper ────────────────────────────────────────────────────────────────

async def event_stream(question: str, db: DatabaseManager) -> AsyncGenerator[str, None]:
    """
    Run the agent in a background thread and stream each step in real time
    via an asyncio.Queue, avoiding long pauses or unhandled exceptions that
    cause ERR_INCOMPLETE_CHUNKED_ENCODING.
    """
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def _worker():
        try:
            for step in run_agent(question, db):
                loop.call_soon_threadsafe(queue.put_nowait, step)
        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "content": str(e)})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, {"type": "done"})

    # Launch worker in thread pool
    asyncio.create_task(asyncio.to_thread(_worker))

    while True:
        step = await queue.get()
        payload = json.dumps(step, ensure_ascii=False)
        yield f"data: {payload}\n\n"
        if step.get("type") == "done":
            break


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/query")
async def query(request: QueryRequest):
    """
    Stream agent reasoning steps as Server-Sent Events.
    The frontend should use EventSource or fetch with stream reading.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    db: DatabaseManager = app.state.db
    return StreamingResponse(
        event_stream(request.question, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering if behind proxy
        },
    )


@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """
    Upload a CSV file. It will be loaded into a table named after the filename
    (without extension, spaces → underscores).
    """
    if not (file.filename and file.filename.lower().endswith(".csv")):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    # Derive safe table name from filename
    raw_name = os.path.splitext(file.filename)[0]
    table_name = re.sub(r"[^a-zA-Z0-9_]", "_", raw_name.strip().lower())
    table_name = re.sub(r"_+", "_", table_name).strip("_")
    if not table_name or table_name[0].isdigit():
        table_name = f"t_{table_name}" if table_name else "uploaded_table"

    # Save uploaded file temporarily
    temp_path = os.path.join(DATA_DIR, f"_upload_{uuid.uuid4().hex}.csv")
    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)

        db: DatabaseManager = app.state.db
        message = db.load_csv(temp_path, table_name)
        return {"status": "ok", "message": message, "table": table_name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.get("/tables")
async def list_tables():
    """List all tables in the connected database."""
    db: DatabaseManager = app.state.db
    tables = db.list_tables()
    return {"tables": tables}


@app.get("/tables-summary")
async def tables_summary():
    """List all tables with row count and column information."""
    db: DatabaseManager = app.state.db
    summary = db.get_tables_summary()
    return {"tables": summary}


@app.delete("/tables/{table_name}")
async def delete_table(table_name: str):
    """Delete (drop) a table from the database."""
    db: DatabaseManager = app.state.db
    try:
        msg = db.delete_table(table_name)
        return {"status": "ok", "message": msg, "table": table_name}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/create-table")
async def create_table(request: CreateTableRequest):
    """Create a new empty table with defined columns."""
    db: DatabaseManager = app.state.db
    try:
        cols = [c.model_dump() for c in request.columns]
        msg = db.create_table(request.table_name, cols)
        return {"status": "ok", "message": msg, "table": request.table_name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/reset-demo")
async def reset_demo():
    """Reset the standard demo tables (products, customers, orders)."""
    db: DatabaseManager = app.state.db
    try:
        msg = db.reset_demo()
        return {"status": "ok", "message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tables/{table_name}")
async def describe_table(table_name: str):
    """Get schema and sample rows for a specific table."""
    db: DatabaseManager = app.state.db
    try:
        schema = db.describe_table(table_name)
        samples = db.sample_rows(table_name)
        return {"table": table_name, "columns": schema, "sample_rows": samples}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "model": "llama-3.1-70b-versatile", "backend": "groq"}
