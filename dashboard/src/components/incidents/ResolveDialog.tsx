import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resolveIncident } from "../../api/incidents";
import type { Incident } from "../../api/types";
import { useToast } from "../../hooks/useAppContext";
import ConfirmDialog from "../ui/ConfirmDialog";

/** Confirmation + mutation for marking an incident resolved. */
function useResolveIncident() {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (incident: Incident) => resolveIncident(incident.id),
    onSuccess: async (incident) => {
      toast({ tone: "success", title: `Incident on ${incident.flagKey} resolved` });
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (error) => toast({ tone: "error", title: "Could not resolve the incident", description: error.message }),
  });
}

/** Confirms and marks an incident resolved. */
export default function ResolveDialog({ incident, onClose }: { incident: Incident | null; onClose: () => void }) {
  const resolve = useResolveIncident();
  return (
    <ConfirmDialog
      open={incident !== null}
      onClose={() => !resolve.isPending && onClose()}
      title="Resolve this incident?"
      tone="primary"
      current={{ label: "Now", value: "Open" }}
      after={{ label: "After", value: "Resolved", hint: "Kept in the history" }}
      impact={<p>Marks the incident as reviewed. It does not change <code className="font-mono text-ink">{incident?.flagKey}</code>: the flag stays at 0% until someone starts a new rollout.</p>}
      confirmLabel="Mark resolved"
      busy={resolve.isPending}
      error={resolve.error?.message ?? null}
      onConfirm={async () => {
        if (!incident) return;
        await resolve.mutateAsync(incident).then(onClose, () => undefined);
      }}
    />
  );
}
