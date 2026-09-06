import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORIO = 'octanutri-clin/octaclin';
const ENDPOINTS_PERMITIDOS = new Set([
  '/repos/octanutri-clin/octaclin/branches/main',
  '/repos/octanutri-clin/octaclin/code-scanning/alerts?state=open&per_page=100',
  '/repos/octanutri-clin/octaclin/dependabot/alerts?state=open&per_page=100',
  '/repos/octanutri-clin/octaclin/secret-scanning/alerts?state=open&per_page=100',
]);

const ENDPOINT_BRANCH_MAIN = '/repos/octanutri-clin/octaclin/branches/main';
const ENDPOINT_CODE_SCANNING = '/repos/octanutri-clin/octaclin/code-scanning/alerts?state=open&per_page=100';
const ENDPOINT_DEPENDABOT = '/repos/octanutri-clin/octaclin/dependabot/alerts?state=open&per_page=100';
const ENDPOINT_SECRET_SCANNING = '/repos/octanutri-clin/octaclin/secret-scanning/alerts?state=open&per_page=100';

function textoOuNulo(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

function valorTrivy(mensagem, campo) {
  if (typeof mensagem !== 'string') return null;
  const encontrado = mensagem.match(new RegExp(`^${campo}:\\s*(.*)$`, 'm'));
  return textoOuNulo(encontrado?.[1]);
}

function detalhesTrivy(alerta) {
  if (alerta?.tool?.name !== 'Trivy') {
    return { pacote: null, versaoInstalada: null, versaoCorrigida: null };
  }

  const mensagem = alerta?.most_recent_instance?.message?.text;
  return {
    pacote: valorTrivy(mensagem, 'Package'),
    versaoInstalada: valorTrivy(mensagem, 'Installed Version'),
    versaoCorrigida: valorTrivy(mensagem, 'Fixed Version'),
  };
}

function ordenarPorNumero(alertas) {
  return [...alertas].sort((a, b) => a.numero - b.numero);
}

export function normalizarCodeScanning(alertas) {
  return ordenarPorNumero(alertas.map((alerta) => {
    const detalhes = detalhesTrivy(alerta);
    return {
      numero: alerta.number,
      ferramenta: alerta.tool?.name,
      regra: alerta.rule?.id,
      categoria: alerta.most_recent_instance?.category,
      caminho: alerta.most_recent_instance?.location?.path,
      pacote: detalhes.pacote,
      versaoInstalada: detalhes.versaoInstalada,
      versaoCorrigida: detalhes.versaoCorrigida,
      severidade: alerta.rule?.security_severity_level ?? 'none',
      severidadeQualidade: alerta.rule?.severity ?? null,
    };
  }));
}

export function normalizarDependabot(alertas) {
  return ordenarPorNumero(alertas.map((alerta) => ({
    numero: alerta.number,
    advisory: alerta.security_advisory?.ghsa_id,
    severidade: alerta.security_vulnerability?.severity ?? alerta.security_advisory?.severity,
    ecossistema: alerta.dependency?.package?.ecosystem,
    pacote: alerta.dependency?.package?.name,
    manifesto: alerta.dependency?.manifest_path,
    versaoCorrigida: textoOuNulo(alerta.security_vulnerability?.first_patched_version?.identifier),
  })));
}

function agruparPorFerramenta(alertas) {
  const totais = new Map();
  for (const alerta of alertas) {
    totais.set(alerta.ferramenta, (totais.get(alerta.ferramenta) ?? 0) + 1);
  }
  return Object.fromEntries([...totais.entries()].sort(([a], [b]) => {
    const esquerda = String(a);
    const direita = String(b);
    if (esquerda < direita) return -1;
    if (esquerda > direita) return 1;
    return 0;
  }));
}

export function criarSnapshot({ codeScanning, dependabot, secretScanning }) {
  if (secretScanning.length !== 0) {
    throw new Error(`${secretScanning.length} alerta de Secret Scanning aberto; siga a resposta a incidente antes de capturar o inventario.`);
  }

  const codeScanningOrdenado = ordenarPorNumero(codeScanning);
  const dependabotOrdenado = ordenarPorNumero(dependabot);
  return {
    codeScanning: {
      total: codeScanningOrdenado.length,
      alertas: codeScanningOrdenado,
      porFerramenta: agruparPorFerramenta(codeScanningOrdenado),
    },
    dependabot: {
      total: dependabotOrdenado.length,
      alertas: dependabotOrdenado,
    },
    secretScanning: { total: 0 },
  };
}

export function consultarPaginasGh(endpoint, { executar = spawnSync } = {}) {
  if (!ENDPOINTS_PERMITIDOS.has(endpoint)) {
    throw new Error(`endpoint nao permitido para captura: ${endpoint}`);
  }

  const resultado = executar(
    'gh',
    ['api', '--paginate', '--slurp', endpoint],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (resultado.status !== 0) {
    throw new Error(`GitHub API falhou para ${endpoint}; reautentique com gh auth login.`);
  }
  const paginas = JSON.parse(resultado.stdout);
  return paginas.flat();
}

export function capturarInventario({ executar = spawnSync, agora = () => new Date().toISOString() } = {}) {
  const [branchMain] = consultarPaginasGh(ENDPOINT_BRANCH_MAIN, { executar });
  const codeScanning = normalizarCodeScanning(consultarPaginasGh(ENDPOINT_CODE_SCANNING, { executar }));
  const dependabot = normalizarDependabot(consultarPaginasGh(ENDPOINT_DEPENDABOT, { executar }));
  const secretScanning = consultarPaginasGh(ENDPOINT_SECRET_SCANNING, { executar });
  const capturadoEm = agora();
  const snapshot = criarSnapshot({
    codeScanning,
    dependabot,
    secretScanning,
    commitBase: branchMain?.commit?.sha,
    capturadoEm,
  });

  return {
    schemaVersion: 1,
    repositorio: REPOSITORIO,
    commitBase: branchMain?.commit?.sha,
    capturadoEm,
    snapshot,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(capturarInventario(), null, 2));
}
