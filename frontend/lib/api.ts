/**
 * lib/api.ts — Type-safe API client for the SQL Agent backend.
 *
 * Why fetch() instead of EventSource?
 *   EventSource only supports GET requests. Our /query endpoint is POST
 *   (because we send a JSON body). So we use fetch() with streaming
 *   and manually parse the SSE format: "data: {...}\n\n"
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StepType = "thought" | "action" | "observation" | "answer" | "error" | "done";

export interface AgentStep {
  type: StepType;
  content: string;
}

export interface TableInfo {
  table: string;
  columns: Array<{ name: string; type: string }>;
  sample_rows: Record<string, unknown>[];
}

export interface TableSummary {
  name: string;
  row_count: number;
  column_count: number;
  columns: string[];
}

// ── Stream query ──────────────────────────────────────────────────────────────

/**
 * Ask the agent a question and stream back each step.
 * Calls the onStep callback for each event received.
 * Calls onDone when the stream completes.
 */
export async function streamQuery(
  question: string,
  onStep: (step: AgentStep) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      onError(`Server error: ${response.status} ${response.statusText}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("No response body.");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by "\n\n"
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? ""; // keep incomplete last chunk

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(line.slice(6)); // strip "data: "
          if (json.type === "done") {
            onDone();
            return;
          }
          onStep(json as AgentStep);
        } catch {
          // malformed SSE line, skip
        }
      }
    }

    onDone();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    onError(msg);
  }
}

// ── Upload CSV ────────────────────────────────────────────────────────────────

export async function uploadCSV(file: File): Promise<{ message: string; table: string }> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/upload-csv`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail ?? "Upload failed");
  }

  return res.json();
}

// ── Schema helpers ────────────────────────────────────────────────────────────

export async function fetchTables(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/tables`);
  const data = await res.json();
  return data.tables ?? [];
}

export async function fetchTablesSummary(): Promise<TableSummary[]> {
  const res = await fetch(`${API_BASE}/tables-summary`);
  const data = await res.json();
  return data.tables ?? [];
}

export async function deleteTable(tableName: string): Promise<{ message: string; table: string }> {
  const res = await fetch(`${API_BASE}/tables/${encodeURIComponent(tableName)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Delete failed" }));
    throw new Error(err.detail ?? "Failed to delete table");
  }
  return res.json();
}

export async function createTable(
  tableName: string,
  columns: Array<{ name: string; type: string }>
): Promise<{ message: string; table: string }> {
  const res = await fetch(`${API_BASE}/create-table`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table_name: tableName, columns }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Create failed" }));
    throw new Error(err.detail ?? "Failed to create table");
  }
  return res.json();
}

export async function resetDemoTables(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/reset-demo`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Reset failed" }));
    throw new Error(err.detail ?? "Failed to reset demo tables");
  }
  return res.json();
}

export async function fetchTableInfo(name: string): Promise<TableInfo> {
  const res = await fetch(`${API_BASE}/tables/${encodeURIComponent(name)}`);
  return res.json();
}
