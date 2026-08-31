import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZES_SKILLS = ['.agents/skills', '.claude/skills'];
const RAIZES_CURTAS_PERMITIDAS = new Set(['.agents', '.claude']);
const EXTENSOES_EXECUTAVEIS = new Set(['.cjs', '.js', '.mjs', '.ps1', '.py', '.sh', '.ts']);
const CAPACIDADES_PERMITIDAS = new Set(['local-read', 'test-only', 'workspace-write-synthetic']);
const PATHS_PROIBIDOS = ['.ai/ACTIVE_WORK.md', '.mcp.json'];
const HOOKS_CLAUDE_PERMITIDOS = [
  "node -e \"const{spawnSync}=require('node:child_process');const{join}=require('node:path');const root=process.env.CLAUDE_PROJECT_DIR;if(!root)process.exit(2);const r=spawnSync(process.execPath,[join(root,'scripts','claude-hook-guard.mjs'),'protect-command'],{stdio:'inherit'});process.exit(r.status??2)\"",
  "node -e \"const{spawnSync}=require('node:child_process');const{join}=require('node:path');const root=process.env.CLAUDE_PROJECT_DIR;if(!root)process.exit(2);const r=spawnSync(process.execPath,[join(root,'scripts','claude-hook-guard.mjs'),'protect-write'],{stdio:'inherit'});process.exit(r.status??2)\""
];
const HOOK_POR_MATCHER = new Map([
  ['Bash', HOOKS_CLAUDE_PERMITIDOS[0]],
  ['Edit|Write', HOOKS_CLAUDE_PERMITIDOS[1]]
]);
const ACOES_IA = [
  'anthropics/claude-code-action',
  'google-github-actions/run-gemini-cli',
  'google-gemini/gemini-cli-action',
  'openai/codex-action',
  'actions/ai-inference'
];

function caminhoPosix(caminho) {
  return caminho.split(sep).join('/');
}

async function existe(caminho) {
  try {
    await lstat(caminho);
    return true;
  } catch {
    return false;
  }
}

async function listarArquivos(raiz, atual = raiz, violacoes = []) {
  if (!(await existe(atual))) return [];
  const info = await lstat(atual);
  if (info.isSymbolicLink()) {
    violacoes.push({ codigo: 'SYMLINK_NAO_PERMITIDO', path: caminhoPosix(relative(raiz, atual)) });
    return [];
  }
  if (info.isFile()) return [atual];
  if (!info.isDirectory()) return [];

  const nomes = await readdir(atual);
  const filhos = await Promise.all(nomes.map((nome) => listarArquivos(raiz, resolve(atual, nome), violacoes)));
  return filhos.flat();
}

async function sha256(caminho) {
  return createHash('sha256').update(await readFile(caminho)).digest('hex');
}

async function carregarJson(caminho, violacoes, codigo) {
  try {
    return JSON.parse(await readFile(caminho, 'utf8'));
  } catch {
    violacoes.push({ codigo, path: caminhoPosix(caminho) });
    return null;
  }
}

async function auditarSkills(raiz, allowlist, violacoes) {
  const skillsListadas = Array.isArray(allowlist.trustedSkills) ? allowlist.trustedSkills : [];
  if (!Array.isArray(allowlist.trustedSkills)) {
    violacoes.push({ codigo: 'ALLOWLIST_ESTRUTURA_INVALIDA', path: 'trustedSkills' });
  }
  const skillsConfiaveis = new Map();
  for (const item of skillsListadas) {
    if (skillsConfiaveis.has(item.name)) violacoes.push({ codigo: 'SKILL_DUPLICADA', path: String(item.name) });
    skillsConfiaveis.set(item.name, item);
  }

  for (const raizRelativa of RAIZES_SKILLS) {
    const raizAbsoluta = resolve(raiz, raizRelativa);
    if (!(await existe(raizAbsoluta))) continue;
    const diretorios = await readdir(raizAbsoluta, { withFileTypes: true });
    for (const diretorio of diretorios.filter((item) => item.isDirectory())) {
      const confiavel = skillsConfiaveis.get(diretorio.name);
      const raizCurta = raizRelativa.split('/')[0];
      if (!confiavel || !(confiavel.roots ?? RAIZES_SKILLS.map((item) => item.split('/')[0])).includes(raizCurta)) {
        violacoes.push({ codigo: 'SKILL_NAO_LISTADA', path: `${raizRelativa}/${diretorio.name}` });
      }
    }
  }

  for (const skill of skillsConfiaveis.values()) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(skill.name)) {
      violacoes.push({ codigo: 'NOME_SKILL_INVALIDO', path: skill.name });
      continue;
    }
    if (!['instruction-only', 'local-workspace-tool'].includes(skill.mode)) {
      violacoes.push({ codigo: 'MODO_SKILL_INVALIDO', path: skill.name });
    }
    const raizes = skill.roots ?? ['.agents', '.claude'];
    if (!Array.isArray(raizes) || !raizes.length || raizes.some((item) => !RAIZES_CURTAS_PERMITIDAS.has(item))) {
      violacoes.push({ codigo: 'ROOT_SKILL_INVALIDO', path: skill.name });
      continue;
    }
    for (const raizCurta of raizes) {
      const skillPath = resolve(raiz, raizCurta, 'skills', skill.name);
      if (!(await existe(resolve(skillPath, 'SKILL.md')))) {
        violacoes.push({ codigo: 'SKILL_LISTADA_AUSENTE', path: caminhoPosix(relative(raiz, skillPath)) });
      }
    }
  }
}

async function auditarExecutaveis(raiz, allowlist, violacoes) {
  const arquivos = [];
  for (const raizRelativa of RAIZES_SKILLS) {
    arquivos.push(...(await listarArquivos(raiz, resolve(raiz, raizRelativa), violacoes)));
  }

  const executaveis = arquivos
    .filter((arquivo) => EXTENSOES_EXECUTAVEIS.has(extname(arquivo).toLowerCase()))
    .map((arquivo) => caminhoPosix(relative(raiz, arquivo)))
    .sort();
  const executaveisListados = Array.isArray(allowlist.executableFiles) ? allowlist.executableFiles : [];
  if (!Array.isArray(allowlist.executableFiles)) {
    violacoes.push({ codigo: 'ALLOWLIST_ESTRUTURA_INVALIDA', path: 'executableFiles' });
  }
  const listados = new Map();
  for (const item of executaveisListados) {
    if (listados.has(item.path)) violacoes.push({ codigo: 'EXECUTAVEL_DUPLICADO', path: String(item.path) });
    listados.set(item.path, item);
  }

  for (const arquivo of executaveis) {
    if (!listados.has(arquivo)) violacoes.push({ codigo: 'EXECUTAVEL_NAO_LISTADO', path: arquivo });
  }

  for (const [path, item] of listados) {
    if (!/^(?:\.agents|\.claude)\/skills\/[a-z0-9-]+\//.test(path) || path.includes('..') || path.includes('\\')) {
      violacoes.push({ codigo: 'PATH_EXECUTAVEL_INVALIDO', path });
      continue;
    }
    if (!CAPACIDADES_PERMITIDAS.has(item.capability)) {
      violacoes.push({ codigo: 'CAPACIDADE_NAO_PERMITIDA', path });
    }
    const nomeSkill = path.split('/')[2];
    const skill = (allowlist.trustedSkills ?? []).find((itemSkill) => itemSkill.name === nomeSkill);
    if (!skill || skill.mode !== 'local-workspace-tool') {
      violacoes.push({ codigo: 'EXECUTAVEL_EM_SKILL_INSTRUCIONAL', path });
    }
    const absoluto = resolve(raiz, path);
    if (!(await existe(absoluto))) {
      violacoes.push({ codigo: 'EXECUTAVEL_LISTADO_AUSENTE', path });
      continue;
    }
    const hash = await sha256(absoluto);
    if (hash !== String(item.sha256).toLowerCase()) {
      violacoes.push({ codigo: 'HASH_DIVERGENTE', path });
    }
  }
}

async function auditarHooks(raiz, allowlist, violacoes) {
  const settingsPath = resolve(raiz, '.claude/settings.json');
  const settings = await carregarJson(settingsPath, violacoes, 'SETTINGS_INVALIDO');
  if (!settings) return;

  if (JSON.stringify(Object.keys(settings).sort()) !== JSON.stringify(['hooks'])) {
    violacoes.push({ codigo: 'SETTINGS_AUTORIDADE_EXTRA', path: '.claude/settings.json' });
  }
  if (JSON.stringify(Object.keys(settings.hooks ?? {}).sort()) !== JSON.stringify(['PreToolUse'])) {
    violacoes.push({ codigo: 'HOOK_EVENTO_NAO_PERMITIDO', path: '.claude/settings.json' });
  }

  const grupos = settings.hooks?.PreToolUse ?? [];
  if (grupos.length !== HOOK_POR_MATCHER.size) {
    violacoes.push({ codigo: 'HOOK_ESTRUTURA_INVALIDA', path: '.claude/settings.json' });
  }
  for (const grupo of grupos) {
    const hooks = grupo.hooks ?? [];
    const esperado = HOOK_POR_MATCHER.get(grupo.matcher);
    const chavesGrupoValidas = Object.keys(grupo).every((chave) => ['hooks', 'matcher'].includes(chave));
    const chavesHookValidas = hooks.length === 1
      && Object.keys(hooks[0]).every((chave) => ['command', 'statusMessage', 'timeout', 'type'].includes(chave));
    if (!esperado || !chavesGrupoValidas || !chavesHookValidas || hooks[0].type !== 'command' || hooks[0].command !== esperado) {
      violacoes.push({ codigo: 'HOOK_ESTRUTURA_INVALIDA', path: `.claude/settings.json:${grupo.matcher ?? 'sem-matcher'}` });
    }
  }

  const comandos = Object.values(settings.hooks ?? {})
    .flat()
    .flatMap((grupo) => grupo.hooks ?? [])
    .filter((hook) => hook.type === 'command')
    .map((hook) => hook.command)
    .sort();
  const esperados = [...(allowlist.claudeHookCommands ?? [])].sort();
  if (JSON.stringify(esperados) !== JSON.stringify(HOOKS_CLAUDE_PERMITIDOS)) {
    violacoes.push({ codigo: 'ALLOWLIST_HOOK_INVALIDA', path: 'config/agent-tooling-allowlist.json' });
  }
  if (JSON.stringify(comandos) !== JSON.stringify(esperados)) {
    violacoes.push({ codigo: 'HOOK_NAO_LISTADO', path: '.claude/settings.json' });
  }
}

async function auditarPathsEWorkflows(raiz, violacoes) {
  for (const path of PATHS_PROIBIDOS) {
    if (await existe(resolve(raiz, path))) violacoes.push({ codigo: 'PATH_PROIBIDO', path });
  }
  if (await existe(resolve(raiz, '.claude/rules'))) {
    violacoes.push({ codigo: 'PATH_PROIBIDO', path: '.claude/rules' });
  }

  const workflows = await listarArquivos(raiz, resolve(raiz, '.github/workflows'), violacoes);
  for (const workflow of workflows.filter((item) => /\.ya?ml$/i.test(item))) {
    const conteudo = (await readFile(workflow, 'utf8')).toLowerCase();
    for (const action of ACOES_IA) {
      if (conteudo.includes(action)) {
        violacoes.push({
          codigo: 'ACAO_IA_CI_NAO_AUTORIZADA',
          path: caminhoPosix(relative(raiz, workflow))
        });
      }
    }
  }
}

export async function auditarToolingAgentes(raizEntrada = process.cwd()) {
  const raiz = resolve(raizEntrada);
  const violacoes = [];
  const allowlistPath = resolve(raiz, 'config/agent-tooling-allowlist.json');
  const allowlist = await carregarJson(allowlistPath, violacoes, 'ALLOWLIST_INVALIDA');
  if (!allowlist) return { violacoes };
  if (allowlist.schemaVersion !== 1) violacoes.push({ codigo: 'SCHEMA_NAO_SUPORTADO', path: 'config/agent-tooling-allowlist.json' });
  const politicaEsperada = {
    externalContentIsUntrusted: true,
    realSecretsAllowed: false,
    realPiiPhiAllowed: false,
    operationalAccessFromSkillsAllowed: false,
    updateRequiresPullRequestAndHashReview: true
  };
  if (JSON.stringify(allowlist.policy) !== JSON.stringify(politicaEsperada)) {
    violacoes.push({ codigo: 'POLITICA_INSEGURA', path: 'config/agent-tooling-allowlist.json' });
  }

  await auditarSkills(raiz, allowlist, violacoes);
  await auditarExecutaveis(raiz, allowlist, violacoes);
  await auditarHooks(raiz, allowlist, violacoes);
  await auditarPathsEWorkflows(raiz, violacoes);
  return { violacoes: violacoes.sort((a, b) => `${a.codigo}:${a.path}`.localeCompare(`${b.codigo}:${b.path}`)) };
}

async function main() {
  const resultado = await auditarToolingAgentes(process.cwd());
  if (resultado.violacoes.length) {
    console.error('Tooling de agentes fora da politica:');
    for (const item of resultado.violacoes) console.error(`- [${item.codigo}] ${item.path}`);
    process.exitCode = 1;
    return;
  }
  console.log('Tooling de agentes valido: skills e executaveis conferem com a allowlist.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
