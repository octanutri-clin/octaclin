import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { auditarCodigoInterface, corrigirCodigoInterface } from './linguagem-interface-lib.mjs';

const raiz = process.cwd();
const corrigir = process.argv.includes('--fix');
const pastas = ['app', 'components'];

function listarTsx(diretorio) {
  if (!fs.existsSync(diretorio)) return [];
  return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap((item) => {
    const destino = path.join(diretorio, item.name);
    if (item.isDirectory()) return listarTsx(destino);
    return item.isFile() && destino.endsWith('.tsx') ? [destino] : [];
  });
}

let total = 0;
for (const arquivo of pastas.flatMap((pasta) => listarTsx(path.join(raiz, pasta)))) {
  const codigo = fs.readFileSync(arquivo, 'utf8');
  const ocorrencias = auditarCodigoInterface(codigo, arquivo);
  if (!ocorrencias.length) continue;
  total += ocorrencias.length;
  if (corrigir) {
    fs.writeFileSync(arquivo, corrigirCodigoInterface(codigo, arquivo));
    continue;
  }
  for (const item of ocorrencias) {
    console.error(`${path.relative(raiz, arquivo)}:${item.linha} "${item.texto}" -> "${item.corrigido}"`);
  }
}

if (total && !corrigir) {
  console.error(`\n${total} inconsistência(s) de linguagem encontrada(s). Execute pnpm test:linguagem:fix e revise o diff.`);
  process.exit(1);
}

console.log(corrigir ? `${total} texto(s) de interface corrigido(s).` : 'Linguagem da interface aprovada.');
