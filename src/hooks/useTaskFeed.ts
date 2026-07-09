import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState, receiveWebSocketEvent, fetchSingleTask } from "../store";

export function useTaskFeed() {
  const dispatch = useDispatch<AppDispatch>();
  const [connected, setConnected] = useState(false);
  
  // Track entities using a ref to prevent re-initializing useEffect when entities change
  const entities = useSelector((state: RootState) => state.tasks.entities);
  const entitiesRef = useRef(entities);

  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeoutId: any = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
      
      console.log(`[WebSocket] Connecting to ${wsUrl}`);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (isMounted) {
          setConnected(true);
          console.log("[WebSocket] Connected successfully");
        }
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          const kind = data?.kind;
          const payload = data?.payload;
          
          if (!kind || !payload) return;

          // Determine the referenced taskId
          const taskId = kind === "annotation.created" ? payload.taskId : payload.id;
          
          if (taskId) {
            const exists = !!entitiesRef.current[taskId];
            if (!exists) {
              console.log(`[WebSocket] Event refers to unknown task ${taskId}. Pre-fetching full task...`);
              // Fetch the full task first, then dispatch the update
              dispatch(fetchSingleTask(taskId)).then(() => {
                dispatch(receiveWebSocketEvent({ kind, payload }));
              });
            } else {
              dispatch(receiveWebSocketEvent({ kind, payload }));
            }
          }
        } catch (error) {
          console.error("[WebSocket] Message parse error", error);
        }
      };

      socket.onclose = () => {
        if (isMounted) {
          setConnected(false);
          console.log("[WebSocket] Disconnected. Reconnecting in 3 seconds...");
          reconnectTimeoutId = setTimeout(connect, 3000);
        }
      };

      socket.onerror = (error) => {
        console.error("[WebSocket] Error occurred", error);
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (socket) {
        socket.close();
      }
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
    };
  }, [dispatch]);

  return { connected };
}
