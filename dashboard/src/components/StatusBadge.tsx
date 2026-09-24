import type { FlagStatus } from "../api/types";

const styles: Record<FlagStatus, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  rolling_out: "bg-sky-100 text-sky-800",
  paused: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
  rolled_back: "bg-rose-100 text-rose-800",
};

const labels: Record<FlagStatus, string> = {
  draft: "Draft",
  rolling_out: "Rolling out",
  paused: "Paused",
  completed: "Completed",
  rolled_back: "Rolled back",
};

export default function StatusBadge({ status }: { status: FlagStatus }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
