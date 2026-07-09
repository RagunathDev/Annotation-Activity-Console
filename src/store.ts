import {
  configureStore,
  createSlice,
  createEntityAdapter,
  createAsyncThunk,
  createSelector,
  PayloadAction,
} from "@reduxjs/toolkit";
import { Task, TasksState, TaskStatus } from "./types";
import { normalizeTask, normalizeStatus } from "./normalize";
import localforage from "localforage";

const CACHE_KEY = "annotator_tasks_cache_v1";

// 1. Entity Adapter Setup
export const tasksAdapter = createEntityAdapter<Task>({
  sortComparer: (a, b) => b.updatedAt - a.updatedAt,
});

// 2. Async Thunk: Fetch Paginated Tasks
export const fetchTasksPage = createAsyncThunk(
  "tasks/fetchPage",
  async ({ page, pageSize }: { page: number; pageSize: number }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks?page=${page}&pageSize=${pageSize}`);
      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }
      const data = await response.json();
      
      const normalizedItems = (data.items || []).map((item: any) => normalizeTask(item));
      return {
        items: normalizedItems,
        total: data.total || 0,
        page: data.page || page,
        pageSize: data.pageSize || pageSize,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch tasks.");
    }
  }
);

// 3. Async Thunk: Fetch Single Task (Lazy load unknown tasks from WebSocket feed)
export const fetchSingleTask = createAsyncThunk(
  "tasks/fetchSingle",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${id}`);
      if (!response.ok) {
        throw new Error(`Task ${id} not found on server`);
      }
      const data = await response.json();
      return normalizeTask(data);
    } catch (error: any) {
      return rejectWithValue(error.message || `Failed to fetch task ${id}`);
    }
  }
);

// 4. Async Thunk: Load Tasks Cache from IndexedDB
export const loadCachedTasks = createAsyncThunk(
  "tasks/loadCached",
  async (_, { rejectWithValue }) => {
    try {
      const cached = await localforage.getItem<{
        ids: string[];
        entities: Record<string, Task>;
        totalTasks: number;
        currentPage: number;
      }>(CACHE_KEY);
      return cached;
    } catch (error) {
      return rejectWithValue("Failed to load IndexedDB cache.");
    }
  }
);

// Helpers to save to IndexedDB asynchronously
const saveStateToCache = async (state: any) => {
  try {
    await localforage.setItem(CACHE_KEY, {
      ids: state.ids,
      entities: state.entities,
      totalTasks: state.totalTasks,
      currentPage: state.currentPage,
    });
  } catch (err) {
    console.error("IndexedDB write failed", err);
  }
};

const initialState: TasksState = tasksAdapter.getInitialState({
  currentPage: 1,
  pageSize: 20,
  totalTasks: 0,
  loading: false,
  error: null,
  isFromCache: false,
});

// 5. Tasks Slice Definition
const tasksSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    // Process real-time update events
    receiveWebSocketEvent(state, action: PayloadAction<any>) {
      const { kind, payload } = action.payload;
      if (!payload) return;

      if (kind === "task.updated") {
        const { id, status, updatedAt } = payload;
        const existing = state.entities[id];
        if (existing) {
          existing.status = normalizeStatus(status);
          if (updatedAt) {
            existing.updatedAt = typeof updatedAt === "string" ? Date.parse(updatedAt) : updatedAt;
          }
        }
      } else if (kind === "task.assigned") {
        const { id, assignee } = payload;
        const existing = state.entities[id];
        if (existing) {
          existing.assignee = assignee;
        }
      } else if (kind === "annotation.created") {
        const { taskId, at } = payload;
        const existing = state.entities[taskId];
        if (existing) {
          existing.annotationCount += 1;
          if (at) {
            existing.updatedAt = typeof at === "string" ? Date.parse(at) : at;
          }
        }
      }
      
      // Update cache after real-time changes
      saveStateToCache(state);
    },
    // Clear cache/reset
    clearCache(state) {
      state.isFromCache = false;
      localforage.removeItem(CACHE_KEY);
    }
  },
  extraReducers: (builder) => {
    builder
      // loadCachedTasks
      .addCase(loadCachedTasks.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadCachedTasks.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          tasksAdapter.setAll(state, Object.values(action.payload.entities));
          state.totalTasks = action.payload.totalTasks;
          state.currentPage = action.payload.currentPage;
          state.isFromCache = true;
        }
      })
      .addCase(loadCachedTasks.rejected, (state) => {
        state.loading = false;
      })
      
      // fetchTasksPage
      .addCase(fetchTasksPage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasksPage.fulfilled, (state, action) => {
        state.loading = false;
        state.isFromCache = false; // Mark as fresh server data
        state.totalTasks = action.payload.total;
        state.currentPage = action.payload.page;
        state.pageSize = action.payload.pageSize;
        
        // Use upsertMany to merge pagination results beautifully or setAll
        // Let's use setAll for the loaded page so that we align with page selection,
        // or upsertMany to collect tasks in memory but remember the subset.
        // Let's set all tasks so that we refresh the list cleanly when page switches
        tasksAdapter.setAll(state, action.payload.items);
        
        // Write fresh data to cache
        saveStateToCache(state);
      })
      .addCase(fetchTasksPage.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to load tasks.";
      })
      
      // fetchSingleTask (WebSocket fallback loader)
      .addCase(fetchSingleTask.fulfilled, (state, action) => {
        tasksAdapter.upsertOne(state, action.payload);
        saveStateToCache(state);
      });
  },
});

export const { receiveWebSocketEvent, clearCache } = tasksSlice.actions;

// 6. Filters Slice Definition
export interface FiltersState {
  search: string;
  type: string;
  status: string;
  sortBy: "updatedAt" | "annotationCount" | "title";
  sortOrder: "asc" | "desc";
}

const initialFiltersState: FiltersState = {
  search: "",
  type: "all",
  status: "all",
  sortBy: "updatedAt",
  sortOrder: "desc",
};

const filtersSlice = createSlice({
  name: "filters",
  initialState: initialFiltersState,
  reducers: {
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setTypeFilter(state, action: PayloadAction<string>) {
      state.type = action.payload;
    },
    setStatusFilter(state, action: PayloadAction<string>) {
      state.status = action.payload;
    },
    setSortBy(state, action: PayloadAction<"updatedAt" | "annotationCount" | "title">) {
      state.sortBy = action.payload;
    },
    toggleSortOrder(state) {
      state.sortOrder = state.sortOrder === "desc" ? "asc" : "desc";
    },
    setFilters(state, action: PayloadAction<Partial<FiltersState>>) {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setSearch,
  setTypeFilter,
  setStatusFilter,
  setSortBy,
  toggleSortOrder,
  setFilters,
} = filtersSlice.actions;

// 7. Store Setup
export const store = configureStore({
  reducer: {
    tasks: tasksSlice.reducer,
    filters: filtersSlice.reducer,
  },
});

// Types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// 8. Selectors
const selectTasksState = (state: RootState) => state.tasks;
export const selectFilters = (state: RootState) => state.filters;

export const {
  selectAll: selectAllTasks,
  selectById: selectTaskById,
} = tasksAdapter.getSelectors(selectTasksState);

export const selectTasksLoading = (state: RootState) => state.tasks.loading;
export const selectTasksError = (state: RootState) => state.tasks.error;
export const selectTotalTasks = (state: RootState) => state.tasks.totalTasks;
export const selectCurrentPage = (state: RootState) => state.tasks.currentPage;
export const selectPageSize = (state: RootState) => state.tasks.pageSize;
export const selectIsFromCache = (state: RootState) => state.tasks.isFromCache;

// Fully memoized selector for filtering, searching, and sorting
export const selectFilteredAndSortedTasks = createSelector(
  [selectAllTasks, selectFilters],
  (tasks, filters) => {
    let result = [...tasks];

    // Filter by type
    if (filters.type && filters.type !== "all") {
      result = result.filter((t) => t.type === filters.type);
    }

    // Filter by status
    if (filters.status && filters.status !== "all") {
      result = result.filter((t) => t.status === filters.status);
    }

    // Filter by Search Query (Case insensitive on ID, Title, and Assignee Name)
    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter((t) => {
        return (
          t.id.toLowerCase().includes(query) ||
          t.title.toLowerCase().includes(query) ||
          (t.assignee && t.assignee.name.toLowerCase().includes(query))
        );
      });
    }

    // Dynamic Sort
    const { sortBy, sortOrder } = filters;
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "updatedAt") {
        comparison = a.updatedAt - b.updatedAt;
      } else if (sortBy === "annotationCount") {
        comparison = a.annotationCount - b.annotationCount;
      } else if (sortBy === "title") {
        comparison = a.title.localeCompare(b.title);
      }

      return sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }
);
