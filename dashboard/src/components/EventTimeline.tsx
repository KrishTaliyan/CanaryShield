import type { Event, EventType } from "../api/types";
import { useFlagEvents } from "../hooks/useFlag";

const labels: Record<EventType, string> = {
  created: "Created",
  updated: "Details updated",
  conditions_changed: "Conditions changed",
  overrides_changed: "Overrides changed",
  guardrail_changed: "Guardrail changed",
  started: "Rollout started",
  step_changed: "Percentage changed",
  paused: "Paused",
  resumed: "Resumed",
  completed: "Completed",
  rolled_back: "Rolled back",
  killed: "Killed",
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

function change(event: Event) {
  if (event.fromPercentage === null || event.toPercentage === null) return null;
  if (event.fromPercentage === event.toPercentage) return `at ${event.toPercentage}%`;
  return `${event.fromPercentage}% → ${event.toPercentage}%`;
}

function EventRow({ event }: { event: Event }) {
  const byGuardian = event.actor === "system:guardian";
  const percentage = change(event);
  return (
    <li className={`relative border-l-2 py-3 pl-4 ${byGuardian ? "border-red-600 bg-red-50" : "border-neutral-200"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className={`text-sm font-semibold ${byGuardian ? "text-red-900" : "text-neutral-900"}`}>
          {labels[event.type] ?? event.type}
          {percentage && <span className="ml-2 font-normal tabular-nums text-neutral-700">{percentage}</span>}
        </p>
        <time className="text-xs tabular-nums text-neutral-500" dateTime={event.createdAt}>{formatTime(event.createdAt)}</time>
      </div>
      <p className={`mt-0.5 text-xs ${byGuardian ? "font-semibold text-red-800" : "text-neutral-500"}`}>
        {byGuardian ? "Guardian (automatic)" : "Admin"}
      </p>
      {event.reason && <p className="mt-1 text-sm text-neutral-700">{event.reason}</p>}
    </li>
  );
}

/** A flag's rollout history, newest first, with guardian actions highlighted. */
export default function EventTimeline({ flagKey }: { flagKey: string }) {
  const eventsQuery = useFlagEvents(flagKey);

  return (
    <section aria-labelledby="timeline-heading" className="border-y border-neutral-200 bg-white p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-950" id="timeline-heading">Timeline</h2>
      {eventsQuery.isPending ? (
        <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading timeline">
          {[0, 1, 2].map((row) => <div key={row} className="h-10 animate-pulse rounded bg-neutral-100" />)}
        </div>
      ) : eventsQuery.isError ? (
        <div className="mt-4" role="alert">
          <p className="text-sm text-red-800">{eventsQuery.error.message}</p>
          <button className="mt-2 rounded border border-neutral-300 px-3 py-1.5 text-sm" onClick={() => void eventsQuery.refetch()} type="button">Retry</button>
        </div>
      ) : eventsQuery.data.events.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">No events yet.</p>
      ) : (
        <ol className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {eventsQuery.data.events.map((event) => <EventRow key={event.id} event={event} />)}
        </ol>
      )}
    </section>
  );
}
