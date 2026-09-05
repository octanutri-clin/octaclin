import { createHash } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

const CODIGO = 'taco_nepa_unicamp';
const VERSAO_LEGADA = '4a edicao revisada e ampliada-2011';
const VERSAO_CANONICA = 'taco-4a-cmvcol-taco3-v1';
const BASE_CANONICA = 'cmvcol_taco3';
const CHECKSUM_ARQUIVO = 'a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14';
const HASH_CONTEUDO = '82c22bc4c72720f9786478b5ba0c6947316b23c4cddfd365781ee2ffb7f481e7';
const TOTAL_ALIMENTOS = 583;

interface FonteLegada {
  id: string;
}

interface AlimentoLegado {
  codigo_origem: string;
  nome: string;
  energia_kcal?: string | null;
  proteinas_g?: string | null;
  carboidratos_g?: string | null;
  lipidios_g?: string | null;
  fibras_g?: string | null;
  sodio_mg?: string | null;
  micronutrientes?: Record<string, unknown> | null;
}

function numeroOuNulo(valor?: string | null): number | null {
  if (valor === undefined || valor === null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function calcularHashLegadoTaco(linhas: AlimentoLegado[]): string {
  const alimentos = linhas
    .map((linha) => ({
      codigo: Number(linha.codigo_origem),
      descricao: linha.nome,
      categoria: String(linha.micronutrientes?.categoria ?? ''),
      energiaKcal: numeroOuNulo(linha.energia_kcal),
      proteinaG: numeroOuNulo(linha.proteinas_g),
      lipideosG: numeroOuNulo(linha.lipidios_g),
      carboidratoG: numeroOuNulo(linha.carboidratos_g),
      fibraG: numeroOuNulo(linha.fibras_g),
      sodioMg: numeroOuNulo(linha.sodio_mg)
    }))
    .sort((a, b) => a.codigo - b.codigo);
  return createHash('sha256').update(JSON.stringify(alimentos)).digest('hex');
}

/** @aplicacao somente-dados */
export class AtivarLegadoTacoGovernado1720000001029 implements MigrationInterface {
  name = 'AtivarLegadoTacoGovernado1720000001029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const canonicas = (await queryRunner.query(
      `select id
         from fontes_composicao_alimentos
        where codigo = $1 and versao = $2 and base_codigo = $3 and situacao = 'ativa'`,
      [CODIGO, VERSAO_CANONICA, BASE_CANONICA]
    )) as FonteLegada[];
    if (canonicas.length === 1) return;
    if (canonicas.length > 1) throw new Error('Governanca TACO invalida: mais de uma fonte canonica ativa.');

    const legadas = (await queryRunner.query(
      `select id
         from fontes_composicao_alimentos
        where codigo = $1 and versao = $2 and hash_conteudo = $3 and situacao = 'em_validacao'`,
      [CODIGO, VERSAO_LEGADA, CHECKSUM_ARQUIVO]
    )) as FonteLegada[];
    if (!legadas.length) return;
    if (legadas.length !== 1) throw new Error('Governanca TACO invalida: identidade legada ambigua.');

    const fonte = legadas[0];
    const alimentos = (await queryRunner.query(
      `select codigo_origem, nome, energia_kcal, proteinas_g, carboidratos_g,
              lipidios_g, fibras_g, sodio_mg, micronutrientes
         from alimentos_composicao
        where fonte_id = $1`,
      [fonte.id]
    )) as AlimentoLegado[];
    if (alimentos.length !== TOTAL_ALIMENTOS || calcularHashLegadoTaco(alimentos) !== HASH_CONTEUDO) {
      throw new Error('Conversao TACO recusada: conteudo legado diverge do catalogo canonico conhecido.');
    }

    await queryRunner.query("select set_config('app.catalogo_ator', $1, true)", [
      'migracao-fase-234-legado-taco-validado'
    ]);
    await queryRunner.query("select set_config('app.catalogo_motivo', $1, true)", [
      'Conversao da identidade legada TACO apos validacao integral dos 583 alimentos.'
    ]);
    await queryRunner.query(
      `update fontes_composicao_alimentos
          set versao = $2,
              base_codigo = $3,
              url_artefato = 'https://www.nepa.unicamp.br/arquivo/uploads/taco-4a-edicao/taco-4a-edicao-2/',
              checksum_arquivo = $4,
              hash_conteudo = $5,
              capturada_em = importada_em,
              esquema_versao = 'octaclin-composicao-v1',
              esquema_nutrientes = jsonb_build_object(
                'baseGramas', 100,
                'campos', jsonb_build_object(
                  'energiaKcal', 'kcal',
                  'proteinasG', 'g',
                  'carboidratosG', 'g',
                  'lipidiosG', 'g',
                  'fibrasG', 'g',
                  'sodioMg', 'mg'
                )
              ),
              direito_uso_status = 'aprovado',
              direito_uso_referencia = coalesce(
                url_fonte,
                'https://nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/'
              ),
              direito_uso_aprovado_em = importada_em,
              responsavel_aprovacao = 'migracao-fase-234-legado-taco-validado',
              situacao = 'ativa'
        where id = $1`,
      [fonte.id, VERSAO_CANONICA, BASE_CANONICA, CHECKSUM_ARQUIVO, HASH_CONTEUDO]
    );
  }

  public async down(): Promise<void> {
    throw new Error('Migration 1029 e forward-only: a identidade clinica validada nao deve ser revertida.');
  }
}
