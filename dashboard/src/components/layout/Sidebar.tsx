import { ChevronsLeft, ChevronsRight, ShieldCheck } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useSystemStatus } from "../../hooks/useSystemStatus";
import { cn } from "../../lib/cn";
import { navigation, type NavItem } from "../../lib/navigation";
import Badge from "../ui/Badge";
import Tooltip from "../ui/Tooltip";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  /** Rendered inside the mobile drawer (never collapsed, no toggle). */
  mobile?: boolean;
}

function isActive(item: NavItem, pathname: string) {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function Sidebar({ collapsed, onToggleCollapsed, onNavigate, mobile }: SidebarProps) {
  const { pathname } = useLocation();
  const status = useSystemStatus();

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 shrink-0 items-center gap-3 px-4", collapsed && "justify-center px-0")}>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#1B3668] text-[#2DD4BF] shadow-raised-sm" aria-hidden="true">
          <ShieldCheck size={22} strokeWidth={2.2} />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight text-ink">CanaryShield</p>
            <p className="truncate text-[11.5px] font-medium text-ink-subtle">Progressive delivery</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-control border border-line/70 bg-sunken/60 px-3 py-2 shadow-inset-sm">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-subtle">Environment</p>
            <p className="truncate text-[13px] font-semibold text-ink">Local</p>
          </div>
          <Badge tone={status.tone} dot pulse={status.level !== "operational"}>
            {status.level === "operational" ? "Healthy" : status.level === "down" ? "Down" : status.level === "incident" ? "Incident" : "Degraded"}
          </Badge>
        </div>
      )}

      <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {navigation.map((group) => (
          <div key={group.label} className="mb-3">
            {collapsed ? (
              <div className="mx-auto my-2 h-px w-8 bg-line" aria-hidden="true" />
            ) : (
              <p className="mb-1 px-3 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item, pathname);
                const Icon = item.icon;
                const link = (
                  <NavLink
                    to={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-control py-2 text-[13.5px] font-medium transition-all duration-200 ease-soft",
                      collapsed ? "justify-center px-0" : "px-3",
                      active
                        ? "bg-surface-2 text-ink shadow-raised-sm"
                        : "text-ink-muted hover:bg-sunken/60 hover:text-ink",
                      item.planned && !active && "opacity-70",
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" aria-hidden="true" />}
                    <Icon size={18} className={cn("shrink-0", active ? "text-accent" : "")} aria-hidden="true" />
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.planned && <span className="rounded-full border border-line px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Planned</span>}
                  </NavLink>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? <Tooltip content={item.planned ? `${item.label} (planned)` : item.label} placement="right" wrapperClassName="flex w-full [&>a]:w-full">{link}</Tooltip> : link}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-line/70 p-3", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-3 rounded-control px-2 py-2", collapsed && "justify-center px-0")}>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary shadow-raised-sm" aria-hidden="true">
            AD
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">Admin</p>
              <p className="truncate text-[11.5px] text-ink-subtle">Shared admin token</p>
            </div>
          )}
          {!mobile && onToggleCollapsed && !collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Collapse sidebar"
              className="inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-subtle hover:bg-sunken/70 hover:text-ink"
            >
              <ChevronsLeft size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {!mobile && onToggleCollapsed && collapsed && (
          <Tooltip content="Expand sidebar" placement="right">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expand sidebar"
              className="mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-control text-ink-subtle hover:bg-sunken/70 hover:text-ink"
            >
              <ChevronsRight size={16} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
