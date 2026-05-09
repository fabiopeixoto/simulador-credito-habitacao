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

CRUMB=$(curl -fsSL \
  --user "${JENKINS_USER}:${JENKINS_API_TOKEN}" \
  "${JENKINS_URL}/crumbIssuer/api/json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['crumbRequestField']+':'+d['crumb'])")

create_secret() {
  local cred_id="$1"
  local cred_secret="$2"
  local cred_desc="$3"

  local payload
  payload=$(cat <<JSON
{"": "0",
 "credentials": {
   "scope": "GLOBAL",
   "id": "${cred_id}",
   "description": "${cred_desc}",
   "secret": "${cred_secret}",
   "\$class": "org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl"
 }}
JSON
)

  curl -fsSL \
    --user "${JENKINS_USER}:${JENKINS_API_TOKEN}" \
    -H "${CRUMB}" \
    --data-urlencode "json=${payload}" \
    "${JENKINS_URL}/credentials/store/system/domain/_/createCredentials"

  echo "Created credential: ${cred_id}"
}

create_secret "admin-token"   "${ADMIN_TOKEN}"   "Admin token for simulador-credito-habitacao"
create_secret "debug-secret"  "${DEBUG_SECRET}"  "Debug secret for simulador-credito-habitacao"
