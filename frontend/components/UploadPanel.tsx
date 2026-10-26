/**
 * components/UploadPanel.tsx — Complete Table & Data Manager.
 * Supports:
 *   - Browsing tables with row and column counts
 *   - Selecting active table context
 *   - Deleting existing tables (with safety confirmation)
 *   - Adding new tables via CSV upload or custom schema creation
 *   - Resetting default demo tables
 */
"use client";

import { useState, useEffect } from "react";
import {
  uploadCSV,
  fetchTablesSummary,
  deleteTable,
  createTable,
  resetDemoTables,
  fetchTableInfo,
  TableSummary,
  TableInfo,
} from "@/lib/api";

interface Props {
  onSelectTable: (tableName: string) => void;
  onTableDeleted?: (tableName: string) => void;
  activeTable?: string | null;
}

const SQLITE_TYPES = ["TEXT", "INTEGER", "REAL", "BLOB", "INTEGER PRIMARY KEY"];

export function UploadPanel({ onSelectTable, onTableDeleted, activeTable }: Props) {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [panelTab, setPanelTab] = useState<"tables" | "upload" | "create">("tables");

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Table deletion safety state
  const [confirmDeleteTable, setConfirmDeleteTable] = useState<string | null>(null);
  const [deletingTable, setDeletingTable] = useState<string | null>(null);

  // Table schema inspect modal
  const [inspectingTable, setInspectingTable] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);

  // Manual table creation state
  const [newTableName, setNewTableName] = useState("");
  const [columns, setColumns] = useState<Array<{ name: string; type: string }>>([
    { name: "id", type: "INTEGER PRIMARY KEY" },
    { name: "title", type: "TEXT" },
  ]);
  const [creating, setCreating] = useState(false);

  // Demo tables reset state
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadTables = async () => {
    setRefreshing(true);
    try {
      const summaries = await fetchTablesSummary();
      setTables(summaries);
    } catch {
      /* ignore */
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  // CSV Upload handler
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);
    try {
      const result = await uploadCSV(file);
      setMessage({ text: `✅ ${result.message}` });
      onSelectTable(result.table);
      await loadTables();
      setPanelTab("tables");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setMessage({ text: `❌ ${msg}`, isError: true });
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  // Delete table handler
  const handleDeleteTable = async (tableName: string) => {
    setDeletingTable(tableName);
    setMessage(null);
    try {
      const res = await deleteTable(tableName);
      setMessage({ text: `🗑️ ${res.message}` });
      setConfirmDeleteTable(null);
      if (activeTable === tableName && onTableDeleted) {
        onTableDeleted(tableName);
      }
      await loadTables();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete table";
      setMessage({ text: `❌ ${msg}`, isError: true });
    } finally {
      setDeletingTable(null);
    }
  };

  // Manual table creation handler
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;

    setCreating(true);
    setMessage(null);
    try {
      const res = await createTable(newTableName.trim(), columns);
      setMessage({ text: `✅ ${res.message}` });
      setNewTableName("");
      setColumns([
        { name: "id", type: "INTEGER PRIMARY KEY" },
        { name: "title", type: "TEXT" },
      ]);
      onSelectTable(res.table);
      await loadTables();
      setPanelTab("tables");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Creation failed";
      setMessage({ text: `❌ ${msg}`, isError: true });
    } finally {
      setCreating(false);
    }
  };

  // Inspect table schema
  const handleInspect = async (tableName: string) => {
    setInspectingTable(tableName);
    try {
      const info = await fetchTableInfo(tableName);
      setTableInfo(info);
    } catch {
      setTableInfo(null);
    }
  };

  // Reset demo tables handler
  const handleResetDemo = async () => {
    setResetting(true);
    setMessage(null);
    try {
      const res = await resetDemoTables();
      setMessage({ text: `✅ ${res.message}` });
      setConfirmReset(false);
      await loadTables();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      setMessage({ text: `❌ ${msg}`, isError: true });
    } finally {
      setResetting(false);
    }
  };

  const addColumnRow = () => {
    setColumns([...columns, { name: "", type: "TEXT" }]);
  };

  const removeColumnRow = (idx: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== idx));
  };

  const updateColumn = (idx: number, field: "name" | "type", val: string) => {
    const updated = [...columns];
    updated[idx] = { ...updated[idx], [field]: val };
    setColumns(updated);
  };

  return (
    <div className="flex flex-col gap-4 text-left">
      {/* ── Sub Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-xl text-xs font-medium">
        <button
          onClick={() => setPanelTab("tables")}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
            panelTab === "tables"
              ? "bg-white text-black font-semibold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Tables ({tables.length})
        </button>
        <button
          onClick={() => setPanelTab("upload")}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
            panelTab === "upload"
              ? "bg-white text-black font-semibold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          ＋ Upload CSV
        </button>
        <button
          onClick={() => setPanelTab("create")}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
            panelTab === "create"
              ? "bg-white text-black font-semibold shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          ＋ New Table
        </button>
      </div>

      {/* Global message banner */}
      {message && (
        <div
          className={`p-2.5 rounded-xl border text-xs leading-relaxed animate-fade-in flex items-center justify-between ${
            message.isError
              ? "bg-rose-950/40 border-rose-800/50 text-rose-300"
              : "bg-emerald-950/40 border-emerald-800/50 text-emerald-200"
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-[11px] opacity-70 hover:opacity-100 ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── TAB 1: Existing Tables ────────────────────────────────────────── */}
      {panelTab === "tables" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">
              Click a table to set query context
            </span>
            <button
              onClick={loadTables}
              disabled={refreshing}
              className="text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
            >
              <span className={refreshing ? "animate-spin-subtle inline-block" : ""}>↻</span>
              <span>Refresh</span>
            </button>
          </div>

          {tables.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center text-xs text-zinc-500 space-y-2">
              <p>No tables found in database.</p>
              <button
                onClick={() => setPanelTab("upload")}
                className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-medium cursor-pointer"
              >
                Upload a CSV to start
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
              {tables.map((t) => {
                const isSelected = activeTable === t.name;
                const isDeleting = deletingTable === t.name;
                const isConfirming = confirmDeleteTable === t.name;

                return (
                  <div
                    key={t.name}
                    className={`p-3 rounded-2xl border transition-all duration-150 ${
                      isSelected
                        ? "bg-blue-600/15 border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                        : "bg-white/[0.03] border-white/5 hover:border-white/15 hover:bg-white/[0.05]"
                    }`}
                  >
                    {/* Header: Name + Badge */}
                    <div className="flex items-center justify-between mb-1.5">
                      <button
                        onClick={() => onSelectTable(t.name)}
                        className="flex items-center gap-2 cursor-pointer text-left truncate flex-1"
                      >
                        <span className={isSelected ? "text-blue-400" : "text-zinc-500"}>
                          📋
                        </span>
                        <span className="font-mono text-xs font-bold text-white truncate">
                          {t.name}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 font-mono">
                          {t.row_count} rows
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Columns Preview */}
                    <p className="text-[11px] text-zinc-400 font-mono truncate mb-2.5">
                      {t.columns.length > 0 ? t.columns.join(", ") : "No columns"}
                    </p>

                    {/* Actions row: Select, Inspect, Delete */}
                    {isConfirming ? (
                      /* Safety Confirmation Box */
                      <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-center justify-between text-xs animate-fade-in">
                        <span className="text-rose-300 text-[11px]">Delete table?</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDeleteTable(t.name)}
                            disabled={isDeleting}
                            className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px] active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? "Deleting..." : "Yes, Delete"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteTable(null)}
                            className="px-2 py-1 rounded-md bg-white/[0.08] hover:bg-white/[0.15] text-zinc-300 text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.05] text-[11px]">
                        <button
                          onClick={() => onSelectTable(t.name)}
                          className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                        >
                          {isSelected ? "Selected ✓" : "Set as active table →"}
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleInspect(t.name)}
                            className="text-zinc-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer"
                            title="Inspect schema"
                          >
                            🔍 Inspect
                          </button>

                          {/* Delete Table Button */}
                          <button
                            onClick={() => setConfirmDeleteTable(t.name)}
                            className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 active:scale-90 transition-all cursor-pointer"
                            title="Delete this table"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions footer */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500">
            <span>{tables.length} table{tables.length === 1 ? "" : "s"} loaded</span>
            <button
              onClick={() => setPanelTab("upload")}
              className="text-blue-400 hover:text-blue-300 text-xs font-medium cursor-pointer"
            >
              ＋ Upload another CSV
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 2: Upload CSV ──────────────────────────────────────────────── */}
      {panelTab === "upload" && (
        <div className="flex flex-col gap-3">
          <label className="group relative flex flex-col items-center justify-center gap-2.5 w-full h-36 border border-dashed border-white/20 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-600/[0.04] active:scale-[0.99] transition-all bg-white/[0.02]">
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-blue-300">
                  Parsing & loading CSV into database...
                </span>
              </div>
            ) : (
              <>
                <span className="text-3xl group-hover:scale-110 transition-transform">📁</span>
                <span className="text-xs font-medium text-zinc-200 group-hover:text-white">
                  Click or drag .csv file to import
                </span>
                <span className="text-[11px] text-zinc-500">
                  Table name is derived from filename automatically
                </span>
              </>
            )}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVUpload}
              disabled={loading}
            />
          </label>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            CSV columns become table columns. Data types are inferred automatically (Integer, Real, Text).
          </p>
        </div>
      )}

      {/* ── TAB 3: Create Custom Table ────────────────────────────────────── */}
      {panelTab === "create" && (
        <form onSubmit={handleCreateTable} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Table Name
            </label>
            <input
              type="text"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="e.g. inventory, employees"
              required
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Columns ({columns.length})
              </label>
              <button
                type="button"
                onClick={addColumnRow}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
              >
                ＋ Add Column
              </button>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {columns.map((col, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => updateColumn(idx, "name", e.target.value)}
                    placeholder="Column name"
                    required
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white font-mono placeholder:text-zinc-600 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <select
                    value={col.type}
                    onChange={(e) => updateColumn(idx, "type", e.target.value)}
                    className="w-32 px-2 py-1.5 rounded-lg bg-[#0e1220] border border-white/10 text-zinc-300 text-xs focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
                  >
                    {SQLITE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeColumnRow(idx)}
                    disabled={columns.length <= 1}
                    className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || !newTableName.trim()}
            className="mt-1 w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md disabled:opacity-40 transition-all cursor-pointer"
          >
            {creating ? "Creating table..." : "Create Table"}
          </button>
        </form>
      )}

      {/* ── Table Schema Inspection Modal ─────────────────────────────────── */}
      {inspectingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setInspectingTable(null)}
          />

          <div className="relative z-10 w-full max-w-lg bg-[#090c1a] border border-white/15 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-white">
                  📋 {inspectingTable}
                </span>
                <span className="text-[10px] text-zinc-400">Schema preview</span>
              </div>
              <button
                onClick={() => setInspectingTable(null)}
                className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {tableInfo ? (
              <div className="space-y-3 text-xs">
                <div>
                  <h4 className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-1.5">
                    Columns ({tableInfo.columns.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {tableInfo.columns.map((c) => (
                      <span
                        key={c.name}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 font-mono text-zinc-200"
                      >
                        {c.name}{" "}
                        <span className="text-[10px] text-blue-400">({c.type})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {tableInfo.sample_rows.length > 0 && (
                  <div>
                    <h4 className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-1.5">
                      Sample Rows ({tableInfo.sample_rows.length})
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-white/10 max-h-48">
                      <table className="min-w-full text-[11px] font-mono text-left">
                        <thead className="bg-white/[0.05] border-b border-white/10">
                          <tr>
                            {Object.keys(tableInfo.sample_rows[0]).map((k) => (
                              <th key={k} className="px-2.5 py-1.5 text-zinc-300">
                                {k}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {tableInfo.sample_rows.map((r, i) => (
                            <tr key={i} className="hover:bg-white/[0.02]">
                              {Object.keys(tableInfo.sample_rows[0]).map((k) => (
                                <td key={k} className="px-2.5 py-1 text-zinc-400 whitespace-nowrap">
                                  {String(r[k] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic py-4 text-center">
                Loading schema details...
              </p>
            )}

            <div className="mt-4 pt-3 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => {
                  onSelectTable(inspectingTable);
                  setInspectingTable(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
              >
                Set as Active Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
