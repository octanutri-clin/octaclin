import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import {
  montarCatalogoTaco,
  serializarCatalogoTaco,
  TACO_URL_ORIGEM
} from '../src/modulos/planos-alimentares/dados/importador-taco';

async function obterArquivoOrigem(): Promise<{ conteudo: Buffer; url: string }> {
  const caminhoLocal = process.env.TACO_ARQUIVO_LOCAL?.trim();
  if (caminhoLocal) {
    return { conteudo: await readFile(resolve(caminhoLocal)), url: TACO_URL_ORIGEM };
  }

  const resposta = await fetch(TACO_URL_ORIGEM);
  if (!resposta.ok) throw new Error(`Falha ao baixar TACO: HTTP ${resposta.status}.`);
  return { conteudo: Buffer.from(await resposta.arrayBuffer()), url: TACO_URL_ORIGEM };
}

async function executar() {
  const origem = await obterArquivoOrigem();
  const catalogo = montarCatalogoTaco(origem.conteudo, origem.url);
  const destino = resolve(__dirname, '../src/modulos/planos-alimentares/dados/catalogo-taco-4a.json');
  await writeFile(destino, serializarCatalogoTaco(catalogo), 'utf8');
  process.stdout.write(
    `Catalogo TACO gerado: ${catalogo.metadados.contagem.alimentosValidos} alimentos, ` +
      `${catalogo.metadados.contagem.alimentosExcluidos} exclusao(oes).\n`
  );
}

void executar().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exitCode = 1;
});
