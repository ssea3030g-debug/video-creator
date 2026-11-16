#!/bin/bash
# SessionStart hook: start FreeLLMAPI on localhost:3001 and register Gemini + Groq.
# Idempotent and non-blocking: all work runs in the background; any failure is silent.
# Keys are NOT stored here: the cloud environment's proxy injects the real API keys
# for api.groq.com / generativelanguage.googleapis.com, so "proxy-injected" is only a placeholder.
D="${FREELLM_DIR:-$HOME/freellmapi}"
[ -f "$D/server/dist/index.js" ] || exit 0
STATE="$HOME/.freellmapi-session"; mkdir -p "$STATE"
(
  setsid nohup bash -c '
    D="'"$D"'"; STATE="'"$STATE"'"
    if ! curl -s -m 2 -o /dev/null localhost:3001/api/health; then
      cd "$D" && nohup npm run start -w server >"$STATE/server.log" 2>&1 &
    fi
    for i in $(seq 1 30); do curl -s -m 2 -o /dev/null localhost:3001/api/auth/status && break; sleep 1; done
    [ -f "$STATE/token" ] && exit 0   # already registered in this container
    J="content-type: application/json"
    PW="$(openssl rand -hex 16)Aa1!"
    TOKEN=$(curl -s -m 10 -X POST localhost:3001/api/auth/setup -H "$J" -d "{\"email\":\"admin@localhost.test\",\"password\":\"$PW\"}" | sed -n "s/.*\"token\":\"\([^\"]*\)\".*/\1/p")
    [ -n "$TOKEN" ] || exit 0
    H="authorization: Bearer $TOKEN"
    curl -s -m 30 -X POST localhost:3001/api/keys -H "$H" -H "$J" -d "{\"platform\":\"groq\",\"key\":\"proxy-injected\",\"label\":\"env-injected\"}" >/dev/null
    curl -s -m 60 -X POST localhost:3001/api/keys/custom -H "$H" -H "$J" -d "{\"baseUrl\":\"https://generativelanguage.googleapis.com/v1beta/openai\",\"apiKey\":\"proxy-injected\",\"label\":\"gemini-openai-compat\",\"models\":[\"gemini-3.5-flash-lite\",\"gemini-3.1-flash-lite\",\"gemini-3.5-flash\"]}" >/dev/null
    UK=$(curl -s -m 10 localhost:3001/api/settings/api-key -H "$H" | sed -n "s/.*\"apiKey\":\"\([^\"]*\)\".*/\1/p")
    umask 077
    echo "$PW" > "$STATE/dashboard-password"; echo "$UK" > "$STATE/unified-key"; echo "$TOKEN" > "$STATE/token"
  ' >/dev/null 2>&1 &
) >/dev/null 2>&1
exit 0
