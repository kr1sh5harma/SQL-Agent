/**
 * components/ResultTable.tsx — Renders SQL result rows as a sleek glassmorphic table.
 */
"use client";

interface Props {
  rows: Record<string, unknown>[];
}

export function ResultTable({ rows }: Props) {
  if (!rows || rows.length === 0) {
    return <p className="text-zinc-400 text-sm italic">No rows returned.</p>;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl shadow-2xl">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead>
            <tr className="bg-white/[0.04] border-b border-white/10">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-xs font-semibold text-zinc-300 uppercase tracking-wider whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-white/[0.03] transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-2.5 text-zinc-200 whitespace-nowrap font-mono text-xs sm:text-sm"
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-xs text-zinc-400 font-medium">
        <span>Displaying {rows.length} row{rows.length !== 1 ? "s" : ""}</span>
        <span className="text-blue-400/80">SQLite verified</span>
      </div>
    </div>
  );
}
