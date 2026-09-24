import { Bell, Keyboard, Laptop, Link2, Moon, Palette, RotateCcw, SlidersHorizontal, Sun, Trash2, Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";
import { adminToken, platformUrl, useMocks } from "../api/client";
import { quickcartUrl, quickcartWebUrl } from "../api/quickcart";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Kbd from "../components/ui/Kbd";
import PageHeader from "../components/ui/PageHeader";
import SegmentedControl from "../components/ui/SegmentedControl";
import Slider from "../components/ui/Slider";
import TimeRangePicker from "../components/ui/TimeRangePicker";
import Toggle from "../components/ui/Toggle";
import { useNotifications, usePreferences, useTheme, useToast } from "../hooks/useAppContext";
import { useChaosLog } from "../hooks/useData";
import { useStreamConnected } from "../hooks/useEventStream";
import { chaosLog } from "../lib/chaosLog";
import { formatDuration } from "../lib/format";
import { preferencesStore, type Preferences } from "../lib/preferences";
import type { ThemeMode } from "../lib/contexts";

function Row({ label, description, children }: { label: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const toast = useToast();
  const { mode, setMode } = useTheme();
  const [preferences, update] = usePreferences();
  const notifications = useNotifications();
  const log = useChaosLog();
  const streamConnected = useStreamConnected();
  const [resetting, setResetting] = useState(false);

  function save(change: Partial<Preferences>, title = "Preference saved") {
    update(change);
    toast({ tone: "success", title, description: "Stored in this browser." });
  }

  const maskedToken = adminToken.length > 4 ? `${"•".repeat(Math.min(12, adminToken.length - 4))}${adminToken.slice(-4)}` : "••••";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Settings" description="Preferences for this dashboard. They are saved in this browser only; nothing here changes the platform." />

      <Card>
        <CardHeader icon={<Palette size={18} />} title="Appearance" />
        <div className="divide-y divide-line/70">
          <Row label="Theme" description="System follows your operating system's light or dark setting.">
            <SegmentedControl<ThemeMode>
              label="Theme"
              value={mode}
              onChange={(value) => {
                setMode(value);
                toast({ tone: "success", title: `Theme: ${value === "system" ? "follow system" : value}` });
              }}
              options={[
                { value: "light", label: <span className="inline-flex items-center gap-1.5"><Sun size={14} aria-hidden="true" />Light</span> },
                { value: "dark", label: <span className="inline-flex items-center gap-1.5"><Moon size={14} aria-hidden="true" />Dark</span> },
                { value: "system", label: <span className="inline-flex items-center gap-1.5"><Laptop size={14} aria-hidden="true" />System</span> },
              ]}
            />
          </Row>
          <Row label="Collapsed sidebar" description="Show only icons in the navigation on large screens.">
            <Toggle label={<span className="sr-only">Collapsed sidebar</span>} checked={preferences.sidebarCollapsed} onChange={(value) => save({ sidebarCollapsed: value })} />
          </Row>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Bell size={18} />} title="Notifications" description="What pops up while you work. Everything is also kept in the notification center." />
        <div className="space-y-4">
          <Toggle checked={preferences.toastOnGuardian} onChange={(value) => save({ toastOnGuardian: value })} label="Automatic rollbacks" description="Show a toast when the guardian rolls a flag back." />
          <Toggle checked={preferences.toastOnHealth} onChange={(value) => save({ toastOnHealth: value })} label="Threshold warnings" description="Show a toast when a canary first breaks its error threshold." />
          <Toggle checked={preferences.notifyOnReleases} onChange={(value) => save({ notifyOnReleases: value })} label="Completed rollouts" description="Add a notification when a rollout reaches 100%." />
        </div>
      </Card>

      <Card>
        <CardHeader icon={<SlidersHorizontal size={18} />} title="Defaults" />
        <div className="divide-y divide-line/70">
          <Row label="Chart time range" description="Used when a page with charts opens.">
            <TimeRangePicker value={preferences.chartRange} onChange={(chartRange) => save({ chartRange })} />
          </Row>
          <div className="space-y-5 py-4 last:pb-0">
            <p className="text-sm font-medium text-ink">Chaos experiment defaults</p>
            <Slider label="Error rate" value={preferences.chaosErrorPercent} onChange={(value) => update({ chaosErrorPercent: value })} min={0} max={100} step={5} format={(value) => `${value}%`} tone="danger" />
            <Slider label="Extra latency" value={preferences.chaosLatencyMs} onChange={(value) => update({ chaosLatencyMs: value })} min={0} max={5000} step={100} format={(value) => `${value} ms`} tone="warning" />
            <Slider label="Duration" value={preferences.chaosDurationSec} onChange={(value) => update({ chaosDurationSec: value })} min={10} max={600} step={10} format={(value) => formatDuration(value * 1000)} />
            <p className="text-xs text-ink-subtle">Saved as you move the sliders. The Chaos page also remembers the last experiment you started.</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Link2 size={18} />} title="Connection" description="Set with VITE_ environment variables when the dashboard starts. Read-only here." />
        <dl className="divide-y divide-line/70 text-sm">
          {[
            { label: "Platform API", value: platformUrl, env: "VITE_PLATFORM_URL" },
            { label: "QuickCart API", value: quickcartUrl, env: "VITE_QUICKCART_URL" },
            { label: "QuickCart web shop", value: quickcartWebUrl, env: "VITE_QUICKCART_WEB_URL" },
            { label: "Admin token", value: maskedToken, env: "VITE_ADMIN_TOKEN" },
          ].map((row) => (
            <div key={row.label} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-ink-muted">{row.label} <code className="ml-1 font-mono text-[11px] text-ink-subtle">{row.env}</code></dt>
              <dd className="break-all font-mono text-[13px] text-ink">{row.value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between py-3 last:pb-0">
            <dt className="text-ink-muted">Data source <code className="ml-1 font-mono text-[11px] text-ink-subtle">VITE_USE_MOCKS</code></dt>
            <dd>{useMocks ? <Badge tone="warning">Mock data</Badge> : <Badge tone={streamConnected ? "success" : "warning"} dot>{streamConnected ? "Live platform" : "Live platform, reconnecting"}</Badge>}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader icon={<Keyboard size={18} />} title="Keyboard shortcuts" />
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            { keys: ["Ctrl", "K"], label: "Search flags, incidents and pages" },
            { keys: ["Esc"], label: "Close a dialog, menu or panel" },
            { keys: ["←", "→"], label: "Move between tabs" },
            { keys: ["↑", "↓"], label: "Move through menus and search results" },
          ].map((shortcut) => (
            <li key={shortcut.label} className="flex items-center justify-between gap-3 rounded-control bg-surface-2/70 px-3 py-2">
              <span className="text-ink-muted">{shortcut.label}</span>
              <span className="flex gap-1">{shortcut.keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader icon={<Wrench size={18} />} title="Data in this browser" />
        <div className="divide-y divide-line/70">
          <Row label="Notifications" description={`${notifications.notifications.length} saved, ${notifications.unreadCount} unread.`}>
            <Button size="sm" icon={<Trash2 size={14} />} disabled={notifications.notifications.length === 0} onClick={() => { notifications.clear(); toast({ tone: "success", title: "Notifications cleared" }); }}>Clear</Button>
          </Row>
          <Row label="Chaos history" description={`${log.length} experiment${log.length === 1 ? "" : "s"} recorded.`}>
            <Button size="sm" icon={<Trash2 size={14} />} disabled={log.length === 0} onClick={() => { chaosLog.clear(); toast({ tone: "success", title: "Chaos history cleared" }); }}>Clear</Button>
          </Row>
          <Row label="Preferences" description="Theme choice is kept; everything else on this page returns to its default.">
            <Button size="sm" variant="danger-soft" icon={<RotateCcw size={14} />} onClick={() => setResetting(true)}>Reset</Button>
          </Row>
        </div>
      </Card>

      <Card>
        <CardHeader title="Not available yet" description="These need platform support that does not exist today." />
        <ul className="flex flex-wrap gap-2">
          {["User accounts and roles", "API tokens per user", "Webhooks and Slack alerts", "Multiple environments"].map((item) => (
            <li key={item}><Badge tone="neutral">{item} · Planned</Badge></li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={resetting}
        onClose={() => setResetting(false)}
        title="Reset preferences?"
        tone="warning"
        current={{ label: "Now", value: "Your choices" }}
        after={{ label: "After", value: "Defaults" }}
        impact={<p>Notification toggles, chart range, chaos defaults and the sidebar return to their defaults. Flags and incidents are not touched.</p>}
        confirmLabel="Reset preferences"
        onConfirm={() => {
          preferencesStore.reset();
          setResetting(false);
          toast({ tone: "success", title: "Preferences reset" });
        }}
      />
    </div>
  );
}
