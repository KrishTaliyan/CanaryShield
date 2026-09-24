import { BookOpen, Check, ChevronDown, Laptop, Layers, Menu, Moon, Search, Settings, Sun } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../../hooks/useAppContext";
import { useSystemStatus } from "../../hooks/useSystemStatus";
import { cn } from "../../lib/cn";
import { crumbsFor } from "../../lib/navigation";
import Badge from "../ui/Badge";
import Dropdown from "../ui/Dropdown";
import IconButton from "../ui/IconButton";
import Kbd from "../ui/Kbd";
import { Breadcrumbs } from "../ui/PageHeader";
import Tooltip from "../ui/Tooltip";
import NotificationCenter from "./NotificationCenter";

interface TopbarProps {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}

export default function Topbar({ onOpenMenu, onOpenSearch }: TopbarProps) {
  const { pathname } = useLocation();
  const { mode, resolved, setMode } = useTheme();
  const status = useSystemStatus();
  const crumbs = crumbsFor(pathname);
  const ThemeIcon = resolved === "dark" ? Moon : Sun;

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-3 md:gap-3 md:px-6 lg:px-8">
        <IconButton label="Open navigation" icon={<Menu size={20} />} onClick={onOpenMenu} className="lg:hidden" tooltip={false} />

        <Breadcrumbs items={crumbs} className="hidden min-w-0 flex-1 sm:block" />
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink sm:hidden">{crumbs[crumbs.length - 1]?.label}</p>

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search (Ctrl+K)"
          className="hidden h-10 w-64 items-center gap-2.5 rounded-control border border-line/70 bg-sunken/70 px-3 text-left text-[13px] text-ink-subtle shadow-inset-sm transition-colors hover:text-ink-muted md:flex xl:w-80"
        >
          <Search size={16} aria-hidden="true" />
          <span className="flex-1 truncate">Search anything…</span>
          <span className="flex items-center gap-1" aria-hidden="true"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
        </button>
        <IconButton label="Search" icon={<Search size={18} />} onClick={onOpenSearch} className="md:hidden" tooltip={false} />

        <Dropdown
          label="Environment"
          placement="bottom-end"
          header={<p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Environment</p>}
          items={[
            { id: "local", label: "Local", description: "This machine: platform on :8080, QuickCart on :4000", icon: <Check size={15} /> },
            { id: "staging", label: "Staging", disabled: true, disabledReason: "Planned: the platform runs one environment today", icon: <Layers size={15} /> },
            { id: "production", label: "Production", disabled: true, disabledReason: "Planned: the platform runs one environment today", icon: <Layers size={15} /> },
          ]}
          trigger={(props) => (
            <button
              {...props}
              type="button"
              className="hidden h-10 items-center gap-2 rounded-control border border-line/80 bg-surface px-3 text-[13px] font-semibold text-ink shadow-raised-sm transition-all hover:-translate-y-px lg:inline-flex"
            >
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              Local
              <ChevronDown size={14} className="text-ink-subtle" aria-hidden="true" />
            </button>
          )}
        />

        <Tooltip content={status.details.length ? status.details.join(" · ") : "Platform, QuickCart and live updates are all healthy."}>
          <Link to="/services" className="hidden xl:inline-flex">
            <Badge tone={status.tone} dot pulse={status.level !== "operational"} size="md">{status.label}</Badge>
          </Link>
        </Tooltip>

        <NotificationCenter />

        <Dropdown
          label="Theme"
          placement="bottom-end"
          items={[
            { id: "light", label: "Light", icon: <Sun size={15} />, description: mode === "light" ? "Current" : undefined, onSelect: () => setMode("light") },
            { id: "dark", label: "Dark", icon: <Moon size={15} />, description: mode === "dark" ? "Current" : undefined, onSelect: () => setMode("dark") },
            { id: "system", label: "System", icon: <Laptop size={15} />, description: mode === "system" ? "Current, follows your OS" : "Follow your OS", onSelect: () => setMode("system") },
          ]}
          trigger={(props) => (
            <Tooltip content="Theme">
              <button
                {...props}
                type="button"
                aria-label={`Theme: ${mode}`}
                className="inline-flex h-10 w-10 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-sunken/70 hover:text-ink"
              >
                <ThemeIcon size={18} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        />

        <Dropdown
          label="Account"
          placement="bottom-end"
          header={
            <div className="border-b border-line/70 px-3 pb-3 pt-2">
              <p className="text-sm font-semibold text-ink">Admin</p>
              <p className="text-xs text-ink-muted">Signed in with the shared admin token. CanaryShield has no user accounts yet.</p>
            </div>
          }
          items={[
            { id: "settings", label: "Settings", icon: <Settings size={15} />, href: "/settings" },
            { id: "docs", label: "Documentation", icon: <BookOpen size={15} />, href: "/docs" },
          ]}
          trigger={(props) => (
            <button
              {...props}
              type="button"
              aria-label="Account menu"
              className={cn("inline-flex h-10 items-center gap-2 rounded-control pl-1 pr-2 transition-colors hover:bg-sunken/70")}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[12px] font-bold text-primary shadow-raised-sm" aria-hidden="true">AD</span>
              <ChevronDown size={14} className="hidden text-ink-subtle sm:block" aria-hidden="true" />
            </button>
          )}
        />
      </div>
    </header>
  );
}
