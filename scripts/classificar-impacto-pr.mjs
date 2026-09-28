import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const domains = ['backend', 'web', 'mobile', 'ai', 'demo'];
const names = { backend: 'Backend NestJS', web: 'Web Next.js', mobile: 'Mobile Expo', ai: 'AI FastAPI', demo: 'Demo local smoke' };

function full(result, rule, file) {
  result.full = true;
  for (const key of domains) result[key] = true;
  result.dependency_review = true;
  result.governance = true;
  result.security = true;
  result.rules.push(`${rule}: ${file}`);
}

function semverBump(from, to) {
  const parse = (value) => /^\D*(\d+)\.(\d+)\.(\d+)(?:$|[-+])/.exec(value);
  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return 'unknown';
  if (a[1] !== b[1]) return 'major';
  if (a[2] !== b[2]) return 'minor';
  if (a[3] !== b[3]) return 'patch';
  return 'unknown';
}

export function classificarImpacto(files, options = {}) {
  const result = {
    backend: false, web: false, mobile: false, ai: false, demo: false,
    governance: true, dependency_review: false, security: true, full: false,
    files: [], rules: [], unrecognized: [], kinds: [], risk: 'R1', dependency_update: 'none', reason: ''
  };
  if (!Array.isArray(files) || files.length === 0) {
    full(result, 'diff vazio ou indisponivel', '(sem arquivo)');
    result.reason = 'Diff vazio ou indisponivel; suite completa por seguranca.';
    return result;
  }
  const kinds = new Set();
  for (const file of [...new Set(files)].sort()) {
    result.files.push(file);
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('\\') || file.split('/').includes('..') || file.includes('\n') || file.includes('\r')) {
      result.unrecognized.push(file);
      full(result, 'caminho invalido', String(file));
      continue;
    }
    if (file === '.github/workflows/ci.yml' || file === '.github/workflows/ci.yaml' || /^scripts\/(classificar-impacto-pr|validar-pr-gate)(\.spec)?\.mjs$/.test(file)) {
      kinds.add('ci');
      full(result, 'seletor ou gate da CI', file);
      result.risk = 'R4';
    } else if (/^octaclin-backend\//.test(file)) {
      result.backend = true;
      if (result.risk === 'R1') result.risk = 'R3';
      if (file === 'octaclin-backend/scripts/api-demo-local.mjs') {
        result.web = true;
        result.demo = true;
        result.rules.push(`API sintetica do smoke: ${file}`);
      }
      kinds.add('backend');
      if (/\/(migracoes|banco-dados|entidades|auth|autorizacao|rls|tenant)\//i.test(file) || /(migration|rls|tenant)/i.test(file)) result.risk = 'R4';
      if (/\/(package\.json|pnpm-lock\.yaml|Dockerfile)$/.test(file)) { result.dependency_review = true; kinds.add('dependency'); }
      if (file.endsWith('/Dockerfile')) kinds.add('docker');
      result.rules.push(`dominio backend: ${file}`);
    } else if (/^octaclin-web\//.test(file)) {
      result.web = true;
      if (result.risk === 'R1') result.risk = 'R3';
      // The demo runs real Next.js against a synthetic API. Any Web change can affect its build or journeys.
      result.demo = true;
      kinds.add('web');
      if (/\/(package\.json|pnpm-lock\.yaml|Dockerfile)$/.test(file)) { result.dependency_review = true; kinds.add('dependency'); }
      if (file.endsWith('/Dockerfile')) kinds.add('docker');
      if (/\/(api|auth|sessoes)\//i.test(file)) result.risk = 'R4';
      result.rules.push(`dominio web e demo: ${file}`);
    } else if (/^octaclin-mobile\//.test(file)) {
      result.mobile = true;
      if (result.risk === 'R1') result.risk = 'R3';
      kinds.add('mobile');
      if (/\/(package\.json|pnpm-lock\.yaml)$/.test(file)) { result.dependency_review = true; kinds.add('dependency'); }
      result.rules.push(`dominio mobile: ${file}`);
    } else if (/^octaclin-ai-service\//.test(file)) {
      result.ai = true;
      if (result.risk === 'R1') result.risk = 'R3';
      kinds.add('ai');
      if (/\/(requirements[^/]*|Dockerfile)$/.test(file)) { result.dependency_review = true; kinds.add('dependency'); }
      if (file.endsWith('/Dockerfile')) kinds.add('docker');
      result.rules.push(`dominio AI: ${file}`);
    } else if (file.startsWith('.github/workflows/')) {
      kinds.add('workflow');
      result.dependency_review = true;
      if (/(codeql|semgrep|trivy|dependency-review|security|seguranca)/i.test(file)) { kinds.add('security-workflow'); result.risk = 'R4'; }
      result.rules.push(`workflow isolado; validar governanca e scanners existentes: ${file}`);
    } else if (file.startsWith('.github/actions/')) {
      kinds.add('shared-config');
      full(result, 'action local pode afetar multiplos jobs', file);
    } else if (file === '.github/dependabot.yml' || file === '.github/dependabot.yaml' || file.startsWith('.github/')) {
      kinds.add('governance');
      result.rules.push(`governanca GitHub: ${file}`);
    } else if (file.startsWith('scripts/')) {
      kinds.add('shared-script');
      full(result, 'script raiz pode controlar multiplos gates', file);
    } else if (/^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.node-version|\.nvmrc|docker-compose[^/]*|\.npmrc)$/.test(file)) {
      kinds.add('shared-config');
      full(result, 'configuracao compartilhada', file);
    } else if (file.startsWith('docs/') || /^(README|AGENTS|SECURITY|STATUS_ATUAL_PROJETO|CHECKLIST_FASES_FUTURAS_PRODUCAO|DECISOES_ARQUITETURA|MATRIZ_CONFIABILIDADE_TESTES|VARIAVEIS_AMBIENTE|SKILLS_GUIA_LOCAL)\.md$/.test(file) || file === 'LICENSE' || file === '.gitignore') {
      kinds.add('docs');
      result.rules.push(`documentacao ou metadado, governanca sempre executa: ${file}`);
    } else {
      result.unrecognized.push(file);
      kinds.add('unknown');
      full(result, 'arquivo nao reconhecido', file);
    }
  }
  result.kinds = [...kinds].sort();
  if (result.dependency_review) {
    const rank = { none: 0, patch: 1, minor: 2, major: 3, unknown: 4 };
    const bumps = options.dependencyBumps;
    result.dependency_update = !Array.isArray(bumps) || bumps.length === 0 ? 'unknown' : bumps.map(({ from, to }) => semverBump(from, to)).sort((a, b) => rank[b] - rank[a])[0];
  }
  result.reason = result.full ? 'Suite completa: seletor, configuracao compartilhada ou caminho incerto.' : result.rules.join('; ');
  if (result.full && result.risk !== 'R4') result.risk = 'R3';
  return result;
}

export function parseNameStatus(buffer) {
  const parts = buffer.toString('utf8').split('\0');
  if (parts.at(-1) !== '') throw new Error('Diff Git incompleto');
  parts.pop();
  const files = [];
  for (let i = 0; i < parts.length;) {
    const status = parts[i++];
    if (!/^(A|M|D|T|U|R\d*|C\d*)$/.test(status)) throw new Error(`Status Git desconhecido: ${status}`);
    const count = /^[RC]/.test(status) ? 2 : 1;
    for (let n = 0; n < count; n++) {
      if (i >= parts.length) throw new Error('Diff Git truncado');
      files.push(parts[i++]);
    }
  }
  return files;
}

function collectDependencyBumps(base, head, files) {
  const manifests = files.filter((file) => /^(octaclin-(?:backend|web|mobile)\/package\.json)$/.test(file));
  const bumps = [];
  for (const path of manifests) {
    const read = (sha) => JSON.parse(execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8' }));
    const before = read(base);
    const after = read(head);
    for (const section of ['dependencies', 'devDependencies']) {
      const oldDeps = before[section] ?? {};
      const newDeps = after[section] ?? {};
      for (const [name, to] of Object.entries(newDeps)) {
        if (typeof to === 'string' && typeof oldDeps[name] === 'string' && oldDeps[name] !== to) bumps.push({ name, from: oldDeps[name], to });
      }
    }
  }
  return bumps;
}

function markdown(result) {
  const esc = (value) => String(value).replace(/[|`<>\r\n]/g, ' ');
  const required = ['Rollout seguro', 'Operacao de lancamento', 'Governanca de repositorio', ...domains.filter((key) => result[key]).map((key) => names[key])];
  const na = domains.filter((key) => !result[key]).map((key) => names[key]);
  return `### PR Impact\n\nChanged files:\n${result.files.map((f) => `- \`${esc(f)}\``).join('\n') || '- (none)'}\n\nDetected: ${domains.map((k) => `${k}=${result[k]}`).join(', ')}, full=${result.full}.\n\nRequired jobs:\n${required.map((v) => `- ${v}`).join('\n')}\n\nSkipped as N/A:\n${na.map((v) => `- ${v}`).join('\n') || '- (none)'}\n\nDependency Review: separate workflow; ${result.dependency_review ? 'relevant' : 'no dependency file detected'}.\n\nReason: ${esc(result.reason)}\n\nRules:\n${result.rules.map((v) => `- ${esc(v)}`).join('\n')}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const args = process.argv.slice(2);
    const get = (flag) => args[args.indexOf(flag) + 1];
    let files;
    let dependencyBumps;
    if (args.includes('--files-json')) files = JSON.parse(get('--files-json'));
    else {
      if (!args.includes('--base') || !args.includes('--head')) throw new Error('Informe --base e --head ou --files-json');
      const base = get('--base');
      const head = get('--head');
      if (!/^[a-f0-9]{40}$/.test(base) || !/^[a-f0-9]{40}$/.test(head)) throw new Error('SHA invalido');
      files = parseNameStatus(execFileSync('git', ['diff', '--name-status', '-z', '--find-renames', base, head, '--'], { maxBuffer: 16 * 1024 * 1024 }));
      try { dependencyBumps = collectDependencyBumps(base, head, files); }
      catch { dependencyBumps = []; } // Deleted/malformed manifest remains unknown, never treated as patch.
    }
    const result = classificarImpacto(files, { dependencyBumps });
    if (process.env.GITHUB_OUTPUT) {
      for (const key of [...domains, 'governance', 'dependency_review', 'security', 'full']) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${result[key]}\n`);
      appendFileSync(process.env.GITHUB_OUTPUT, `classification=${JSON.stringify(result)}\n`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown(result));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`Falha ao classificar impacto: ${error.message}`);
    process.exitCode = 1;
  }
}
