import type { Flag } from "../../api/types";
import { cn } from "../../lib/cn";

interface RolloutProgressProps {
  flag: Pick<Flag, "rolloutPercentage" | "rolloutSteps" | "status">;
  size?: "sm" | "md";
  showSteps?: boolean;
  className?: string;
}

/** Horizontal rollout track: the current percentage, with each planned step marked. */
export default function RolloutProgress({ flag, size = "sm", showSteps = true, className }: RolloutProgressProps) {
  const percentage = Math.min(100, Math.max(0, flag.rolloutPercentage));
  const tone = flag.status === "rolled_back"
    ? "bg-danger"
    : flag.status === "paused"
      ? "bg-warning"
      : flag.status === "completed"
        ? "bg-success"
        : "bg-accent";

  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="progressbar"
        aria-label="Rollout percentage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className={cn("well relative w-full overflow-visible rounded-full p-0", size === "sm" ? "h-2" : "h-3")}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-soft", tone)}
          style={{ width: `${percentage}%` }}
        />
        {showSteps && flag.rolloutSteps.filter((step) => step < 100).map((step) => (
          <span
            key={step}
            aria-hidden="true"
            className={cn(
              "absolute top-1/2 h-[140%] w-0.5 -translate-y-1/2 rounded-full",
              step <= percentage ? "bg-surface/80" : "bg-line-strong",
            )}
            style={{ left: `${step}%` }}
          />
        ))}
      </div>
    </div>
  );
}
