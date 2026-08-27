import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { avaliarProjeto } from './auditoria-acessibilidade-lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRETORIOS = ['app', 'components'];

async function listarFontes(diretorio) {
  const entradas = await readdir(path.join(RAIZ, diretorio), { withFileTypes: true, recursive: true });
  return entradas
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith('.tsx'))
    .map((entrada) => path.relative(RAIZ, path.join(entrada.parentPath, entrada.name)).split(path.sep).join('/'));
}

export async function carregarProjeto() {
  const caminhos = (await Promise.all(DIRETORIOS.map(listarFontes))).flat().sort();
  const arquivos = await Promise.all(
    caminhos.map(async (caminho) => ({ caminho, fonte: await readFile(path.join(RAIZ, caminho), 'utf8') })),
  );
  const temaFonte = await readFile(path.join(RAIZ, 'lib/tema.ts'), 'utf8');
  return { arquivos, temaFonte };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { arquivos, temaFonte } = await carregarProjeto();
  const resultado = avaliarProjeto(arquivos, temaFonte);

  for (const problema of resultado.problemas) console.error(problema);
  console.log(resultado.mensagem);

  if (!resultado.aprovado) process.exit(1);
}
