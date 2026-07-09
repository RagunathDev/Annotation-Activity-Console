# Annotation Activity Console

A responsive, high-performance, and secure Full-Stack developer portal for managing annotation activities (image, audio, and text tasks). It supports real-time WebSocket feeds, paginated server data views, offline IndexedDB persistence, and secure, sanitized SSE-streamed AI summaries.

## Key Features

1. **Robust Data Normalizer**: Sanitizes messy casing/spelling in statuses, variable timestamp formats (ISO strings vs epoch-ms), and stringified counts into a clean, strictly typed discriminated union task model.
2. **Unified Redux Store**: Implements standard Redux Toolkit with `createEntityAdapter` to hold normalized state, along with memoized selectors for dynamic search, multi-faceted filtering, and sorting.
3. **Real-time Event Synchronization**: A custom React WebSocket hook (`useTaskFeed`) that connects to `/ws`, auto-reconnects, and handles out-of-order events by lazy-fetching missing tasks fully from the server.
4. **Incremental Streamed AI Summary**: Custom SSE reader (`useTaskSummary`) that streams markdown summaries chunk-by-chunk and aborts active streams on task switches.
5. **DOMPurify Sanitization**: Renders markdown and code blocks securely, stripping high-risk XSS injection vectors (scripts, event handlers) safely.
6. **IndexedDB Caching**: Persists task list locally using `localforage`. Instantly loads cached state on startup and displays a status indicator warning of "stale data" until the revalidation fetch resolves.
7. **Bento Grid Layout**: Visually pleasing split-screen design presenting search filters, dynamic metrics, task catalogs, active details, and a corrected `TaskTicker` recent-activity feed.

---

## Getting Started

### 1. Installation
Install all backend and frontend dependencies:
```bash
npm install
```

### 2. Run the Full-Stack Application
Start the integrated Express backend + Vite frontend server on port `3000`:
```bash
npm run dev
```

### 3. Run the Test Suite
Execute the Vitest suite covering normalizers, selectors, and RTL component actions:
```bash
npm run test
```

---

## Project Structure
* `server.ts` - Clean Full-Stack Express Server (serving Mock REST APIs, SSE Streams, WebSocket server at `/ws` and proxying Vite assets)
* `src/types.ts` - Clean, discriminated-union domain types
* `src/normalize.ts` - Data sanitization and raw parsing logic
* `src/store.ts` - Redux store configuration, slices, and memoized selectors
* `src/hooks/` - Custom WebSocket and SSE stream hooks
* `src/components/` - Sanitized Markdown and corrected Activity Ticker components
* `src/App.test.tsx` - Vitest and React Testing Library tests
* `DECISIONS.md` - In-depth breakdown of architectural choices and Bug Hunt diagnosis
