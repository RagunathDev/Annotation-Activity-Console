# Engineering Decisions & Trade-offs

This document outlines the architectural decisions, security practices, caching strategies, and edge-case handling implemented in the Annotation Activity Console, as well as the findings from the Part 2 Bug Hunt.

---

## Part 2: Bug Hunt (buggy/TaskTicker.tsx)

Below is the diagnosis and remedy of the five distinct defects discovered in the original `TaskTicker.tsx` component:

1. **Clock State Closure Bug (Section A)**
   * **Root Cause**: The `setInterval` closure captures the initial value of `tick` (which is `0`) because the `useEffect` hook has an empty dependency array (`[]`) and does not re-register. Consequently, `setTick(tick + 1)` always evaluates to `setTick(0 + 1)`, setting `tick` to `1` repeatedly on every tick.
   * **Correction**: Changed to the functional updater form `setTick((prev) => prev + 1)`. This guarantees React always receives the most current state of `tick` regardless of closures.

2. **State Mutation / Non-Rerender Bug (Section B)**
   * **Root Cause**: Doing `prev.push(t)` directly mutates the existing state array in-place. Moreover, returning the exact same array reference (`prev`) to React causes it to assume state hasn't changed, failing to trigger a re-render.
   * **Correction**: Avoided in-place array mutation by utilizing the spread operator `[...prev, t]` to return a brand new array reference containing the appended task.

3. **In-Render State Mutation Bug (Section C)**
   * **Root Cause**: Calling `tasks.sort(...)` directly inside the render phase mutates the original `tasks` state array in-place. Direct mutation of states inside rendering violates React's pure-rendering contract and can induce infinite re-render loops or corrupt view-state history.
   * **Correction**: Copied the array with the spread operator prior to sorting: `[...tasks].sort(...)`, protecting the underlying React state from unintended mutations.

4. **Index-Based Key Prop Bug (Section C)**
   * **Root Cause**: Using the array index `key={i}` during list rendering is a dangerous anti-pattern when list order fluctuates (e.g. via sorting). It tricks React into reusing stale DOM structures or animations for the wrong logical nodes.
   * **Correction**: Configured the unique task ID `key={t.id}` as the stable element key, enabling React to correctly track list shifts.

5. **Initial Null Fetch & Race Condition Bug (Section B)**
   * **Root Cause**: When the component first mounts, `selectedId` is `null`. The hook fires a fetch request to `${apiBase}/api/tasks/null`, which immediately fails with a 404 from the server. Furthermore, rapid selections trigger multiple overlapping fetches without cancelling previous ones, creating network race conditions.
   * **Correction**: Guarded the fetch call with `if (!selectedId) return;` and integrated an `AbortController` cleanup to cancel obsolete fetch requests.

---

## Part 3: Architectural Decisions

### 1. Key Decisions & Trade-offs

* **Redux Toolkit (Thunks vs RTK Query)**:
  * **Decision**: We selected **Redux Toolkit (with `createSlice`, `createEntityAdapter`, and Async Thunks)** over RTK Query.
  * **Trade-off / Justification**: Since real-time events from the WebSocket feed frequently update or augment the task database state (including adding tasks that are completely unknown to the client), a traditional thunk-based flow gives us surgical control over the store. We can easily dispatch events to insert/upsert/modify entities within a single, unified state model. `createEntityAdapter` was utilized to maintain normalized, high-performance task mappings.

* **Normalization Approach**:
  * **Decision**: Clean model isolation inside `/src/types.ts` with a strong discriminated union on `type` (`"image" | "audio" | "text" | "unknown"`) and a normalized status enum (`TaskStatus`).
  * **Justification**: Slicing the messy, unstructured payload into strict Typescript types prevents low-quality "any dumping grounds" and eliminates runtime errors.

* **Real-time Event Merge Strategy**:
  * **Decision**: If a WebSocket update comes in for a task ID that we haven't loaded in the current paginated view, the custom hook `useTaskFeed` triggers an on-demand, lazy-fetch dispatch (`fetchSingleTask(id)`) to request the full model from `/api/tasks/:id` before applying the update.
  * **Justification**: This prevents displaying corrupt or partially empty task list entries in the UI while ensuring real-time state integrity.

### 2. Streamed Markdown Rendering & Security (Sanitization)

* **Streaming Mechanism**: We implemented a `ReadableStream` reader within a custom `useTaskSummary` hook to decode raw byte streams incrementally as they arrive. This updates React state on every chunk to deliver smooth, real-time "text typing" effects.
* **Security & Sanitization**: 
  * The streamed data contains hostile scripts and elements (e.g., `<script>alert('xss-script')</script>` and `<img src=x onerror="...">`).
  * **Sanitization** is executed at the rendering layer inside `/src/components/SafeMarkdown.tsx`.
  * After our parser compiles markdown blocks into HTML, we run **`DOMPurify.sanitize(html)`** with a strict whitelist of allowed tags and attributes.
  * *Why this is safe*: `DOMPurify` strips the dangerous `onerror` attributes from images and completely excises the `<script>` tag and its children from the HTML before it is injected using `dangerouslySetInnerHTML`. 

### 3. Client-Side Persistence (IndexedDB Caching)

* **Storage Tool**: We used **`localforage`** as a non-blocking, asynchronous layer over IndexedDB to handle large task caches without stalling the browser's main thread.
* **Flow**:
  * On mount, we fire `loadCachedTasks()` to immediately populate the Redux store with the last saved state.
  * Simultaneously, we dispatch a fresh network fetch `fetchTasksPage({ page, pageSize })` to revalidate task records.
  * **Stale State Indicator**: If the store is populated via cache, we flag `isFromCache: true`. The UI displays a amber warning badge: `"Loaded from Cache (Syncing...)"` so users are immediately aware that they are looking at stale data until the fresh server response lands.

### 4. Edge Cases & Messy Data Handling

* **What we handled**:
  * Normalized status strings to lowercase, stripped special characters, and matched against `TaskStatus` to handle values like `"in_progress"`, `"InProgress"`, and `"done"`.
  * Parsed mixed epoch millisecond numbers and ISO date strings to consistent epoch millisecond numbers.
  * Parsed stringified or missing `annotationCount` variables into valid integers.
  * Safely captured unstructured dynamic `meta` payloads into a strict `Record<string, string>` map.
* **What we deliberately didn't handle**:
  * We did not implement full-form field validation for nested custom properties beyond converting them to string representations, as these vary based on format and are not critical for overall console orchestration.

---

## What We'd Do Differently / Future Iterations

1. **Virtualization**: For lists with thousands of items, we would integrate `@tanstack/react-virtual` to virtualize the task catalog, rendering only visible DOM nodes.
2. **WebSocket Batching**: For rapid server events, we would throttle WebSocket state dispatches to avoid overloading the React scheduler.
