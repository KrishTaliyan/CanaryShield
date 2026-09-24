import {
  Activity,
  BookOpen,
  Boxes,
  Flag,
  FlaskConical,
  Gauge,
  GitBranchPlus,
  HeartPulse,
  Layers,
  LayoutDashboard,
  LineChart,
  Rocket,
  Settings,
  ShieldAlert,
  Siren,
  TestTubeDiagonal,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Shown as "Planned": the backend does not support it yet. */
  planned?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard, description: "What is happening right now" }],
  },
  {
    label: "Release management",
    items: [
      { label: "Feature flags", href: "/flags", icon: Flag, description: "Every flag, its rollout and health" },
      { label: "Rollouts", href: "/rollouts", icon: Rocket, description: "Rollouts in progress, with controls" },
      { label: "Releases", href: "/releases", icon: GitBranchPlus, description: "History of every rollout and its outcome" },
      { label: "Environments", href: "/environments", icon: Layers, description: "Multiple environments", planned: true },
    ],
  },
  {
    label: "Observability",
    items: [
      { label: "Canary health", href: "/health", icon: HeartPulse, description: "Health score and guardian status per flag" },
      { label: "Metrics", href: "/metrics", icon: LineChart, description: "Error rate, latency and traffic charts" },
      { label: "Incidents", href: "/incidents", icon: Siren, description: "Automatic rollbacks and their impact" },
      { label: "Activity", href: "/activity", icon: Activity, description: "Audit log of every change" },
    ],
  },
  {
    label: "Experimentation",
    items: [
      { label: "Playground", href: "/playground", icon: TestTubeDiagonal, description: "Evaluate flags and simulate rollouts" },
      { label: "Experiments", href: "/experiments", icon: FlaskConical, description: "A/B experiments", planned: true },
    ],
  },
  {
    label: "Testing",
    items: [
      { label: "Load generator", href: "/load-generator", icon: Gauge, description: "Live payment traffic and how to drive it" },
      { label: "Chaos testing", href: "/chaos", icon: Zap, description: "Inject failures to prove automatic rollback" },
    ],
  },
  {
    label: "Platform",
    items: [{ label: "Services", href: "/services", icon: Boxes, description: "Status of every component" }],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings, description: "Appearance, notifications and defaults" },
      { label: "Documentation", href: "/docs", icon: BookOpen, description: "How CanaryShield works" },
    ],
  },
];

export const allNavItems = navigation.flatMap((group) => group.items);

export const brandIcon = ShieldAlert;

/** Breadcrumb trail for a pathname. */
export function crumbsFor(pathname: string): Array<{ label: string; href?: string }> {
  const trail: Array<{ label: string; href?: string }> = [{ label: "CanaryShield", href: "/" }];
  if (pathname === "/") return [...trail, { label: "Dashboard" }];
  if (pathname === "/flags/new") return [...trail, { label: "Feature flags", href: "/flags" }, { label: "Create flag" }];
  const flagMatch = pathname.match(/^\/flags\/([^/]+)/);
  if (flagMatch) return [...trail, { label: "Feature flags", href: "/flags" }, { label: decodeURIComponent(flagMatch[1]) }];
  const incidentMatch = pathname.match(/^\/incidents\/([^/]+)/);
  if (incidentMatch) return [...trail, { label: "Incidents", href: "/incidents" }, { label: `Incident ${incidentMatch[1].slice(0, 8)}` }];
  const item = allNavItems.find((nav) => nav.href === pathname);
  return [...trail, { label: item?.label ?? "Not found" }];
}
