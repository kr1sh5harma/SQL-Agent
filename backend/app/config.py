"""
config.py — Central configuration using environment variables.
Load a .env file with your GROQ_API_KEY before starting the server.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Groq ─────────────────────────────────────────────────────────────────────
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

# ── Database ──────────────────────────────────────────────────────────────────
DATA_DIR: str = os.path.join(os.path.dirname(__file__), "..", "data")
DEFAULT_DB_PATH: str = os.path.join(DATA_DIR, "default.db")

# ── Agent ─────────────────────────────────────────────────────────────────────
MAX_AGENT_ITERATIONS: int = 10   # hard limit to prevent runaway loops
