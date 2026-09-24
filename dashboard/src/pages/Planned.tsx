import { ArrowRight, FlaskConical, Layers } from "lucide-react";
import Badge from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";

const features = {
  environments: {
    icon: Layers,
    title: "Environments",
    summary: "Separate flag configurations for staging and production, promoted from one to the next.",
    today: "The platform runs a single environment. Every flag, rollout and incident on this dashboard belongs to it.",
    needs: ["An environment dimension on flags, rollouts and events in the database", "Per-environment SDK keys", "A promotion flow with its own approvals"],
    alternative: { label: "Manage flags", href: "/flags" },
  },
  experiments: {
    icon: FlaskConical,
    title: "Experiments",
    summary: "A/B tests with goal metrics and statistical significance, built on the same bucketing as rollouts.",
    today: "Rollouts compare canary and baseline error rates and latency, which covers safety but not business goals such as conversion.",
    needs: ["Goal metrics reported by applications", "Assignment logging for analysis", "Significance calculations"],
    alternative: { label: "Compare canary vs baseline", href: "/metrics" },
  },
} as const;

/** An honest placeholder for a navigation item the backend cannot support yet. */
export default function Planned({ feature }: { feature: keyof typeof features }) {
  const config = features[feature];
  const Icon = config.icon;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={<Icon size={22} />} title={config.title} description={config.summary} meta={<Badge tone="info" size="md">Planned · not available yet</Badge>} />
      <Card className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-ink">What exists today</h2>
          <p className="mt-1 text-sm text-ink-muted">{config.today}</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-ink">What it needs</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            {config.needs.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <p className="rounded-control bg-surface-2 px-3 py-2.5 text-[13px] text-ink-muted">
          Nothing on this page is interactive, because the platform has no API for it. It is listed so the navigation shows where the product is heading.
        </p>
        <ButtonLink to={config.alternative.href} variant="primary" iconRight={<ArrowRight size={15} />}>{config.alternative.label}</ButtonLink>
      </Card>
    </div>
  );
}
