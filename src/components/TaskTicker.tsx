import React, { useEffect, useState } from "react";

type Task = { id: string; title: string; updatedAt: number };

export function TaskTicker({ apiBase }: { apiBase: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // (A) FIXED: use functional update setTick((prev) => prev + 1) to avoid capturing stale state (tick=0)
  useEffect(() => {
    const id = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // (B) FIXED: Guard against selectedId being null, handle race conditions with AbortController, and respect immutability
  useEffect(() => {
    if (!selectedId) return;

    const controller = new AbortController();
    
    fetch(`${apiBase}/api/tasks/${selectedId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch task");
        return r.json();
      })
      .then((t) => {
        setTasks((prev) => {
          // Avoid adding duplicate tasks
          if (prev.some((existing) => existing.id === t.id)) {
            return prev.map((existing) => (existing.id === t.id ? t : existing));
          }
          // Return new array instead of mutating in-place with push()
          return [...prev, t];
        });
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Error in TaskTicker fetch:", err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [apiBase, selectedId]);

  // (C) FIXED: Copy tasks array with spread operator before sorting to prevent direct state mutation during render
  const sorted = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
      <h3 className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3 italic font-serif">
        Recent Activity Ticker
      </h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No tasks selected yet. Click on any task to track it here.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((t) => {
            const secondsAgo = Math.max(0, Math.floor((Date.now() - t.updatedAt) / 1000));
            return (
              <li
                key={t.id} // FIXED: Use unique task ID instead of array index for key prop
                onClick={() => setSelectedId(t.id)}
                className={`text-xs p-2.5 rounded-md cursor-pointer transition-all duration-200 border font-mono ${
                  selectedId === t.id
                    ? "bg-blue-50 border-blue-200 text-blue-900 font-semibold"
                    : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="truncate mr-2">{t.title}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {secondsAgo}s ago
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
