import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-[13px] text-ink-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className={cn(
                "flex items-center gap-1",
                last ? "min-w-0" : "shrink-0",
                // The brand root is redundant next to the sidebar on deep pages.
                index === 0 && items.length > 2 && "hidden 2xl:flex",
              )}
            >
              {item.href && !last ? (
                <Link to={item.href} className="truncate rounded px-1 hover:text-ink">{item.label}</Link>
              ) : (
                <span className={cn("truncate px-1", last && "font-medium text-ink")} aria-current={last ? "page" : undefined}>{item.label}</span>
              )}
              {!last && <ChevronRight size={14} className="shrink-0 text-ink-subtle" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
}

/** Title block at the top of every page. */
export default function PageHeader({ title, description, eyebrow, actions, meta, icon }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {icon && (
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-card bg-surface text-accent shadow-raised-sm sm:inline-flex" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-sm text-ink-muted md:text-[15px]">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ title, description, actions, id, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
