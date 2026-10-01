import { createHash } from 'crypto';
import { readFile, rename, stat, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { validarCatalogoFonte } from '../src/modulos/planos-alimentares/dados/catalogo-composicao-fonte';
import { montarCatalogoUsda, type OpcoesImportacaoUsda } from '../src/modulos/planos-alimentares/dados/importador-usda-fdc';

const TAMANHO_MAXIMO_JSON = 500 * 1024 * 1024;

function argumentos(): Record<string, string> {
  const saida: Record<string, string> = {};
  for (let indice = 2; indice < process.argv.length; indice += 1) {
    const chave = process.argv[indice];
    if (indice === 2 && chave === '--') continue;
    if (!chave.startsWith('--') || !process.argv[indice + 1]) throw new Error('Use --arquivo, --saida, --base, --versao e --capturada-em.');
    saida[chave.slice(2)] = process.argv[++indice];
  }
  return saida;
}

async function executar() {
  const args = argumentos();
  const arquivo = resolve(args.arquivo ?? '');
  const destino = resolve(args.saida ?? '');
  const base = args.base as OpcoesImportacaoUsda['base'];
  if (!args.arquivo || !args.saida || !args.versao || !args['capturada-em']) {
    throw new Error('Informe os argumentos obrigatórios --arquivo, --saida, --versao e --capturada-em.');
  }
  if (base !== 'foundation-foods' && base !== 'sr-legacy') throw new Error('Base USDA inválida.');
  const informacoes = await stat(arquivo);
  if (!informacoes.isFile() || informacoes.size <= 0 || informacoes.size > TAMANHO_MAXIMO_JSON) {
    throw new Error('Arquivo JSON USDA vazio ou acima do limite de 500 MiB.');
  }
  const conteudo = await readFile(arquivo);
  const checksumArquivo = createHash('sha256').update(conteudo).digest('hex');
  let entrada: unknown;
  try {
    entrada = JSON.parse(conteudo.toString('utf8')) as unknown;
  } catch {
    throw new Error('Arquivo USDA não contém JSON UTF-8 válido.');
  }
  const catalogo = montarCatalogoUsda(entrada, {
    base,
    versao: args.versao,
    capturadaEm: args['capturada-em'],
    checksumArquivo,
    urlArtefato: args['url-artefato']
  });
  validarCatalogoFonte(catalogo);
  const temporario = `${destino}.tmp`;
  await writeFile(temporario, `${JSON.stringify(catalogo, null, 2)}\n`, 'utf8');
  await rename(temporario, destino);
  process.stdout.write(
    `Artefato USDA ${catalogo.fonte.baseCodigo} gerado: ${catalogo.registros.length} registros; SHA-256 ${checksumArquivo}.\n`
  );
}

void executar().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Falha ao gerar catálogo USDA.'}\n`);
  process.exitCode = 1;
});
