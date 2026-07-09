var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_http = __toESM(require("http"), 1);
var import_ws = require("ws");
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_vite = require("vite");
var import_meta = {};
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use((0, import_cors.default)());
  app.use(import_express.default.json());
  const TYPES = ["image", "audio", "text", "image", "text"];
  const STATUSES = ["in_progress", "InProgress", "done", "QA", "todo", "BLOCKED"];
  const USERS = [
    { id: "u1", name: "Asha" },
    { id: "u2", name: "Ben" },
    { id: "u3", name: "Chen" },
    null
  ];
  function makeTask(i) {
    const type = i % 11 === 0 ? "video" : TYPES[i % TYPES.length];
    const status = STATUSES[i % STATUSES.length];
    const assignee = USERS[i % USERS.length];
    const useIso = i % 2 === 0;
    const updatedAt = 17196e8 + i * 37e3;
    return {
      id: `t${i}`,
      title: `Task ${i}`,
      type,
      status,
      assignee,
      annotationCount: i % 3 === 0 ? String(i) : i,
      updatedAt: useIso ? new Date(updatedAt).toISOString() : updatedAt,
      meta: i % 4 === 0 ? { priority: "high", note: "rush" } : {}
    };
  }
  const ALL = Array.from({ length: 137 }, (_, i) => makeTask(i + 1));
  app.get("/api/tasks", (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const start = (page - 1) * pageSize;
    const items = ALL.slice(start, start + pageSize);
    const delay = page % 3 === 0 ? 1200 : 200;
    setTimeout(() => {
      res.json({ page, pageSize, total: ALL.length, items });
    }, delay);
  });
  app.get("/api/tasks/:id", (req, res) => {
    const t = ALL.find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: "not found" });
    res.json(t);
  });
  app.get("/api/tasks/:id/summary", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const id = req.params.id;
    const chunks = [
      `## Summary for ${id}

`,
      `This task is **in progress**. Recent activity:

`,
      `- 3 annotations added
- 1 review pending

`,
      "```ts\nconst score = computeQuality(task); // sample code block\n```\n\n",
      `Reviewer note: looks good, _ship it_.

`,
      `<img src=x onerror="alert('xss-img')">

`,
      `<script>alert('xss-script')</script>

`,
      `Done.
`
    ];
    let i = 0;
    const timer = setInterval(() => {
      if (i >= chunks.length) {
        res.write("event: done\ndata: end\n\n");
        clearInterval(timer);
        return res.end();
      }
      res.write(`data: ${JSON.stringify(chunks[i])}

`);
      i += 1;
    }, 400);
    req.on("close", () => clearInterval(timer));
  });
  const server = import_http.default.createServer(app);
  const wss = new import_ws.WebSocketServer({ server, path: "/ws" });
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
        { kind: "task.updated", payload: { id: `t${120 + n % 17}`, status: "done", updatedAt: Date.now() } }
      ];
      ws.send(JSON.stringify(kinds[n % kinds.length]));
    }, 2e3);
    ws.on("close", () => clearInterval(timer));
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
