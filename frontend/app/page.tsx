/**
 * app/page.tsx — Practical SQL Agent landing page & chat interface.
 * Features:
 *   - Clean, professional UI/UX without marketing filler
 *   - Custom SQL Agent vector logo in Navbar and Browser Tab
 *   - Dynamic suggestions based strictly on user's uploaded tables
 *   - Non-redundant navbar
 *   - Comprehensive Table Manager (Delete tables, Add new tables via CSV or Schema, Inspect)
 *   - Direct quick-table filter chips
 *   - Instant back navigation without scrolling
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { AgentStep, streamQuery, uploadCSV, fetchTablesSummary, TableSummary } from "@/lib/api";
import { StepCard } from "@/components/StepCard";
import { ResultTable } from "@/components/ResultTable";
import { UploadPanel } from "@/components/UploadPanel";
import { Logo } from "@/components/Logo";

interface Message {
  id: string;
  question: string;
  steps: AgentStep[];
  finalRows: Record<string, unknown>[] | null;
  isLoading: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [tablesList, setTablesList] = useState<TableSummary[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clickedButtonId, setClickedButtonId] = useState<string | null>(null);
  const [navUploading, setNavUploading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navFileInputRef = useRef<HTMLInputElement>(null);

  // Load table list for quick navigation chips & counts
  const refreshTables = async () => {
    try {
      const summaries = await fetchTablesSummary();
      setTablesList(summaries);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refreshTables();
  }, [isSidebarOpen]);

  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isLoading = messages.some((m) => m.isLoading);

  const triggerClickFeedback = (id: string, callback?: () => void) => {
    setClickedButtonId(id);
    setTimeout(() => {
      setClickedButtonId(null);
      if (callback) callback();
    }, 180);
  };

  const handleReturnToHome = () => {
    triggerClickFeedback("btn-return-home", () => {
      setMessages([]);
      setInput("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const handleSubmit = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const id = crypto.randomUUID();
    const newMsg: Message = {
      id,
      question: question.trim(),
      steps: [],
      finalRows: null,
      isLoading: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");

    await streamQuery(
      question.trim(),
      (step) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, steps: [...m.steps, step] } : m
          )
        );

        if (step.type === "observation") {
          try {
            const data = JSON.parse(step.content);
            if (Array.isArray(data.rows) && data.rows.length > 0) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === id ? { ...m, finalRows: data.rows } : m
                )
              );
            }
          } catch {
            // not JSON rows
          }
        }
      },
      () => {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isLoading: false } : m))
        );
      },
      (error) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  isLoading: false,
                  steps: [...m.steps, { type: "error", content: error }],
                }
              : m
          )
        );
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  // Direct CSV upload from navbar
  const handleNavFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNavUploading(true);
    try {
      const res = await uploadCSV(file);
      setActiveTable(res.table);
      await refreshTables();
      setIsSidebarOpen(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setNavUploading(false);
      e.target.value = "";
    }
  };

  // Dynamic suggested queries based on activeTable or uploaded tables
  const getDynamicSuggestions = (): string[] => {
    if (activeTable) {
      return [
        `Show the first 10 rows of ${activeTable}`,
        `Count the total number of records in ${activeTable}`,
        `What are the columns and data types in ${activeTable}?`,
        `Find distinct values and summary statistics for ${activeTable}`,
      ];
    }

    if (tablesList.length > 0) {
      const firstTable = tablesList[0].name;
      return [
        `List all available tables and their row counts`,
        `Show the first 10 rows from ${firstTable}`,
        `How many total records are stored across all tables?`,
        `Which table has the most records in the database?`,
      ];
    }

    return [
      "Upload a CSV file to start asking questions",
      "How do I upload custom data to this agent?",
    ];
  };

  const currentSuggestions = getDynamicSuggestions();

  return (
    <div className="relative min-h-screen w-full bg-[#03050d] text-white flex flex-col justify-between overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* Hidden file input for navbar Upload CSV */}
      <input
        ref={navFileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleNavFileUpload}
      />

      {/* ── Ambient Background Lighting ────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[#03050d]" />
        <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-[#020409] via-[#03050d]/80 to-transparent z-10" />
        <div className="absolute -bottom-28 -right-20 w-[780px] h-[780px] rounded-full bg-blue-600/35 blur-[150px] animate-glow-pulse pointer-events-none" />
        <div className="absolute bottom-16 right-28 w-[500px] h-[500px] rounded-full bg-blue-500/25 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-28 -left-28 w-[650px] h-[650px] rounded-full bg-blue-800/30 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-12 left-36 w-[400px] h-[400px] rounded-full bg-indigo-700/20 blur-[110px] pointer-events-none" />
        <div className="absolute -bottom-48 left-1/3 w-[600px] h-[500px] rounded-full bg-blue-700/20 blur-[140px] pointer-events-none" />
      </div>

      {/* ── Practical, Clean Navbar with Logo ───────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full bg-[#03050d]/85 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          {/* Brand Logo & Back Button */}
          <div className="flex items-center gap-3">
            {messages.length > 0 ? (
              <button
                onClick={handleReturnToHome}
                className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 active:scale-95 transition-all duration-150 cursor-pointer shadow-sm"
              >
                <span className="text-blue-400 group-hover:-translate-x-1 transition-transform duration-150 text-base leading-none">
                  ←
                </span>
                <span>Back to Search</span>
              </button>
            ) : (
              <div
                className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform duration-150"
                onClick={() => {
                  setActiveTable(null);
                  setMessages([]);
                }}
              >
                {/* Custom Brand Logo */}
                <Logo className="w-8 h-8" />
                <div>
                  <span className="text-base font-bold tracking-tight text-white block leading-tight">
                    SQL Agent
                  </span>
                  <span className="text-[10px] text-zinc-400 block font-mono">
                    Natural Language to SQL
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Action Controls: Manage Tables & Upload CSV */}
          <div className="flex items-center gap-2.5">
            {messages.length > 0 && (
              <button
                onClick={handleReturnToHome}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 active:scale-95 transition-all cursor-pointer"
              >
                <span>＋</span>
                <span>New Query</span>
              </button>
            )}

            {/* Manage Tables Drawer Trigger */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-zinc-200 bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 active:scale-95 backdrop-blur-md transition-all cursor-pointer flex items-center gap-2"
              title="Add, delete, or inspect tables"
            >
              <span>📂</span>
              <span>Manage Tables</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-white/[0.1] text-zinc-300">
                {tablesList.length}
              </span>
            </button>

            {/* Direct Upload CSV Button */}
            <button
              onClick={() => navFileInputRef.current?.click()}
              disabled={navUploading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all cursor-pointer disabled:opacity-50"
            >
              {navUploading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>＋</span>
                  <span>Upload CSV</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ─────────────────────────────────────────────────── */}
      <main className="relative z-20 flex-1 flex flex-col justify-center items-center px-4 sm:px-6 w-full max-w-5xl mx-auto my-auto py-10">
        {messages.length === 0 ? (
          /* ── Practical Hero Landing View ─────────────────────────────────── */
          <div className="w-full flex flex-col items-center text-center">
            {/* Practical Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-[-0.03em] leading-[1.12] max-w-2xl mx-auto animate-landing-1">
              Ask your database in plain English
            </h1>

            {/* Practical Subtitle */}
            <p className="text-zinc-300/80 text-sm sm:text-base font-normal leading-relaxed max-w-xl mx-auto mt-3 mb-6 tracking-[-0.01em] animate-landing-2">
              Upload your own CSV files and query your data directly. The AI agent inspects your tables, writes verified SQL, and returns clean results.
            </p>

            {/* ── Quick Table Selector Chips ───────────────────────────────── */}
            <div className="mb-5 flex flex-wrap items-center justify-center gap-1.5 max-w-2xl animate-landing-3">
              {tablesList.length > 0 ? (
                <>
                  <span className="text-[11px] font-medium text-zinc-400 mr-1">
                    Context:
                  </span>

                  {/* All tables option */}
                  <button
                    onClick={() => setActiveTable(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                      activeTable === null
                        ? "bg-white text-black font-semibold shadow-sm"
                        : "bg-white/[0.04] text-zinc-400 hover:text-white border border-white/10"
                    }`}
                  >
                    All Tables ({tablesList.length})
                  </button>

                  {/* User uploaded table chips */}
                  {tablesList.map((t) => {
                    const isSelected = activeTable === t.name;
                    return (
                      <button
                        key={t.name}
                        onClick={() => setActiveTable(isSelected ? null : t.name)}
                        className={`px-3 py-1 rounded-full text-xs font-mono transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-blue-600 text-white font-bold border border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                            : "bg-white/[0.04] text-zinc-300 hover:text-white border border-white/10 hover:border-white/20"
                        }`}
                      >
                        <span>📋 {t.name}</span>
                        <span className="text-[10px] opacity-70">({t.row_count} rows)</span>
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 cursor-pointer transition-all ml-1"
                    title="Manage tables: delete or add"
                  >
                    ＋ Manage
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="px-4 py-2 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-xs text-blue-300 hover:bg-blue-600/25 transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>📁</span>
                  <span>No tables loaded yet — Click to upload your first CSV file</span>
                </button>
              )}
            </div>

            {/* ── Search / Query Input Bar ─────────────────────────────────── */}
            <div className="w-full max-w-2xl mx-auto animate-landing-4">
              <div className="w-full bg-[#12141d]/90 border border-white/[0.14] hover:border-white/25 focus-within:border-blue-500/70 rounded-2xl pl-5 pr-2.5 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl flex items-center gap-3 transition-all duration-200">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    activeTable
                      ? `Ask a question about '${activeTable}'... (e.g. summarize data, filter records)`
                      : tablesList.length > 0
                      ? "Ask any question about your data... (e.g. Show records, aggregate values)"
                      : "Upload a CSV to start querying..."
                  }
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-zinc-500 text-sm sm:text-base font-normal tracking-[-0.01em]"
                />
                <button
                  onClick={() => handleSubmit(input)}
                  disabled={isLoading || !input.trim()}
                  className="group w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-90 disabled:opacity-40 text-white flex items-center justify-center shadow-[0_0_18px_rgba(37,99,235,0.5)] transition-all duration-150 flex-shrink-0 cursor-pointer"
                  title="Run natural language query"
                >
                  {isLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    <span className="font-bold text-sm leading-none group-hover:-translate-y-0.5 transition-transform duration-150">
                      ↑
                    </span>
                  )}
                </button>
              </div>

              {/* ── Dynamic Suggested Queries ──────────────────────────────── */}
              <div className="mt-4 flex flex-col items-center gap-2 animate-landing-5">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span>💡 Try asking:</span>
                  {activeTable && (
                    <span className="font-mono text-blue-300">[{activeTable}]</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-2xl mt-1">
                  {currentSuggestions.map((q, idx) => {
                    const btnKey = `sugg-${idx}`;
                    const isClicked = clickedButtonId === btnKey;
                    return (
                      <button
                        key={q}
                        onClick={() => {
                          triggerClickFeedback(btnKey, () => {
                            if (tablesList.length === 0) {
                              setIsSidebarOpen(true);
                            } else {
                              handleSubmit(q);
                            }
                          });
                        }}
                        className="text-xs px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] active:scale-95 border border-white/[0.08] hover:border-white/20 text-zinc-300 hover:text-white transition-all duration-150 backdrop-blur-md cursor-pointer flex items-center gap-1.5"
                      >
                        {isClicked && (
                          <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                        )}
                        <span>{q}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Active Conversation Stream View ────────────────────────────── */
          <div className="w-full max-w-4xl flex flex-col gap-6 py-4 pb-36 animate-fade-in">
            {/* Top Session Bar with Instant Back Button */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleReturnToHome}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 active:scale-95 transition-all duration-150 cursor-pointer shadow-sm"
                >
                  <span className="text-blue-400 group-hover:-translate-x-1 transition-transform duration-150 text-sm leading-none">
                    ←
                  </span>
                  <span>Back to Search</span>
                </button>

                {activeTable && (
                  <span className="px-2.5 py-1 rounded-xl text-xs font-mono bg-white/[0.06] text-blue-300 border border-white/10">
                    Table: {activeTable}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                >
                  📂 Tables ({tablesList.length})
                </button>
                <button
                  onClick={handleReturnToHome}
                  className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  ✕ Clear session
                </button>
              </div>
            </div>

            {/* Conversation Messages List */}
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-4">
                {/* User Prompt */}
                <div className="flex justify-end">
                  <div className="max-w-xl px-5 py-2.5 rounded-2xl bg-blue-600/90 text-white text-sm font-medium shadow-[0_0_20px_rgba(37,99,235,0.35)] border border-blue-400/30">
                    {msg.question}
                  </div>
                </div>

                {/* Agent Steps */}
                <div className="space-y-3 max-w-3xl">
                  {msg.steps.map((step, i) => (
                    <StepCard key={i} step={step} index={i} />
                  ))}

                  {/* Loading pulse */}
                  {msg.isLoading && (
                    <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-zinc-300">
                        Agent is reasoning, inspecting schema, and running SQL...
                      </span>
                    </div>
                  )}

                  {/* Final Result Table */}
                  {!msg.isLoading && msg.finalRows && (
                    <div className="mt-5 space-y-2">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                        Query Result Table
                      </p>
                      <ResultTable rows={msg.finalRows} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* ── Fixed Floating Bottom Navigation & Input Bar ───────────────────── */}
      {messages.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-[#03050d] via-[#03050d]/95 to-transparent">
          <div className="max-w-2xl mx-auto flex flex-col gap-2">
            <div className="flex items-center justify-between px-2">
              <button
                onClick={handleReturnToHome}
                className="group flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 backdrop-blur-md active:scale-95 transition-all duration-150 cursor-pointer shadow-md"
              >
                <span className="text-blue-400 group-hover:-translate-x-0.5 transition-transform">
                  ←
                </span>
                <span>Back to Search</span>
              </button>

              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 active:scale-95 transition-all cursor-pointer"
              >
                <span>↑</span>
                <span>Top</span>
              </button>
            </div>

            <div className="w-full bg-[#12141d]/90 border border-white/[0.14] hover:border-white/25 focus-within:border-blue-500/70 rounded-2xl pl-5 pr-2.5 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl flex items-center gap-3 transition-all duration-200">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask another question about your database..."
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-zinc-500 text-sm sm:text-base font-normal tracking-[-0.01em]"
              />
              <button
                onClick={() => handleSubmit(input)}
                disabled={isLoading || !input.trim()}
                className="group w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-90 disabled:opacity-40 text-white flex items-center justify-center shadow-[0_0_18px_rgba(37,99,235,0.6)] transition-all duration-150 flex-shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <span className="font-bold text-sm leading-none group-hover:-translate-y-0.5 transition-transform duration-150">
                    ↑
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-Out Table & Data Manager Drawer ───────────────────────────── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />

          <div className="relative z-10 w-full max-w-md h-full bg-[#070914]/95 border-l border-white/10 backdrop-blur-3xl p-6 flex flex-col justify-between overflow-y-auto shadow-2xl">
            <div>
              {/* Drawer Header with Logo */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <Logo className="w-7 h-7" />
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">
                      Table & Data Manager
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Manage, delete, create, or import database tables
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 flex items-center justify-center text-xs text-zinc-300 hover:text-white active:scale-90 transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Active Table Notification */}
              {activeTable && (
                <div className="mb-4 p-3 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-between animate-fade-in">
                  <div>
                    <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest">
                      Active Table Context
                    </span>
                    <p className="text-xs font-mono font-bold text-white">
                      {activeTable}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTable(null)}
                    className="text-[11px] text-zinc-400 hover:text-rose-300 hover:underline active:scale-95 transition-all cursor-pointer"
                  >
                    Clear filter
                  </button>
                </div>
              )}

              {/* Upload & Table Management Panel */}
              <UploadPanel
                activeTable={activeTable}
                onSelectTable={(tableName) => {
                  setActiveTable(tableName);
                  refreshTables();
                  setIsSidebarOpen(false);
                  setTimeout(() => inputRef.current?.focus(), 150);
                }}
                onTableDeleted={(tableName) => {
                  if (activeTable === tableName) {
                    setActiveTable(null);
                  }
                  refreshTables();
                }}
              />
            </div>

            <div className="pt-5 mt-6 border-t border-white/5 text-[11px] text-zinc-500 text-center">
              Natural Language SQL Agent • Query your CSV data directly
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
