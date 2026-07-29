import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const arquivoCanonico = 'docs/handoffs/ESTADO_ATUAL_AGENTES.md';
const pontosEntrada = [
  'AGENTS.md',
  'README.md',
  'CLAUDE.md',
  'ONBOARDING_DESENVOLVEDOR.md',
  'COORDENACAO_DESENVOLVIMENTO_IA.md',
  'MENSAGEM_HANDOFF_DESENVOLVEDOR.md',
  'HANDOFF-TECNICO-OCTACLIN.md'
];
const referenciasObsoletas = ['Fase 105', 'Fase 106', 'Fase 129', 'Fase 130', 'Fase 142'];

const falhas = [];
const ler = (arquivo) => readFileSync(resolve(raiz, arquivo), 'utf8');

let estadoCanonico = '';
try {
  estadoCanonico = ler(arquivoCanonico);
} catch {
  falhas.push(`Arquivo canonico ausente: ${arquivoCanonico}`);
}

for (const fase of ['Fase 150A', 'Fase 150B', 'Fase 150C', 'Fase 151']) {
  if (!estadoCanonico.includes(fase)) falhas.push(`Estado canonico nao registra ${fase}.`);
}

for (const arquivo of pontosEntrada) {
  let conteudo = '';
  try {
    conteudo = ler(arquivo);
  } catch {
    falhas.push(`Ponto de entrada ausente: ${arquivo}.`);
    continue;
  }

  if (!conteudo.includes(arquivoCanonico)) {
    falhas.push(`${arquivo} nao aponta para ${arquivoCanonico}.`);
  }

  for (const referencia of referenciasObsoletas) {
    if (conteudo.includes(referencia)) {
      falhas.push(`${arquivo} ainda contem referencia operacional obsoleta: ${referencia}.`);
    }
  }
}

if (falhas.length > 0) {
  console.error('Falhas de continuidade:');
  for (const falha of falhas) console.error(`- ${falha}`);
  process.exit(1);
}

console.log('Handoff atual validado.');
