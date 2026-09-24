export const featureName = "new_payment_flow";

export const cityOptions = ["All", "Delhi", "Mumbai"];
export const userTypeOptions = ["internal", "beta", "general"];

export const rolloutRings = [
  {
    id: 0,
    key: "ring0",
    name: "Ring 0",
    label: "internal",
    audience: "Internal",
  },
  {
    id: 1,
    key: "ring1",
    name: "Ring 1",
    label: "beta",
    audience: "Beta",
  },
  {
    id: 2,
    key: "ring2",
    name: "Ring 2",
    label: "public",
    audience: "Public",
  },
];

export const previewUsers = [
  { id: 2, name: "Krish", city: "Delhi", type: "internal", cartTotal: 12490 },
  { id: 7, name: "Anika", city: "Delhi", type: "beta", cartTotal: 8790 },
  { id: 18, name: "Kabir", city: "Delhi", type: "beta", cartTotal: 6540 },
  { id: 24, name: "Mira", city: "Mumbai", type: "beta", cartTotal: 11240 },
  { id: 63, name: "Rohan", city: "Delhi", type: "general", cartTotal: 14990 },
  { id: 82, name: "Isha", city: "Mumbai", type: "general", cartTotal: 5490 },
  { id: 105, name: "Tara", city: "Delhi", type: "beta", cartTotal: 9990 },
  { id: 128, name: "Neel", city: "Mumbai", type: "general", cartTotal: 7290 },
];

const typeRank = {
  internal: 0,
  beta: 1,
  general: 2,
};

export const defaultFlagConfig = {
  enabled: true,
  rollout: 5,
  city: "All",
  type: "internal",
  ring: "ring0",
};

export function getRingByKey(ringKey) {
  return rolloutRings.find((ring) => ring.key === ringKey) ?? rolloutRings[0];
}

export function normalizeFeatureConfig(config) {
  return {
    enabled: Boolean(config.enabled),
    rollout: Number(config.rollout ?? config.rolloutPercentage ?? 0),
    city: config.city ?? config.cohort ?? "All",
    type: config.type ?? "internal",
    ring: config.ring ?? "ring0",
  };
}

export function evaluateFeature(user, rawConfig) {
  const config = normalizeFeatureConfig(rawConfig);
  const activeRing = getRingByKey(config.ring);
  const bucket = user.id % 100;
  const checks = {
    killSwitch: config.enabled,
    city: config.city === "All" || user.city === config.city,
    userType: user.type === config.type,
    ring: typeRank[user.type] <= activeRing.id,
    rollout: bucket < config.rollout,
  };
  const enabled =
    checks.killSwitch &&
    checks.city &&
    checks.userType &&
    checks.ring &&
    checks.rollout;

  return {
    feature: featureName,
    enabled,
    variant: enabled ? "new" : "old",
    bucket,
    activeRing,
    checks,
    reason: !checks.killSwitch
      ? "KILL_SWITCH"
      : !checks.city || !checks.userType || !checks.ring
        ? "NOT_COHORT"
        : checks.rollout
          ? "IN_ROLLOUT"
          : "OUT_OF_ROLLOUT",
  };
}

export function projectBlastRadius(users, config, liveTraffic) {
  const enabledUsers = users.filter((user) => evaluateFeature(user, config).enabled);
  const eligibleUsers = users.filter((user) => {
    const decision = evaluateFeature(user, {
      ...config,
      enabled: true,
      rollout: 100,
    });
    return decision.checks.city && decision.checks.userType && decision.checks.ring;
  });

  return {
    enabledUsers,
    eligibleUsers,
    impactedUsers: Math.round((enabledUsers.length / users.length) * liveTraffic),
    eligibleUsersEstimate: Math.round((eligibleUsers.length / users.length) * liveTraffic),
  };
}

export function toApiResponse(config) {
  const normalized = normalizeFeatureConfig(config);

  return {
    enabled: normalized.enabled,
    rollout: normalized.rollout,
    cohort: normalized.city,
    ring: normalized.ring,
  };
}
