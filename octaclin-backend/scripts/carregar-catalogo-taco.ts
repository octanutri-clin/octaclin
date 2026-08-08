import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { fonteDados } from '../src/infraestrutura/banco-dados/fonte-dados';
import { validarIdentidadeCatalogoTaco } from '../src/modulos/planos-alimentares/dados/importador-taco';
import type { CatalogoTaco } from '../src/modulos/planos-alimentares/dados/importador-taco';
import { AlimentoComposicaoOrm } from '../src/modulos/planos-alimentares/infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../src/modulos/planos-alimentares/infraestrutura/fonte-composicao-alimento.orm';

const CODIGO_FONTE = 'taco_nepa_unicamp';

async function executar() {
  if (process.env.TACO_CONFIRMAR_CARGA !== 'true') {
    throw new Error('Defina TACO_CONFIRMAR_CARGA=true para confirmar a carga no banco configurado.');
  }
  const bancoEsperado = process.env.TACO_BANCO_ESPERADO?.trim();
  if (!bancoEsperado) {
    throw new Error('Defina TACO_BANCO_ESPERADO com o nome exato do banco que recebera o catalogo.');
  }

  const caminho = resolve(__dirname, '../src/modulos/planos-alimentares/dados/catalogo-taco-4a.json');
  const catalogo = JSON.parse(await readFile(caminho, 'utf8')) as CatalogoTaco;
  const identidade = validarIdentidadeCatalogoTaco(catalogo);
  await fonteDados.initialize();

  try {
    const [{ nome: bancoAtual } = {}] = (await fonteDados.query(
      'select current_database() as nome'
    )) as { nome?: string }[];
    if (bancoAtual !== bancoEsperado) {
      throw new Error(`Carga recusada: banco conectado e "${bancoAtual ?? 'desconhecido'}", esperado "${bancoEsperado}".`);
    }

    await fonteDados.transaction(async (gerenciador) => {
      const fontes = gerenciador.getRepository(FonteComposicaoAlimentoOrm);
      await fontes.upsert(
        {
          codigo: CODIGO_FONTE,
          nome: catalogo.metadados.fonte.nome,
          versao: identidade.versaoArtefato,
          licenca: catalogo.metadados.fonte.licenca.texto,
          urlFonte: catalogo.metadados.fonte.urlPublicacao,
          hashConteudo: identidade.sha256Alimentos,
          publicadaEm: `${catalogo.metadados.fonte.ano}-01-01`
        },
        ['codigo', 'versao']
      );
      const fonte = await fontes.findOneByOrFail({
        codigo: CODIGO_FONTE,
        versao: identidade.versaoArtefato
      });

      const alimentos = gerenciador.getRepository(AlimentoComposicaoOrm);
      for (let inicio = 0; inicio < catalogo.alimentos.length; inicio += 100) {
        const lote = catalogo.alimentos.slice(inicio, inicio + 100).map((alimento) => ({
          fonteId: fonte.id,
          codigoOrigem: String(alimento.codigo),
          nome: alimento.descricao,
          baseGramas: '100',
          energiaKcal: alimento.energiaKcal === null ? undefined : String(alimento.energiaKcal),
          proteinasG: alimento.proteinaG === null ? undefined : String(alimento.proteinaG),
          carboidratosG: alimento.carboidratoG === null ? undefined : String(alimento.carboidratoG),
          lipidiosG: alimento.lipideosG === null ? undefined : String(alimento.lipideosG),
          fibrasG: alimento.fibraG === null ? undefined : String(alimento.fibraG),
          sodioMg: alimento.sodioMg === null ? undefined : String(alimento.sodioMg),
          micronutrientes: { categoria: alimento.categoria }
        }));
        await alimentos.upsert(lote, ['fonteId', 'codigoOrigem']);
      }
    });

    process.stdout.write(`Catalogo TACO carregado: ${catalogo.alimentos.length} alimentos.\n`);
  } finally {
    await fonteDados.destroy();
  }
}

void executar().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exitCode = 1;
});
