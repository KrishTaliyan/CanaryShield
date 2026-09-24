import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { setOverrides } from "../../api/flags";
import type { Overrides } from "../../api/types";
import { useToast } from "../../hooks/useAppContext";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Card, { CardHeader } from "../ui/Card";
import InfoTip from "../ui/InfoTip";
import TagInput from "../ui/TagInput";

/** Include and exclude lists (controlled). */
export function OverridesFields({ value, onChange }: { value: Overrides; onChange: (value: Overrides) => void }) {
  const conflicts = value.include.filter((userId) => value.exclude.includes(userId));
  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <TagInput
          label="Always get the new version"
          values={value.include}
          onChange={(include) => onChange({ ...value, include })}
          placeholder="u_demo_canary"
          hint="Useful for testers and internal accounts."
          conflicts={conflicts}
        />
        <TagInput
          label="Never get the new version"
          values={value.exclude}
          onChange={(exclude) => onChange({ ...value, exclude })}
          placeholder="u_vip_customer"
          hint="Excluded users stay on the stable version."
          tone="danger"
          conflicts={conflicts}
        />
      </div>
      {conflicts.length > 0 && (
        <Alert tone="warning" title={`${conflicts.length} user${conflicts.length === 1 ? " is" : "s are"} in both lists`}>
          The exclude list wins: {conflicts.join(", ")} will get the stable version.
        </Alert>
      )}
    </div>
  );
}

/** User overrides of an existing flag, saved with PUT /overrides. */
export default function OverridesEditor({ flagKey, overrides }: { flagKey: string; overrides: Overrides }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Overrides>(overrides);
  const dirty = JSON.stringify(draft) !== JSON.stringify({ include: overrides.include, exclude: overrides.exclude });

  const mutation = useMutation({
    mutationFn: (value: Overrides) => setOverrides(flagKey, value),
    onSuccess: async (flag) => {
      toast({
        tone: "success",
        title: "Overrides saved",
        description: `${flag.overrides.include.length} included, ${flag.overrides.exclude.length} excluded.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["flags"] }),
        queryClient.invalidateQueries({ queryKey: ["events", flagKey] }),
      ]);
    },
    onError: (error) => toast({ tone: "error", title: "Could not save overrides", description: error.message }),
  });

  useEffect(() => setDraft({ include: overrides.include, exclude: overrides.exclude }), [overrides]);

  return (
    <Card>
      <CardHeader
        icon={<Users size={18} />}
        title={<span className="inline-flex items-center gap-1.5">User overrides <InfoTip term="overrides" /></span>}
        description="Force specific users onto or off the new version, whatever the rollout percentage."
      />
      <OverridesFields value={draft} onChange={setDraft} />
      {mutation.error && <Alert tone="danger" title="Save failed" className="mt-3">{mutation.error.message}</Alert>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => mutation.mutate(draft)} loading={mutation.isPending} disabled={!dirty}>Save overrides</Button>
        <Button variant="ghost" icon={<RotateCcw size={15} />} disabled={!dirty || mutation.isPending} onClick={() => setDraft(overrides)}>Discard changes</Button>
        {dirty && <span className="text-xs font-medium text-warning">Unsaved changes</span>}
      </div>
    </Card>
  );
}
