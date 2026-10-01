import { readFile, rename, stat, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { validarCatalogoFonte } from '../src/modulos/planos-alimentares/dados/catalogo-composicao-fonte';
import { montarCatalogoIbgePof, type EntradaIbgePof } from '../src/modulos/planos-alimentares/dados/importador-ibge-pof';

const TAMANHO_MAXIMO_JSON = 50 * 1024 * 1024;

function argumentos(): Record<string, string> {
  const saida: Record<string, string> = {};
  for (let indice = 2; indice < process.argv.length; indice += 1) {
    const chave = process.argv[indice];
    if (indice === 2 && chave === '--') continue;
    if (!chave.startsWith('--') || !process.argv[indice + 1]) throw new Error('Use --arquivo e --saida.');
    saida[chave.slice(2)] = process.argv[++indice];
  }
  return saida;
}

async function executar() {
  const args = argumentos();
  if (!args.arquivo || !args.saida) throw new Error('Informe --arquivo e --saida.');
  const arquivo = resolve(args.arquivo);
  const destino = resolve(args.saida);
  const informacoes = await stat(arquivo);
  if (!informacoes.isFile() || informacoes.size <= 0 || informacoes.size > TAMANHO_MAXIMO_JSON) {
    throw new Error('Arquivo intermediário IBGE vazio ou acima do limite de 50 MiB.');
  }
  let entrada: EntradaIbgePof;
  try {
    entrada = JSON.parse((await readFile(arquivo, 'utf8'))) as EntradaIbgePof;
  } catch {
    throw new Error('Arquivo intermediário IBGE não contém JSON válido.');
  }
  const catalogo = montarCatalogoIbgePof(entrada);
  validarCatalogoFonte(catalogo);
  const temporario = `${destino}.tmp`;
  await writeFile(temporario, `${JSON.stringify(catalogo, null, 2)}\n`, 'utf8');
  await rename(temporario, destino);
  process.stdout.write(
    `Artefato IBGE ${catalogo.fonte.versao} gerado: ${catalogo.registros.length} registros; SHA-256 ${catalogo.fonte.checksumArquivo}.\n`
  );
}

void executar().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Falha ao gerar catálogo IBGE.'}\n`);
  process.exitCode = 1;
});
