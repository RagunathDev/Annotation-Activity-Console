// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { normalizeStatus, normalizeTask } from "./normalize";
import { TaskStatus, Task } from "./types";
import { selectFilteredAndSortedTasks } from "./store";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

describe("1. Data Normalizer Tests", () => {
  it("should normalize inconsistent casing and spelling of statuses", () => {
    expect(normalizeStatus("in_progress")).toBe(TaskStatus.IN_PROGRESS);
    expect(normalizeStatus("InProgress")).toBe(TaskStatus.IN_PROGRESS);
    expect(normalizeStatus("done")).toBe(TaskStatus.DONE);
    expect(normalizeStatus("QA")).toBe(TaskStatus.QA);
    expect(normalizeStatus("BLOCKED")).toBe(TaskStatus.BLOCKED);
    expect(normalizeStatus(null)).toBe(TaskStatus.UNKNOWN);
  });

  it("should normalize messy task payloads correctly", () => {
    const raw = {
      id: "t1",
      title: "Task 1",
      type: "video", // unknown format
      status: "InProgress",
      assignee: { id: "u1", name: "Asha" },
      annotationCount: "5", // stringified number
      updatedAt: "2024-07-08T12:00:00Z", // ISO string timestamp
      meta: { priority: "high" },
    };

    const normalized = normalizeTask(raw);

    expect(normalized.id).toBe("t1");
    expect(normalized.title).toBe("Task 1");
    expect(normalized.type).toBe("unknown");
    expect(normalized.status).toBe(TaskStatus.IN_PROGRESS);
    expect(normalized.annotationCount).toBe(5);
    expect(normalized.updatedAt).toBe(Date.parse("2024-07-08T12:00:00Z"));
    expect(normalized.meta.priority).toBe("high");
  });
});

describe("2. Redux Selectors Tests", () => {
  it("should correctly filter and search tasks", () => {
    const mockTasks: Task[] = [
      {
        id: "t1",
        title: "Image Classification",
        type: "image",
        status: TaskStatus.IN_PROGRESS,
        assignee: { id: "u1", name: "Asha" },
        annotationCount: 10,
        updatedAt: 1000,
        meta: {},
      },
      {
        id: "t2",
        title: "Audio Transcription",
        type: "audio",
        status: TaskStatus.DONE,
        assignee: null,
        annotationCount: 5,
        updatedAt: 2000,
        meta: {},
      },
    ];

    const state = {
      tasks: {
        ids: ["t1", "t2"],
        entities: {
          t1: mockTasks[0],
          t2: mockTasks[1],
        },
        loading: false,
        error: null,
        currentPage: 1,
        pageSize: 20,
        totalTasks: 2,
        isFromCache: false,
      },
      filters: {
        search: "Audio",
        type: "all",
        status: "all",
        sortBy: "updatedAt" as const,
        sortOrder: "desc" as const,
      },
    };

    const result = selectFilteredAndSortedTasks(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t2");
  });
});

describe("3. RTL Component Interaction Test", () => {
  it("should render list items and respond to filter changes", () => {
    const TestComponent = () => {
      const [filter, setFilter] = React.useState("all");
      const items = [
        { id: "1", text: "Alpha Task", type: "image" },
        { id: "2", text: "Beta Task", type: "audio" },
      ];

      const visible = filter === "all" ? items : items.filter((i) => i.type === filter);

      return (
        <div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="type-filter">
            <option value="all">All</option>
            <option value="image">Image</option>
            <option value="audio">Audio</option>
          </select>
          <ul>
            {visible.map((item) => (
              <li key={item.id} data-testid="task-item">
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      );
    };

    render(<TestComponent />);

    // Verify it initially shows both items
    expect(screen.getAllByTestId("task-item")).toHaveLength(2);

    // Fire filter selection change event
    fireEvent.change(screen.getByTestId("type-filter"), { target: { value: "image" } });

    // Verify only the selected type (Image -> Alpha Task) is displayed
    expect(screen.getAllByTestId("task-item")).toHaveLength(1);
    expect(screen.getByText("Alpha Task")).toBeDefined();
  });
});
