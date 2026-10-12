import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda. Aditiva; nunca habilita flags ou publica legado. */
export class PilotoGamificacao1720000001070 implements MigrationInterface {
  name = 'PilotoGamificacao1720000001070';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      alter table circulos_pacientes add column modelo_versao integer not null default 1,
        add column estado_piloto varchar(24) not null default 'ativo',
        add column versao_piloto integer not null default 1,
        add column snapshot_criptografado bytea, add column eliminar_em timestamptz;
      alter table membros_circulo add column estado_piloto varchar(24) not null default 'legado',
        add column geracao integer not null default 1, add column versao_piloto integer not null default 1,
        add column convite_expira_em timestamptz, add column autor_convite_usuario_id uuid references usuarios(id),
        add column usuario_aceite_id uuid references usuarios(id), add column termo_versao varchar(80),
        add column aceito_em timestamptz, add column revogado_em timestamptz,
        add column nome_criptografado bytea, add column eliminar_em timestamptz;
      alter table posts_comunidade add column modelo_versao integer not null default 1,
        add column versao_piloto integer not null default 1, add column geracao_membro integer,
        add column autor_usuario_id uuid references usuarios(id), add column conteudo_criptografado bytea,
        add column retirado_em timestamptz, add column eliminar_em timestamptz;
      alter table paciente_badges add column modelo_versao integer not null default 1,
        add column versao_piloto integer not null default 1,
        add column autor_usuario_id uuid references usuarios(id), add column profissional_id uuid references profissionais(id),
        add column snapshot_criptografado bytea, add column compartilhado boolean not null default false,
        add column geracao_compartilhamento integer not null default 0,
        add column profissional_compartilhamento_id uuid references profissionais(id);
      alter table circulos_pacientes add constraint uq_circulo317 unique(tenant_id,id);
      alter table membros_circulo add constraint uq_membro317 unique(tenant_id,circulo_id,paciente_id),
        add constraint uq_membro317_id unique(tenant_id,id);
      alter table posts_comunidade add constraint uq_post317 unique(tenant_id,circulo_id,id);
      alter table paciente_badges add constraint uq_conquista317 unique(tenant_id,paciente_id,id);
      create unique index if not exists uq_profissional317 on profissionais(tenant_id,id);
      create unique index if not exists uq_paciente317 on pacientes(tenant_id,id);
      create unique index if not exists uq_usuario317 on usuarios(tenant_id,id);
      -- New writes are checked. Historic rows are not silently rewritten/validated.
      alter table circulos_pacientes add constraint fk_circulo317_profissional foreign key(tenant_id,profissional_id) references profissionais(tenant_id,id) not valid;
      alter table membros_circulo add constraint fk_membro317_circulo foreign key(tenant_id,circulo_id) references circulos_pacientes(tenant_id,id) not valid,
        add constraint fk_membro317_paciente foreign key(tenant_id,paciente_id) references pacientes(tenant_id,id) not valid;
      alter table posts_comunidade add constraint fk_post317_circulo foreign key(tenant_id,circulo_id) references circulos_pacientes(tenant_id,id) not valid,
        add constraint fk_post317_paciente foreign key(tenant_id,paciente_id) references pacientes(tenant_id,id) not valid;
      alter table paciente_badges add constraint fk_conquista317_paciente foreign key(tenant_id,paciente_id) references pacientes(tenant_id,id) not valid;
      alter table circulos_pacientes add constraint ck_circulo317 check(modelo_versao in (1,317) and versao_piloto>=1 and estado_piloto in ('ativo','encerrado') and (modelo_versao=1 or (privado=true and (snapshot_criptografado is not null or estado_piloto='encerrado'))));
      alter table posts_comunidade add constraint ck_post317 check(modelo_versao in (1,317) and versao_piloto>=1 and (modelo_versao=1 or (autor_usuario_id is not null and geracao_membro is not null and geracao_membro>=1 and status in ('publicado','oculto','retirado','excluido') and (conteudo_criptografado is not null or status<>'publicado')))),
        add constraint fk_post317_autor foreign key(tenant_id,autor_usuario_id) references usuarios(tenant_id,id) not valid;
      alter table paciente_badges add constraint ck_conquista317 check(modelo_versao in (1,317) and versao_piloto>=1 and geracao_compartilhamento>=0 and (modelo_versao=1 or (snapshot_criptografado is not null and autor_usuario_id is not null and profissional_id is not null))),
        add constraint fk_conquista317_profissional foreign key(tenant_id,profissional_id) references profissionais(tenant_id,id) not valid,
        add constraint fk_conquista317_compartilhamento foreign key(tenant_id,profissional_compartilhamento_id) references profissionais(tenant_id,id) not valid,
        add constraint fk_conquista317_autor foreign key(tenant_id,autor_usuario_id) references usuarios(tenant_id,id) not valid;
      alter table membros_circulo add constraint fk_membro317_aceite foreign key(tenant_id,usuario_aceite_id) references usuarios(tenant_id,id) not valid,
        add constraint fk_membro317_convite foreign key(tenant_id,autor_convite_usuario_id) references usuarios(tenant_id,id) not valid,
        add constraint ck_membro317 check(geracao>=1 and versao_piloto>=1 and estado_piloto in ('legado','convidado','ativo','saiu','revogado') and (estado_piloto<>'ativo' or (nome_criptografado is not null and usuario_aceite_id is not null and termo_versao is not null and aceito_em is not null and revogado_em is null)));
      create table consentimentos_conquistas (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        paciente_id uuid not null, conquista_id uuid not null, usuario_id uuid not null,
        geracao integer not null check(geracao>=1), versao integer not null default 1 check(versao>=1), termo_versao varchar(80) not null,
        aceito_em timestamptz, revogado_em timestamptz,
        unique(tenant_id,paciente_id,conquista_id,usuario_id,geracao),
        foreign key(tenant_id,paciente_id,conquista_id) references paciente_badges(tenant_id,paciente_id,id),
        foreign key(tenant_id,usuario_id) references usuarios(tenant_id,id)
      );
      create table comentarios_comunidade (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        circulo_id uuid not null, post_id uuid not null, paciente_id uuid not null, autor_usuario_id uuid not null,
        geracao_membro integer not null check(geracao_membro>=1), versao integer not null default 1 check(versao>=1),
        estado varchar(24) not null default 'publicado' check(estado in ('publicado','oculto','retirado','excluido')), conteudo_criptografado bytea,
        criado_em timestamptz not null default now(), retirado_em timestamptz, eliminar_em timestamptz,
        unique(tenant_id,circulo_id,post_id,id),
        foreign key (tenant_id,circulo_id,post_id) references posts_comunidade(tenant_id,circulo_id,id),
        foreign key(tenant_id,circulo_id,paciente_id) references membros_circulo(tenant_id,circulo_id,paciente_id),
        foreign key(tenant_id,autor_usuario_id) references usuarios(tenant_id,id)
      );
      create table curtidas_comunidade (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        circulo_id uuid not null, post_id uuid not null, comentario_id uuid,
        paciente_id uuid not null, geracao_membro integer not null,
        criado_em timestamptz not null default now(),
        foreign key(tenant_id,circulo_id,post_id) references posts_comunidade(tenant_id,circulo_id,id),
        foreign key(tenant_id,circulo_id,post_id,comentario_id) references comentarios_comunidade(tenant_id,circulo_id,post_id,id),
        foreign key(tenant_id,circulo_id,paciente_id) references membros_circulo(tenant_id,circulo_id,paciente_id),
        unique nulls not distinct(tenant_id,circulo_id,post_id,comentario_id,paciente_id)
      );
      create table denuncias_comunidade (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        circulo_id uuid not null, post_id uuid not null, comentario_id uuid,
        paciente_id uuid not null, estado varchar(24) not null default 'aberta',
        versao integer not null default 1, evidencia_criptografada bytea, decisao_criptografada bytea,
        revisado_por_usuario_id uuid, criado_em timestamptz not null default now(),
        eliminar_em timestamptz not null default (now()+interval '90 days'),
        hold_ate timestamptz, hold_justificativa_criptografada bytea, hold_autor_usuario_id uuid,
        foreign key(tenant_id,circulo_id,post_id) references posts_comunidade(tenant_id,circulo_id,id),
        foreign key(tenant_id,circulo_id,post_id,comentario_id) references comentarios_comunidade(tenant_id,circulo_id,post_id,id),
        foreign key(tenant_id,circulo_id,paciente_id) references membros_circulo(tenant_id,circulo_id,paciente_id),
        foreign key(tenant_id,revisado_por_usuario_id) references usuarios(tenant_id,id),
        foreign key(tenant_id,hold_autor_usuario_id) references usuarios(tenant_id,id),
        check ((hold_ate is null and hold_justificativa_criptografada is null and hold_autor_usuario_id is null) or (hold_ate is not null and hold_justificativa_criptografada is not null and hold_autor_usuario_id is not null))
      );
      create table revisoes_publicacao (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        circulo_id uuid not null, post_id uuid not null, comentario_id uuid,
        versao integer not null, conteudo_criptografado bytea, criado_em timestamptz not null default now(),
        eliminar_em timestamptz,
        foreign key(tenant_id,circulo_id,post_id) references posts_comunidade(tenant_id,circulo_id,id),
        foreign key(tenant_id,circulo_id,post_id,comentario_id) references comentarios_comunidade(tenant_id,circulo_id,post_id,id),
        unique nulls not distinct(tenant_id,post_id,comentario_id,versao)
      );
      create table comandos_gamificacao (
        id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
        usuario_id uuid not null, chave uuid not null, acao varchar(80) not null,
        fingerprint_criptografado bytea, resultado_criptografado bytea, expirado_em timestamptz,
        criado_em timestamptz not null default now(),
        constraint ck_comando317_expiracao check((expirado_em is null and fingerprint_criptografado is not null and resultado_criptografado is not null) or (expirado_em is not null and fingerprint_criptografado is null and resultado_criptografado is null)),
        unique(tenant_id,usuario_id,chave), foreign key(tenant_id,usuario_id) references usuarios(tenant_id,id)
      );
      create index ix_comentarios317_feed on comentarios_comunidade(tenant_id,circulo_id,post_id,criado_em,id);
      create index ix_denuncias317_fila on denuncias_comunidade(tenant_id,circulo_id,estado,criado_em,id);
      create index ix_comandos317_quota on comandos_gamificacao(tenant_id,usuario_id,acao,criado_em);
      create index ix_posts317_feed on posts_comunidade(tenant_id,circulo_id,criado_em,id) where modelo_versao=317;
      create function proteger_revisao317() returns trigger language plpgsql as $$
      begin
        if tg_op='DELETE' then
          if old.eliminar_em is null or old.eliminar_em>now() then raise exception 'Revisao nao pode ser apagada antes do prazo de retencao.'; end if;
          return old;
        end if;
        if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id or new.circulo_id is distinct from old.circulo_id or new.post_id is distinct from old.post_id or new.comentario_id is distinct from old.comentario_id or new.versao is distinct from old.versao or new.criado_em is distinct from old.criado_em or (new.conteudo_criptografado is distinct from old.conteudo_criptografado and not (new.conteudo_criptografado is null and coalesce(old.eliminar_em<=now(),false))) then
          raise exception 'Revisao de publicacao imutavel; somente expurgo vencido.';
        end if;
        return new;
      end; $$;
      create trigger trg_revisao317_imutavel before update or delete on revisoes_publicacao for each row execute function proteger_revisao317();
      create function proteger_snapshot_conquista317() returns trigger language plpgsql as $$
      begin
        if old.modelo_versao=317 and (tg_op='DELETE' or new.id is distinct from old.id or new.modelo_versao is distinct from old.modelo_versao or new.conquistado_em is distinct from old.conquistado_em or new.snapshot_criptografado is distinct from old.snapshot_criptografado or new.paciente_id is distinct from old.paciente_id or new.profissional_id is distinct from old.profissional_id or new.autor_usuario_id is distinct from old.autor_usuario_id or new.badge_id is distinct from old.badge_id or new.tenant_id is distinct from old.tenant_id) then
          raise exception 'Snapshot da conquista exige procedimento de retencao autorizado.';
        end if;
        if tg_op='DELETE' then return old; end if; return new;
      end; $$;
      create trigger trg_conquista317_snapshot before update or delete on paciente_badges for each row execute function proteger_snapshot_conquista317();
    `);
    for (const table of ['consentimentos_conquistas','comentarios_comunidade','curtidas_comunidade','denuncias_comunidade','revisoes_publicacao','comandos_gamificacao']) {
      await q.query(`alter table ${table} enable row level security; alter table ${table} force row level security;
        create policy isolamento_tenant_${table} on ${table}
        using (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
        with check (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);`);
    }
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('set local row_security = off');
    const [r] = await q.query(`select (exists(select 1 from circulos_pacientes where modelo_versao=317) or exists(select 1 from paciente_badges where modelo_versao=317) or exists(select 1 from comandos_gamificacao)) as existe`);
    if (r?.existe) throw new Error('Rollback recusado: preservar historia e consentimentos da gamificacao.');
    // Never let TypeORM erase its ledger while the additive schema remains.
    throw new Error('Rollback funcional: desabilite o piloto; schema e registro da migration permanecem.');
  }
}
