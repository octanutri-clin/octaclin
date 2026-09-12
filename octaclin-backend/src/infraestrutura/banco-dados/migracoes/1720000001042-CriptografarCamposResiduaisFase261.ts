import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase A do desenho em
 * `docs/governance/DESENHO_CRIPTOGRAFIA_TITULOS_PHI_FASE261.md`: so aditiva,
 * mesmo espirito de `1720000001018-CriptografarConteudoNotificacoes`. Nenhum
 * backfill, nenhuma mudanca de comportamento -- as colunas novas ficam
 * `null` ate a Fase B (troca do caminho de escrita/leitura, PR separado)
 * comecar a grava-las.
 *
 * `titulo` de `evolucoes_clinicas`/`acompanhamento_tarefas` e `valor` de
 * `logs_diario_rapido` perdem o `not null`: a Fase B vai gravar so a coluna
 * cifrada em linha nova, e a antiga so continua preenchida em linha
 * historica. `documentos_emitidos.motivo_cancelamento` ja e nullable, e o
 * CHECK `documentos_emitidos_cancelamento_check` continua valido sem
 * alteracao (ele so proibe motivo preenchido sem cancelamento, nao exige o
 * contrario).
 *
 * @aplicacao fora-de-banda
 */
export class CriptografarCamposResiduaisFase2611720000001042 implements MigrationInterface {
  name = 'CriptografarCamposResiduaisFase2611720000001042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table logs_diario_rapido
        add column if not exists valor_criptografado bytea,
        alter column valor drop not null;

      comment on column logs_diario_rapido.valor_criptografado is
        'Conteudo do registro rapido (JSON serializado e cifrado). valor em claro so continua preenchido em linha anterior a Fase B.';

      alter table evolucoes_clinicas
        add column if not exists titulo_criptografado bytea,
        alter column titulo drop not null;

      comment on column evolucoes_clinicas.titulo_criptografado is
        'Titulo da evolucao clinica, cifrado. titulo em claro so continua preenchido em linha anterior a Fase B.';

      alter table acompanhamento_tarefas
        add column if not exists titulo_criptografado bytea,
        alter column titulo drop not null;

      comment on column acompanhamento_tarefas.titulo_criptografado is
        'Titulo da tarefa de acompanhamento, cifrado. titulo em claro so continua preenchido em linha anterior a Fase B.';

      alter table documentos_emitidos
        add column if not exists motivo_cancelamento_criptografado bytea;

      comment on column documentos_emitidos.motivo_cancelamento_criptografado is
        'Motivo de cancelamento do documento, cifrado. motivo_cancelamento em claro so continua preenchido em linha anterior a Fase B.';

      alter table agenda_consultas
        add column if not exists motivo_cancelamento_criptografado bytea;

      comment on column agenda_consultas.motivo_cancelamento_criptografado is
        'Motivo de cancelamento da consulta, cifrado. A partir da Fase B, payload.historico para de gravar o motivo em claro, so um booleano de presenca.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table agenda_consultas
        drop column if exists motivo_cancelamento_criptografado;

      alter table documentos_emitidos
        drop column if exists motivo_cancelamento_criptografado;

      alter table acompanhamento_tarefas
        alter column titulo set not null,
        drop column if exists titulo_criptografado;

      alter table evolucoes_clinicas
        alter column titulo set not null,
        drop column if exists titulo_criptografado;

      alter table logs_diario_rapido
        alter column valor set not null,
        drop column if exists valor_criptografado;
    `);
  }
}
