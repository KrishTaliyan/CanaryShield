#!/usr/bin/env bash
# Seeds the demo flag through the platform API (README S14):
# new_payment_flow with no conditions, the default guardrail and
# u_demo_canary in the include list. Safe to run again: an existing flag is
# reset to that configuration and rolled back to 0% if it is still active.
set -euo pipefail

PLATFORM_URL="${PLATFORM_URL:-http://localhost:8080}"
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-admin-token}"
FLAG_KEY="new_payment_flow"

response="$(mktemp)"
trap 'rm -f "$response"' EXIT

# request METHOD PATH [JSON] prints the HTTP status and saves the body.
request() {
  local method=$1 path=$2 body=${3:-}
  local args=(-sS -o "$response" -w '%{http_code}' -X "$method"
    -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json')
  if [[ -n $body ]]; then
    args+=(-d "$body")
  fi
  curl "${args[@]}" "$PLATFORM_URL/api/v1$path"
}

# expect STEP STATUS ALLOWED... exits with the response body unless STATUS is allowed.
expect() {
  local step=$1 status=$2 ok
  shift 2
  for ok in "$@"; do
    if [[ $status == "$ok" ]]; then
      echo "  ok    $step"
      return
    fi
  done
  echo "  FAIL  $step (HTTP $status)" >&2
  cat "$response" >&2
  echo >&2
  exit 1
}

echo "Waiting for the platform at $PLATFORM_URL ..."
for attempt in $(seq 1 30); do
  if curl -sf "$PLATFORM_URL/healthz" >/dev/null; then
    break
  fi
  if [[ $attempt == 30 ]]; then
    echo "The platform is not reachable at $PLATFORM_URL" >&2
    exit 1
  fi
  sleep 1
done

echo "Seeding $FLAG_KEY"
status=$(request POST /flags \
  "{\"key\":\"$FLAG_KEY\",\"name\":\"New payment flow\",\"description\":\"Payment v2 released as a canary\"}")
expect "create flag" "$status" 201 409

if [[ $status == 409 ]]; then
  echo "  $FLAG_KEY already exists; resetting it"
  status=$(request GET "/flags/$FLAG_KEY")
  expect "read flag" "$status" 200
  if grep -Eq '"status":"(rolling_out|paused|completed)"' "$response"; then
    status=$(request POST "/flags/$FLAG_KEY/rollback" '{"reason":"Reset by seed.sh"}')
    expect "roll back to 0%" "$status" 200
  fi
  status=$(request PUT "/flags/$FLAG_KEY/conditions" '{"conditions":[]}')
  expect "clear conditions" "$status" 200
  status=$(request PUT "/flags/$FLAG_KEY/guardrail" \
    '{"enabled":true,"errorRateThreshold":0.03,"minSamples":20,"consecutiveBreaches":2}')
  expect "default guardrail" "$status" 200
fi

status=$(request PUT "/flags/$FLAG_KEY/overrides" '{"include":["u_demo_canary"],"exclude":[]}')
expect "include u_demo_canary" "$status" 200

echo "Done: $FLAG_KEY is at 0% and ready for the demo."
