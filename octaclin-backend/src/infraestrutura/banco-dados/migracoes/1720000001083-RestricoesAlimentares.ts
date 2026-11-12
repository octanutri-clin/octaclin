import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FOOD06 P1b (contrato v2 §4.1 + v3 §2.1): tabelas ADITIVAS e VAZIAS de restrições alimentares. Sem backfill,
 * sem dado, sem consumidor: nenhum serviço, rota ou flag lê estas tabelas nesta etapa.
 *
 * Proteções (R4):
 * - Toda tabela tem `tenant_id`, RLS `ENABLE` + `FORCE` e policies só por `app.tenant_id` (padrão 1081). Nenhuma
 *   policy de DELETE; as tabelas de histórico não têm policy de UPDATE.
 * - Histórico append-only por trigger POR INSTRUÇÃO (padrão 1082), que dispara para qualquer role, inclusive owner,
 *   e cobre TRUNCATE. As tabelas de estado também recusam DELETE/TRUNCATE: inativar nunca apaga (Q3).
 * - Conteúdo clínico (natureza, subtipo, alvo, gravidade, observação, pedido, explicação, justificativa, evidência,
 *   resultado da reconfirmação) só em `bytea` cifrado pela aplicação (`CriptografiaDadosSensiveis`, padrão das
 *   gestações). Em claro ficam só identificadores, estados e datas necessários a constraints e consultas.
 *   Sem coluna `razao` (Q4) e sem reutilizar `resposta_valores`/`respostas_rascunho` (auditoria Q5).
 * - D2 (#531): o conteúdo de `restricoes_pacientes` e das revisões só é escrito pelo codec
 *   `codec-conteudo-restricao.ts`, que valida o objeto clínico e vincula a cifra a tenant, paciente, restrição e revisão.
 *   O banco garante só o que enxerga (tamanho do bytea, estados, FKs); os invariantes clínicos são da aplicação.
 * - FKs compostas por tenant, sempre RESTRICT.
 * - Mapeamento: esta tabela é só a LOCAL do tenant (`origem = 'local_profissional'`, Q9 nível 1); um tenant não
 *   consegue forjar mapeamento `global`. O catálogo global (Q9 nível 2) tem outro modelo de acesso e fica para a
 *   PR da curadoria. Liberação local (`nao_contem_confirmado`) exige evidência cifrada; o motor ainda a trata
 *   como `exige_confirmacao`.
 * - Fora de escopo: taxonomia, regras clínicas, decisões de aplicação, pedidos de curadoria, permissão por
 *   usuário (Q6) e migração do histórico do questionário.
 *
 * Limites: o owner ainda pode desabilitar triggers no catálogo; isso não é imutabilidade contra o administrador do
 * banco. Eliminação por direito do titular (LGPD) exige procedimento fora de banda.
 *
 * @aplicacao fora-de-banda
 */
export const TABELAS_RESTRICOES_ALIMENTARES = [
  'restricoes_pacientes',
  'restricoes_pacientes_revisoes',
  'avaliacoes_restricoes_pacientes',
  'avaliacoes_restricoes_revisoes',
  'reconfirmacoes_restricoes',
  'solicitacoes_restricoes_pacientes',
  'mapeamentos_alimento_alvo_locais'
] as const;

const APPEND_ONLY = ['restricoes_pacientes_revisoes', 'avaliacoes_restricoes_revisoes', 'reconfirmacoes_restricoes', 'mapeamentos_alimento_alvo_locais'];
const MUTAVEIS = ['restricoes_pacientes', 'avaliacoes_restricoes_pacientes', 'solicitacoes_restricoes_pacientes'];
const TENANT = "tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid";
const CIFRADO = (coluna: string, obrigatorio = true) =>
  `${coluna} bytea${obrigatorio ? ' not null' : ''} check (octet_length(${coluna}) between 32 and 65536)`;
const ID_CURTO = (coluna: string) => `${coluna} varchar(100) not null check (${coluna} ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$')`;
const ROLES_CONHECIDAS = "array['octaclin_runtime_integracao', 'octaclin_app_producao']";

export class RestricoesAlimentares1720000001083 implements MigrationInterface {
  name = 'RestricoesAlimentares1720000001083';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      create table restricoes_pacientes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        paciente_id uuid not null,
        autor_usuario_id uuid not null,
        chave_criacao uuid not null,
        origem varchar(24) not null check (origem in ('profissional', 'colaborador', 'declaracao_paciente', 'questionario_legado')),
        estado varchar(16) not null default 'ativa' check (estado in ('ativa', 'em_reavaliacao', 'inativa')),
        confirmacao varchar(12) not null default 'pendente' check (confirmacao in ('pendente', 'confirmada', 'rejeitada')),
        confirmado_por_usuario_id uuid,
        confirmado_em timestamptz,
        ${CIFRADO('conteudo_criptografado')},
        revisao integer not null default 1 check (revisao > 0),
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        unique (tenant_id, paciente_id, id),
        constraint ux_restricoes_pacientes_criacao unique (tenant_id, autor_usuario_id, chave_criacao),
        constraint ck_restricoes_pacientes_confirmacao check (
          (confirmacao = 'confirmada') = (confirmado_por_usuario_id is not null and confirmado_em is not null)
          and (confirmado_por_usuario_id is null) = (confirmado_em is null)),
        foreign key (tenant_id, paciente_id) references pacientes(tenant_id, id) on delete restrict,
        foreign key (tenant_id, autor_usuario_id) references usuarios(tenant_id, id) on delete restrict,
        foreign key (tenant_id, confirmado_por_usuario_id) references usuarios(tenant_id, id) on delete restrict
      )`);
    await q.query(`
      create table restricoes_pacientes_revisoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        paciente_id uuid not null,
        restricao_id uuid not null,
        numero integer not null check (numero > 0),
        evento varchar(16) not null check (evento in ('criacao', 'edicao', 'confirmacao', 'rejeicao', 'reavaliacao', 'reativacao', 'inativacao')),
        motivo_inativacao varchar(32) check (motivo_inativacao in ('registro_incorreto', 'informacao_clinica_revisada', 'solicitacao_fundamentada', 'outro')),
        confirmacao_dois_passos boolean not null default false,
        autor_usuario_id uuid not null,
        ${CIFRADO('conteudo_criptografado')},
        ${CIFRADO('justificativa_criptografada', false)},
        criado_em timestamptz not null default now(),
        unique (tenant_id, restricao_id, numero),
        check ((evento = 'inativacao') = (motivo_inativacao is not null)),
        check (evento <> 'inativacao' or (justificativa_criptografada is not null and confirmacao_dois_passos)),
        foreign key (tenant_id, paciente_id, restricao_id) references restricoes_pacientes(tenant_id, paciente_id, id) on delete restrict,
        foreign key (tenant_id, autor_usuario_id) references usuarios(tenant_id, id) on delete restrict
      )`);
    await q.query(`
      create table avaliacoes_restricoes_pacientes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        paciente_id uuid not null,
        situacao varchar(32) not null default 'nao_informado' check (situacao in ('nao_informado', 'sem_restricoes_confirmadas', 'restricoes_registradas')),
        confirmado_por_usuario_id uuid,
        confirmado_em timestamptz,
        vence_em timestamptz,
        revisao integer not null default 1 check (revisao > 0),
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_avaliacoes_restricoes_paciente unique (tenant_id, paciente_id),
        unique (tenant_id, paciente_id, id),
        unique (tenant_id, id),
        check ((situacao = 'nao_informado') = (confirmado_por_usuario_id is null)),
        check ((confirmado_por_usuario_id is null) = (confirmado_em is null) and (confirmado_em is null) = (vence_em is null)),
        check (vence_em is null or vence_em > confirmado_em),
        foreign key (tenant_id, paciente_id) references pacientes(tenant_id, id) on delete restrict,
        foreign key (tenant_id, confirmado_por_usuario_id) references usuarios(tenant_id, id) on delete restrict
      )`);
    await q.query(`
      create table avaliacoes_restricoes_revisoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        paciente_id uuid not null,
        avaliacao_id uuid not null,
        numero integer not null check (numero > 0),
        situacao varchar(32) not null check (situacao in ('nao_informado', 'sem_restricoes_confirmadas', 'restricoes_registradas')),
        autor_usuario_id uuid not null,
        vence_em timestamptz,
        criado_em timestamptz not null default now(),
        unique (tenant_id, avaliacao_id, numero),
        foreign key (tenant_id, paciente_id, avaliacao_id) references avaliacoes_restricoes_pacientes(tenant_id, paciente_id, id) on delete restrict,
        foreign key (tenant_id, autor_usuario_id) references usuarios(tenant_id, id) on delete restrict
      )`);
    // Q10 + D4 (#531): atestação do profissional. O sistema não verifica que a pergunta ocorreu; registra quem atestou,
    // quando, por qual meio, o resultado (cifrado) e a revisão REAL da avaliação (obrigatória). A restrição é opcional;
    // reconfirmação individual nunca renova a avaliação global (`vence_em` nulo), e `vence_em` nulo também registra
    // pendência mantida sem declaração falsa.
    await q.query(`
      create table reconfirmacoes_restricoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        paciente_id uuid not null,
        avaliacao_id uuid not null,
        revisao_avaliacao integer not null check (revisao_avaliacao > 0),
        restricao_id uuid,
        revisao_restricao integer check (revisao_restricao > 0),
        atestado_por_usuario_id uuid not null,
        atestado_em timestamptz not null,
        meio varchar(24) not null check (meio in ('presencial', 'teleconsulta', 'portal', 'contato_documentado')),
        ${CIFRADO('resultado_criptografado')},
        vence_em timestamptz,
        chave_idempotencia uuid not null,
        criado_em timestamptz not null default now(),
        constraint ux_reconfirmacoes_idempotencia unique (tenant_id, atestado_por_usuario_id, chave_idempotencia),
        check (vence_em is null or vence_em > atestado_em),
        check ((restricao_id is null) = (revisao_restricao is null)),
        check (restricao_id is null or vence_em is null),
        foreign key (tenant_id, paciente_id, avaliacao_id) references avaliacoes_restricoes_pacientes(tenant_id, paciente_id, id) on delete restrict,
        foreign key (tenant_id, avaliacao_id, revisao_avaliacao) references avaliacoes_restricoes_revisoes(tenant_id, avaliacao_id, numero) on delete restrict,
        foreign key (tenant_id, paciente_id, restricao_id) references restricoes_pacientes(tenant_id, paciente_id, id) on delete restrict,
        foreign key (tenant_id, restricao_id, revisao_restricao) references restricoes_pacientes_revisoes(tenant_id, restricao_id, numero) on delete restrict,
        foreign key (tenant_id, atestado_por_usuario_id) references usuarios(tenant_id, id) on delete restrict
      )`);
    // D7-a + D1 (#531): explicação AO PACIENTE (visível) separada da justificativa INTERNA (nunca exibida). Estados =
    // domínio (`ESTADOS_SOLICITACAO`), com `parcial` terminal. Toda decisão guarda o desfecho cifrado (itens alterados,
    // com a revisão da operação clínica, e inalterados); a solicitação nunca altera a restrição por si.
    await q.query(`
      create table solicitacoes_restricoes_pacientes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        paciente_id uuid not null,
        restricao_id uuid,
        tipo varchar(12) not null check (tipo in ('inclusao', 'correcao', 'remocao')),
        estado varchar(24) not null default 'criada' check (estado in ('criada', 'em_analise', 'atendida', 'parcial', 'recusada', 'cancelada_pelo_paciente')),
        autor_usuario_id uuid not null,
        chave_criacao uuid not null,
        ${CIFRADO('conteudo_criptografado')},
        ${CIFRADO('explicacao_paciente_criptografada', false)},
        ${CIFRADO('justificativa_interna_criptografada', false)},
        ${CIFRADO('desfecho_criptografado', false)},
        decidido_por_usuario_id uuid,
        decidido_em timestamptz,
        revisao integer not null default 1 check (revisao > 0),
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        constraint ux_solicitacoes_restricoes_criacao unique (tenant_id, autor_usuario_id, chave_criacao),
        check ((tipo = 'inclusao') = (restricao_id is null)),
        check ((estado in ('atendida', 'parcial', 'recusada')) = (decidido_por_usuario_id is not null and decidido_em is not null)
          and (decidido_por_usuario_id is null) = (decidido_em is null)),
        check (estado not in ('atendida', 'parcial', 'recusada') or explicacao_paciente_criptografada is not null),
        check ((estado in ('atendida', 'parcial', 'recusada')) = (desfecho_criptografado is not null)),
        foreign key (tenant_id, paciente_id) references pacientes(tenant_id, id) on delete restrict,
        foreign key (tenant_id, paciente_id, restricao_id) references restricoes_pacientes(tenant_id, paciente_id, id) on delete restrict,
        foreign key (tenant_id, autor_usuario_id) references usuarios(tenant_id, id) on delete restrict,
        foreign key (tenant_id, decidido_por_usuario_id) references usuarios(tenant_id, id) on delete restrict
      )`);
    await q.query(`
      create table mapeamentos_alimento_alvo_locais (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id) on delete restrict,
        ${ID_CURTO('fonte_id')},
        ${ID_CURTO('codigo_origem')},
        ${ID_CURTO('alvo_id')},
        ${ID_CURTO('versao_mapeamento')},
        relacao varchar(24) not null check (relacao in ('contem', 'pode_conter', 'nao_contem_confirmado')),
        granularidade varchar(12) not null check (granularidade in ('alimento', 'produto', 'ingrediente')),
        origem varchar(20) not null default 'local_profissional' check (origem = 'local_profissional'),
        cobertura varchar(12) not null check (cobertura in ('suficiente', 'insuficiente')),
        ${CIFRADO('evidencia_criptografada', false)},
        ${CIFRADO('justificativa_criptografada', false)},
        autor_usuario_id uuid not null,
        criado_em timestamptz not null default now(),
        constraint ux_mapeamentos_locais_versao unique (tenant_id, fonte_id, codigo_origem, alvo_id, versao_mapeamento),
        check (relacao <> 'nao_contem_confirmado' or evidencia_criptografada is not null),
        foreign key (tenant_id, autor_usuario_id) references usuarios(tenant_id, id) on delete restrict
      )`);

    await q.query(`
      create index idx_restricoes_pacientes_paciente on restricoes_pacientes (tenant_id, paciente_id, criado_em desc, id desc);
      create index idx_solicitacoes_restricoes_paciente on solicitacoes_restricoes_pacientes (tenant_id, paciente_id, criado_em desc, id desc);
      create index idx_reconfirmacoes_restricoes_paciente on reconfirmacoes_restricoes (tenant_id, paciente_id, atestado_em desc, id desc);
    `);

    // Recusa por instrução: dispara antes de o RLS filtrar linhas, para qualquer role (padrão 1082).
    await q.query(`
      create function rejeitar_mutacao_restricoes_alimentares()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception '% em % rejeitado: restricoes alimentares preservam historico.', tg_op, tg_table_name
          using errcode = '42501';
      end;
      $$;
    `);

    // Invariantes de transição que o banco também garante (defesa em profundidade; o domínio continua decidindo).
    await q.query(`
      create function validar_atualizacao_restricao_paciente()
      returns trigger
      language plpgsql
      as $$
      begin
        if (new.id, new.tenant_id, new.paciente_id, new.autor_usuario_id, new.chave_criacao, new.origem, new.criado_em)
           is distinct from (old.id, old.tenant_id, old.paciente_id, old.autor_usuario_id, old.chave_criacao, old.origem, old.criado_em) then
          raise exception 'Identidade da restricao e imutavel.' using errcode = '23514';
        end if;
        if new.revisao <> old.revisao + 1 then
          raise exception 'Revisao da restricao deve avancar uma unidade.' using errcode = '23514';
        end if;
        if old.estado = 'inativa' then
          raise exception 'Restricao inativa e terminal; recorrencia cria um registro novo.' using errcode = '23514';
        end if;
        -- Contrato v2 §4.3: só pendente → confirmada ou rejeitada. A decisão, quem decidiu e quando são imutáveis
        -- (revisão R4 da #531): não volta a pendente, não troca confirmada ↔ rejeitada nem reescreve a autoria.
        if old.confirmacao <> 'pendente' and (new.confirmacao, new.confirmado_por_usuario_id, new.confirmado_em)
           is distinct from (old.confirmacao, old.confirmado_por_usuario_id, old.confirmado_em) then
          raise exception 'Decisao de confirmacao e imutavel.' using errcode = '23514';
        end if;
        return new;
      end;
      $$;
      create function validar_atualizacao_avaliacao_restricoes()
      returns trigger
      language plpgsql
      as $$
      begin
        if (new.id, new.tenant_id, new.paciente_id, new.criado_em) is distinct from (old.id, old.tenant_id, old.paciente_id, old.criado_em) then
          raise exception 'Identidade da avaliacao e imutavel.' using errcode = '23514';
        end if;
        if new.revisao <> old.revisao + 1 then
          raise exception 'Revisao da avaliacao deve avancar uma unidade.' using errcode = '23514';
        end if;
        return new;
      end;
      $$;
      create function validar_atualizacao_solicitacao_restricao()
      returns trigger
      language plpgsql
      as $$
      begin
        if (new.id, new.tenant_id, new.paciente_id, new.restricao_id, new.tipo, new.autor_usuario_id, new.chave_criacao, new.conteudo_criptografado, new.criado_em)
           is distinct from (old.id, old.tenant_id, old.paciente_id, old.restricao_id, old.tipo, old.autor_usuario_id, old.chave_criacao, old.conteudo_criptografado, old.criado_em) then
          raise exception 'Pedido do paciente e imutavel.' using errcode = '23514';
        end if;
        if new.revisao <> old.revisao + 1 then
          raise exception 'Revisao da solicitacao deve avancar uma unidade.' using errcode = '23514';
        end if;
        if old.estado in ('atendida', 'parcial', 'recusada', 'cancelada_pelo_paciente') then
          raise exception 'Solicitacao encerrada e terminal.' using errcode = '23514';
        end if;
        if new.estado <> old.estado and (old.estado, new.estado) not in (
          ('criada', 'em_analise'), ('criada', 'cancelada_pelo_paciente'),
          ('em_analise', 'atendida'), ('em_analise', 'parcial'), ('em_analise', 'recusada'),
          ('em_analise', 'cancelada_pelo_paciente')) then
          raise exception 'Transicao de solicitacao invalida.' using errcode = '23514';
        end if;
        return new;
      end;
      $$;
    `);

    for (const t of APPEND_ONLY) {
      await q.query(`
        create trigger trg_${t}_append_only
          before update or delete or truncate on ${t}
          for each statement execute function rejeitar_mutacao_restricoes_alimentares();
        alter table ${t} enable always trigger trg_${t}_append_only;
        revoke update, delete, truncate on ${t} from public;
      `);
    }
    for (const t of MUTAVEIS) {
      await q.query(`
        create trigger trg_${t}_sem_exclusao
          before delete or truncate on ${t}
          for each statement execute function rejeitar_mutacao_restricoes_alimentares();
        alter table ${t} enable always trigger trg_${t}_sem_exclusao;
        revoke delete, truncate on ${t} from public;
      `);
    }
    await q.query(`
      create trigger trg_restricoes_pacientes_transicao before update on restricoes_pacientes
        for each row execute function validar_atualizacao_restricao_paciente();
      alter table restricoes_pacientes enable always trigger trg_restricoes_pacientes_transicao;
      create trigger trg_avaliacoes_restricoes_transicao before update on avaliacoes_restricoes_pacientes
        for each row execute function validar_atualizacao_avaliacao_restricoes();
      alter table avaliacoes_restricoes_pacientes enable always trigger trg_avaliacoes_restricoes_transicao;
      create trigger trg_solicitacoes_restricoes_transicao before update on solicitacoes_restricoes_pacientes
        for each row execute function validar_atualizacao_solicitacao_restricao();
      alter table solicitacoes_restricoes_pacientes enable always trigger trg_solicitacoes_restricoes_transicao;
    `);

    for (const t of TABELAS_RESTRICOES_ALIMENTARES) {
      await q.query(`
        alter table ${t} enable row level security;
        alter table ${t} force row level security;
        create policy ${t}_leitura on ${t} for select
          using (${TENANT});
        create policy ${t}_criacao on ${t} for insert
          with check (${TENANT});
      `);
    }
    for (const t of MUTAVEIS) {
      await q.query(`
        create policy ${t}_atualizacao on ${t} for update
          using (${TENANT})
          with check (${TENANT});
      `);
    }

    // Defesa em profundidade, só onde a role conhecida existe (padrão 1030/1038/1082). A trigger é o que protege.
    await q.query(`
      do $$
      declare
        papel text;
      begin
        foreach papel in array ${ROLES_CONHECIDAS} loop
          if exists (select 1 from pg_roles where rolname = papel) then
            execute format('revoke update, delete, truncate on ${APPEND_ONLY.join(', ')} from %I', papel);
            execute format('revoke delete, truncate on ${MUTAVEIS.join(', ')} from %I', papel);
          end if;
        end loop;
      end;
      $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Só reverte antes de haver dado (contrato v2 §6, PR C). Com qualquer linha, recusa e não toca em nada.
    // Sob FORCE RLS um owner comum veria zero linhas: `row_security = off` faz a consulta falhar em vez de mentir.
    await q.query('set local row_security = off');
    // Fora de transação o `set local` não tem efeito: um owner sem BYPASSRLS contaria zero linhas sob FORCE.
    const rs: Array<{ rs: string }> = await q.query("select current_setting('row_security') as rs");
    if (rs[0]?.rs !== 'off') throw new Error('Rollback recusado: execute o down dentro de transacao (row_security nao ficou off).');
    const linhas: Array<{ existe: boolean }> = await q.query(
      `select ${TABELAS_RESTRICOES_ALIMENTARES.map(t => `exists(select 1 from ${t})`).join(' or ')} as existe`
    );
    if (linhas[0]?.existe !== false) throw new Error('Rollback recusado: restricoes alimentares persistidas ou estado nao verificavel.');
    await q.query(`
      drop table mapeamentos_alimento_alvo_locais;
      drop table solicitacoes_restricoes_pacientes;
      drop table reconfirmacoes_restricoes;
      drop table avaliacoes_restricoes_revisoes;
      drop table avaliacoes_restricoes_pacientes;
      drop table restricoes_pacientes_revisoes;
      drop table restricoes_pacientes;
      drop function validar_atualizacao_solicitacao_restricao();
      drop function validar_atualizacao_avaliacao_restricoes();
      drop function validar_atualizacao_restricao_paciente();
      drop function rejeitar_mutacao_restricoes_alimentares();
    `);
  }
}
