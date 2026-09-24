import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { eventStreamUrl, useMocks } from "../api/client";
import type { Event as RolloutEvent, Flag, Health, Incident } from "../api/types";

const reconnectDelayMs = 3000;
const pollingFallbackMs = 5000;

let connected = false;
const listeners = new Set<() => void>();

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reports whether the live event stream is currently open. */
export function useStreamConnected() {
  return useSyncExternalStore(subscribe, () => connected);
}

/** Polls every 5 seconds only while the live stream is down (README 9.8). */
export function usePollingFallback(): number | false {
  return useStreamConnected() ? false : pollingFallbackMs;
}

interface StreamHandlers {
  onIncident?: (incident: Incident) => void;
}

function parse<T>(message: MessageEvent<string>): T | null {
  try {
    return JSON.parse(message.data) as T;
  } catch {
    return null;
  }
}

function applyFlag(queryClient: QueryClient, flag: Flag) {
  queryClient.setQueryData(["flags", flag.key], flag);
  queryClient.setQueryData<{ flags: Flag[] }>(["flags"], (current) => {
    if (!current) return current;
    const others = current.flags.filter((item) => item.key !== flag.key);
    return { flags: [...others, flag].sort((a, b) => a.key.localeCompare(b.key)) };
  });
}

function applyRollout(queryClient: QueryClient, event: RolloutEvent) {
  queryClient.setQueryData<{ events: RolloutEvent[] }>(["events", event.flagKey], (current) => {
    if (!current) return current;
    return { events: [event, ...current.events.filter((item) => item.id !== event.id)] };
  });
}

function applyHealth(queryClient: QueryClient, health: Health) {
  queryClient.setQueryData(["health", health.flagKey], health);
  queryClient.setQueryData<Flag>(["flags", health.flagKey], (current) => (
    current ? { ...current, healthStatus: health.status } : current
  ));
  queryClient.setQueryData<{ flags: Flag[] }>(["flags"], (current) => (
    current
      ? { flags: current.flags.map((flag) => (flag.key === health.flagKey ? { ...flag, healthStatus: health.status } : flag)) }
      : current
  ));
}

/**
 * Keeps the query cache in sync with the platform's live events over one
 * EventSource connection (README 8.5). Mount it once.
 */
export function useEventStream(handlers: StreamHandlers = {}) {
  const queryClient = useQueryClient();
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (useMocks) return;

    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let stopped = false;

    function connect() {
      source = new EventSource(eventStreamUrl());
      source.onopen = () => {
        setConnected(true);
        // Catch up on anything that changed while the stream was closed.
        void queryClient.invalidateQueries();
      };
      source.onerror = () => {
        setConnected(false);
        // The browser retries dropped connections itself; a refused one is
        // closed for good, so reconnect by hand.
        if (source?.readyState === EventSource.CLOSED && !stopped) {
          retryTimer = window.setTimeout(connect, reconnectDelayMs);
        }
      };
      source.addEventListener("flag", (message) => {
        const flag = parse<Flag>(message);
        if (flag) applyFlag(queryClient, flag);
      });
      source.addEventListener("rollout", (message) => {
        const event = parse<RolloutEvent>(message);
        if (event) applyRollout(queryClient, event);
      });
      source.addEventListener("health", (message) => {
        const health = parse<Health>(message);
        if (health) applyHealth(queryClient, health);
      });
      source.addEventListener("incident", (message) => {
        const incident = parse<Incident>(message);
        if (!incident) return;
        void queryClient.invalidateQueries({ queryKey: ["incidents"] });
        handlersRef.current.onIncident?.(incident);
      });
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      source?.close();
      setConnected(false);
    };
  }, [queryClient]);
}
