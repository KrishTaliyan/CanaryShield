import { useMutation } from "@tanstack/react-query";
import { Braces, Dices, FlaskConical, Play, Plus, Square, Trash2, UserRound, Users } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { evaluateInPlayground } from "../api/flags";
import type { EvaluationReason, EvaluationResult, Persona } from "../api/types";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import { Field, Input, Select } from "../components/ui/Field";
import IconButton from "../components/ui/IconButton";
import InfoTip from "../components/ui/InfoTip";
import PageHeader from "../components/ui/PageHeader";
import { ProgressBar } from "../components/ui/Progress";
import SegmentedControl from "../components/ui/SegmentedControl";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../components/ui/States";
import { FlagStatusBadge } from "../components/ui/StatusBadge";
import Toggle from "../components/ui/Toggle";
import { useToast } from "../hooks/useAppContext";
import { usePersonas } from "../hooks/useData";
import { useFlags } from "../hooks/useFlags";
import { cn } from "../lib/cn";
import { bucketCutoff, parseAttributeValue, reasonConfig, variantLabel } from "../lib/evaluation";
import { describeConditions } from "../lib/targeting";

interface Attribute {
  key: string;
  value: string;
}

interface SimulationResult {
  total: number;
  done: number;
  variants: Record<EvaluationResult["variant"], number>;
  reasons: Partial<Record<EvaluationReason, number>>;
  failed: number;
  rolloutPercentage: number | null;
  running: boolean;
}

const reservedKeys = ["userId", "country", "plan", "betaUser"];

function randomUserId() {
  return `u_${Math.random().toString(36).slice(2, 9)}`;
}

function BucketBar({ result }: { result: EvaluationResult }) {
  const cutoff = bucketCutoff(result.rolloutPercentage);
  const hasBucket = result.bucket >= 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1">Bucket <InfoTip term="bucket" /></span>
        <span className="tabular">cutoff {cutoff} ({result.rolloutPercentage}%)</span>
      </div>
      <div className="well relative h-6 overflow-visible rounded-full p-0">
        <div className="h-full rounded-full bg-accent/25" style={{ width: `${Math.min(100, result.rolloutPercentage)}%` }} aria-hidden="true" />
        {hasBucket && (
          <span
            className={cn("absolute top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-raised-sm", result.bucket < cutoff ? "bg-success" : "bg-info")}
            style={{ left: `${result.bucket / 100}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular text-ink-subtle" aria-hidden="true"><span>0</span><span>9,999</span></div>
      <p className="mt-2 text-[13px] text-ink-muted">
        {hasBucket
          ? <>This user always lands in bucket <strong className="tabular text-ink">{result.bucket}</strong> for this flag. {result.bucket < cutoff ? "It is below" : "It is not below"} the cutoff of {cutoff}.</>
          : "No bucket was computed: the decision was made before the rollout percentage applied."}
      </p>
    </div>
  );
}

export default function Playground() {
  const toast = useToast();
  const flagsQuery = useFlags();
  const personas = usePersonas();
  const [params, setParams] = useSearchParams();
  const [userId, setUserId] = useState("u_playground");
  const [country, setCountry] = useState("India");
  const [plan, setPlan] = useState<"free" | "premium">("free");
  const [betaUser, setBetaUser] = useState(false);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [showJson, setShowJson] = useState(false);
  const [sampleSize, setSampleSize] = useState<"50" | "100" | "250">("100");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [personaResults, setPersonaResults] = useState<Array<{ persona: Persona; result?: EvaluationResult; error?: string }> | null>(null);
  const cancelRef = useRef(false);
  const evaluation = useMutation({ mutationFn: evaluateInPlayground });

  const flags = flagsQuery.data?.flags ?? [];
  const flagKey = params.get("flag") && flags.some((flag) => flag.key === params.get("flag")) ? params.get("flag")! : flags[0]?.key ?? "";
  const flag = flags.find((item) => item.key === flagKey);

  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

  function context(forUser = userId.trim()) {
    const value: Record<string, unknown> = { userId: forUser, country: country.trim(), plan, betaUser };
    for (const attribute of attributes) {
      if (attribute.key.trim() && !reservedKeys.includes(attribute.key.trim())) value[attribute.key.trim()] = parseAttributeValue(attribute.value);
    }
    return value;
  }

  function selectFlag(key: string) {
    setParams({ flag: key }, { replace: true });
    evaluation.reset();
    setSimulation(null);
    setPersonaResults(null);
  }

  function applyPersona(persona: Persona) {
    setUserId(persona.userId);
    setCountry(persona.country);
    setPlan(persona.plan);
    setBetaUser(persona.betaUser);
    evaluation.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    evaluation.mutate({ flagKey, context: context() }, {
      onError: (error) => toast({ tone: "error", title: "Evaluation failed", description: error.message }),
    });
  }

  async function simulate() {
    const total = Number(sampleSize);
    cancelRef.current = false;
    const state: SimulationResult = { total, done: 0, variants: { new: 0, old: 0, off: 0 }, reasons: {}, failed: 0, rolloutPercentage: null, running: true };
    setSimulation({ ...state });
    let next = 0;
    async function worker() {
      while (next < total && !cancelRef.current) {
        const index = next++;
        const id = `sim_user_${String(index + 1).padStart(4, "0")}`;
        try {
          const result = await evaluateInPlayground({ flagKey, context: context(id) });
          state.variants[result.variant] += 1;
          state.reasons[result.reason] = (state.reasons[result.reason] ?? 0) + 1;
          state.rolloutPercentage = result.rolloutPercentage;
        } catch {
          state.failed += 1;
        }
        state.done += 1;
        setSimulation({ ...state, variants: { ...state.variants }, reasons: { ...state.reasons } });
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker));
    state.running = false;
    setSimulation({ ...state, variants: { ...state.variants }, reasons: { ...state.reasons } });
    if (cancelRef.current) return;
    toast({ tone: state.failed ? "warning" : "success", title: `Simulated ${state.done} users`, description: `${state.variants.new} got the new version${state.failed ? `, ${state.failed} requests failed` : ""}.` });
  }

  async function evaluatePersonas() {
    const list = personas.data ?? [];
    setPersonaResults(list.map((persona) => ({ persona })));
    const results = await Promise.all(list.map(async (persona) => {
      try {
        const result = await evaluateInPlayground({ flagKey, context: { userId: persona.userId, country: persona.country, plan: persona.plan, betaUser: persona.betaUser } });
        return { persona, result };
      } catch (error) {
        return { persona, error: error instanceof Error ? error.message : "Failed" };
      }
    }));
    setPersonaResults(results);
    toast({ tone: "success", title: `Evaluated ${results.length} personas against ${flagKey}` });
  }

  const result = evaluation.data;
  const reason = result ? reasonConfig[result.reason] : null;
  const simulationBusy = simulation?.running ?? false;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Playground"
        description="Ask the platform what a user would get, without touching real traffic. Evaluations here are side-effect free: they are not counted as exposures or metrics."
      />

      {flagsQuery.isError ? (
        <ErrorState title="Could not load flags" message={flagsQuery.error.message} onRetry={() => void flagsQuery.refetch()} />
      ) : flagsQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2"><SkeletonCard lines={6} /><SkeletonCard lines={6} /></div>
      ) : flags.length === 0 ? (
        <EmptyState icon={<FlaskConical size={22} />} title="No flags to evaluate" description="Create a flag first." action={<Link to="/flags/new" className="text-sm font-semibold text-accent hover:underline">Create a flag</Link>} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader icon={<UserRound size={18} />} title="Who is asking" description="The context an SDK would send with the request." />
              <form onSubmit={submit} className="space-y-4">
                <Field label="Flag">
                  {(props) => (
                    <Select {...props} value={flagKey} onChange={(event) => selectFlag(event.target.value)}>
                      {flags.map((item) => <option key={item.key} value={item.key}>{item.name} ({item.key})</option>)}
                    </Select>
                  )}
                </Field>
                {flag && (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <FlagStatusBadge status={flag.status} /> {flag.rolloutPercentage}% rollout · {describeConditions(flag.conditions)}
                  </p>
                )}

                {personas.data && personas.data.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-ink">Quick fill from QuickCart personas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {personas.data.map((persona) => (
                        <button
                          key={persona.userId}
                          type="button"
                          onClick={() => applyPersona(persona)}
                          aria-pressed={userId === persona.userId}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            userId === persona.userId ? "border-accent/50 bg-accent-soft text-accent" : "border-line bg-surface-2 text-ink-muted hover:text-ink",
                          )}
                        >
                          {persona.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {personas.isError && <p className="text-xs text-ink-subtle">Personas unavailable: QuickCart is not reachable. You can still type a context.</p>}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="User ID" hint="Decides the bucket.">
                    {(props) => (
                      <div className="flex gap-2">
                        <Input {...props} value={userId} onChange={(event) => setUserId(event.target.value)} className="font-mono" autoComplete="off" />
                        <IconButton label="Random user ID" icon={<Dices size={16} />} onClick={() => setUserId(randomUserId())} />
                      </div>
                    )}
                  </Field>
                  <Field label="Country">
                    {(props) => <Input {...props} value={country} onChange={(event) => setCountry(event.target.value)} list="playground-countries" />}
                  </Field>
                </div>
                <datalist id="playground-countries">
                  {["India", "US", "UK", "Germany", "Singapore"].map((value) => <option key={value} value={value} />)}
                </datalist>
                <div className="grid items-end gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-ink">Plan</p>
                    <SegmentedControl label="Plan" value={plan} onChange={setPlan} options={[{ value: "free", label: "Free" }, { value: "premium", label: "Premium" }]} />
                  </div>
                  <Toggle checked={betaUser} onChange={setBetaUser} label="Beta user" />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">Custom attributes</p>
                    <Button type="button" size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setAttributes((list) => [...list, { key: "", value: "" }])}>Add</Button>
                  </div>
                  {attributes.length === 0 ? (
                    <p className="text-xs text-ink-subtle">Add any attribute your targeting conditions use. “true”, “false” and numbers are sent as those types.</p>
                  ) : (
                    <div className="space-y-2">
                      {attributes.map((attribute, index) => (
                        <div key={index} className="flex gap-2">
                          <input aria-label={`Attribute ${index + 1} name`} value={attribute.key} placeholder="appVersion" onChange={(event) => setAttributes((list) => list.map((item, row) => (row === index ? { ...item, key: event.target.value } : item)))} className="well h-9 min-w-0 flex-1 px-3 font-mono text-sm text-ink outline-none focus:border-accent" />
                          <input aria-label={`Attribute ${index + 1} value`} value={attribute.value} placeholder="5.2" onChange={(event) => setAttributes((list) => list.map((item, row) => (row === index ? { ...item, value: event.target.value } : item)))} className="well h-9 min-w-0 flex-1 px-3 text-sm text-ink outline-none focus:border-accent" />
                          <IconButton label={`Remove attribute ${index + 1}`} icon={<Trash2 size={15} />} variant="ghost" onClick={() => setAttributes((list) => list.filter((_, row) => row !== index))} />
                        </div>
                      ))}
                      {attributes.some((attribute) => reservedKeys.includes(attribute.key.trim())) && (
                        <p className="text-xs text-warning">userId, country, plan and betaUser come from the fields above; duplicates here are ignored.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
                  <Button type="submit" variant="primary" icon={<Play size={16} />} loading={evaluation.isPending} disabled={!flagKey}>Evaluate</Button>
                  <Button type="button" variant="ghost" icon={<Braces size={15} />} onClick={() => setShowJson((value) => !value)} aria-expanded={showJson}>{showJson ? "Hide" : "Show"} request</Button>
                </div>
                {showJson && (
                  <pre className="well overflow-x-auto p-3 font-mono text-xs text-ink">{JSON.stringify({ flagKey, context: context() }, null, 2)}</pre>
                )}
              </form>
            </Card>

            <Card className="flex flex-col" aria-live="polite">
              <CardHeader title="Result" description="What the platform decided, and why." />
              {evaluation.isError ? (
                <ErrorState compact title="Evaluation failed" message={evaluation.error.message} />
              ) : !result || !reason ? (
                <EmptyState compact icon={<Play size={20} />} title="No evaluation yet" description="Fill in a context and press Evaluate." className="flex-1" />
              ) : (
                <div className="space-y-5 animate-rise-in">
                  <div className={cn("rounded-card border p-5 text-center", result.variant === "new" ? "border-success/30 bg-success-soft/50" : result.variant === "off" ? "border-danger/30 bg-danger-soft/40" : "border-line bg-surface-2/70")}>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">Serves</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">{variantLabel(result.variant)}</p>
                    <p className="mt-1 font-mono text-xs text-ink-muted">variant “{result.variant}”</p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={reason.tone} size="md">{reason.label}</Badge>
                      <code className="font-mono text-xs text-ink-subtle">{result.reason}</code>
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">{reason.explanation}</p>
                  </div>
                  <BucketBar result={result} />
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div className="well px-3 py-2"><dt className="text-[11px] font-semibold uppercase text-ink-subtle">Rollout</dt><dd className="font-semibold tabular text-ink">{result.rolloutPercentage}%</dd></div>
                    <div className="well px-3 py-2"><dt className="text-[11px] font-semibold uppercase text-ink-subtle">Flag version</dt><dd className="font-semibold tabular text-ink">{result.flagVersion}</dd></div>
                  </dl>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader
                icon={<Dices size={18} />}
                title="Simulate many users"
                description="Evaluates synthetic user IDs (sim_user_0001, 0002, …) with the country, plan and attributes above. Every answer comes from the real platform."
              />
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl label="Number of users" value={sampleSize} onChange={setSampleSize} options={[{ value: "50", label: "50" }, { value: "100", label: "100" }, { value: "250", label: "250" }]} />
                {simulationBusy ? (
                  <Button icon={<Square size={14} />} onClick={() => { cancelRef.current = true; }}>Stop</Button>
                ) : (
                  <Button variant="primary" icon={<Play size={16} />} onClick={() => void simulate()} disabled={!flagKey}>Run simulation</Button>
                )}
              </div>
              {simulation && (
                <div className="mt-5 space-y-4">
                  <ProgressBar value={simulation.done} max={simulation.total} label="Simulation progress" tone="accent" />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {(["new", "old", "off"] as const).map((variant) => (
                      <div key={variant} className="well px-2 py-3">
                        <p className="text-[11px] font-semibold uppercase text-ink-subtle">{variantLabel(variant)}</p>
                        <p className="mt-1 text-xl font-semibold tabular text-ink">{simulation.variants[variant]}</p>
                        <p className="text-xs tabular text-ink-muted">{simulation.done ? Math.round((simulation.variants[variant] / simulation.done) * 100) : 0}%</p>
                      </div>
                    ))}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {Object.entries(simulation.reasons).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
                      <li key={key} className="flex items-center justify-between gap-2">
                        <Badge tone={reasonConfig[key as EvaluationReason].tone}>{reasonConfig[key as EvaluationReason].label}</Badge>
                        <span className="tabular text-ink-muted">{count}</span>
                      </li>
                    ))}
                  </ul>
                  {simulation.rolloutPercentage !== null && !simulation.running && (
                    <p className="text-xs text-ink-subtle">
                      With a {simulation.rolloutPercentage}% rollout, roughly {simulation.rolloutPercentage}% of eligible users should get the new version. Small samples vary.
                    </p>
                  )}
                  {simulation.failed > 0 && <Alert tone="warning" title={`${simulation.failed} requests failed`}>The platform did not answer some requests; they are not counted above.</Alert>}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                icon={<Users size={18} />}
                title="All personas"
                description="The demo shoppers QuickCart offers at checkout, evaluated against this flag."
                actions={<Button size="sm" onClick={() => void evaluatePersonas()} disabled={!personas.data?.length || !flagKey}>Evaluate all</Button>}
              />
              {personas.isPending ? <SkeletonCard className="shadow-none" /> : personas.isError ? (
                <ErrorState compact title="Personas unavailable" message={personas.error.message} onRetry={() => void personas.refetch()} />
              ) : !personaResults ? (
                <EmptyState compact icon={<Users size={20} />} title="Not evaluated yet" description={`${personas.data.length} personas ready.`} />
              ) : (
                <ul className="divide-y divide-line/70">
                  {personaResults.map(({ persona, result: personaResult, error }) => (
                    <li key={persona.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{persona.name}</p>
                        <p className="truncate font-mono text-xs text-ink-subtle">{persona.userId} · {persona.country} · {persona.plan}{persona.betaUser ? " · beta" : ""}</p>
                      </div>
                      {error ? <Badge tone="danger">Failed</Badge> : personaResult ? (
                        <>
                          <Badge tone={reasonConfig[personaResult.reason].tone}>{reasonConfig[personaResult.reason].label}</Badge>
                          <span className={cn("w-28 text-right text-sm font-semibold", personaResult.variant === "new" ? "text-success" : "text-ink-muted")}>{variantLabel(personaResult.variant)}</span>
                        </>
                      ) : <span className="text-xs text-ink-subtle">Evaluating…</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
