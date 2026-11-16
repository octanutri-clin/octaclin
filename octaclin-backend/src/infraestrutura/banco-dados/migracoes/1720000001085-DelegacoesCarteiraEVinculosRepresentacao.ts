import type { MigrationInterface, QueryRunner } from 'typeorm';

const TENANT_ATUAL = "nullif(current_setting('app.tenant_id', true), '')::uuid";

/** Políticas por comando (SELECT/INSERT/UPDATE), nunca ALL nem DELETE; mesmo padrão da 1084. */
function politicas(tabela: string, prefixo: string): string {
  return `
      alter table ${tabela} enable row level security;
      alter table ${tabela} force row level security;
      create policy ${prefixo}_leitura on ${tabela} for select using (tenant_id = ${TENANT_ATUAL});
      create policy ${prefixo}_criacao on ${tabela} for insert with check (tenant_id = ${TENANT_ATUAL});
      create policy ${prefixo}_revogacao on ${tabela} for update using (tenant_id = ${TENANT_ATUAL}) with check (tenant_id = ${TENANT_ATUAL});`;
}

/**
 * FOOD06 P2d-1: estrutura VAZIA de delegação de carteira (titular → colaborador) e de vínculo de representação
 * (conta representante → paciente). Decisões do proprietário: a delegação cobre a carteira ATUAL do titular, sem
 * prazo, e nunca dá confirmação clínica; uma conta pode representar vários pacientes; a equipe registra o vínculo
 * e a verificação fica só registrada (tipo, quem, quando), sem documento. Sem serviço, rota ou consumidor nesta
 * etapa (P2d-2 e P2d-3). Histórico nunca é apagado: só a revogação única altera a linha.
 * Owner ainda pode remover triggers: não é proteção contra administrador do banco.
 * @aplicacao fora-de-banda
 */
export class DelegacoesCarteiraEVinculosRepresentacao1720000001085 implements MigrationInterface {
  name = 'DelegacoesCarteiraEVinculosRepresentacao1720000001085';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      create table delegacoes_carteira_profissional (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        profissional_id uuid not null,
        colaborador_usuario_id uuid not null,
        concedida_por uuid not null,
        concedida_em timestamptz not null default now(),
        revogada_por uuid,
        revogada_em timestamptz,
        unique (tenant_id, id),
        constraint ck_delegacoes_sem_auto_concessao check (concedida_por <> colaborador_usuario_id),
        constraint ck_delegacoes_carteira_revogacao check (
          (revogada_por is null) = (revogada_em is null)
          and (revogada_em is null or revogada_em >= concedida_em)),
        foreign key (tenant_id, profissional_id) references profissionais(tenant_id, id) on delete restrict,
        foreign key (tenant_id, colaborador_usuario_id) references usuarios(tenant_id, id) on delete restrict,
        foreign key (tenant_id, concedida_por) references usuarios(tenant_id, id) on delete restrict,
        foreign key (tenant_id, revogada_por) references usuarios(tenant_id, id) on delete restrict
      );
      create unique index ux_delegacoes_carteira_ativa
        on delegacoes_carteira_profissional (tenant_id, profissional_id, colaborador_usuario_id) where revogada_em is null;
      create index idx_delegacoes_carteira_colaborador
        on delegacoes_carteira_profissional (tenant_id, colaborador_usuario_id) where revogada_em is null;
      ${politicas('delegacoes_carteira_profissional', 'delegacoes_carteira')}

      create table vinculos_representacao_paciente (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        paciente_id uuid not null,
        representante_usuario_id uuid not null,
        verificado_por uuid not null,
        verificado_em timestamptz not null default now(),
        tipo_verificacao varchar(24) not null check (tipo_verificacao in ('documento_apresentado', 'presencial', 'procuracao', 'outro')),
        revogado_por uuid,
        revogado_em timestamptz,
        unique (tenant_id, id),
        constraint ck_vinculos_sem_auto_outorga check (verificado_por <> representante_usuario_id),
        constraint ck_vinculos_representacao_revogacao check (
          (revogado_por is null) = (revogado_em is null)
          and (revogado_em is null or revogado_em >= verificado_em)),
        foreign key (tenant_id, paciente_id) references pacientes(tenant_id, id) on delete restrict,
        foreign key (tenant_id, representante_usuario_id) references usuarios(tenant_id, id) on delete restrict,
        foreign key (tenant_id, verificado_por) references usuarios(tenant_id, id) on delete restrict,
        foreign key (tenant_id, revogado_por) references usuarios(tenant_id, id) on delete restrict
      );
      create unique index ux_vinculos_representacao_ativo
        on vinculos_representacao_paciente (tenant_id, paciente_id, representante_usuario_id) where revogado_em is null;
      create index idx_vinculos_representacao_representante
        on vinculos_representacao_paciente (tenant_id, representante_usuario_id) where revogado_em is null;
      ${politicas('vinculos_representacao_paciente', 'vinculos_representacao')}
    `);
    await q.query(`
      create function rejeitar_exclusao_delegacao_vinculo() returns trigger language plpgsql as $$
      begin
        raise exception 'Delegacoes e vinculos preservam historico: exclusao recusada.' using errcode = '42501';
      end; $$;

      -- Datas do histórico vêm do banco, nunca do cliente; nenhuma linha nasce revogada (revisão R4 da P2d-1).
      create function validar_criacao_delegacao_carteira() returns trigger language plpgsql as $$
      begin
        if new.revogada_por is not null or new.revogada_em is not null then
          raise exception 'Delegacao nasce vigente.' using errcode = '23514';
        end if;
        new.concedida_em := now();
        return new;
      end; $$;

      create function validar_criacao_vinculo_representacao() returns trigger language plpgsql as $$
      begin
        if new.revogado_por is not null or new.revogado_em is not null then
          raise exception 'Vinculo nasce vigente.' using errcode = '23514';
        end if;
        new.verificado_em := now();
        return new;
      end; $$;

      create function validar_revogacao_delegacao_carteira() returns trigger language plpgsql as $$
      begin
        if (new.id, new.tenant_id, new.profissional_id, new.colaborador_usuario_id, new.concedida_por, new.concedida_em)
           is distinct from (old.id, old.tenant_id, old.profissional_id, old.colaborador_usuario_id, old.concedida_por, old.concedida_em)
           or old.revogada_em is not null or new.revogada_em is null or new.revogada_por is null then
          raise exception 'Delegacao imutavel: apenas revogacao unica e permitida.' using errcode = '23514';
        end if;
        new.revogada_em := clock_timestamp();
        return new;
      end; $$;

      create function validar_revogacao_vinculo_representacao() returns trigger language plpgsql as $$
      begin
        if (new.id, new.tenant_id, new.paciente_id, new.representante_usuario_id, new.verificado_por, new.verificado_em, new.tipo_verificacao)
           is distinct from (old.id, old.tenant_id, old.paciente_id, old.representante_usuario_id, old.verificado_por, old.verificado_em, old.tipo_verificacao)
           or old.revogado_em is not null or new.revogado_em is null or new.revogado_por is null then
          raise exception 'Vinculo imutavel: apenas revogacao unica e permitida.' using errcode = '23514';
        end if;
        new.revogado_em := clock_timestamp();
        return new;
      end; $$;

      create trigger trg_delegacoes_carteira_sem_exclusao
        before delete or truncate on delegacoes_carteira_profissional
        for each statement execute function rejeitar_exclusao_delegacao_vinculo();
      alter table delegacoes_carteira_profissional enable always trigger trg_delegacoes_carteira_sem_exclusao;
      revoke delete, truncate on delegacoes_carteira_profissional from public;
      create trigger trg_delegacoes_carteira_criacao
        before insert on delegacoes_carteira_profissional
        for each row execute function validar_criacao_delegacao_carteira();
      alter table delegacoes_carteira_profissional enable always trigger trg_delegacoes_carteira_criacao;
      create trigger trg_delegacoes_carteira_revogacao
        before update on delegacoes_carteira_profissional
        for each row execute function validar_revogacao_delegacao_carteira();
      alter table delegacoes_carteira_profissional enable always trigger trg_delegacoes_carteira_revogacao;

      create trigger trg_vinculos_representacao_sem_exclusao
        before delete or truncate on vinculos_representacao_paciente
        for each statement execute function rejeitar_exclusao_delegacao_vinculo();
      alter table vinculos_representacao_paciente enable always trigger trg_vinculos_representacao_sem_exclusao;
      revoke delete, truncate on vinculos_representacao_paciente from public;
      create trigger trg_vinculos_representacao_criacao
        before insert on vinculos_representacao_paciente
        for each row execute function validar_criacao_vinculo_representacao();
      alter table vinculos_representacao_paciente enable always trigger trg_vinculos_representacao_criacao;
      create trigger trg_vinculos_representacao_revogacao
        before update on vinculos_representacao_paciente
        for each row execute function validar_revogacao_vinculo_representacao();
      alter table vinculos_representacao_paciente enable always trigger trg_vinculos_representacao_revogacao;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    if (!q.isTransactionActive) throw new Error('Rollback recusado: execute em transacao.');
    const iso: Array<{ transaction_isolation: string }> = await q.query('show transaction_isolation');
    if (iso[0]?.transaction_isolation !== 'read committed') throw new Error('Rollback recusado: exige READ COMMITTED.');
    await q.query('set local row_security = off');
    const rs: Array<{ rs: string }> = await q.query("select current_setting('row_security') as rs");
    if (rs[0]?.rs !== 'off') throw new Error('Rollback recusado: estado de RLS nao verificavel.');
    await q.query('lock table delegacoes_carteira_profissional, vinculos_representacao_paciente in access exclusive mode');
    for (const tabela of ['delegacoes_carteira_profissional', 'vinculos_representacao_paciente']) {
      const rows: Array<{ existe: boolean }> = await q.query(`select exists(select 1 from ${tabela}) as existe`);
      if (rows[0]?.existe !== false) throw new Error('Rollback recusado: preservar delegacoes, vinculos e historico.');
    }
    await q.query(`drop table vinculos_representacao_paciente;
      drop table delegacoes_carteira_profissional;
      drop function validar_revogacao_vinculo_representacao();
      drop function validar_criacao_vinculo_representacao();
      drop function validar_criacao_delegacao_carteira();
      drop function validar_revogacao_delegacao_carteira();
      drop function rejeitar_exclusao_delegacao_vinculo();`);
  }
}
