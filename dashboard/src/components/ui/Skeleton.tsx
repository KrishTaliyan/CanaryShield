import { cn } from "../../lib/cn";

/** Shimmering placeholder block. */
export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="skeleton h-3.5" style={{ width: `${index === lines - 1 ? 60 : 100 - index * 6}%` }} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("surface p-5", className)} aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-4 h-4 w-1/3" />
      <SkeletonText lines={lines} />
    </div>
  );
}
