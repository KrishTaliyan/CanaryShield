import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Previous / next with a "1–20 of 84" summary. Pages are 1-based. */
export default function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const button = "inline-flex h-8 w-8 items-center justify-center rounded-control border border-line/80 bg-surface text-ink-muted shadow-raised-sm hover:text-ink disabled:pointer-events-none disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-3 pt-4 text-[13px] text-ink-muted", className)}>
      <span className="tabular">{from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={button} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="tabular">Page {page} of {pageCount}</span>
        <button type="button" className={button} onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
