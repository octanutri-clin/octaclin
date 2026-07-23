import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_EXCLUDED_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results'
]);

const PLACEHOLDER_VALUES = new Set([
  'changeme',
  'example',
  'placeholder',
  'placeholder_token_meta_cloud_api',
  'senha',
  'senha_de_app_google',
  'troque',
  'troque_por_um_valor_longo_aleatorio',
  'troque_por_outro_valor_longo_aleatorio'
]);

const RULES = [
  {
    id: 'openai-api-key',
    description: 'Possivel chave OpenAI real',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g
  },
  {
    id: 'meta-whatsapp-token',
    description: 'Possivel token Meta/WhatsApp real',
    pattern: /\bEAAY[A-Za-z0-9]{40,}\b/g
  },
  {
    id: 'google-oauth-refresh-token',
    description: 'Possivel refresh token OAuth Google',
    pattern: /\b1\/\/[A-Za-z0-9_-]{30,}\b/g
  },
  {
    id: 'private-key',
    description: 'Possivel chave privada',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g
  },
  {
    id: 'database-url-with-password',
    description: 'URL de banco/cache com usuario e senha embutidos',
    pattern: /\b(?:postgres(?:ql)?|mysql|redis):\/\/[^:\s/@]+:([^@\s]+)@[^)\s'"`]+/g,
    shouldReport: (match) => !isPlaceholder(match[1])
  }
];

function isPlaceholder(value = '') {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (PLACEHOLDER_VALUES.has(normalized)) return true;
  return normalized.includes('placeholder') || normalized.includes('changeme') || normalized.includes('troque');
}

function shouldSkipPath(path) {
  const parts = path.split(/[\\/]/);
  return parts.some((part) => DEFAULT_EXCLUDED_DIRS.has(part));
}

function shouldSkipFile(path) {
  const lower = path.toLowerCase();
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.ico') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.zip') ||
    lower.endsWith('.lock')
  );
}

function lineAndColumn(content, index) {
  const before = content.slice(0, index);
  const lines = before.split(/\r?\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function redact(value) {
  if (value.length <= 12) return '<redacted>';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function scanContent(content, file) {
  const findings = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      if (rule.shouldReport && !rule.shouldReport(match)) continue;
      const position = lineAndColumn(content, match.index ?? 0);
      findings.push({
        ruleId: rule.id,
        description: rule.description,
        file,
        line: position.line,
        column: position.column,
        preview: redact(match[0])
      });
    }
  }

  return findings;
}

async function collectFiles(root, current = root) {
  if (shouldSkipPath(relative(root, current))) return [];
  const info = await stat(current);
  if (info.isFile()) return shouldSkipFile(current) ? [] : [current];
  if (!info.isDirectory()) return [];

  const entries = await readdir(current);
  const nested = await Promise.all(entries.map((entry) => collectFiles(root, resolve(current, entry))));
  return nested.flat();
}

export async function scanPathForSecrets(rootPath = process.cwd()) {
  const root = resolve(rootPath);
  const files = await collectFiles(root);
  const findings = [];

  for (const filePath of files) {
    const relativeFile = relative(root, filePath).split(sep).join('/');
    try {
      const content = await readFile(filePath, 'utf8');
      findings.push(...scanContent(content, relativeFile));
    } catch {
      // Arquivos binarios ou inacessiveis sao ignorados pela varredura textual.
    }
  }

  return findings.sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`));
}

async function main() {
  const rootArg = process.argv.find((arg) => arg.startsWith('--root='));
  const json = process.argv.includes('--json');
  const root = rootArg ? rootArg.slice('--root='.length) : process.cwd();
  const findings = await scanPathForSecrets(root);

  if (json) {
    console.log(JSON.stringify({ findings }, null, 2));
  } else if (findings.length) {
    console.error('Possiveis secrets encontrados:');
    findings.forEach((finding) => {
      console.error(`- ${finding.file}:${finding.line}:${finding.column} [${finding.ruleId}] ${finding.preview}`);
    });
  } else {
    console.log('Nenhum secret real identificado pelos padroes locais.');
  }

  process.exitCode = findings.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
