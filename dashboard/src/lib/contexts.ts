import { createContext, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title: string;
  description?: ReactNode;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export type NotificationTone = "danger" | "warning" | "success" | "info";

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  description?: string;
  href?: string;
  createdAt: number;
  read: boolean;
}

export interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  push: (notification: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);
