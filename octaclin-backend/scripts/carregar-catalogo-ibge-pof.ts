import { readFile, stat } from 'fs/promises';
import { resolve } from 'path';
import { validarCatalogoFonte, type CatalogoFonteNormalizado } from '../src/modulos/planos-alimentares/dados/catalogo-composicao-fonte';
import { persistirCatalogoFonte } from './persistir-catalogo-fonte';

async function executar() {
  if (process.env.IBGE_CONFIRMAR_CARGA !== 'true') throw new Error('Defina IBGE_CONFIRMAR_CARGA=true para confirmar a carga.');
  const bancoEsperado = process.env.IBGE_BANCO_ESPERADO?.trim();
  const roleEsperada = process.env.IBGE_ROLE_ESPERADA?.trim();
  const responsavelAprovacao = process.env.IBGE_RESPONSAVEL_APROVACAO?.trim();
  const direitoUsoReferencia = process.env.IBGE_REFERENCIA_DIREITO_USO?.trim();
  const caminho = process.env.IBGE_CATALOGO_JSON?.trim();
  if (!bancoEsperado || !roleEsperada || !responsavelAprovacao || !direitoUsoReferencia || !caminho) {
    throw new Error(
      'Defina IBGE_BANCO_ESPERADO, IBGE_ROLE_ESPERADA, IBGE_RESPONSAVEL_APROVACAO, IBGE_REFERENCIA_DIREITO_USO e IBGE_CATALOGO_JSON.'
    );
  }
  const arquivo = resolve(caminho);
  const tamanho = await stat(arquivo);
  if (!tamanho.isFile() || tamanho.size <= 0 || tamanho.size > 1024 * 1024 * 1024) {
    throw new Error('Artefato IBGE inválido ou acima do limite de 1 GiB.');
  }
  let catalogo: CatalogoFonteNormalizado;
  try {
    catalogo = JSON.parse(await readFile(arquivo, 'utf8')) as CatalogoFonteNormalizado;
  } catch {
    throw new Error('Artefato IBGE não contém JSON válido.');
  }
  if (catalogo.fonte.codigo !== 'ibge_pof_2008_2009' || catalogo.fonte.baseCodigo !== 'pof-2008-2009-composicao') {
    throw new Error('Artefato não pertence à tabela IBGE POF 2008–2009 permitida.');
  }
  validarCatalogoFonte(catalogo);
  const resultado = await persistirCatalogoFonte(catalogo, {
    bancoEsperado,
    roleEsperada,
    responsavelAprovacao,
    direitoUsoReferencia
  });
  process.stdout.write(
    resultado === 'criado'
      ? `Catálogo IBGE carregado: ${catalogo.fonte.versao}, ${catalogo.registros.length} registros.\n`
      : `Catálogo IBGE já está íntegro: ${catalogo.fonte.versao}, ${catalogo.registros.length} registros.\n`
  );
}

void executar().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : 'Falha na carga IBGE.'}\n`);
  process.exitCode = 1;
});
