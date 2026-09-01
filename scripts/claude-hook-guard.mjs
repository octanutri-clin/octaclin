import { relative, resolve, sep } from 'node:path';

const MAX_PAYLOAD_BYTES = 1024 * 1024;
const PATHS_GOVERNANCA_PROIBIDOS = new Set(['.ai/active_work.md', '.mcp.json']);

function responder(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason
    }
  }));
}

async function lerPayload() {
  let bruto = '';
  process.stdin.setEncoding('utf8');
  for await (const trecho of process.stdin) {
    bruto += trecho;
    if (Buffer.byteLength(bruto, 'utf8') > MAX_PAYLOAD_BYTES) throw new Error('payload excede o limite');
  }
  const payload = JSON.parse(bruto);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('payload invalido');
  return payload;
}

function normalizarPath(pathEntrada) {
  if (typeof pathEntrada !== 'string' || !pathEntrada.trim() || pathEntrada.includes('\0')) return null;
  const raiz = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const absoluto = resolve(raiz, pathEntrada);
  const relativo = relative(raiz, absoluto).split(sep).join('/');
  if (relativo === '..' || relativo.startsWith('../') || /^[A-Za-z]:/.test(relativo)) return null;
  return relativo.toLowerCase();
}

function protegerEscrita(payload) {
  if (!['Edit', 'Write'].includes(payload.tool_name)) {
    responder('ask', 'Protecao de escrita recebeu uma ferramenta inesperada; confirme manualmente.');
    return;
  }
  const path = normalizarPath(payload.tool_input?.file_path ?? payload.tool_input?.filePath);
  if (!path) {
    responder('ask', 'Nao foi possivel provar que o caminho de escrita pertence ao projeto; confirme manualmente.');
    return;
  }

  const nome = path.split('/').at(-1);
  const ehEnv = /^\.env(?:\..+)?$/.test(nome);
  if (ehEnv && nome !== '.env.example') {
    responder('deny', 'Bloqueado: arquivos .env nao podem ser escritos pelo agente.');
    return;
  }
  if (PATHS_GOVERNANCA_PROIBIDOS.has(path) || path.startsWith('.claude/rules/')) {
    responder('deny', 'Bloqueado: este path foi recusado pela decisao final de governanca.');
    return;
  }
  responder('allow', 'Caminho de escrita aprovado pela politica local.');
}

function protegerComando(payload) {
  if (payload.tool_name !== 'Bash') {
    responder('ask', 'Protecao de comando recebeu uma ferramenta inesperada; confirme manualmente.');
    return;
  }
  const comando = payload.tool_input?.command;
  if (typeof comando !== 'string' || !comando.trim() || comando.length > 32768 || comando.includes('\0')) {
    responder('ask', 'Comando ausente, invalido ou grande demais para avaliacao segura.');
    return;
  }

  const comandoCompacto = comando.replace(/\s+/g, ' ');
  const remotoParaShell = /(?:curl|wget|invoke-webrequest|iwr)\b.*?\|\s*(?:(?:\/usr)?\/bin\/)?(?:bash|sh|zsh|pwsh|powershell|iex)\b/i;
  const substituicaoDeProcesso = /(?:bash|sh|zsh)\s+<\(\s*(?:curl|wget)\b/i;
  const baixaEExecuta = /(?:curl|wget|invoke-webrequest|iwr)\b.*?(?:&&|;|\|)\s*(?:(?:\/usr)?\/bin\/)?(?:bash|sh|zsh|pwsh|powershell)\b/i;
  if (remotoParaShell.test(comandoCompacto) || substituicaoDeProcesso.test(comandoCompacto) || baixaEExecuta.test(comandoCompacto)) {
    responder('deny', 'Bloqueado: conteudo remoto nao pode ser encaminhado diretamente a um shell.');
    return;
  }

  const mencionaEnv = /(^|[\\/\s'"`])\.env(?:\.[^\\/\s'"`]*)?/i.test(comandoCompacto);
  const escreveArquivo = /(?:^|[;&|\s])(?:set-content|add-content|out-file|remove-item|del|erase|rm|mv|move|cp|copy|tee)\b|(?:^|[^>])>{1,2}(?!=)/i.test(comandoCompacto);
  if (mencionaEnv && escreveArquivo) {
    responder('deny', 'Bloqueado: comando de shell pode escrever, mover ou remover arquivo .env.');
    return;
  }

  if (/(^|[;&|\s])gog(?:\.exe)?\s|gmail_skill\.py\b/i.test(comandoCompacto)) {
    responder('ask', 'Tooling Google/Gmail pode acessar PII ou executar acao externa; exige aceite humano explicito.');
    return;
  }

  responder('allow', 'Comando nao acionou as restricoes locais de tooling.');
}

async function main() {
  const modo = process.argv[2];
  let payload;
  try {
    payload = await lerPayload();
  } catch {
    responder('ask', 'Payload do hook nao pode ser interpretado com seguranca; confirme manualmente.');
    return;
  }

  if (modo === 'protect-write') protegerEscrita(payload);
  else if (modo === 'protect-command') protegerComando(payload);
  else responder('ask', 'Modo de hook desconhecido; confirme manualmente.');
}

main().catch(() => {
  process.stderr.write('Hook de seguranca falhou antes de emitir uma decisao.\n');
  process.exitCode = 2;
});
