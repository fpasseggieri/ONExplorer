#!/bin/sh
set -eu

escape_js() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

PORT="${PORT:-3000}"
KEYCLOAK_URL="$(escape_js "${REACT_APP_KEYCLOAK_URL:-}")"
KEYCLOAK_REALM="$(escape_js "${REACT_APP_KEYCLOAK_REALM:-}")"
KEYCLOAK_CLIENT_ID="$(escape_js "${REACT_APP_KEYCLOAK_CLIENT_ID:-}")"
DEFAULT_BASE_URL="$(escape_js "${REACT_APP_DEFAULT_BASE_URL:-}")"
ENFORCE_DEFAULT_BASE_URL="$(escape_js "${REACT_APP_ENFORCE_DEFAULT_BASE_URL:-}")"

cat > /app/build/env.js <<EOF
window.__ENV__ = {
  REACT_APP_KEYCLOAK_URL: "${KEYCLOAK_URL}",
  REACT_APP_KEYCLOAK_REALM: "${KEYCLOAK_REALM}",
  REACT_APP_KEYCLOAK_CLIENT_ID: "${KEYCLOAK_CLIENT_ID}",
  REACT_APP_DEFAULT_BASE_URL: "${DEFAULT_BASE_URL}",
  REACT_APP_ENFORCE_DEFAULT_BASE_URL: "${ENFORCE_DEFAULT_BASE_URL}"
};
EOF

node /app/server/staticServer.js &
exec node /app/server/expressServer.js "$PORT"
