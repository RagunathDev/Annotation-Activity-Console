import { Task, TaskStatus } from "./types";

/**
 * Normalizes inconsistent casing and spelling of task status strings.
 */
export function normalizeStatus(rawStatus: string | undefined | null): TaskStatus {
  if (!rawStatus) return TaskStatus.UNKNOWN;
  // Convert to lowercase and strip non-alphabetical chars (e.g. "in_progress" -> "inprogress")
  const cleaned = rawStatus.toLowerCase().replace(/[^a-z]/g, "");
  
  if (cleaned === "inprogress") {
    return TaskStatus.IN_PROGRESS;
  }
  if (cleaned === "done") {
    return TaskStatus.DONE;
  }
  if (cleaned === "qa") {
    return TaskStatus.QA;
  }
  if (cleaned === "todo") {
    return TaskStatus.TODO;
  }
  if (cleaned === "blocked") {
    return TaskStatus.BLOCKED;
  }
  return TaskStatus.UNKNOWN;
}

/**
 * Normalizes a single raw task payload from the API or WS stream.
 */
export function normalizeTask(raw: any): Task {
  const id = typeof raw?.id === "string" ? raw.id : `t-fallback-${Math.random()}`;
  const title = typeof raw?.title === "string" ? raw.title : `Task ${id}`;
  
  // Status normalization
  const status = normalizeStatus(raw?.status);

  // Assignee normalization (handling null or partial structures)
  let assignee: { id: string; name: string } | null = null;
  if (raw?.assignee && typeof raw.assignee === "object") {
    const aid = typeof raw.assignee.id === "string" ? raw.assignee.id : "";
    const name = typeof raw.assignee.name === "string" ? raw.assignee.name : "";
    if (aid && name) {
      assignee = { id: aid, name };
    }
  }

  // Annotation count normalization (handling numbers and strings)
  let annotationCount = 0;
  if (typeof raw?.annotationCount === "number") {
    annotationCount = raw.annotationCount;
  } else if (typeof raw?.annotationCount === "string") {
    const parsed = parseInt(raw.annotationCount, 10);
    annotationCount = isNaN(parsed) ? 0 : parsed;
  }

  // Timestamp normalization (handling ISO strings and epoch-ms numbers)
  let updatedAt = Date.now();
  if (raw?.updatedAt !== undefined && raw?.updatedAt !== null) {
    if (typeof raw.updatedAt === "number") {
      updatedAt = raw.updatedAt;
    } else if (typeof raw.updatedAt === "string") {
      const parsed = Date.parse(raw.updatedAt);
      if (!isNaN(parsed)) {
        updatedAt = parsed;
      }
    }
  }

  // Meta object normalization
  const meta: Record<string, string> = {};
  if (raw?.meta && typeof raw.meta === "object") {
    for (const key of Object.keys(raw.meta)) {
      const val = raw.meta[key];
      if (val !== undefined && val !== null) {
        meta[key] = String(val);
      }
    }
  }

  const rawType = typeof raw?.type === "string" ? raw.type : "unknown";
  const baseTask = {
    id,
    title,
    status,
    assignee,
    annotationCount,
    updatedAt,
    meta,
  };

  // Discriminated union handling
  if (rawType === "image") {
    return { ...baseTask, type: "image" };
  } else if (rawType === "audio") {
    return { ...baseTask, type: "audio" };
  } else if (rawType === "text") {
    return { ...baseTask, type: "text" };
  } else {
    return { ...baseTask, type: "unknown", rawType };
  }
}
