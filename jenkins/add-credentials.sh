#!/usr/bin/env bash
# Creates Jenkins secret-text credentials: admin-token and debug-secret.
# Requires: JENKINS_URL, JENKINS_USER, JENKINS_API_TOKEN env vars, plus
#           ADMIN_TOKEN and DEBUG_SECRET with the actual secret values.
set -euo pipefail

: "${JENKINS_URL:?Set JENKINS_URL (e.g. http://localhost:8080)}"
: "${JENKINS_USER:?Set JENKINS_USER}"
: "${JENKINS_API_TOKEN:?Set JENKINS_API_TOKEN}"
: "${ADMIN_TOKEN:?Set ADMIN_TOKEN with the desired admin-token value}"
: "${DEBUG_SECRET:?Set DEBUG_SECRET with the desired debug-secret value}"

# Crumb is optional: some Jenkins instances disable CSRF protection entirely.
CRUMB=""
CRUMB=$(curl -sSL \
  --user "${JENKINS_USER}:${JENKINS_API_TOKEN}" \
  "${JENKINS_URL}/crumbIssuer/api/json" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['crumbRequestField']+':'+d['crumb'])" 2>/dev/null) || true

create_secret() {
  local cred_id="$1"
  local cred_secret="$2"
  local cred_desc="$3"

  # Pass values via env vars so python3 can JSON-encode them safely,
  # handling any characters that would break raw string interpolation.
  local payload
  payload=$(CRED_ID="${cred_id}" CRED_SECRET="${cred_secret}" CRED_DESC="${cred_desc}" \
    python3 -c "
import json, os
print(json.dumps({
  '': '0',
  'credentials': {
    'scope': 'GLOBAL',
    'id': os.environ['CRED_ID'],
    'description': os.environ['CRED_DESC'],
    'secret': os.environ['CRED_SECRET'],
    '\$class': 'org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl'
  }
}))
")

  local curl_args=(
    -fsSL
    --user "${JENKINS_USER}:${JENKINS_API_TOKEN}"
    --data-urlencode "json=${payload}"
  )
  [[ -n "${CRUMB}" ]] && curl_args+=(-H "${CRUMB}")

  curl "${curl_args[@]}" "${JENKINS_URL}/credentials/store/system/domain/_/createCredentials"

  echo "Created credential: ${cred_id}"
}

create_secret "admin-token"   "${ADMIN_TOKEN}"   "Admin token for simulador-credito-habitacao"
create_secret "debug-secret"  "${DEBUG_SECRET}"  "Debug secret for simulador-credito-habitacao"
