import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Define Mock Server State & Endpoints
  const TYPES = ["image", "audio", "text", "image", "text"];
  const STATUSES = ["in_progress", "InProgress", "done", "QA", "todo", "BLOCKED"];
  const USERS = [
    { id: "u1", name: "Asha" },
    { id: "u2", name: "Ben" },
    { id: "u3", name: "Chen" },
    null,
  ];

  function makeTask(i: number) {
    const type = i % 11 === 0 ? "video" : TYPES[i % TYPES.length];
    const status = STATUSES[i % STATUSES.length];
    const assignee = USERS[i % USERS.length];
    const useIso = i % 2 === 0;
    const updatedAt = 1719600000000 + i * 37000;
    return {
      id: `t${i}`,
      title: `Task ${i}`,
      type,
      status,
      assignee,
      annotationCount: i % 3 === 0 ? String(i) : i,
      updatedAt: useIso ? new Date(updatedAt).toISOString() : updatedAt,
      meta: i % 4 === 0 ? { priority: "high", note: "rush" } : {},
    };
  }

  const ALL = Array.from({ length: 137 }, (_, i) => makeTask(i + 1));

  // GET /api/tasks?page=1&pageSize=20
  app.get("/api/tasks", (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20);
    const start = (page - 1) * pageSize;
    const items = ALL.slice(start, start + pageSize);
    const delay = page % 3 === 0 ? 1200 : 200;
    setTimeout(() => {
      res.json({ page, pageSize, total: ALL.length, items });
    }, delay);
  });

  // GET /api/tasks/:id
  app.get("/api/tasks/:id", (req, res) => {
    const t = ALL.find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: "not found" });
    res.json(t);
  });

  // GET /api/tasks/:id/summary -> SSE streaming
  app.get("/api/tasks/:id/summary", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const id = req.params.id;
    const chunks = [
      `## Summary for ${id}\n\n`,
      `This task is **in progress**. Recent activity:\n\n`,
      `- 3 annotations added\n- 1 review pending\n\n`,
      "```ts\nconst score = computeQuality(task); // sample code block\n```\n\n",
      `Reviewer note: looks good, _ship it_.\n\n`,
      `<img src=x onerror="alert('xss-img')">\n\n`,
      `<script>alert('xss-script')</script>\n\n`,
      `Done.\n`,
    ];
    let i = 0;
    const timer = setInterval(() => {
      if (i >= chunks.length) {
        res.write("event: done\ndata: end\n\n");
        clearInterval(timer);
        return res.end();
      }
      res.write(`data: ${JSON.stringify(chunks[i])}\n\n`);
      i += 1;
    }, 400);
    req.on("close", () => clearInterval(timer));
  });

  // Setup HTTP server
  const server = http.createServer(app);

  // Setup WebSocket server at path "/ws"
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      const t = ALL[n % ALL.length];
      const kinds = [
        { kind: "task.updated", payload: { id: t.id, status: STATUSES[n % STATUSES.length], updatedAt: Date.now() } },
        { kind: "task.assigned", payload: { id: t.id, assignee: USERS[n % USERS.length] } },
        { kind: "annotation.created", payload: { taskId: t.id, by: "u1", at: Date.now() } },
        // references a task that may be beyond the loaded page, handle it gracefully:
        { kind: "task.updated", payload: { id: `t${120 + (n % 17)}`, status: "done", updatedAt: Date.now() } },
      ];
      ws.send(JSON.stringify(kinds[n % kinds.length]));
    }, 2000);
    ws.on("close", () => clearInterval(timer));
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
