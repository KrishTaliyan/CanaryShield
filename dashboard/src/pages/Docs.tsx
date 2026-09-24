import { BookOpen, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import { glossary } from "../lib/glossary";

const sections = [
  { id: "overview", title: "What CanaryShield does" },
  { id: "lifecycle", title: "Flag lifecycle" },
  { id: "evaluation", title: "How a user is evaluated" },
  { id: "guardian", title: "The guardian" },
  { id: "scores", title: "Health score and severity" },
  { id: "demo", title: "Running the demo" },
  { id: "api", title: "API reference" },
  { id: "glossary", title: "Glossary" },
];

const endpoints: Array<[string, string, string]> = [
  ["GET", "/api/v1/flags", "List flags"],
  ["POST", "/api/v1/flags", "Create a flag (key, name, description)"],
  ["GET", "/api/v1/flags/{key}", "One flag"],
  ["PATCH", "/api/v1/flags/{key}", "Change name or description"],
  ["PUT", "/api/v1/flags/{key}/conditions", "Replace targeting conditions"],
  ["PUT", "/api/v1/flags/{key}/overrides", "Replace include/exclude lists"],
  ["PUT", "/api/v1/flags/{key}/guardrail", "Replace the guardrail"],
  ["POST", "/api/v1/flags/{key}/rollout/start", "Start at the first step"],
  ["POST", "/api/v1/flags/{key}/rollout/advance", "Move to the next step"],
  ["POST", "/api/v1/flags/{key}/rollout/set", "Set any percentage (0–100]"],
  ["POST", "/api/v1/flags/{key}/rollout/pause", "Freeze the percentage"],
  ["POST", "/api/v1/flags/{key}/rollout/resume", "Continue a paused rollout"],
  ["POST", "/api/v1/flags/{key}/rollback", "Back to 0% with a reason"],
  ["POST", "/api/v1/flags/{key}/kill", "Turn off for everyone"],
  ["GET", "/api/v1/flags/{key}/events", "Activity log"],
  ["GET", "/api/v1/flags/{key}/health", "Latest guardian reading"],
  ["GET", "/api/v1/flags/{key}/metrics?range=", "Chart series: 5m, 15m, 30m, 1h, 6h, 24h"],
  ["GET", "/api/v1/incidents", "Incidents, optional ?status=open|resolved"],
  ["GET", "/api/v1/incidents/{id}", "One incident"],
  ["POST", "/api/v1/incidents/{id}/resolve", "Mark resolved"],
  ["POST", "/api/v1/playground/evaluate", "Evaluate without side effects"],
  ["GET", "/api/v1/stream?token=", "Server-sent events: flag, rollout, health, incident"],
  ["POST", "/sdk/v1/evaluate", "SDK evaluation (counts exposures and metrics)"],
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <Card>
        <h2 id={`${id}-title`} className="mb-3 text-lg font-semibold tracking-tight text-ink">{title}</h2>
        <div className="space-y-3 text-[14.5px] leading-relaxed text-ink-muted">{children}</div>
      </Card>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[13px] text-ink">{children}</code>;
}

export default function Docs() {
  return (
    <div>
      <PageHeader icon={<BookOpen size={22} />} title="Documentation" description="How CanaryShield releases features safely, and how to run the demo." />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">On this page</p>
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="block rounded-control px-3 py-1.5 text-sm text-ink-muted hover:bg-surface hover:text-ink">{section.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <Section id="overview" title="What CanaryShield does">
            <p>
              CanaryShield ships a new version of a feature to a small share of users first (the <strong className="text-ink">canary</strong>), compares its error
              rate with the stable version (the <strong className="text-ink">baseline</strong>) and widens the rollout step by step. If the canary misbehaves,
              the <strong className="text-ink">guardian</strong> rolls it back automatically, usually within seconds, and opens an incident.
            </p>
            <p>
              The demo app, QuickCart, asks the platform about the flag <Code>new_payment_flow</Code> on every payment. The answer decides whether the payment
              goes through the new or the stable payment flow.
            </p>
          </Section>

          <Section id="lifecycle" title="Flag lifecycle">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink" aria-label="Draft, then rolling out, then completed">
              {["Draft", "Rolling out", "Completed"].map((state, index) => (
                <span key={state} className="inline-flex items-center gap-2">
                  {index > 0 && <ChevronRight size={16} className="text-ink-subtle" aria-hidden="true" />}
                  <span className="rounded-control border border-line bg-surface-2 px-3 py-1.5 shadow-raised-sm">{state}</span>
                </span>
              ))}
            </div>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong className="text-ink">Start</strong> works from Draft or Rolled back and sets the first step (5% by default). It also turns a killed flag back on.</li>
              <li><strong className="text-ink">Advance</strong> moves to the next step (5 → 10 → 25 → 50 → 100%). <strong className="text-ink">Set</strong> picks any percentage. Reaching 100% completes the rollout.</li>
              <li><strong className="text-ink">Pause</strong> freezes the percentage; the guardian keeps watching. <strong className="text-ink">Resume</strong> continues.</li>
              <li><strong className="text-ink">Roll back</strong> (from Rolling out, Paused or Completed) returns to 0% and needs a reason.</li>
              <li><strong className="text-ink">Kill switch</strong> works in any state: the flag is disabled for everyone and resets to 0%.</li>
            </ul>
          </Section>

          <Section id="evaluation" title="How a user is evaluated">
            <p>The first rule that matches wins:</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Draft flag → stable version (<Code>NOT_STARTED</Code>).</li>
              <li>Kill switch on → stable version (<Code>KILL_SWITCH</Code>).</li>
              <li>Rolled back → stable version, include list too (<Code>ROLLED_BACK</Code>).</li>
              <li>User on the exclude list → stable (<Code>OVERRIDE_EXCLUDE</Code>).</li>
              <li>User on the include list → new version (<Code>OVERRIDE_INCLUDE</Code>).</li>
              <li>Targeting conditions not met → stable (<Code>NOT_ELIGIBLE</Code>).</li>
              <li>No user ID → stable (<Code>NO_BUCKET_KEY</Code>).</li>
              <li>
                Otherwise the user ID is hashed with the flag key into a bucket from 0 to 9,999. Buckets below rollout% × 100 get the new version
                (<Code>IN_ROLLOUT</Code>); the rest get the stable one (<Code>OUTSIDE_ROLLOUT</Code>). A user keeps the same bucket, so raising the percentage only adds users.
              </li>
            </ol>
          </Section>

          <Section id="guardian" title="The guardian">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Every 5 seconds, for each flag rolling out or paused, it asks Prometheus for the canary and baseline error rates and the canary request count over the last 30 seconds.</li>
              <li>With fewer requests than the guardrail's minimum samples, it reports “Collecting data” and keeps the breach count as it is.</li>
              <li>A check above the error threshold adds a breach (status Warning). A check at or below it resets the count to zero.</li>
              <li>When breaches reach the configured number in a row, it rolls the flag back to 0%, records who was exposed, opens an incident and broadcasts it to the dashboard.</li>
            </ol>
            <p>With the defaults (3% threshold, 20 samples, 2 checks) a bad canary is rolled back about 10 seconds after errors start, once there is enough traffic.</p>
          </Section>

          <Section id="scores" title="Health score and severity">
            <p>
              The 0–100 <strong className="text-ink">health score</strong> is a summary for people; the guardian never uses it. It weights error rate against the threshold (40),
              availability (20), p95 latency against the baseline (20) and traffic confidence, meaning samples against the minimum (20). Signals without data are left out
              and the rest re-weighted. It is capped at 60 during a Warning and 25 when Breached. Saturation is not scored because QuickCart does not export CPU or memory.
            </p>
            <p>
              Incidents carry no stored severity, so the dashboard derives one: <strong className="text-ink">critical</strong> at 10× the threshold or 50% exposure,
              <strong className="text-ink"> high</strong> at 4× or 25%, <strong className="text-ink">medium</strong> at 2×, otherwise <strong className="text-ink">low</strong>.
            </p>
          </Section>

          <Section id="demo" title="Running the demo">
            <p>From the repository root on Windows:</p>
            <pre className="well overflow-x-auto p-4 font-mono text-[13px] text-ink">.\dev-start.ps1</pre>
            <p>It starts Docker (PostgreSQL, Redis, Prometheus), the platform on :8080, the QuickCart server on :4000, this dashboard on :5173 and the shop on :5174. Then:</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Seed the demo flag once: <Code>bash scripts/seed.sh</Code> (Git Bash).</li>
              <li>Start traffic: <Code>cd loadgen; go run . -rps 30</Code> (see Load generator).</li>
              <li>Start the rollout of <Code>new_payment_flow</Code> and advance it to 25%.</li>
              <li>On Chaos testing, start the “Demo failure” preset and watch the guardian roll back and open an incident.</li>
            </ol>
          </Section>

          <Section id="api" title="API reference">
            <p>Admin endpoints need <Code>Authorization: Bearer &lt;admin token&gt;</Code>. Errors look like <Code>{`{"error":{"code","message"}}`}</Code>.</p>
            <div className="overflow-x-auto rounded-control border border-line/70">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">Platform endpoints</caption>
                <thead className="bg-surface-2/70 text-[12px] uppercase tracking-wide text-ink-subtle">
                  <tr><th scope="col" className="px-3 py-2">Method</th><th scope="col" className="px-3 py-2">Path</th><th scope="col" className="px-3 py-2">Purpose</th></tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {endpoints.map(([method, path, purpose]) => (
                    <tr key={`${method} ${path}`}>
                      <td className="px-3 py-2 font-mono text-[12px] font-semibold text-accent">{method}</td>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-ink">{path}</td>
                      <td className="px-3 py-2 text-ink-muted">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="glossary" title="Glossary">
            <dl className="grid gap-3 sm:grid-cols-2">
              {Object.entries(glossary).map(([term, text]) => (
                <div key={term} className="rounded-control bg-surface-2/70 p-3">
                  <dt className="text-sm font-semibold capitalize text-ink">{term.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                  <dd className="mt-1 text-[13px]">{text}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}
