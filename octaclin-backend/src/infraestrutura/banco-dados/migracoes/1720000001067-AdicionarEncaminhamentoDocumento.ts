import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class AdicionarEncaminhamentoDocumento1720000001067 implements MigrationInterface {
  name = 'AdicionarEncaminhamentoDocumento1720000001067';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table documentos_emitidos add column chave_emissao uuid;

      alter table documentos_emitidos
        drop constraint documentos_emitidos_tipo_check,
        add constraint documentos_emitidos_tipo_check
          check (tipo in ('declaracao_comparecimento', 'relatorio_alta', 'recibo_consulta', 'encaminhamento')),
        add constraint documentos_emitidos_encaminhamento_check
          check (tipo <> 'encaminhamento' or (consulta_id is null and chave_emissao is not null));

      create unique index uq_documentos_emitidos_encaminhamento_chave
        on documentos_emitidos (tenant_id, autor_usuario_id, chave_emissao)
        where tipo = 'encaminhamento';

      create function impedir_alteracao_encaminhamento_emitido() returns trigger language plpgsql as $$
      begin
        if old.tipo = 'encaminhamento' or new.tipo = 'encaminhamento' then
          if old.id is distinct from new.id
            or old.tenant_id is distinct from new.tenant_id
            or old.paciente_id is distinct from new.paciente_id
            or old.profissional_id is distinct from new.profissional_id
            or old.autor_usuario_id is distinct from new.autor_usuario_id
            or old.tipo is distinct from new.tipo
            or old.consulta_id is distinct from new.consulta_id
            or old.chave_emissao is distinct from new.chave_emissao
            or old.titulo is distinct from new.titulo
            or old.corpo_criptografado is distinct from new.corpo_criptografado
            or old.cabecalho_criptografado is distinct from new.cabecalho_criptografado
            or old.emitido_em is distinct from new.emitido_em
            or old.criado_em is distinct from new.criado_em then
            raise exception 'Snapshot de encaminhamento emitido e imutavel.';
          end if;
        end if;
        return new;
      end;
      $$;

      create trigger trg_documento_encaminhamento_imutavel
        before update on documentos_emitidos
        for each row execute function impedir_alteracao_encaminhamento_emitido();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // FORCED RLS nao pode esconder linhas e fazer o rollback parecer seguro.
    // Sem role capaz de ver todas as linhas, row_security=off recusa o SELECT.
    await queryRunner.query('set local row_security = off');
    const encontrados = (await queryRunner.query(
      "select exists (select 1 from documentos_emitidos where tipo = 'encaminhamento') as existe"
    )) as Array<{ existe: boolean }>;
    if (encontrados[0]?.existe) {
      throw new Error('Rollback recusado: existem encaminhamentos emitidos que precisam permanecer legiveis.');
    }

    await queryRunner.query(`
      drop trigger if exists trg_documento_encaminhamento_imutavel on documentos_emitidos;
      drop function if exists impedir_alteracao_encaminhamento_emitido();
      drop index if exists uq_documentos_emitidos_encaminhamento_chave;
      alter table documentos_emitidos
        drop constraint if exists documentos_emitidos_encaminhamento_check,
        drop constraint if exists documentos_emitidos_tipo_check,
        add constraint documentos_emitidos_tipo_check
          check (tipo in ('declaracao_comparecimento', 'relatorio_alta', 'recibo_consulta')),
        drop column chave_emissao;
    `);
  }
}
