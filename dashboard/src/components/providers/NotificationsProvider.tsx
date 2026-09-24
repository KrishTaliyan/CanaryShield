import { useCallback, useMemo, useState, type ReactNode } from "react";
import { NotificationsContext, type AppNotification } from "../../lib/contexts";
import { storage } from "../../lib/storage";

const key = "canaryshield.notifications";
const limit = 50;

/** Notification center state, kept in this browser (last 50). */
export default function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => storage.get<AppNotification[]>(key, []));

  const save = useCallback((update: (current: AppNotification[]) => AppNotification[]) => {
    setNotifications((current) => {
      const next = update(current).slice(0, limit);
      storage.set(key, next);
      return next;
    });
  }, []);

  const push = useCallback((notification: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    save((current) => [
      { ...notification, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now(), read: false },
      ...current,
    ]);
  }, [save]);

  const value = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    push,
    markRead: (id: string) => save((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item))),
    markAllRead: () => save((current) => current.map((item) => ({ ...item, read: true }))),
    clear: () => save(() => []),
  }), [notifications, push, save]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
