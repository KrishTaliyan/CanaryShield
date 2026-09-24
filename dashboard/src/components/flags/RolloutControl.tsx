import { ChevronsRight, CirclePause, CirclePlay, Power, ShieldCheck, ShieldOff, Undo2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Flag } from "../../api/types";
import { useToast } from "../../hooks/useAppContext";
import { useFlagActions, type FlagAction } from "../../hooks/useFlag";
import { cn } from "../../lib/cn";
import { allowedActions, describeAction } from "../../lib/flagActions";
import { formatRate } from "../../lib/format";
import Button from "../ui/Button";
import Card, { CardHeader } from "../ui/Card";
import ConfirmDialog from "../ui/ConfirmDialog";
import InfoTip from "../ui/InfoTip";
import { ProgressRing } from "../ui/Progress";
import { FlagStatusBadge } from "../ui/StatusBadge";
import Tooltip from "../ui/Tooltip";
import RolloutProgress from "./RolloutProgress";

type Pending =
  | { kind: "start" }
  | { kind: "set"; percentage: number }
  | { kind: "resume" }
  | { kind: "rollback" }
  | { kind: "kill" };

interface RolloutControlProps {
  flag: Flag;
  /** Fewer controls, for lists of rollouts. */
  compact?: boolean;
  className?: string;
}

function eligibleText(flag: Flag) {
  return flag.conditions.length === 0
    ? "all users"
    : `users matching ${flag.conditions.length} targeting condition${flag.conditions.length === 1 ? "" : "s"}`;
}

function guardianText(flag: Flag) {
  const guardrail = flag.guardrail;
  if (!guardrail.enabled) return "Guardrail off: the guardian will not roll this flag back automatically.";
  return `Automatic rollback if the canary error rate stays above ${formatRate(guardrail.errorRateThreshold, 1)} for ${guardrail.consecutiveBreaches} checks in a row (at least ${guardrail.minSamples} requests per check).`;
}

function percentageImpact(flag: Flag, from: number, to: number) {
  const direction = to > from ? "more" : "fewer";
  return (
    <>
      <p>
        {Math.abs(to - from)}% {direction} of eligible traffic ({eligibleText(flag)}) will get the new version,
        for {to}% in total. Users already in the rollout stay in it: buckets are stable.
      </p>
      <p className="mt-1.5">{guardianText(flag)}</p>
    </>
  );
}

/**
 * The rollout control center: current exposure, step controls and the
 * pause, rollback and kill switches. Every change is confirmed with the
 * current state, the new state and the expected impact.
 */
export default function RolloutControl({ flag, compact, className }: RolloutControlProps) {
  const toast = useToast();
  const { runAction, isPending } = useFlagActions(flag.key);
  const allowed = allowedActions(flag);
  const [pending, setPending] = useState<Pending | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  const percentage = flag.rolloutPercentage;
  const ringTone = flag.status === "rolled_back" ? "danger" : flag.status === "paused" ? "warning" : flag.status === "completed" ? "success" : "accent";

  async function execute(action: FlagAction) {
    setDialogError(null);
    try {
      const updated = await runAction(action);
      if (updated) {
        const danger = action.type === "rollback" || action.type === "kill";
        toast({ tone: danger ? "warning" : "success", title: describeAction(action, updated), description: flag.name });
      }
      setPending(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The action failed.";
      setDialogError(message);
      toast({ tone: "error", title: "Rollout action failed", description: message });
    }
  }

  function open(next: Pending) {
    setDialogError(null);
    setPending(next);
  }

  function submitCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(custom);
    if (!custom.trim() || !Number.isFinite(value) || value <= 0 || value > 100) {
      setCustomError("Enter a percentage above 0 and up to 100.");
      return;
    }
    const rounded = Math.round(value * 100) / 100;
    if (rounded === percentage) {
      setCustomError(`The rollout is already at ${percentage}%.`);
      return;
    }
    setCustomError(null);
    open({ kind: "set", percentage: rounded });
  }

  const dialog = (() => {
    if (!pending) return null;
    const firstStep = flag.rolloutSteps[0] ?? 0;
    switch (pending.kind) {
      case "start":
        return {
          title: `Start rolling out ${flag.name}?`,
          tone: "primary" as const,
          current: { label: "Now", value: "0%", hint: "Everyone gets the stable version" },
          after: { label: "After", value: `${firstStep}%`, hint: "Canary starts receiving traffic" },
          impact: percentageImpact(flag, 0, firstStep),
          confirmLabel: `Start at ${firstStep}%`,
          run: () => execute({ type: "rollout", action: "start" }),
        };
      case "set": {
        const target = pending.percentage;
        const isNextStep = flag.status === "rolling_out" && target === allowed.nextStep;
        return {
          title: target >= 100 ? `Release ${flag.name} to everyone?` : `Change rollout to ${target}%?`,
          tone: (target > percentage ? "primary" : "warning") as "primary" | "warning",
          current: { label: "Now", value: `${percentage}%` },
          after: { label: "After", value: `${target}%`, hint: target >= 100 ? "Rollout completes; guardian stops watching" : undefined },
          impact: percentageImpact(flag, percentage, target),
          confirmLabel: target >= 100 ? "Complete rollout" : `Set to ${target}%`,
          run: () => execute(isNextStep ? { type: "rollout", action: "advance" } : { type: "set", percentage: target }),
        };
      }
      case "resume":
        return {
          title: `Resume ${flag.name}?`,
          tone: "primary" as const,
          current: { label: "Now", value: "Paused", hint: `Frozen at ${percentage}%` },
          after: { label: "After", value: "Rolling out", hint: `Still ${percentage}%; steps can advance again` },
          impact: <p>The percentage does not change. Advancing becomes possible again. {guardianText(flag)}</p>,
          confirmLabel: "Resume rollout",
          run: () => execute({ type: "rollout", action: "resume" }),
        };
      case "rollback":
        return {
          title: `Roll back ${flag.name}?`,
          tone: "danger" as const,
          current: { label: "Now", value: `${percentage}%`, hint: "Getting the new version" },
          after: { label: "After", value: "0%", hint: "Everyone on the stable version" },
          impact: (
            <p>
              {percentage}% of eligible traffic returns to the stable version immediately, including users on the include list.
              The flag stays enabled and can be started again later. The reason is saved in the activity log.
            </p>
          ),
          reason: { label: "Reason for rollback", placeholder: "e.g. Checkout errors reported by support", required: true },
          confirmLabel: "Roll back now",
          run: (reason: string) => execute({ type: "rollback", reason }),
        };
      case "kill":
        return {
          title: `Use the kill switch on ${flag.name}?`,
          tone: "danger" as const,
          current: { label: "Now", value: flag.enabled ? `On · ${percentage}%` : "Off" },
          after: { label: "After", value: "Off · 0%", hint: "Disabled for everyone" },
          impact: (
            <p>
              The flag is turned off for every user at once and the rollout resets to 0%. Overrides stop applying.
              Use this when something is badly wrong; a normal rollback is usually enough.
            </p>
          ),
          requireText: flag.key,
          confirmLabel: "Turn flag off",
          run: () => execute({ type: "kill" }),
        };
    }
  })();

  const startButton = allowed.start && (
    <Button variant="primary" icon={<CirclePlay size={16} />} onClick={() => open({ kind: "start" })} disabled={isPending}>
      Start rollout at {flag.rolloutSteps[0] ?? 0}%
    </Button>
  );
  const advanceButton = flag.status === "rolling_out" && (
    <Tooltip content={allowed.nextStep === null ? "Already at the last step" : `Move to the next planned step, ${allowed.nextStep}%`}>
      <Button
        variant="primary"
        icon={<ChevronsRight size={16} />}
        disabled={!allowed.advance || isPending}
        onClick={() => allowed.nextStep !== null && open({ kind: "set", percentage: allowed.nextStep })}
      >
        {allowed.nextStep === null ? "Advance" : allowed.nextStep >= 100 ? "Complete (100%)" : `Advance to ${allowed.nextStep}%`}
      </Button>
    </Tooltip>
  );
  const pauseButton = allowed.pause && (
    <Button
      variant="secondary"
      icon={<CirclePause size={16} />}
      loading={isPending && pending === null}
      disabled={isPending}
      onClick={() => void execute({ type: "rollout", action: "pause" })}
    >
      Pause
    </Button>
  );
  const resumeButton = allowed.resume && (
    <Button variant="primary" icon={<CirclePlay size={16} />} disabled={isPending} onClick={() => open({ kind: "resume" })}>
      Resume
    </Button>
  );
  const rollbackButton = (
    <Button
      variant="danger-soft"
      icon={<Undo2 size={16} />}
      disabled={!allowed.rollback || isPending}
      onClick={() => open({ kind: "rollback" })}
    >
      Roll back
    </Button>
  );

  const confirm = dialog && (
    <ConfirmDialog
      open
      onClose={() => !isPending && setPending(null)}
      title={dialog.title}
      tone={dialog.tone}
      current={dialog.current}
      after={dialog.after}
      impact={dialog.impact}
      reason={"reason" in dialog ? dialog.reason : undefined}
      requireText={"requireText" in dialog ? dialog.requireText : undefined}
      confirmLabel={dialog.confirmLabel}
      onConfirm={(reason) => dialog.run(reason)}
      busy={isPending}
      error={dialogError}
    />
  );

  if (compact) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-3">
          <RolloutProgress flag={flag} className="flex-1" />
          <span className="w-12 text-right text-sm font-semibold tabular text-ink">{percentage}%</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {startButton}
          {advanceButton}
          {pauseButton}
          {resumeButton}
          {allowed.rollback && rollbackButton}
        </div>
        {confirm}
      </div>
    );
  }

  return (
    <Card className={className} aria-labelledby={`rollout-${flag.key}`}>
      <CardHeader
        id={`rollout-${flag.key}`}
        title={<span className="inline-flex items-center gap-1.5">Rollout control center <InfoTip term="rollout" /></span>}
        description="Change who gets the new version. Every change is confirmed and logged."
        actions={<FlagStatusBadge status={flag.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <ProgressRing value={percentage} size={168} thickness={14} tone={ringTone} label={`${percentage}% rollout`}>
            <span className="text-[34px] font-semibold leading-none tracking-tight tabular text-ink">{percentage}%</span>
            <span className="mt-1 text-xs font-medium text-ink-muted">of eligible traffic</span>
          </ProgressRing>
          <p className="max-w-[220px] text-[13px] text-ink-muted">
            <span className="inline-flex items-center gap-1 font-semibold text-ink">Blast radius <InfoTip term="blastRadius" /></span>
            {percentage === 0 ? " Nobody gets the new version." : ` ${percentage}% of ${eligibleText(flag)}.`}
          </p>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">Planned steps</p>
              {!allowed.set && (
                <p className="text-xs text-ink-subtle">
                  {flag.status === "completed" ? "Rollout complete" : "Start the rollout to change steps"}
                </p>
              )}
            </div>
            <RolloutProgress flag={flag} size="md" />
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Set rollout to a planned step">
              {flag.rolloutSteps.map((step) => {
                const current = step === percentage;
                return (
                  <button
                    key={step}
                    type="button"
                    aria-pressed={current}
                    disabled={!allowed.set || current || isPending}
                    onClick={() => open({ kind: "set", percentage: step })}
                    className={cn(
                      "min-w-[58px] rounded-control border px-3 py-1.5 text-sm font-semibold tabular transition-all duration-200 ease-soft",
                      current
                        ? "border-accent/40 bg-accent-soft text-accent shadow-inset-sm"
                        : "border-line bg-surface text-ink shadow-raised-sm hover:-translate-y-px hover:text-accent",
                      "disabled:cursor-not-allowed disabled:hover:translate-y-0",
                      !current && "disabled:opacity-45",
                    )}
                  >
                    {step}%
                  </button>
                );
              })}
            </div>
          </div>

          {allowed.set && (
            <form onSubmit={submitCustom} className="flex flex-wrap items-end gap-2" noValidate>
              <div>
                <label htmlFor={`custom-${flag.key}`} className="mb-1.5 block text-sm font-medium text-ink">Custom percentage</label>
                <div className="flex items-center gap-2">
                  <input
                    id={`custom-${flag.key}`}
                    inputMode="decimal"
                    value={custom}
                    onChange={(event) => {
                      setCustom(event.target.value);
                      setCustomError(null);
                    }}
                    placeholder="e.g. 15"
                    aria-invalid={customError ? true : undefined}
                    aria-describedby={customError ? `custom-${flag.key}-error` : undefined}
                    className="well h-10 w-28 px-3 text-sm tabular text-ink outline-none placeholder:text-ink-subtle focus:border-accent"
                  />
                  <span className="text-sm text-ink-muted">%</span>
                  <Button type="submit" variant="secondary" disabled={isPending}>Set</Button>
                </div>
              </div>
              {customError && <p id={`custom-${flag.key}-error`} className="w-full text-sm text-danger" role="alert">{customError}</p>}
            </form>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line/70 pt-4">
            {startButton}
            {advanceButton}
            {pauseButton}
            {resumeButton}
            {rollbackButton}
            <Button variant="ghost" className="text-danger hover:text-danger" icon={<Power size={16} />} disabled={isPending} onClick={() => open({ kind: "kill" })}>
              Kill switch
            </Button>
          </div>

          <p className={cn("flex items-start gap-2 rounded-control px-3 py-2.5 text-[13px]", flag.guardrail.enabled ? "bg-success-soft/60 text-ink-muted" : "bg-warning-soft/70 text-ink-muted")}>
            {flag.guardrail.enabled
              ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              : <ShieldOff size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />}
            <span>{guardianText(flag)}</span>
          </p>
        </div>
      </div>
      {confirm}
    </Card>
  );
}
