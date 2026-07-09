import { useState, useEffect } from "react";

export interface UseTaskSummaryResult {
  summary: string;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to stream AI summaries incrementally from the SSE summary endpoint.
 * Handles mid-stream cancellation when the selected task ID changes, as well as error handling.
 */
export function useTaskSummary(taskId: string | null): UseTaskSummaryResult {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setSummary("");
      setLoading(false);
      setError(null);
      return;
    }

    setSummary("");
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const { signal } = controller;

    async function streamSummary() {
      try {
        const response = await fetch(`/api/tasks/${taskId}/summary`, { signal });
        
        if (!response.ok) {
          throw new Error(`Failed to load summary. Server returned: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable.");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          // Decode raw byte stream chunks
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Save the last trailing line back to the buffer in case it's incomplete
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataValue = trimmed.slice(6).trim();
              if (dataValue === "end") {
                break;
              }
              try {
                const chunk = JSON.parse(dataValue);
                if (typeof chunk === "string") {
                  setSummary((prev) => prev + chunk);
                }
              } catch {
                // Ignore parsing errors for custom message shapes or non-JSON parts
              }
            }
          }
        }
        setLoading(false);
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log(`[Summary Stream] Stream aborted for task ${taskId}`);
          return;
        }
        console.error(`[Summary Stream] Error streaming for task ${taskId}:`, err);
        setError(err.message || "An error occurred while streaming the summary.");
        setLoading(false);
      }
    }

    streamSummary();

    return () => {
      // Clean up and abort active stream to prevent memory leaks or incorrect UI states
      controller.abort();
    };
  }, [taskId]);

  return {
    summary,
    loading,
    error,
  };
}
