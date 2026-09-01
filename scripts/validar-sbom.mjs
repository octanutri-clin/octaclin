// Reproducao e cobertura do SBOM CycloneDX (PR 49).
//
// "SBOM reproduzivel" nao significa byte identico: o Trivy grava serialNumber
// e timestamp novos a cada execucao. O criterio correto e inventario semantico
// identico -- mesmos pacotes, versoes, PURLs, relacoes e licencas conhecidas.
// Normalizar esses campos antes de comparar evita tanto o falso vermelho quanto
// o falso verde de esconder diferenca real removendo campo relevante.

import { readFileSync } from 'node:fs';

// Um componente conhecido por ecossistema: o gate detecta o desaparecimento de
// um app inteiro do SBOM, que e a falha silenciosa que importa. Os nomes vem
// dos manifests e nao fixam versao, para nao quebrar a cada Dependabot.
export const ECOSSISTEMAS_ESPERADOS = [
  { componente: 'octaclin-backend', prefixoPurl: 'pkg:npm/', pacotes: ['@nestjs/core', 'typeorm'] },
  { componente: 'octaclin-web', prefixoPurl: 'pkg:npm/', pacotes: ['next', 'react'] },
  { componente: 'octaclin-mobile', prefixoPurl: 'pkg:npm/', pacotes: ['expo', 'react-native'] },
  { componente: 'octaclin-ai-service', prefixoPurl: 'pkg:pypi/', pacotes: ['fastapi', 'pydantic'] },
];

function licencasDe(componente) {
  if (!Array.isArray(componente.licenses)) return [];
  return componente.licenses
    .map((entrada) => entrada?.license?.id ?? entrada?.license?.name ?? entrada?.expression)
    .filter((valor) => typeof valor === 'string')
    .sort();
}

export function normalizarSbom(sbom) {
  const componentes = (sbom.components ?? []).map((componente) => ({
    name: componente.name ?? '',
    version: componente.version ?? '',
    purl: componente.purl ?? '',
    licencas: licencasDe(componente),
  }));

  // Dedup e ordenacao: a ordem de emissao do scanner nao e estavel e nao faz
  // parte do inventario.
  const unicos = new Map();
  for (const componente of componentes) {
    unicos.set(`${componente.purl}|${componente.name}@${componente.version}`, componente);
  }

  const dependencias = (sbom.dependencies ?? [])
    .map((relacao) => ({
      ref: relacao.ref ?? '',
      dependsOn: [...(relacao.dependsOn ?? [])].sort(),
    }))
    .sort((a, b) => a.ref.localeCompare(b.ref));

  return {
    componentes: [...unicos.values()].sort((a, b) =>
      `${a.purl}${a.name}${a.version}`.localeCompare(`${b.purl}${b.name}${b.version}`)
    ),
    dependencias,
  };
}

export function compararInventarios(sbomA, sbomB) {
  const a = normalizarSbom(sbomA);
  const b = normalizarSbom(sbomB);

  const chave = (componente) =>
    `${componente.purl || `${componente.name}@${componente.version}`}[${componente.licencas.join(',')}]`;
  const conjuntoA = new Set(a.componentes.map(chave));
  const conjuntoB = new Set(b.componentes.map(chave));

  const somenteA = [...conjuntoA].filter((item) => !conjuntoB.has(item));
  const somenteB = [...conjuntoB].filter((item) => !conjuntoA.has(item));
  const relacoesIguais = JSON.stringify(a.dependencias) === JSON.stringify(b.dependencias);

  if (somenteA.length === 0 && somenteB.length === 0 && relacoesIguais) {
    return {
      reproduzivel: true,
      mensagem: `SBOM reproduzivel: ${a.componentes.length} componentes com inventario semantico identico.`,
    };
  }

  const detalhes = [];
  if (somenteA.length > 0) detalhes.push(`so na execucao A: ${somenteA.slice(0, 10).join(', ')}`);
  if (somenteB.length > 0) detalhes.push(`so na execucao B: ${somenteB.slice(0, 10).join(', ')}`);
  if (!relacoesIguais) detalhes.push('as relacoes de dependencia divergem');

  return {
    reproduzivel: false,
    mensagem: `SBOM nao reproduzivel. ${detalhes.join('; ')}.`,
  };
}

export function verificarCobertura(sbom) {
  const componentes = sbom.components ?? [];
  if (componentes.length === 0) {
    return { aprovado: false, mensagem: 'SBOM sem componentes: o inventario nao foi gerado.' };
  }

  const faltando = [];
  for (const ecossistema of ECOSSISTEMAS_ESPERADOS) {
    const encontrou = componentes.some(
      (componente) =>
        typeof componente.purl === 'string' &&
        componente.purl.startsWith(ecossistema.prefixoPurl) &&
        ecossistema.pacotes.some((pacote) => componente.name === pacote)
    );
    if (!encontrou) {
      faltando.push(`${ecossistema.componente} (esperado um de: ${ecossistema.pacotes.join(', ')})`);
    }
  }

  return faltando.length === 0
    ? {
        aprovado: true,
        mensagem: `SBOM cobre os ${ECOSSISTEMAS_ESPERADOS.length} ecossistemas com ${componentes.length} componentes.`,
      }
    : {
        aprovado: false,
        mensagem: `SBOM incompleto: ecossistema ausente -> ${faltando.join('; ')}.`,
      };
}

function ler(caminho) {
  return JSON.parse(readFileSync(caminho, 'utf8'));
}

export function validarArquivos(caminhoA, caminhoB) {
  const sbomA = ler(caminhoA);
  const cobertura = verificarCobertura(sbomA);
  if (!cobertura.aprovado) throw new Error(cobertura.mensagem);

  if (!caminhoB) return cobertura.mensagem;

  const reproducao = compararInventarios(sbomA, ler(caminhoB));
  if (!reproducao.reproduzivel) throw new Error(reproducao.mensagem);

  return `${cobertura.mensagem} ${reproducao.mensagem}`;
}

if (process.argv[1] && process.argv[1].endsWith('validar-sbom.mjs')) {
  const [caminhoA, caminhoB] = process.argv.slice(2);
  if (!caminhoA) {
    console.error('Uso: node scripts/validar-sbom.mjs <sbom-a.json> [sbom-b.json]');
    process.exitCode = 1;
  } else {
    try {
      console.log(validarArquivos(caminhoA, caminhoB));
    } catch (erro) {
      console.error(erro.message);
      process.exitCode = 1;
    }
  }
}
