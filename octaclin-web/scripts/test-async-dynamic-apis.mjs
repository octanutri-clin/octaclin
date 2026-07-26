import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const appDir = join(import.meta.dirname, '..', 'app');

async function listarArquivos(diretorio) {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const arquivos = await Promise.all(
    entradas.map((entrada) => {
      const caminho = join(diretorio, entrada.name);
      return entrada.isDirectory() ? listarArquivos(caminho) : [caminho];
    })
  );

  return arquivos.flat();
}

const arquivos = (await listarArquivos(appDir)).filter((arquivo) => {
  const caminhoRelativo = relative(appDir, arquivo);
  return /\[[^\]]+\]/.test(caminhoRelativo) && /(?:route\.ts|page\.tsx)$/.test(arquivo);
});

const erros = [];

for (const arquivo of arquivos) {
  const conteudo = await readFile(arquivo, 'utf8');
  const caminhoRelativo = relative(appDir, arquivo);

  if (!/params\s*:\s*Promise\s*</.test(conteudo)) {
    erros.push(`${caminhoRelativo}: params deve ser tipado como Promise.`);
  }

  if (!/await\s+(?:[A-Za-z_$][\w$]*\.)?params\b/.test(conteudo)) {
    erros.push(`${caminhoRelativo}: params deve ser resolvido com await.`);
  }
}

if (erros.length > 0) {
  console.error('APIs dinamicas do Next 15 ainda usam parametros sincronos:');
  erros.forEach((erro) => console.error(`- ${erro}`));
  process.exit(1);
}

console.log(`APIs dinamicas assincronas validadas: ${arquivos.length} arquivos.`);
