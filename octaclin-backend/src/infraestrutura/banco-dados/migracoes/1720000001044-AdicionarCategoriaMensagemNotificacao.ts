import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 261, decisao de produto sobre retencao LGPD: mensagem com conteudo
 * clinico ou relevante para a assistencia deve herdar os 20 anos do
 * prontuario; mensagem puramente administrativa/de suporte segue retencao
 * padrao de 12 meses apos o fim da finalidade. Sem essa coluna nao ha onde
 * apoiar a diferenca.
 *
 * Default `'administrativo'`: toda linha existente e todo remetente atual
 * (agenda, lembretes, recall, envio de documento) manda so conteudo
 * transacional/administrativo -- nenhum fluxo hoje envia narrativa clinica
 * por `mensagens_notificacao` (esse conteudo fica em
 * `evolucoes_clinicas`/`documentos_emitidos`, cifrado). O default reflete a
 * realidade atual, nao uma suposicao.
 *
 * @aplicacao fora-de-banda
 */
export class AdicionarCategoriaMensagemNotificacao1720000001044 implements MigrationInterface {
  name = 'AdicionarCategoriaMensagemNotificacao1720000001044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table mensagens_notificacao
        add column if not exists categoria varchar(20) not null default 'administrativo';

      alter table mensagens_notificacao
        drop constraint if exists mensagens_notificacao_categoria_check,
        add constraint mensagens_notificacao_categoria_check
          check (categoria in ('clinico', 'administrativo'));

      comment on column mensagens_notificacao.categoria is
        'clinico herda a retencao de 20 anos do prontuario; administrativo segue retencao padrao de 12 meses (Fase 261).';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table mensagens_notificacao
        drop constraint if exists mensagens_notificacao_categoria_check,
        drop column if exists categoria;
    `);
  }
}
