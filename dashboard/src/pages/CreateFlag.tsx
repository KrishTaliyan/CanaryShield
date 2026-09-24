import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, CircleX, ExternalLink, Rocket, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createFlag, setConditions, setGuardrail, setOverrides, setRolloutPercentage, startRollout } from "../api/flags";
import type { Condition, Guardrail, Overrides } from "../api/types";
import { ConditionsFields } from "../components/flags/ConditionsEditor";
import { GuardrailFields } from "../components/flags/GuardrailForm";
import { OverridesFields } from "../components/flags/OverridesEditor";
import Alert from "../components/ui/Alert";
import Button, { ButtonLink } from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import { Field, Input, Textarea } from "../components/ui/Field";
import PageHeader from "../components/ui/PageHeader";
import Spinner from "../components/ui/Spinner";
import { useToast } from "../hooks/useAppContext";
import { useFlags } from "../hooks/useFlags";
import { cn } from "../lib/cn";
import {
  compileConditions,
  compileGuardrail,
  defaultGuardrail,
  describeConditions,
  describeGuardrail,
  sameGuardrail,
  toGuardrailDraft,
  type ConditionDraft,
  type GuardrailDraft,
} from "../lib/targeting";

const steps = [
  { id: "basics", label: "Basics", description: "Name and key" },
  { id: "targeting", label: "Targeting", description: "Who is eligible" },
  { id: "rollout", label: "Rollout", description: "Guardrail and launch" },
  { id: "review", label: "Review", description: "Check and create" },
] as const;

/** Rollout steps every new flag gets (infra/migrations/0001_init.sql). */
const plannedSteps = [5, 10, 25, 50, 100];
const keyPattern = /^[a-z0-9_]{3,64}$/;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
}

type TaskState = "pending" | "running" | "done" | "failed";
interface Task {
  id: string;
  label: string;
  state: TaskState;
  error?: string;
}

export default function CreateFlag() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const flagsQuery = useFlags();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [conditionDrafts, setConditionDrafts] = useState<ConditionDraft[]>([]);
  const [overrides, setOverridesDraft] = useState<Overrides>({ include: [], exclude: [] });
  const [guardrailDraft, setGuardrailDraft] = useState<GuardrailDraft>(() => toGuardrailDraft(defaultGuardrail));
  const [launch, setLaunch] = useState<"draft" | "start">("draft");
  const [startAt, setStartAt] = useState(plannedSteps[0]);
  const [stepError, setStepError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [doneTasks, setDoneTasks] = useState<string[]>([]);

  const running = tasks?.some((task) => task.state === "running") ?? false;
  const keyTaken = flagsQuery.data?.flags.some((flag) => flag.key === key.trim()) ?? false;
  const keyError = !key ? null : !keyPattern.test(key) ? "Use 3–64 lowercase letters, numbers or underscores." : keyTaken ? "A flag with this key already exists." : null;

  function validate(index: number): { conditions?: Condition[]; guardrail?: Guardrail } | null {
    try {
      if (index === 0) {
        if (!name.trim()) throw new Error("Give the flag a name.");
        if (!keyPattern.test(key.trim())) throw new Error("The key must be 3–64 lowercase letters, numbers or underscores.");
        if (keyTaken) throw new Error("A flag with this key already exists. Choose another key.");
      }
      if (index === 1) return { conditions: compileConditions(conditionDrafts) };
      if (index === 2) return { guardrail: compileGuardrail(guardrailDraft) };
      setStepError(null);
      return {};
    } catch (error) {
      setStepError(error instanceof Error ? error.message : "Check this step.");
      return null;
    }
  }

  function next(event?: FormEvent) {
    event?.preventDefault();
    if (!validate(step)) return;
    setStepError(null);
    setStep((current) => Math.min(steps.length - 1, current + 1));
  }

  function goTo(index: number) {
    if (index < step) {
      setStepError(null);
      setStep(index);
    }
  }

  async function create() {
    const conditions = compileConditions(conditionDrafts);
    const guardrail = compileGuardrail(guardrailDraft);
    const flagKey = createdKey ?? key.trim();

    const plan: Array<Task & { run: () => Promise<unknown> }> = [];
    if (!createdKey) plan.push({ id: "create", label: `Create flag ${flagKey}`, state: "pending", run: () => createFlag({ key: flagKey, name: name.trim(), description: description.trim() }) });
    if (conditions.length) plan.push({ id: "conditions", label: `Save ${conditions.length} targeting condition${conditions.length === 1 ? "" : "s"}`, state: "pending", run: () => setConditions(flagKey, conditions) });
    if (overrides.include.length || overrides.exclude.length) plan.push({ id: "overrides", label: "Save user overrides", state: "pending", run: () => setOverrides(flagKey, overrides) });
    if (!sameGuardrail(guardrail, defaultGuardrail)) plan.push({ id: "guardrail", label: "Save guardrail", state: "pending", run: () => setGuardrail(flagKey, guardrail) });
    if (launch === "start") {
      plan.push({ id: "start", label: `Start rollout at ${plannedSteps[0]}%`, state: "pending", run: () => startRollout(flagKey) });
      if (startAt !== plannedSteps[0]) plan.push({ id: "set", label: `Set rollout to ${startAt}%`, state: "pending", run: () => setRolloutPercentage(flagKey, startAt) });
    }

    const remaining = plan.filter((task) => !doneTasks.includes(task.id));
    setTasks(plan.map(({ id, label }) => ({ id, label, state: doneTasks.includes(id) ? "done" : "pending" })));
    for (const task of remaining) {
      setTasks((current) => current?.map((item) => (item.id === task.id ? { ...item, state: "running" } : item)) ?? null);
      try {
        await task.run();
        if (task.id === "create") setCreatedKey(flagKey);
        setDoneTasks((current) => [...current, task.id]);
        setTasks((current) => current?.map((item) => (item.id === task.id ? { ...item, state: "done" } : item)) ?? null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed.";
        setTasks((current) => current?.map((item) => (item.id === task.id ? { ...item, state: "failed", error: message } : item)) ?? null);
        toast({ tone: "error", title: task.id === "create" ? "Could not create the flag" : `Flag created, but "${task.label}" failed`, description: message });
        await queryClient.invalidateQueries({ queryKey: ["flags"] });
        return;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["flags"] });
    toast({
      tone: "success",
      title: `Flag ${flagKey} created`,
      description: launch === "start" ? `Rolling out to ${startAt}% of eligible users. The guardian is watching.` : "Saved as a draft. Nobody gets the new version yet.",
    });
    navigate(`/flags/${encodeURIComponent(flagKey)}`);
  }

  let conditionsSummary = "";
  try {
    conditionsSummary = describeConditions(compileConditions(conditionDrafts));
  } catch {
    conditionsSummary = "Incomplete: go back to Targeting";
  }
  let guardrailSummary = "";
  try {
    guardrailSummary = describeGuardrail(compileGuardrail(guardrailDraft));
  } catch {
    guardrailSummary = "Invalid: go back to Rollout";
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="New flag"
        title="Create a feature flag"
        description="Set it up in four short steps. Nothing reaches users until you start a rollout."
        actions={<ButtonLink to="/flags" variant="ghost" icon={<ArrowLeft size={16} />}>Back to flags</ButtonLink>}
      />

      <nav aria-label="Progress" className="mb-6">
        <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {steps.map((item, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  disabled={!done || running}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-card border p-3 text-left transition-all duration-200 ease-soft",
                    current ? "border-accent/40 bg-surface shadow-raised" : done ? "border-line bg-surface/70 hover:bg-surface" : "border-transparent bg-transparent opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      done ? "bg-success text-on-success" : current ? "bg-accent text-on-accent" : "bg-sunken text-ink-muted shadow-inset-sm",
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check size={16} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{item.label}</span>
                    <span className="block truncate text-xs text-ink-muted">{item.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <form onSubmit={next} noValidate>
        {step === 0 && (
          <Card className="animate-rise-in">
            <CardHeader title="Basics" description="What the flag controls. The key is what your code asks for." />
            <div className="space-y-5">
              <Field label="Name" required hint="Shown in this dashboard, e.g. “New payment flow”.">
                {(props) => (
                  <Input
                    {...props}
                    data-autofocus
                    autoFocus
                    value={name}
                    maxLength={100}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (!keyTouched) setKey(slugify(event.target.value));
                    }}
                    placeholder="New payment flow"
                  />
                )}
              </Field>
              <Field label="Key" required error={keyError} hint="Lowercase letters, numbers and underscores. It cannot be changed later.">
                {(props) => (
                  <Input
                    {...props}
                    value={key}
                    maxLength={64}
                    onChange={(event) => {
                      setKey(event.target.value);
                      setKeyTouched(true);
                    }}
                    placeholder="new_payment_flow"
                    className="font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                )}
              </Field>
              <Field label="Description" hint="Optional. What changes for users, and who to contact.">
                {(props) => <Textarea {...props} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Routes checkout through payment service v2." />}
              </Field>
              <Alert tone="info" title="Owner and tags are not stored yet">
                The platform keeps a name, key and description per flag. Put the owner in the description for now.
              </Alert>
            </div>
          </Card>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-rise-in">
            <Card>
              <CardHeader title="Targeting conditions" description="Only users matching every condition are eligible. Leave empty to include everyone." />
              <ConditionsFields drafts={conditionDrafts} onChange={(drafts) => { setConditionDrafts(drafts); setStepError(null); }} />
            </Card>
            <Card>
              <CardHeader title="User overrides" description="Optional. Force specific users onto or off the new version." />
              <OverridesFields value={overrides} onChange={setOverridesDraft} />
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-rise-in">
            <Card>
              <CardHeader title="Guardrail" description="When the guardian should roll back automatically. The defaults suit most flags." />
              <GuardrailFields draft={guardrailDraft} onChange={(change) => { setGuardrailDraft((current) => ({ ...current, ...change })); setStepError(null); }} />
            </Card>
            <Card>
              <CardHeader title="Launch" description={`Every flag rolls out in steps: ${plannedSteps.join("% → ")}%.`} />
              <fieldset className="grid gap-3 md:grid-cols-2">
                <legend className="sr-only">When to start</legend>
                {([
                  { value: "draft", title: "Save as draft", body: "Create the flag now and start the rollout later from its page.", icon: Save },
                  { value: "start", title: "Start rollout now", body: "Begin sending a small share of traffic to the new version right away.", icon: Rocket },
                ] as const).map((option) => {
                  const Icon = option.icon;
                  const checked = launch === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-card border p-4 transition-all duration-200 ease-soft",
                        checked ? "border-accent/50 bg-accent-soft/40 shadow-inset-sm" : "border-line bg-surface-2/60 hover:border-accent/30",
                      )}
                    >
                      <input type="radio" name="launch" value={option.value} checked={checked} onChange={() => setLaunch(option.value)} className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]" />
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon size={16} className="text-accent" aria-hidden="true" />{option.title}</span>
                        <span className="mt-1 block text-[13px] text-ink-muted">{option.body}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              {launch === "start" && (
                <div className="mt-4 animate-rise-in">
                  <p className="mb-2 text-sm font-medium text-ink">Start at</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Initial rollout percentage">
                    {plannedSteps.filter((value) => value < 100).map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={startAt === value}
                        onClick={() => setStartAt(value)}
                        className={cn(
                          "min-w-[64px] rounded-control border px-3 py-2 text-sm font-semibold tabular transition-all",
                          startAt === value ? "border-accent/50 bg-accent-soft text-accent shadow-inset-sm" : "border-line bg-surface text-ink shadow-raised-sm hover:-translate-y-px",
                        )}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                  {startAt > 10 && (
                    <Alert tone="warning" title="Large first step" className="mt-3">
                      Starting at {startAt}% exposes more users before the guardian has data. 5% is the safest start.
                    </Alert>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {step === 3 && (
          <Card className="animate-rise-in">
            <CardHeader title="Review" description="Check everything before creating the flag." />
            <dl className="divide-y divide-line/70 rounded-control border border-line/70">
              {[
                { label: "Name", value: name.trim(), step: 0 },
                { label: "Key", value: <code className="font-mono">{key.trim()}</code>, step: 0 },
                { label: "Description", value: description.trim() || <span className="text-ink-subtle">None</span>, step: 0 },
                { label: "Eligible users", value: conditionsSummary, step: 1 },
                { label: "Overrides", value: `${overrides.include.length} always on · ${overrides.exclude.length} always off`, step: 1 },
                { label: "Guardrail", value: guardrailSummary, step: 2 },
                { label: "Launch", value: launch === "start" ? `Start now at ${startAt}%` : "Save as draft (0%)", step: 2 },
              ].map((row) => (
                <div key={row.label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <dt className="w-36 shrink-0 text-sm font-medium text-ink-muted">{row.label}</dt>
                  <dd className="min-w-0 flex-1 break-words text-sm text-ink">{row.value}</dd>
                  <button type="button" onClick={() => goTo(row.step)} disabled={running || Boolean(createdKey)} className="self-start text-xs font-semibold text-accent hover:underline disabled:opacity-40">Edit</button>
                </div>
              ))}
            </dl>

            {tasks && (
              <ol className="mt-5 space-y-2" aria-label="Creation progress" aria-live="polite">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2.5 text-sm">
                    {task.state === "running" ? <Spinner size={16} className="mt-0.5 text-accent" />
                      : task.state === "done" ? <CheckCircle2 size={16} className="mt-0.5 text-success" aria-hidden="true" />
                        : task.state === "failed" ? <CircleX size={16} className="mt-0.5 text-danger" aria-hidden="true" />
                          : <Circle size={16} className="mt-0.5 text-ink-subtle" aria-hidden="true" />}
                    <span className={cn(task.state === "failed" ? "text-danger" : task.state === "pending" ? "text-ink-muted" : "text-ink")}>
                      {task.label}
                      {task.error && <span className="block text-xs">{task.error}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {createdKey && tasks?.some((task) => task.state === "failed") && (
              <Alert tone="warning" title="The flag exists, but setup is incomplete" className="mt-4" action={<ButtonLink to={`/flags/${createdKey}`} size="sm" icon={<ExternalLink size={14} />}>Open flag</ButtonLink>}>
                Retry the remaining steps, or finish them on the flag&apos;s page.
              </Alert>
            )}
          </Card>
        )}

        {stepError && <Alert tone="danger" title={stepError} className="mt-4" />}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => goTo(step - 1)} disabled={step === 0 || running || Boolean(createdKey)}>
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button type="submit" variant="primary" iconRight={<ArrowRight size={16} />}>Continue</Button>
          ) : (
            <Button type="button" variant="primary" icon={launch === "start" ? <Rocket size={16} /> : <Save size={16} />} loading={running} onClick={() => void create()}>
              {createdKey ? "Retry remaining steps" : launch === "start" ? `Create and start at ${startAt}%` : "Create flag"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
