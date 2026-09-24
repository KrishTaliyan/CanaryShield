import { useContext, useSyncExternalStore } from "react";
import { NotificationsContext, ThemeContext, ToastContext } from "../lib/contexts";
import { preferencesStore } from "../lib/preferences";

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider.");
  return value;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider.");
  return value.toast;
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationsProvider.");
  return value;
}

/** Browser-local preferences (Settings page), shared across components. */
export function usePreferences() {
  const preferences = useSyncExternalStore(preferencesStore.subscribe, preferencesStore.get);
  return [preferences, preferencesStore.update] as const;
}
