# 🗃️ SQL Agent — Natural Language to SQL

An AI agent that answers questions about your database in plain English.
Uses **Groq** for ultra-fast inference and **SQLite** for secure, deterministic local execution.

Upload any CSV file, explore schemas, create or delete tables, and query your data using natural language with live streamed reasoning and formatted data tables.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **ReAct Agent** | Thinks step-by-step: inspects schema → writes SQL → executes → verifies |
| ⚡ **Groq LLM** | Ultra-fast inference with free tier support |
| 📡 **Live Streaming** | Each reasoning step (Thought, Action, Observation, Answer) streams via SSE |
| 📂 **CSV Ingestion** | Drop any `.csv` file and query it immediately |
| 🛠️ **Table Management** | Browse schemas, inspect sample rows, create tables, or delete existing tables |
| 🎨 **Modern Dark UI** | Next.js 16 + Tailwind CSS with ambient glow and clean typography |
| 🔒 **Safe SQL Execution** | Queries run against SQLite with error recovery |

---

## 📐 Architecture

```
User Question
      │
      ▼
Next.js Frontend ───POST /query───▶ FastAPI Backend
      │                                    │
      │ ◀─── SSE Stream of Steps ─────────┤
      │                               ReAct Loop:
      │                               1. list_tables()
      │                               2. describe_table(t)
      │                               3. run_sql(...)
      │                               4. Final Answer
      ▼
Chat UI renders:
🧠 Thinking  |  ⚙️ Tool Call  |  📊 Result Table  |  ✅ Final Answer
```

---

## 🚀 Quick Start (Local Development)

### 1. Get a free Groq API key
Go to [console.groq.com](https://console.groq.com) → Create API Key.

### 2. Set up the Backend
```bash
cd backend
cp .env.example .env
# Edit .env and paste your GROQ_API_KEY

python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Set up the Frontend
```bash
cd frontend
cp .env.example .env.local

npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser 🎉

---

## 📁 Project Structure

```
sql-agent/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── agent.py      ← ReAct loop (core logic)
│   │   ├── tools.py      ← list_tables, describe_table, run_sql
│   │   ├── database.py   ← SQLite manager + CSV loader + table manager
│   │   └── config.py     ← Settings from .env
│   ├── main.py           ← FastAPI server + SSE streaming + CRUD endpoints
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── page.tsx      ← Main chat UI & table manager
│   │   ├── layout.tsx
│   │   ├── icon.svg      ← Favicon for browser tab
│   │   └── globals.css   ← Ambient theme styling & animations
│   ├── components/
│   │   ├── Logo.tsx      ← Brand vector logo
│   │   ├── StepCard.tsx  ← Reasoning step card
│   │   ├── ResultTable.tsx ← Glassmorphic SQL result table
│   │   └── UploadPanel.tsx ← Table & data manager drawer
│   └── lib/
│       └── api.ts        ← API client + SSE stream reader
└── seed_db.py            ← Optional demo database generator
```

---

## 🌐 Deployment Guide

### Deploy Backend (e.g. Render / Railway / VPS)
1. **Root Directory:** `backend`
2. **Build Command:** `pip install -r requirements.txt`
3. **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables:**
   - `GROQ_API_KEY`: Your Groq API key
   - `GROQ_MODEL`: `qwen/qwen3.8-27b` or `llama-3.1-70b-versatile`

### Deploy Frontend (Vercel)
1. Import repository on [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Set **Environment Variable:**
   - `NEXT_PUBLIC_API_URL`: Your deployed backend URL (e.g. `https://your-backend.onrender.com`).
4. Click **Deploy**.

---

## 📄 License
MIT License
