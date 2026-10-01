import { readFile, stat } from 'fs/promises';
import { resolve } from 'path';
import { validarCatalogoFonte, type CatalogoFonteNormalizado } from '../src/modulos/planos-alimentares/dados/catalogo-composicao-fonte';
import { persistirCatalogoFonte } from './persistir-catalogo-fonte';

async function executar() {
  if (process.env.USDA_CONFIRMAR_CARGA !== 'true') throw new Error('Defina USDA_CONFIRMAR_CARGA=true para confirmar a carga.');
  const bancoEsperado = process.env.USDA_BANCO_ESPERADO?.trim();
  const roleEsperada = process.env.USDA_ROLE_ESPERADA?.trim();
  const responsavelAprovacao = process.env.USDA_RESPONSAVEL_APROVACAO?.trim();
  const caminho = process.env.USDA_CATALOGO_JSON?.trim();
  if (!bancoEsperado || !roleEsperada || !responsavelAprovacao || !caminho) {
    throw new Error('Defina USDA_BANCO_ESPERADO, USDA_ROLE_ESPERADA, USDA_RESPONSAVEL_APROVACAO e USDA_CATALOGO_JSON.');
  }
  const arquivo = resolve(caminho);
  const tamanho = await stat(arquivo);
  if (!tamanho.isFile() || tamanho.size <= 0 || tamanho.size > 1024 * 1024 * 1024) {
    throw new Error('Artefato USDA inválido ou acima do limite de 1 GiB.');
  }
  let catalogo: CatalogoFonteNormalizado;
  try {
    catalogo = JSON.parse(await readFile(arquivo, 'utf8')) as CatalogoFonteNormalizado;
  } catch {
    throw new Error('Artefato USDA não contém JSON válido.');
  }
  if (!catalogo.fonte.codigo.startsWith('usda_fdc_') || !['foundation-foods', 'sr-legacy'].includes(catalogo.fonte.baseCodigo)) {
    throw new Error('Artefato não pertence a uma base FoodData Central permitida.');
  }
  validarCatalogoFonte(catalogo);
  const resultado = await persistirCatalogoFonte(catalogo, {
    bancoEsperado,
    roleEsperada,
    responsavelAprovacao,
    direitoUsoReferencia: 'USDA FoodData Central — CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/'
  });
  process.stdout.write(
    resultado === 'criado'
      ? `Catálogo USDA carregado: ${catalogo.fonte.baseCodigo}, ${catalogo.registros.length} registros.\n`
      : `Catálogo USDA já está íntegro: ${catalogo.fonte.baseCodigo}, ${catalogo.registros.length} registros.\n`
  );
}

void executar().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Falha na carga USDA.'}\n`);
  process.exitCode = 1;
});
