import React, { useState, useEffect } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import {
  store,
  RootState,
  AppDispatch,
  fetchTasksPage,
  loadCachedTasks,
  setSearch,
  setTypeFilter,
  setStatusFilter,
  setSortBy,
  toggleSortOrder,
  selectFilteredAndSortedTasks,
  selectTasksLoading,
  selectTasksError,
  selectTotalTasks,
  selectCurrentPage,
  selectPageSize,
  selectIsFromCache,
  selectFilters,
} from "./store";
import { useTaskFeed } from "./hooks/useTaskFeed";
import { useTaskSummary } from "./hooks/useTaskSummary";
import { SafeMarkdown } from "./components/SafeMarkdown";
import { TaskTicker } from "./components/TaskTicker";
import { TaskStatus, Task } from "./types";
import {
  Search,
  RotateCcw,
  Database,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  HelpCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Clock,
  User,
  Layers,
  Sparkles,
} from "lucide-react";

// Get appropriate Tailwind classes for each task status matching the Professional Polish palette
function getStatusBadgeClass(status: TaskStatus) {
  switch (status) {
    case TaskStatus.IN_PROGRESS:
      return "bg-blue-100 text-blue-700 border border-blue-200";
    case TaskStatus.DONE:
      return "bg-green-100 text-green-700 border border-green-200";
    case TaskStatus.QA:
      return "bg-purple-100 text-purple-700 border border-purple-200";
    case TaskStatus.TODO:
      return "bg-slate-100 text-slate-700 border border-slate-200";
    case TaskStatus.BLOCKED:
      return "bg-red-100 text-red-700 border border-red-200";
    default:
      return "bg-amber-100 text-amber-700 border border-amber-200";
  }
}

// Get appropriate icons for status
function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case TaskStatus.IN_PROGRESS:
      return <PlayCircle className="w-3 h-3 mr-1 animate-pulse shrink-0" />;
    case TaskStatus.DONE:
      return <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" />;
    case TaskStatus.QA:
      return <Layers className="w-3 h-3 mr-1 shrink-0" />;
    case TaskStatus.BLOCKED:
      return <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />;
    default:
      return <HelpCircle className="w-3 h-3 mr-1 shrink-0" />;
  }
}

// Format relative times (e.g. "2m ago", "Just now") like the design HTML
function formatRelativeTime(epochMs: number) {
  const diffMs = Date.now() - epochMs;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 10) return "Now";
  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(epochMs).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DashboardContent() {
  const dispatch = useDispatch<AppDispatch>();
  
  // Connect to live updates WS stream
  const { connected: wsConnected } = useTaskFeed();

  // Selected Task State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Real-time server/UTC clock
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hrs = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      const secs = String(now.getUTCSeconds()).padStart(2, '0');
      setCurrentTime(`${hrs}:${mins}:${secs} UTC`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Redux Selectors
  const tasks = useSelector(selectFilteredAndSortedTasks);
  const loading = useSelector(selectTasksLoading);
  const error = useSelector(selectTasksError);
  const totalTasks = useSelector(selectTotalTasks);
  const currentPage = useSelector(selectCurrentPage);
  const pageSize = useSelector(selectPageSize);
  const isFromCache = useSelector(selectIsFromCache);
  const filters = useSelector(selectFilters);

  // Selected Task details lookup
  const selectedTask = useSelector((state: RootState) =>
    selectedTaskId ? state.tasks.entities[selectedTaskId] : null
  );

  // Summary Stream custom hook
  const {
    summary: streamedSummary,
    loading: summaryStreaming,
    error: summaryError,
  } = useTaskSummary(selectedTaskId);

  // Initial Load Cache, then Revalidate from Server
  useEffect(() => {
    dispatch(loadCachedTasks()).then(() => {
      dispatch(fetchTasksPage({ page: 1, pageSize }));
    });
  }, [dispatch, pageSize]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    dispatch(fetchTasksPage({ page: newPage, pageSize }));
  };

  // State-driven sidebar navigation item clicks
  const handleSidebarNavClick = (type: string, status: string) => {
    dispatch(setTypeFilter(type));
    dispatch(setStatusFilter(status));
  };

  // Determine active item styling in sidebar
  const isSidebarItemActive = (type: string, status: string) => {
    return filters.type === type && filters.status === status;
  };

  // Derived metrics / stats of loaded tasks (Tasks per Status)
  const stats = React.useMemo(() => {
    const counts = {
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.DONE]: 0,
      [TaskStatus.QA]: 0,
      [TaskStatus.TODO]: 0,
      [TaskStatus.BLOCKED]: 0,
      [TaskStatus.UNKNOWN]: 0,
    };
    tasks.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row overflow-x-hidden font-sans border border-slate-200 shadow-2xl relative">
      
      {/* 1. Sidebar Panel (Aside) */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col border-b md:border-b-0 md:border-r border-slate-800 shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg text-white">K</div>
          <span className="text-xl font-semibold tracking-tight text-white">KRONOS CORE</span>
        </div>
        
        {/* State-driven Navigation Links */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          <button
            onClick={() => handleSidebarNavClick("all", "all")}
            className={`w-full flex items-center px-4 py-3 text-sm rounded-md transition-colors cursor-pointer text-left ${
              isSidebarItemActive("all", "all")
                ? "bg-blue-600 text-white font-medium"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 mr-3 opacity-80 flex items-center">●</span> All Datasets
          </button>
          
          <button
            onClick={() => handleSidebarNavClick("image", "all")}
            className={`w-full flex items-center px-4 py-3 text-sm rounded-md transition-colors cursor-pointer text-left ${
              isSidebarItemActive("image", "all")
                ? "bg-blue-600 text-white font-medium"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 mr-3 opacity-80 flex items-center">🖼️</span> Image Fleet
          </button>

          <button
            onClick={() => handleSidebarNavClick("audio", "all")}
            className={`w-full flex items-center px-4 py-3 text-sm rounded-md transition-colors cursor-pointer text-left ${
              isSidebarItemActive("audio", "all")
                ? "bg-blue-600 text-white font-medium"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 mr-3 opacity-80 flex items-center">🎵</span> Audio Fleet
          </button>

          <button
            onClick={() => handleSidebarNavClick("text", "all")}
            className={`w-full flex items-center px-4 py-3 text-sm rounded-md transition-colors cursor-pointer text-left ${
              isSidebarItemActive("text", "all")
                ? "bg-blue-600 text-white font-medium"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 mr-3 opacity-80 flex items-center">📝</span> Text Fleet
          </button>

          <button
            onClick={() => handleSidebarNavClick("all", "BLOCKED")}
            className={`w-full flex items-center px-4 py-3 text-sm rounded-md transition-colors cursor-pointer text-left ${
              isSidebarItemActive("all", "BLOCKED")
                ? "bg-blue-600 text-white font-medium"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 h-5 mr-3 opacity-80 flex items-center text-red-500">⚠️</span> Incidents Log
          </button>
        </nav>

        {/* Dynamic bottom profile updating based on selected task assignee */}
        <div className="p-6 border-t border-slate-800 mt-auto hidden md:block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-200">
              {selectedTask?.assignee ? selectedTask.assignee.name.split(" ").map(n => n[0]).join("") : "MC"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-200 truncate max-w-[140px]">
                {selectedTask?.assignee ? selectedTask.assignee.name : "Marcus Chen"}
              </span>
              <span className="text-xs text-slate-500">
                {selectedTask ? "Active Assignee" : "Lead Architect"}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="h-auto md:h-16 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between px-6 py-4 md:py-0 gap-4 shrink-0">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Operational Dashboard</h2>
              <span className="text-slate-400 text-xs hidden md:inline">|</span>
              <span className="text-xs text-slate-500 font-medium hidden md:inline">Annotation Console</span>
            </div>
            
            <div className="flex gap-2">
              {wsConnected ? (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> ACTIVE
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span> OFFLINE
                </span>
              )}

              {isFromCache ? (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
                  <Database className="w-2.5 h-2.5" /> CACHED
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
                  <Database className="w-2.5 h-2.5" /> SYNCED
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
            <div className="text-left">
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest leading-none">Server Time</p>
              <p className="text-sm font-mono text-slate-700 font-semibold">{currentTime || "00:00:00 UTC"}</p>
            </div>
            <button
              onClick={() => dispatch(fetchTasksPage({ page: currentPage, pageSize }))}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Grid</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <section className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="flex flex-col gap-6 max-w-7xl mx-auto">
            
            {/* Live Key Performance Indicators (KPI Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 italic font-serif">Registry Queue</p>
                <p className="text-3xl font-light text-slate-800">{totalTasks}</p>
                <div className="mt-3 h-1 w-full bg-slate-100 rounded-full">
                  <div className="h-1 bg-blue-600 w-4/5 rounded-full"></div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 italic font-serif">In Progress</p>
                <p className="text-3xl font-light text-slate-800">{stats[TaskStatus.IN_PROGRESS] || 0}</p>
                <p className="text-xs text-blue-600 mt-2 font-medium">↑ Active validation threads</p>
              </div>
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 italic font-serif">QA Approved</p>
                <p className="text-3xl font-light text-slate-800">{stats[TaskStatus.QA] || 0}</p>
                <p className="text-xs text-slate-400 mt-2 uppercase font-mono">Pending final release</p>
              </div>
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 italic font-serif">Blocked Issues</p>
                <p className={`text-3xl font-light ${stats[TaskStatus.BLOCKED] > 0 ? "text-red-600 font-medium" : "text-slate-800"}`}>
                  {String(stats[TaskStatus.BLOCKED] || 0).padStart(2, "0")}
                </p>
                <p className="text-xs text-red-500 mt-2 font-medium">Critical focus items</p>
              </div>
            </div>

            {/* Split Workspace Column */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Filters, Live Metrics and Grid Table (7 Columns) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* Search, Type, Status & Sorting Controls */}
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    
                    {/* Search Field */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search ID, Title, or Assignee..."
                        value={filters.search}
                        onChange={(e) => dispatch(setSearch(e.target.value))}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-slate-50"
                      />
                    </div>

                    {/* Type Filter */}
                    <select
                      value={filters.type}
                      onChange={(e) => dispatch(setTypeFilter(e.target.value))}
                      className="px-3 py-2 border border-slate-200 rounded text-xs bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition-all font-medium text-slate-700"
                    >
                      <option value="all">All Types</option>
                      <option value="image">🖼️ Image</option>
                      <option value="audio">🎵 Audio</option>
                      <option value="text">📝 Text</option>
                      <option value="unknown">❓ Unknown</option>
                    </select>

                    {/* Status Filter */}
                    <select
                      value={filters.status}
                      onChange={(e) => dispatch(setStatusFilter(e.target.value))}
                      className="px-3 py-2 border border-slate-200 rounded text-xs bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition-all font-medium text-slate-700"
                    >
                      <option value="all">All Statuses</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                      <option value="QA">QA Review</option>
                      <option value="TODO">To Do</option>
                      <option value="BLOCKED">Blocked</option>
                    </select>
                  </div>

                  {/* Sorting controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-400">Sort by:</span>
                      <button
                        onClick={() => dispatch(setSortBy("updatedAt"))}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          filters.sortBy === "updatedAt"
                            ? "bg-slate-900 text-white font-medium"
                            : "hover:bg-slate-100"
                        }`}
                      >
                        Last Updated
                      </button>
                      <button
                        onClick={() => dispatch(setSortBy("annotationCount"))}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          filters.sortBy === "annotationCount"
                            ? "bg-slate-900 text-white font-medium"
                            : "hover:bg-slate-100"
                        }`}
                      >
                        Annotations
                      </button>
                      <button
                        onClick={() => dispatch(setSortBy("title"))}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          filters.sortBy === "title"
                            ? "bg-slate-900 text-white font-medium"
                            : "hover:bg-slate-100"
                        }`}
                      >
                        Task Title
                      </button>
                    </div>

                    <button
                      onClick={() => dispatch(toggleSortOrder())}
                      className="flex items-center space-x-1 px-2.5 py-1 border border-slate-200 hover:bg-slate-50 rounded text-slate-700 font-semibold transition-colors cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      <span>{filters.sortOrder === "desc" ? "Descending" : "Ascending"}</span>
                    </button>
                  </div>
                </div>

                {/* Derived Live Metrics List Progress Widgets */}
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex items-center space-x-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs text-slate-500 font-bold uppercase tracking-wider italic font-serif">
                      Derived Live Metrics (Page Tasks: {tasks.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { status: TaskStatus.TODO, label: "To Do", color: "bg-slate-400" },
                      { status: TaskStatus.IN_PROGRESS, label: "In Progress", color: "bg-blue-600" },
                      { status: TaskStatus.QA, label: "QA Review", color: "bg-purple-600" },
                      { status: TaskStatus.DONE, label: "Done", color: "bg-green-600" },
                      { status: TaskStatus.BLOCKED, label: "Blocked", color: "bg-red-600" },
                    ].map((item) => {
                      const count = stats[item.status] || 0;
                      const pct = tasks.length > 0 ? (count / tasks.length) * 100 : 0;
                      return (
                        <div key={item.status} className="bg-slate-50 p-3 rounded border border-slate-100">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                            {item.label}
                          </span>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-lg font-bold text-slate-800">{count}</span>
                            <span className="text-[9px] text-slate-400">({Math.round(pct)}%)</span>
                          </div>
                          <div className="w-full h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full ${item.color} transition-all duration-500`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed Tasks Grid (Main Table Layout) */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
                  
                  {/* Grid Header matching Mockup */}
                  <div className="grid grid-cols-6 p-4 bg-slate-50 border-b border-slate-200 shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">ID</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest italic font-serif col-span-2">Task Title & Assignee</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Format Type</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Status</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest text-right">Last Check</span>
                  </div>

                  {/* Error messaging inside workspace */}
                  {error && (
                    <div className="p-6 m-4 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                      <div>
                        <h4 className="font-bold text-sm">Failed to Load Registry</h4>
                        <p className="text-xs mt-1">{error}</p>
                        <button
                          onClick={() => dispatch(fetchTasksPage({ page: currentPage, pageSize }))}
                          className="mt-3 px-3 py-1.5 bg-white border border-rose-200 text-rose-800 text-xs rounded hover:bg-rose-100/50 font-bold transition-colors cursor-pointer"
                        >
                          Retry Connection
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List rows */}
                  <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
                    {tasks.length === 0 && !loading ? (
                      <div className="p-12 text-center text-slate-400">
                        <Layers className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                        <p className="text-sm font-medium">No tasks found matching current filters.</p>
                        <p className="text-xs mt-1">Try selecting another option in the filters panel or reset query.</p>
                      </div>
                    ) : (
                      tasks.map((task) => (
                        <div
                          key={task.id}
                          id={`task-row-${task.id}`}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`grid grid-cols-6 p-4 items-center cursor-pointer transition-colors text-xs ${
                            selectedTaskId === task.id
                              ? "bg-blue-50/70 border-l-4 border-blue-600"
                              : "hover:bg-slate-50 border-l-4 border-transparent"
                          }`}
                        >
                          <span className="font-mono text-slate-500">#{task.id}</span>
                          <div className="col-span-2 flex flex-col pr-2">
                            <span className="text-slate-800 font-semibold truncate">{task.title}</span>
                            <span className="text-[10px] text-slate-400 font-sans">
                              {task.assignee ? task.assignee.name : "Unassigned"}
                            </span>
                          </div>
                          <span className="text-blue-600 font-mono text-[11px] capitalize">
                            {task.type === "image" && "🖼️ Image"}
                            {task.type === "audio" && "🎵 Audio"}
                            {task.type === "text" && "📝 Text"}
                            {task.type === "unknown" && `❓ ${(task as any).rawType || "Unknown"}`}
                          </span>
                          <div>
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center w-fit ${getStatusBadgeClass(task.status)}`}>
                              {getStatusIcon(task.status)}
                              <span>{task.status}</span>
                            </span>
                          </div>
                          <span className="text-right text-slate-400 font-mono text-[10px]">
                            {formatRelativeTime(task.updatedAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pagination Footer */}
                  <footer className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-400 font-bold shrink-0">
                    <span>Showing {tasks.length} of {totalTasks} Active Tasks</span>
                    <div className="flex gap-4">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                        className="hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        Prev Page
                      </button>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= Math.ceil(totalTasks / pageSize) || loading}
                        className="hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        Next Page
                      </button>
                    </div>
                  </footer>
                </div>
              </div>

              {/* Right Column: Selected Task Details & Ticker Panel (5 Columns) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Details Whiteboard Card */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex flex-col min-h-[450px]">
                  {selectedTask ? (
                    <div className="space-y-6 flex-1 flex flex-col">
                      
                      {/* Meta header */}
                      <div className="border-b border-slate-100 pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              ID: {selectedTask.id}
                            </span>
                            <h2 className="text-lg font-bold text-slate-900 mt-2 font-serif italic">{selectedTask.title}</h2>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold flex items-center ${getStatusBadgeClass(
                              selectedTask.status
                            )}`}
                          >
                            {getStatusIcon(selectedTask.status)}
                            <span>{selectedTask.status}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-5 text-xs">
                          <div className="space-y-0.5">
                            <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-wider">Assignee</span>
                            <span className="text-slate-700 font-semibold flex items-center">
                              <User className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                              {selectedTask.assignee ? selectedTask.assignee.name : "Unassigned"}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-wider">Annotations Count</span>
                            <span className="text-slate-700 font-bold">{selectedTask.annotationCount}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-wider">Format Type</span>
                            <span className="text-slate-700 font-semibold capitalize">
                              {selectedTask.type}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-slate-400 block font-bold uppercase text-[9px] tracking-wider">Last Sync</span>
                            <span className="text-slate-700 font-semibold">
                              {formatRelativeTime(selectedTask.updatedAt)}
                            </span>
                          </div>
                        </div>

                        {/* Free-form Metadata Fields */}
                        {Object.keys(selectedTask.meta || {}).length > 0 && (
                          <div className="mt-4 bg-slate-50 p-3 rounded border border-slate-100 text-xs">
                            <span className="font-bold text-slate-500 block mb-2 uppercase text-[9px] tracking-wider">Extended Parameters</span>
                            <div className="grid grid-cols-2 gap-2 font-mono">
                              {Object.entries(selectedTask.meta).map(([key, val]) => (
                                <div key={key}>
                                  <span className="text-[9px] text-slate-400 capitalize">{key}:</span>
                                  <span className="text-slate-700 ml-1 font-semibold">{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AI Summary Section with SSE status */}
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-600">
                            <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                            <span className="font-serif italic">Live AI Summary (Streamed)</span>
                          </div>
                          {summaryStreaming && (
                            <span className="text-[9px] px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-full font-bold animate-pulse">
                              STREAMING CHUNKS
                            </span>
                          )}
                        </div>

                        {summaryError ? (
                          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            <span>{summaryError}</span>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded flex-1 max-h-[300px] overflow-y-auto">
                            {streamedSummary ? (
                              <SafeMarkdown content={streamedSummary} />
                            ) : (
                              <p className="text-xs text-slate-400 italic">
                                {summaryStreaming ? "Initiating secure summary stream..." : "Loading streamed AI summary..."}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-slate-400">
                      <Layers className="w-12 h-12 text-slate-300 mb-3" />
                      <h4 className="font-bold text-sm text-slate-700 font-serif italic">No Task Selected</h4>
                      <p className="text-xs mt-1 max-w-xs">
                        Select an active annotation task from the grid to stream live quality reviews, verify data schemas, and access extended logs.
                      </p>
                    </div>
                  )}
                </div>

                {/* Recents Activity Ticker */}
                <TaskTicker apiBase="" />
              </div>

            </div>
          </div>
        </section>

        {/* 3. Bottom Status Bar */}
        <footer className="h-10 bg-slate-100 border-t border-slate-200 px-8 flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-slate-500 shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Secure Connection
            </span>
            <span>TLS 1.3 Encryption Active</span>
          </div>
          <div className="flex gap-6">
            <span>System v2.4.1</span>
            <span className="text-slate-300">|</span>
            <span>Internal Usage Only</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <DashboardContent />
    </Provider>
  );
}

