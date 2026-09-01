#!/usr/bin/env bash
# PR 50 — Harness de runtime canonico dos containers do OctaClin.
#
# Prova, em Docker real, o que um Dockerfile estatico nao prova: usuario efetivo
# non-root, rootfs read-only com escrita proibida, cap-drop=ALL,
# no-new-privileges, limites de pids/memoria/cpu, healthcheck que chega a
# `healthy`, canario de contexto ausente da imagem e history sem secrets.
#
# Sem recursos externos reais (Neon/Redis externo/Backblaze/OpenAI). Os sidecars
# usados para o backend subir sao Postgres/Redis descartaveis de CI com
# configuracao sintetica — nunca provider de producao.
#
# Contrato (variaveis por servico, definidas pelo workflow):
#   SERVICO CONTEXTO PORTA HEALTH_PATH PIDS_LIMIT MEMORIA CPUS
#   TMPFS_EXTRA (lista separada por espaco de caminhos gravaveis)
#   REDE (host|bridge) ENV_ARGS (flags -e sinteticas, sem secret real)
#   MODO_HEALTH=real   -> executa o CMD real e exige Health.Status=healthy.
#   MODO_HEALTH=factual-> imagem cujo app depende de config/provider (fronteira
#                         do PR 51): mantem o container vivo por um comando
#                         trivial para provar hardening (uid/read-only/caps/
#                         limites) e reporta a health do app como FACTUAL, nunca
#                         PASS. Documente o motivo no relatorio do PR 50.
#   REQUIRE_DOCKER=1 exige Docker (CI); ausente localmente => SKIPPED (exit 0)
set -euo pipefail

falhar() { echo "FAIL: $*" >&2; exit 1; }
info()  { echo "  -> $*"; }

if ! command -v docker >/dev/null 2>&1; then
  if [[ "${REQUIRE_DOCKER:-0}" == "1" ]]; then
    falhar "docker indisponivel com REQUIRE_DOCKER=1"
  fi
  echo "SKIPPED: docker indisponivel (harness de runtime nao executado; SKIPPED != PASS)"
  exit 0
fi

: "${SERVICO:?}"; : "${CONTEXTO:?}"; : "${PORTA:?}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
PIDS_LIMIT="${PIDS_LIMIT:-256}"
MEMORIA="${MEMORIA:-512m}"
CPUS="${CPUS:-1.0}"
REDE="${REDE:-bridge}"
MODO_HEALTH="${MODO_HEALTH:-real}"
IMAGEM="octaclin-${SERVICO}:pr50"
CONTAINER="octaclin-${SERVICO}-pr50"
CANARIO="${CONTEXTO}/secret-canary.txt"

limpar() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -f "$CANARIO" >/dev/null 2>&1 || true
}
trap limpar EXIT

echo "== [$SERVICO] canario de contexto: presente localmente, ausente da imagem =="
echo "SINTETICO-NAO-SECRETO-canario-pr50-$(date +%s)" > "$CANARIO"

echo "== [$SERVICO] build (contexto $CONTEXTO, .dockerignore do contexto ativo) =="
docker build --tag "$IMAGEM" "$CONTEXTO"

# Prova negativa de build context: o canario nao pode ter entrado na imagem.
if docker export "$(docker create "$IMAGEM")" | tar -t 2>/dev/null | grep -q 'secret-canary.txt'; then
  falhar "[$SERVICO] canario proibido presente na imagem final"
fi
info "canario ausente da imagem final: OK"
rm -f "$CANARIO"

echo "== [$SERVICO] docker history sem canario/secret obvio =="
if docker history --no-trunc "$IMAGEM" | grep -Eiq 'secret-canary|PRIVATE KEY|password=|BEGIN RSA'; then
  falhar "[$SERVICO] docker history contem padrao sensivel"
fi
info "history limpo: OK"

echo "== [$SERVICO] auditoria de setuid/setgid (evidencia, nao bloqueante) =="
docker run --rm --entrypoint sh "$IMAGEM" -c \
  'find / -xdev \( -perm -4000 -o -perm -2000 \) -type f 2>/dev/null || true' \
  | sed 's/^/  setuid\/setgid: /' || true

echo "== [$SERVICO] subir hardened =="
declare -a TMPFS_ARGS=(--tmpfs "/tmp:rw,noexec,nosuid,size=64m")
for caminho in ${TMPFS_EXTRA:-}; do
  TMPFS_ARGS+=(--tmpfs "${caminho}:rw,noexec,nosuid,size=64m")
done
declare -a REDE_ARGS=()
[[ "$REDE" == "host" ]] && REDE_ARGS+=(--network host)

# Em modo factual o app depende de config/provider (PR 51): substituimos o
# entrypoint por um comando trivial que roda como o USER da imagem, so para
# provar o hardening sem exigir o boot completo do app.
declare -a MODO_ARGS=()
declare -a CMD_ARGS=()
if [[ "$MODO_HEALTH" == "factual" ]]; then
  MODO_ARGS+=(--entrypoint sh)
  CMD_ARGS+=(-c 'trap : TERM INT; sleep 3600 & wait')
fi

# shellcheck disable=SC2086
docker run -d --name "$CONTAINER" \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --pids-limit="$PIDS_LIMIT" \
  --memory="$MEMORIA" --memory-swap="$MEMORIA" \
  --cpus="$CPUS" \
  "${TMPFS_ARGS[@]}" "${REDE_ARGS[@]}" "${MODO_ARGS[@]}" ${ENV_ARGS:-} \
  "$IMAGEM" "${CMD_ARGS[@]}" >/dev/null
info "container iniciado com --read-only --cap-drop=ALL --security-opt=no-new-privileges pids=$PIDS_LIMIT mem=$MEMORIA cpus=$CPUS (modo_health=$MODO_HEALTH)"

echo "== [$SERVICO] usuario efetivo non-root (nao apenas Config.User) =="
UID_EFETIVO="$(docker exec "$CONTAINER" id -u 2>/dev/null || docker exec "$CONTAINER" sh -c 'echo $(id -u)')"
[[ -n "$UID_EFETIVO" && "$UID_EFETIVO" != "0" ]] || falhar "[$SERVICO] processo executa como root (uid=$UID_EFETIVO)"
info "uid efetivo=$UID_EFETIVO (non-root): OK"
[[ -z "${UID_ESPERADO:-}" || "$UID_EFETIVO" == "$UID_ESPERADO" ]] || falhar "[$SERVICO] uid $UID_EFETIVO != esperado $UID_ESPERADO"

echo "== [$SERVICO] rootfs read-only: escrita proibida falha, tmpfs permitido passa =="
if docker exec "$CONTAINER" sh -c 'echo x > /app/persistencia-nao-autorizada' 2>/dev/null; then
  falhar "[$SERVICO] escrita em /app deveria falhar sob --read-only"
fi
info "escrita em /app negada: OK"
docker exec "$CONTAINER" sh -c 'echo ok > /tmp/harness-ok' || falhar "[$SERVICO] escrita no tmpfs /tmp deveria passar"
info "escrita no tmpfs /tmp permitida: OK"

if [[ "$MODO_HEALTH" == "factual" ]]; then
  echo "== [$SERVICO] healthcheck do app: FACTUAL (nao PASS) =="
  info "app depende de config/provider sintetico completo (fronteira do PR 51);"
  info "hardening (uid/read-only/caps/no-new-privileges/limites) provado acima."
  echo "PASS: [$SERVICO] runtime hardened comprovado (health do app: FACTUAL)."
  exit 0
fi

echo "== [$SERVICO] healthcheck chega a healthy =="
STATUS="starting"
for _ in $(seq 1 60); do
  STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}sem-health{{end}}' "$CONTAINER" 2>/dev/null || echo erro)"
  [[ "$STATUS" == "healthy" ]] && break
  if [[ "$STATUS" == "sem-health" ]]; then falhar "[$SERVICO] imagem sem HEALTHCHECK em runtime"; fi
  sleep 2
done
if [[ "$STATUS" != "healthy" ]]; then
  echo "--- logs do container ---"; docker logs "$CONTAINER" 2>&1 | tail -40 || true
  falhar "[$SERVICO] healthcheck nao chegou a healthy (status=$STATUS)"
fi
info "Health.Status=healthy: OK"

echo "PASS: [$SERVICO] runtime hardened comprovado."
