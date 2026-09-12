import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 261, decisao de produto sobre retencao LGPD: arquivo clinico (exame,
 * laudo, foto clinica, documento de avaliacao e outros anexos vinculados a
 * assistencia) tem a mesma retencao de 20 anos do prontuario; arquivo
 * temporario/exportacao/artefato de download tem no maximo 7 dias; anexo
 * puramente administrativo/de suporte tem 90 dias apos encerramento, salvo
 * necessidade legal especifica.
 *
 * As quatro categorias existentes (`exame`, `documento`, `foto`, `diario`)
 * sao todas assistenciais e continuam herdando os 20 anos sem mudanca de
 * comportamento. Esta migration so amplia o CHECK para aceitar as tres
 * categorias novas (`temporario`, `exportacao`, `administrativo`); nenhum
 * fluxo de upload hoje as usa -- e a mesma base para os fluxos futuros que
 * precisarem delas.
 *
 * @aplicacao fora-de-banda
 */
export class ExpandirCategoriaArquivosMidia1720000001045 implements MigrationInterface {
  name = 'ExpandirCategoriaArquivosMidia1720000001045';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table arquivos_midia
        drop constraint if exists arquivos_midia_categoria_check,
        add constraint arquivos_midia_categoria_check
          check (categoria in ('exame', 'documento', 'foto', 'diario', 'temporario', 'exportacao', 'administrativo'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table arquivos_midia
        drop constraint if exists arquivos_midia_categoria_check,
        add constraint arquivos_midia_categoria_check
          check (categoria in ('exame', 'documento', 'foto', 'diario'));
    `);
  }
}
