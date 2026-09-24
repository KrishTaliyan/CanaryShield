package evaluation

// Evaluation reasons (README 9.1).
const (
	ReasonFlagNotFound    = "FLAG_NOT_FOUND"
	ReasonNotStarted      = "NOT_STARTED"
	ReasonKillSwitch      = "KILL_SWITCH"
	ReasonRolledBack      = "ROLLED_BACK"
	ReasonOverrideExclude = "OVERRIDE_EXCLUDE"
	ReasonOverrideInclude = "OVERRIDE_INCLUDE"
	ReasonNotEligible     = "NOT_ELIGIBLE"
	ReasonNoBucketKey     = "NO_BUCKET_KEY"
	ReasonInRollout       = "IN_ROLLOUT"
	ReasonOutsideRollout  = "OUTSIDE_ROLLOUT"
)

// VariantOff is served for flags that do not exist.
const VariantOff = "off"

// NoBucket is reported when the bucket was not computed.
const NoBucket = -1
