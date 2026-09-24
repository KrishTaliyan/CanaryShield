import { AlertTriangle, Bell, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../hooks/useAppContext";
import { useNow } from "../../hooks/useUi";
import { cn } from "../../lib/cn";
import type { NotificationTone } from "../../lib/contexts";
import { formatRelative } from "../../lib/format";
import IconButton from "../ui/IconButton";
import Popover from "../ui/Popover";
import { EmptyState } from "../ui/States";

const icons: Record<NotificationTone, typeof Info> = { danger: OctagonAlert, warning: AlertTriangle, success: CheckCircle2, info: Info };
const tones: Record<NotificationTone, string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
};

/** Bell with unread count; opens the recent-events list. */
export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { notifications, unreadCount, markRead, markAllRead, clear } = useNotifications();
  const navigate = useNavigate();
  const now = useNow(30_000, open);

  return (
    <>
      <IconButton
        ref={anchorRef}
        label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        icon={<Bell size={18} />}
        badge={unreadCount}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      />
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} placement="bottom-end" label="Notifications" className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <p className="text-xs text-ink-muted">{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}</p>
          </div>
          <div className="flex gap-1">
            {unreadCount > 0 && <button type="button" onClick={markAllRead} className="rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-sunken/70">Mark all read</button>}
            {notifications.length > 0 && <button type="button" onClick={clear} className="rounded-md px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-sunken/70">Clear</button>}
          </div>
        </div>
        {notifications.length === 0 ? (
          <EmptyState compact icon={<Bell size={20} />} title="No notifications yet" description="Automatic rollbacks, health warnings, completed rollouts and chaos experiments show up here." />
        ) : (
          <ul className="max-h-[60vh] divide-y divide-line/60 overflow-y-auto">
            {notifications.map((item) => {
              const Icon = icons[item.tone];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markRead(item.id);
                      setOpen(false);
                      if (item.href) navigate(item.href);
                    }}
                    className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken/50", !item.read && "bg-accent-soft/25")}
                  >
                    <span className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control", tones[item.tone])} aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-semibold text-ink">{item.title}</span>
                        {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                      </span>
                      {item.description && <span className="mt-0.5 block text-xs text-ink-muted">{item.description}</span>}
                      <span className="mt-1 block text-[11px] text-ink-subtle">{formatRelative(new Date(item.createdAt).toISOString(), now)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Popover>
    </>
  );
}
