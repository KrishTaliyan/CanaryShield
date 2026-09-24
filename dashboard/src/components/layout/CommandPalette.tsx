import { CornerDownLeft, ExternalLink, Flag, Moon, Plus, Search, Siren, Sun, Zap, type LucideIcon } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { quickcartWebUrl } from "../../api/quickcart";
import { useTheme } from "../../hooks/useAppContext";
import { useIncidents } from "../../hooks/useData";
import { useFlags } from "../../hooks/useFlags";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { cn } from "../../lib/cn";
import { allNavItems } from "../../lib/navigation";
import { flagStatusConfig } from "../../lib/status";
import Kbd from "../ui/Kbd";

interface Result {
  id: string;
  group: "Pages" | "Feature flags" | "Incidents" | "Actions";
  label: string;
  detail?: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
}

const groupOrder: Result["group"][] = ["Actions", "Feature flags", "Incidents", "Pages"];

/** Ctrl/Cmd + K: jump to any page, flag or incident, or run a quick action. */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const flags = useFlags();
  const incidents = useIncidents();
  const { resolved, setMode } = useTheme();
  useFocusTrap(panelRef, open, onClose);

  const go = (href: string) => () => {
    onClose();
    setQuery("");
    navigate(href);
  };

  const all = useMemo<Result[]>(() => {
    const results: Result[] = [
      { id: "create-flag", group: "Actions", label: "Create a feature flag", icon: Plus, keywords: "new add flag create", run: go("/flags/new") },
      { id: "chaos", group: "Actions", label: "Start a chaos experiment", icon: Zap, keywords: "chaos failure test experiment", run: go("/chaos") },
      {
        id: "theme",
        group: "Actions",
        label: resolved === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolved === "dark" ? Sun : Moon,
        keywords: "theme dark light mode appearance",
        run: () => {
          setMode(resolved === "dark" ? "light" : "dark");
          onClose();
        },
      },
      {
        id: "quickcart",
        group: "Actions",
        label: "Open QuickCart shop",
        detail: quickcartWebUrl,
        icon: ExternalLink,
        keywords: "quickcart shop store demo open",
        run: () => {
          window.open(quickcartWebUrl, "_blank", "noopener");
          onClose();
        },
      },
    ];
    for (const item of allNavItems) {
      results.push({ id: `page-${item.href}`, group: "Pages", label: item.label, detail: item.planned ? "Planned" : item.description, icon: item.icon, keywords: `${item.label} ${item.description}`, run: go(item.href) });
    }
    for (const flag of flags.data?.flags ?? []) {
      results.push({
        id: `flag-${flag.key}`,
        group: "Feature flags",
        label: flag.name,
        detail: `${flag.key} · ${flagStatusConfig[flag.status].label} · ${flag.rolloutPercentage}%`,
        icon: Flag,
        keywords: `${flag.name} ${flag.key} ${flag.description}`,
        run: go(`/flags/${encodeURIComponent(flag.key)}`),
      });
    }
    for (const incident of incidents.data?.incidents.slice(0, 20) ?? []) {
      results.push({
        id: `incident-${incident.id}`,
        group: "Incidents",
        label: `${incident.status === "open" ? "Open" : "Resolved"} incident on ${incident.flagKey}`,
        detail: incident.reason,
        icon: Siren,
        keywords: `${incident.flagKey} ${incident.reason} ${incident.status} incident`,
        run: go(`/incidents/${incident.id}`),
      });
    }
    return results;
    // `go` is recreated each render but only closes over stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags.data, incidents.data, resolved]);

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matched = terms.length === 0
      ? all
      : all.filter((result) => terms.every((term) => `${result.label} ${result.keywords}`.toLowerCase().includes(term)));
    return groupOrder.flatMap((group) => matched.filter((result) => result.group === group).slice(0, group === "Pages" && terms.length === 0 ? 20 : 8));
  }, [all, query]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(results.length - 1, value + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(0, value - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      results[cursor]?.run();
    }
  }

  if (!open) return null;
  let index = -1;
  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex items-start justify-center bg-[rgb(8_12_20/0.45)] px-3 pt-[10vh] backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Search" className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-line bg-surface shadow-float animate-scale-in">
        <div className="flex items-center gap-3 border-b border-line/70 px-4">
          <Search size={18} className="shrink-0 text-ink-subtle" aria-hidden="true" />
          <input
            data-autofocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search flags, incidents, pages or actions…"
            aria-label="Search"
            aria-controls="command-results"
            aria-activedescendant={results[cursor] ? `command-${results[cursor].id}` : undefined}
            className="h-14 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-subtle"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div id="command-results" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-10 text-center text-sm text-ink-muted">No results for “{query}”.</p>}
          {groupOrder.map((group) => {
            const items = results.filter((result) => result.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{group}</p>
                {items.map((result) => {
                  index += 1;
                  const selected = index === cursor;
                  const itemIndex = index;
                  const Icon = result.icon;
                  return (
                    <button
                      key={result.id}
                      id={`command-${result.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setCursor(itemIndex)}
                      onClick={result.run}
                      className={cn("flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left", selected ? "bg-surface-2 shadow-raised-sm" : "hover:bg-sunken/60")}
                    >
                      <Icon size={17} className={cn("shrink-0", selected ? "text-accent" : "text-ink-subtle")} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{result.label}</span>
                        {result.detail && <span className="block truncate text-xs text-ink-muted">{result.detail}</span>}
                      </span>
                      {selected && <CornerDownLeft size={15} className="shrink-0 text-ink-subtle" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line/70 px-4 py-2.5 text-[11.5px] text-ink-subtle">
          <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="inline-flex items-center gap-1"><Kbd>Enter</Kbd> open</span>
          <span className="inline-flex items-center gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd> toggle</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
