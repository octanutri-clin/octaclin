import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 265, Incremento 265.2 (`docs/history/phases/PLANO_FASE_265.md`):
 * persistencia e RLS para a prioridade de acompanhamento explicavel. So
 * schema -- nenhum consumidor de producao le ou escreve estas tabelas neste
 * incremento; o calculador puro (265.1) e o job idempotente (265.3) que vao
 * usa-las continuam desacoplados de proposito, para manter o risco desta
 * migration isolado do risco de logica de negocio.
 *
 * Duas tabelas, papeis diferentes:
 *
 * - `prioridades_acompanhamento_paciente`: uma linha por paciente com o
 *   ultimo estado calculado (score, faixa, fatores, versao da formula) e o
 *   override humano em vigor, se houver. E uma projecao recomputavel a
 *   qualquer momento a partir do historico e dos dados de origem -- por isso
 *   o `down()` pode remove-la sem perda real.
 * - `prioridades_acompanhamento_historico`: append-only, uma linha por
 *   evento (calculo novo ou mudanca de override). E o registro de auditoria
 *   e a fonte de verdade para reconstruir "por que este paciente tinha esta
 *   prioridade nesta data" depois. Protegida pelo mesmo mecanismo de
 *   trigger que `user_action_logs` (migration 1038): nem o dono da tabela
 *   consegue `update`/`delete`/`truncate` por SQL comum.
 *
 * Override "tudo ou nada": a check constraint em
 * `prioridades_acompanhamento_paciente` obriga os campos de controle do override
 * (faixa, codigo de motivo, expiracao, ator, instante) a existirem juntos ou
 * nenhum. A migration corretiva 1047 inclui tambem a justificativa cifrada
 * nessa invariavel "tudo ou nada" sem reescrever esta migration publicada.
 *
 * `override_codigo_motivo` fica como `varchar` livre nesta migration porque
 * o conjunto fechado de codigos de motivo ainda nao foi definido pelo
 * produto (secao 3.3 do plano so diz "codigo de motivo fechado"); validar o
 * conjunto e responsabilidade da aplicacao no incremento 265.4, quando o
 * fluxo de escrita do override for implementado. `override_justificativa`
 * e cifrada (`bytea`) porque o plano marca a justificativa como dado
 * clinico protegido que nao pode entrar em log comum -- mesmo padrao de
 * `acompanhamento_tarefas.descricao_criptografada`.
 *
 * Rollback deliberadamente assimetrico: `down()` remove
 * `prioridades_acompanhamento_paciente` (cache recomputavel), mas NUNCA
 * `prioridades_acompanhamento_historico`. O plano exige "consumidores podem
 * voltar a ignorar os campos, mas o historico ja criado nao deve ser
 * apagado automaticamente" -- um `drop table` do historico apagaria
 * definitivamente um registro que pode ja ter valor de auditoria em
 * producao. Reverter esta migration deixa a tabela de historico orfa (sem
 * escritor), nao vazia.
 *
 * @aplicacao fora-de-banda
 */
export class AdicionarPrioridadeAcompanhamento1720000001046 implements MigrationInterface {
  name = 'AdicionarPrioridadeAcompanhamento1720000001046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table if not exists prioridades_acompanhamento_paciente (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        score integer not null check (score between 0 and 100),
        faixa varchar(10) not null check (faixa in ('baixa', 'media', 'alta')),
        fatores jsonb not null default '[]',
        versao_formula varchar(20) not null,
        calculado_em timestamptz not null,
        override_faixa varchar(10) check (override_faixa in ('baixa', 'media', 'alta')),
        override_codigo_motivo varchar(60),
        override_justificativa_criptografada bytea,
        override_expira_em timestamptz,
        override_ator_usuario_id uuid references usuarios(id),
        override_criado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        unique (tenant_id, paciente_id),
        check (
          (override_faixa is null and override_codigo_motivo is null and override_expira_em is null and override_ator_usuario_id is null and override_criado_em is null)
          or
          (override_faixa is not null and override_codigo_motivo is not null and override_expira_em is not null and override_ator_usuario_id is not null and override_criado_em is not null)
        )
      );

      create index if not exists idx_prioridades_acompanhamento_paciente_override_expira
        on prioridades_acompanhamento_paciente (override_expira_em)
        where override_expira_em is not null;

      alter table prioridades_acompanhamento_paciente enable row level security;
      alter table prioridades_acompanhamento_paciente force row level security;

      drop policy if exists isolamento_tenant_prioridades_acompanhamento_paciente on prioridades_acompanhamento_paciente;
      create policy isolamento_tenant_prioridades_acompanhamento_paciente on prioridades_acompanhamento_paciente
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);

    await queryRunner.query(`
      create table if not exists prioridades_acompanhamento_historico (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        tipo_evento varchar(30) not null
          check (tipo_evento in ('calculo', 'override_criado', 'override_alterado', 'override_expirado', 'override_removido')),
        score integer,
        faixa varchar(10),
        versao_formula varchar(20),
        fatores jsonb,
        ator_usuario_id uuid references usuarios(id),
        override_codigo_motivo varchar(60),
        override_expira_em timestamptz,
        criado_em timestamptz not null default now()
      );

      create index if not exists idx_prioridades_acompanhamento_historico_tenant_paciente
        on prioridades_acompanhamento_historico (tenant_id, paciente_id, criado_em desc);

      alter table prioridades_acompanhamento_historico enable row level security;
      alter table prioridades_acompanhamento_historico force row level security;

      drop policy if exists isolamento_tenant_prioridades_acompanhamento_historico on prioridades_acompanhamento_historico;
      create policy isolamento_tenant_prioridades_acompanhamento_historico on prioridades_acompanhamento_historico
        using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `);

    await queryRunner.query(`
      create or replace function rejeitar_mutacao_prioridades_acompanhamento_historico()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception
          'prioridades_acompanhamento_historico e append-only: % rejeitado.', tg_op
          using errcode = '42501';
      end;
      $$;
    `);

    await queryRunner.query(`
      drop trigger if exists trg_prioridades_acompanhamento_historico_append_only on prioridades_acompanhamento_historico;
      create trigger trg_prioridades_acompanhamento_historico_append_only
        before update or delete on prioridades_acompanhamento_historico
        for each row execute function rejeitar_mutacao_prioridades_acompanhamento_historico();
      alter table prioridades_acompanhamento_historico
        enable always trigger trg_prioridades_acompanhamento_historico_append_only;
    `);

    await queryRunner.query(`
      drop trigger if exists trg_prioridades_acompanhamento_historico_sem_truncate on prioridades_acompanhamento_historico;
      create trigger trg_prioridades_acompanhamento_historico_sem_truncate
        before truncate on prioridades_acompanhamento_historico
        for each statement execute function rejeitar_mutacao_prioridades_acompanhamento_historico();
      alter table prioridades_acompanhamento_historico
        enable always trigger trg_prioridades_acompanhamento_historico_sem_truncate;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // So o estado atual (cache recomputavel) e removido. O historico
    // append-only permanece intacto de proposito -- ver o comentario da
    // classe. Os triggers de imutabilidade ficam com a tabela: sem
    // consumidor escrevendo nela, sao inertes, e mante-los evita reabrir a
    // janela de mutacao caso a tabela volte a ser usada antes de uma
    // decisao explicita de descomissiona-la.
    await queryRunner.query('drop table if exists prioridades_acompanhamento_paciente cascade');
  }
}
