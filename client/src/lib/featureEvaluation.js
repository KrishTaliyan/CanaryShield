export const rings = [
  {
    id: 0,
    name: "Ring 0",
    audience: "Internal",
    userTypes: ["internal"],
    budget: "1%",
  },
  {
    id: 1,
    name: "Ring 1",
    audience: "Beta buyers",
    userTypes: ["internal", "beta"],
    budget: "10%",
  },
  {
    id: 2,
    name: "Ring 2",
    audience: "General",
    userTypes: ["internal", "beta", "general"],
    budget: "100%",
  },
];

export const demoUsers = [
  { id: 7, name: "Aarav", city: "Delhi", type: "internal", cartValue: 8420 },
  { id: 18, name: "Meera", city: "Delhi", type: "beta", cartValue: 6190 },
  { id: 23, name: "Kabir", city: "Mumbai", type: "beta", cartValue: 4720 },
  { id: 42, name: "Isha", city: "Delhi", type: "general", cartValue: 12990 },
  { id: 64, name: "Rohan", city: "Bengaluru", type: "general", cartValue: 3599 },
  { id: 81, name: "Naina", city: "Delhi", type: "general", cartValue: 2299 },
  { id: 92, name: "Dev", city: "Pune", type: "internal", cartValue: 9990 },
  { id: 105, name: "Tara", city: "Delhi", type: "beta", cartValue: 7440 },
];

const normalize = (value) => value.trim().toLowerCase();

export function matchesCohort(user, cohortTarget) {
  const target = normalize(cohortTarget);

  if (!target || target === "all") {
    return true;
  }

  return [user.city, user.type].some((value) => normalize(value).includes(target));
}

export function getRingForUser(user) {
  return rings.find((ring) => ring.userTypes.at(-1) === user.type) ?? rings[2];
}

export function evaluateFeature(user, config) {
  if (!config.enabled) {
    return {
      allowed: false,
      reason: "Kill switch disabled",
      checks: { killSwitch: false, cohort: false, ring: false, rollout: false },
    };
  }

  const cohort = matchesCohort(user, config.cohortTarget);
  const userRing = getRingForUser(user);
  const ring = userRing.id <= config.activeRing;
  const bucket = user.id % 100;
  const rollout = bucket < config.rolloutPercentage;
  const allowed = cohort && ring && rollout;

  return {
    allowed,
    bucket,
    userRing,
    reason: allowed
      ? "All targeting checks passed"
      : [
          !cohort && "Cohort mismatch",
          !ring && "Outside active ring",
          !rollout && "Outside rollout bucket",
        ]
          .filter(Boolean)
          .join(", "),
    checks: { killSwitch: true, cohort, ring, rollout },
  };
}

export function getProjectedImpact(users, config, liveTraffic) {
  const enabledUsers = users.filter((user) => evaluateFeature(user, config).allowed);
  const eligibleUsers = users.filter(
    (user) =>
      matchesCohort(user, config.cohortTarget) &&
      getRingForUser(user).id <= config.activeRing,
  );

  return {
    enabledUsers,
    eligibleUsers,
    impacted: Math.round((enabledUsers.length / users.length) * liveTraffic),
    eligible: Math.round((eligibleUsers.length / users.length) * liveTraffic),
  };
}
