import { useNavigate } from "react-router-dom";
import { formatRate } from "../lib/format";
import { useNotifications, usePreferences, useToast } from "./useAppContext";
import { useEventStream } from "./useEventStream";

/**
 * Connects the live event stream and turns important events into
 * notification-center entries and toasts. Mount once, in the app shell.
 */
export function useLiveUpdates() {
  const toast = useToast();
  const { push } = useNotifications();
  const [preferences] = usePreferences();
  const navigate = useNavigate();

  useEventStream({
    onIncident: (incident) => {
      const href = `/incidents/${incident.id}`;
      if (incident.status === "open") {
        push({ tone: "danger", title: `Automatic rollback: ${incident.flagKey}`, description: incident.reason, href });
        if (preferences.toastOnGuardian) {
          toast({
            tone: "error",
            title: `Guardian rolled back ${incident.flagKey}`,
            description: incident.reason,
            action: { label: "View incident", onClick: () => navigate(href) },
          });
        }
      } else {
        push({ tone: "success", title: `Incident resolved: ${incident.flagKey}`, href });
      }
    },
    onRollout: (event) => {
      if (event.type === "completed" && preferences.notifyOnReleases) {
        push({ tone: "success", title: `Rollout completed: ${event.flagKey}`, description: "The new version now serves 100% of eligible users.", href: `/flags/${event.flagKey}` });
      }
    },
    onHealth: (health, previous) => {
      if (previous === undefined || previous === health.status) return;
      if (health.status === "WARNING") {
        const description = `Canary error rate ${formatRate(health.canaryErrorRate)} is above the ${formatRate(health.threshold, 1)} threshold.`;
        push({ tone: "warning", title: `Canary error rate exceeded threshold: ${health.flagKey}`, description, href: `/flags/${health.flagKey}?tab=health` });
        if (preferences.toastOnHealth) toast({ tone: "warning", title: `${health.flagKey} is breaking its guardrail`, description });
      }
    },
  });
}
