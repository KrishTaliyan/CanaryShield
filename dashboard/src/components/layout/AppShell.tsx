import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { usePreferences } from "../../hooks/useAppContext";
import { useLiveUpdates } from "../../hooks/useLiveUpdates";
import { useHotkey } from "../../hooks/useUi";
import { cn } from "../../lib/cn";
import Drawer from "../ui/Drawer";
import CommandPalette from "./CommandPalette";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/** Sidebar + top bar + page, with Ctrl+K search and live updates. */
export default function AppShell() {
  const [preferences, updatePreferences] = usePreferences();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const collapsed = preferences.sidebarCollapsed;

  useLiveUpdates();
  useHotkey("k", () => setPaletteOpen((open) => !open));

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <a
        href="#main"
        className="sr-only z-[90] rounded-control bg-surface-2 px-4 py-2 text-sm font-semibold text-ink shadow-float focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-line/70 bg-surface transition-[width] duration-300 ease-soft lg:block",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={() => updatePreferences({ sidebarCollapsed: !collapsed })} />
      </aside>

      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Navigation" side="left" width="sm">
        <Sidebar collapsed={false} mobile onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>

      <div className={cn("min-w-0 transition-[padding] duration-300 ease-soft", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
        <Topbar onOpenMenu={() => setMobileNavOpen(true)} onOpenSearch={() => setPaletteOpen(true)} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-6 focus:outline-none md:px-6 lg:px-8 lg:pt-8">
          <div key={location.pathname} className="animate-rise-in">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
