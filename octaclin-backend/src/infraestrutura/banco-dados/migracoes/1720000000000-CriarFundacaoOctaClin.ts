import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda */
export class CriarFundacaoOctaClin1720000000000 implements MigrationInterface {
  name = 'CriarFundacaoOctaClin1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create extension if not exists "uuid-ossp"`);
    await queryRunner.query(`create extension if not exists "pgcrypto"`);
    await queryRunner.query(`create extension if not exists vector`);
    await queryRunner.query(`create extension if not exists timescaledb`);

    await queryRunner.query(`
      create table if not exists tenants (
        id uuid primary key default gen_random_uuid(),
        nome varchar(160) not null,
        slug varchar(80) not null unique,
        status varchar(32) not null default 'ativo',
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create table if not exists tenant_configuracoes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        chave varchar(120) not null,
        valor jsonb not null default '{}'::jsonb,
        criado_em timestamptz not null default now(),
        unique (tenant_id, chave)
      );

      create table if not exists usuarios (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        email_hash varchar(128) not null,
        email_criptografado bytea not null,
        senha_hash varchar(255) not null,
        role varchar(32) not null check (role in ('SuperAdmin', 'Professional', 'Collaborator', 'Patient')),
        ativo boolean not null default true,
        ultimo_login_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        unique (tenant_id, email_hash)
      );

      create table if not exists refresh_tokens (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null references usuarios(id),
        token_hash varchar(255) not null unique,
        familia_token varchar(80) not null,
        revogado_em timestamptz,
        expira_em timestamptz not null,
        criado_em timestamptz not null default now()
      );

      create table if not exists consentimentos_lgpd (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null references usuarios(id),
        tipo varchar(80) not null,
        versao varchar(40) not null,
        aceito_em timestamptz not null default now(),
        ip inet,
        metadados jsonb not null default '{}'::jsonb
      );

      create table if not exists profissionais (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null references usuarios(id),
        nome_criptografado bytea not null,
        registro_profissional varchar(80),
        especialidade varchar(120),
        arquivado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        unique (tenant_id, usuario_id)
      );

      create table if not exists colaboradores (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid not null references usuarios(id),
        profissional_id uuid references profissionais(id),
        permissoes jsonb not null default '[]'::jsonb,
        criado_em timestamptz not null default now()
      );

      create table if not exists pacientes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid references usuarios(id),
        profissional_responsavel_id uuid not null references profissionais(id),
        nome_criptografado bytea not null,
        contato_criptografado bytea,
        data_nascimento date,
        status_adesao varchar(40) not null default 'novo',
        score_risco numeric(5,2) not null default 0,
        ultimo_checkin_em timestamptz,
        arquivado_em timestamptz,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create table if not exists acompanhantes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        nome_criptografado bytea not null,
        contato_criptografado bytea,
        pin_hash varchar(255) not null,
        ativo boolean not null default true,
        criado_em timestamptz not null default now()
      );

      create table if not exists categorias_pergunta (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        nome varchar(120) not null,
        icone_svg text not null,
        cor_hex varchar(7) not null,
        ordem integer not null default 0
      );

      create table if not exists questionarios (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        titulo varchar(180) not null,
        descricao text,
        status varchar(32) not null default 'rascunho',
        versao integer not null default 1,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now()
      );

      create table if not exists perguntas (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        questionario_id uuid not null references questionarios(id) on delete cascade,
        categoria_id uuid not null references categorias_pergunta(id),
        tipo varchar(40) not null check (tipo in ('likert', 'multipla_escolha', 'linear', 'metrica', 'upload_midia', 'texto_longo', 'sim_nao')),
        enunciado text not null,
        peso numeric(6,2) not null default 1,
        obrigatoria boolean not null default true,
        configuracao jsonb not null default '{}'::jsonb,
        ordem integer not null default 0
      );

      create table if not exists opcoes_pergunta (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        pergunta_id uuid not null references perguntas(id) on delete cascade,
        rotulo varchar(180) not null,
        valor varchar(120) not null,
        imagem_url text,
        ordem integer not null default 0
      );

      create table if not exists agendamentos_questionario (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        questionario_id uuid not null references questionarios(id),
        regra_cron varchar(120),
        data_fixa timestamptz,
        timezone varchar(80) not null default 'America/Sao_Paulo',
        ativo boolean not null default true,
        ultima_execucao_em timestamptz,
        proxima_execucao_em timestamptz,
        criado_em timestamptz not null default now()
      );

      create table if not exists envios_questionario (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        questionario_id uuid not null references questionarios(id),
        paciente_id uuid not null references pacientes(id),
        agendamento_id uuid references agendamentos_questionario(id),
        status varchar(40) not null default 'pendente',
        enviado_em timestamptz,
        respondido_em timestamptz,
        expira_em timestamptz
      );

      create table if not exists respostas_checkin (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        envio_questionario_id uuid not null references envios_questionario(id),
        score_final numeric(8,2),
        finalizado_em timestamptz,
        criado_em timestamptz not null default now()
      );

      create table if not exists resposta_valores (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        resposta_checkin_id uuid not null references respostas_checkin(id) on delete cascade,
        pergunta_id uuid not null references perguntas(id),
        valor jsonb not null,
        score_ponderado numeric(8,2)
      );

      create table if not exists arquivos_midia (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        tipo varchar(40) not null check (tipo in ('imagem', 'audio', 'video', 'documento')),
        bucket varchar(120) not null,
        chave_objeto text not null,
        mime_type varchar(120) not null,
        tamanho_bytes bigint not null,
        hash_conteudo varchar(128),
        metadados jsonb not null default '{}'::jsonb,
        criado_em timestamptz not null default now()
      );

      create table if not exists transcricoes_midia (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        arquivo_midia_id uuid not null references arquivos_midia(id),
        provedor varchar(80) not null,
        texto text not null,
        confianca numeric(5,2),
        criado_em timestamptz not null default now()
      );

      create table if not exists canais_notificacao (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        tipo varchar(40) not null check (tipo in ('whatsapp', 'email', 'push')),
        nome varchar(120) not null,
        configuracao jsonb not null,
        ativo boolean not null default true
      );

      create table if not exists templates_mensagem (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        canal varchar(40) not null,
        codigo_externo varchar(160),
        nome varchar(160) not null,
        conteudo jsonb not null,
        aprovado boolean not null default false
      );

      create table if not exists mensagens_notificacao (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid references pacientes(id),
        canal_id uuid references canais_notificacao(id),
        template_id uuid references templates_mensagem(id),
        status varchar(40) not null default 'pendente',
        payload jsonb not null default '{}'::jsonb,
        erro text,
        enviado_em timestamptz,
        criado_em timestamptz not null default now()
      );

      create table if not exists regras_automacao (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        nome varchar(160) not null,
        gatilho jsonb not null,
        condicoes jsonb not null default '[]'::jsonb,
        acoes jsonb not null default '[]'::jsonb,
        ativa boolean not null default true,
        criado_em timestamptz not null default now()
      );

      create table if not exists execucoes_regra (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        regra_id uuid not null references regras_automacao(id),
        paciente_id uuid references pacientes(id),
        status varchar(40) not null default 'pendente',
        resultado jsonb not null default '{}'::jsonb,
        erro text,
        criado_em timestamptz not null default now()
      );

      create table if not exists ai_sentiment_analysis (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        resposta_checkin_id uuid references respostas_checkin(id),
        transcricao_midia_id uuid references transcricoes_midia(id),
        modelo varchar(120) not null,
        ansiedade_score numeric(5,2) not null,
        frustracao_score numeric(5,2) not null,
        motivacao_score numeric(5,2) not null,
        confusao_score numeric(5,2) not null,
        embedding vector(1536),
        explicacao jsonb not null default '{}'::jsonb,
        alerta_disparado boolean not null default false,
        criado_em timestamptz not null default now()
      );

      create table if not exists food_recognition_cache (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        arquivo_midia_id uuid not null references arquivos_midia(id),
        provedor varchar(80) not null,
        imagem_hash varchar(128) not null,
        alimentos_detectados jsonb not null default '[]'::jsonb,
        peso_estimado_gramas numeric(8,2),
        calorias_estimadas numeric(8,2),
        confianca_media numeric(5,2),
        criado_em timestamptz not null default now(),
        unique (tenant_id, provedor, imagem_hash)
      );

      create table if not exists circulos_pacientes (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        nome varchar(160) not null,
        objetivo varchar(160) not null,
        privado boolean not null default true,
        criado_em timestamptz not null default now()
      );

      create table if not exists membros_circulo (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        circulo_id uuid not null references circulos_pacientes(id),
        paciente_id uuid not null references pacientes(id),
        entrou_em timestamptz not null default now(),
        unique (tenant_id, circulo_id, paciente_id)
      );

      create table if not exists posts_comunidade (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        circulo_id uuid not null references circulos_pacientes(id),
        paciente_id uuid not null references pacientes(id),
        conteudo text not null,
        status varchar(40) not null default 'publicado',
        criado_em timestamptz not null default now()
      );

      create table if not exists moderacoes_post (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        post_id uuid not null references posts_comunidade(id),
        status varchar(40) not null,
        pontuacao_risco numeric(5,2),
        motivos jsonb not null default '[]'::jsonb,
        revisado_por_usuario_id uuid references usuarios(id),
        criado_em timestamptz not null default now()
      );

      create table if not exists desafios (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        titulo varchar(160) not null,
        descricao text,
        regra_pontuacao jsonb not null,
        inicia_em timestamptz not null,
        termina_em timestamptz not null,
        criado_em timestamptz not null default now()
      );

      create table if not exists participacoes_desafio (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        desafio_id uuid not null references desafios(id),
        paciente_id uuid not null references pacientes(id),
        pontos numeric(10,2) not null default 0,
        progresso jsonb not null default '{}'::jsonb,
        unique (tenant_id, desafio_id, paciente_id)
      );

      create table if not exists badges (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        nome varchar(120) not null,
        descricao text,
        icone_svg text not null,
        regra_conquista jsonb not null
      );

      create table if not exists paciente_badges (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        badge_id uuid not null references badges(id),
        conquistado_em timestamptz not null default now(),
        unique (tenant_id, paciente_id, badge_id)
      );

      create table if not exists protocolos (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        nome varchar(160) not null,
        descricao text,
        criado_em timestamptz not null default now()
      );

      create table if not exists protocolo_itens (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        protocolo_id uuid not null references protocolos(id),
        tipo varchar(40) not null,
        referencia_id uuid,
        configuracao jsonb not null default '{}'::jsonb,
        ordem integer not null default 0
      );

      create table if not exists eventos_timeline (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        tipo varchar(60) not null,
        titulo varchar(180) not null,
        conteudo jsonb not null default '{}'::jsonb,
        referencia_tipo varchar(80),
        referencia_id uuid,
        criado_por_usuario_id uuid references usuarios(id),
        criado_em timestamptz not null default now()
      );

      create table if not exists anotacoes_voz (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        profissional_id uuid not null references profissionais(id),
        paciente_id uuid not null references pacientes(id),
        arquivo_midia_id uuid references arquivos_midia(id),
        texto_transcrito text,
        criado_em timestamptz not null default now()
      );

      create table if not exists logs_diario_rapido (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        tipo varchar(40) not null,
        valor jsonb not null,
        registrado_em timestamptz not null default now()
      );

      create table if not exists sincronizacoes_mobile (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        id_local varchar(160) not null,
        tipo varchar(80) not null,
        status varchar(40) not null,
        recurso_tipo varchar(80),
        recurso_id uuid,
        erro text,
        criado_em timestamptz not null default now(),
        unique (tenant_id, id_local)
      );

      create table if not exists metricas_temporais (
        tenant_id uuid not null references tenants(id),
        paciente_id uuid not null references pacientes(id),
        tipo varchar(60) not null,
        valor numeric(12,4) not null,
        unidade varchar(40),
        metadados jsonb not null default '{}'::jsonb,
        registrado_em timestamptz not null default now(),
        primary key (tenant_id, paciente_id, tipo, registrado_em)
      );

      create table if not exists user_action_logs (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        usuario_id uuid references usuarios(id),
        acao varchar(120) not null,
        recurso_tipo varchar(120),
        recurso_id uuid,
        ip inet,
        user_agent text,
        metadados jsonb not null default '{}'::jsonb,
        criado_em timestamptz not null default now()
      );

      create table if not exists outbox_eventos (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references tenants(id),
        tipo varchar(120) not null,
        payload jsonb not null,
        status varchar(40) not null default 'pendente',
        tentativas integer not null default 0,
        erro text,
        processado_em timestamptz,
        criado_em timestamptz not null default now()
      );
    `);

    await queryRunner.query(`select create_hypertable('metricas_temporais', 'registrado_em', if_not_exists => true)`);

    await queryRunner.query(`
      create index if not exists idx_usuarios_tenant_role on usuarios (tenant_id, role);
      create index if not exists idx_pacientes_tenant_profissional on pacientes (tenant_id, profissional_responsavel_id);
      create index if not exists idx_envios_tenant_paciente_status on envios_questionario (tenant_id, paciente_id, status);
      create index if not exists idx_respostas_tenant_paciente on respostas_checkin (tenant_id, paciente_id, criado_em desc);
      create index if not exists idx_sentimento_tenant_paciente on ai_sentiment_analysis (tenant_id, paciente_id, criado_em desc);
      create index if not exists idx_food_hash on food_recognition_cache (tenant_id, provedor, imagem_hash);
      create index if not exists idx_timeline_tenant_paciente on eventos_timeline (tenant_id, paciente_id, criado_em desc);
      create index if not exists idx_logs_tenant_criado on user_action_logs (tenant_id, criado_em desc);
      create index if not exists idx_outbox_tenant_status on outbox_eventos (tenant_id, status, criado_em);
      create index if not exists idx_sync_mobile_tenant_status on sincronizacoes_mobile (tenant_id, status, criado_em);
    `);

    const tabelasComTenant = [
      'tenant_configuracoes',
      'usuarios',
      'refresh_tokens',
      'consentimentos_lgpd',
      'profissionais',
      'colaboradores',
      'pacientes',
      'acompanhantes',
      'categorias_pergunta',
      'questionarios',
      'perguntas',
      'opcoes_pergunta',
      'agendamentos_questionario',
      'envios_questionario',
      'respostas_checkin',
      'resposta_valores',
      'arquivos_midia',
      'transcricoes_midia',
      'canais_notificacao',
      'templates_mensagem',
      'mensagens_notificacao',
      'regras_automacao',
      'execucoes_regra',
      'ai_sentiment_analysis',
      'food_recognition_cache',
      'circulos_pacientes',
      'membros_circulo',
      'posts_comunidade',
      'moderacoes_post',
      'desafios',
      'participacoes_desafio',
      'badges',
      'paciente_badges',
      'protocolos',
      'protocolo_itens',
      'eventos_timeline',
      'anotacoes_voz',
      'logs_diario_rapido',
      'sincronizacoes_mobile',
      'metricas_temporais',
      'user_action_logs',
      'outbox_eventos'
    ];

    for (const tabela of tabelasComTenant) {
      await queryRunner.query(`alter table ${tabela} enable row level security`);
      await queryRunner.query(`alter table ${tabela} force row level security`);
      await queryRunner.query(`
        drop policy if exists isolamento_tenant_${tabela} on ${tabela};
        create policy isolamento_tenant_${tabela}
          on ${tabela}
          using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
          with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop table if exists user_action_logs cascade;
      drop table if exists outbox_eventos cascade;
      drop table if exists metricas_temporais cascade;
      drop table if exists logs_diario_rapido cascade;
      drop table if exists sincronizacoes_mobile cascade;
      drop table if exists anotacoes_voz cascade;
      drop table if exists eventos_timeline cascade;
      drop table if exists protocolo_itens cascade;
      drop table if exists protocolos cascade;
      drop table if exists paciente_badges cascade;
      drop table if exists badges cascade;
      drop table if exists participacoes_desafio cascade;
      drop table if exists desafios cascade;
      drop table if exists moderacoes_post cascade;
      drop table if exists posts_comunidade cascade;
      drop table if exists membros_circulo cascade;
      drop table if exists circulos_pacientes cascade;
      drop table if exists food_recognition_cache cascade;
      drop table if exists ai_sentiment_analysis cascade;
      drop table if exists execucoes_regra cascade;
      drop table if exists regras_automacao cascade;
      drop table if exists mensagens_notificacao cascade;
      drop table if exists templates_mensagem cascade;
      drop table if exists canais_notificacao cascade;
      drop table if exists transcricoes_midia cascade;
      drop table if exists arquivos_midia cascade;
      drop table if exists resposta_valores cascade;
      drop table if exists respostas_checkin cascade;
      drop table if exists envios_questionario cascade;
      drop table if exists agendamentos_questionario cascade;
      drop table if exists opcoes_pergunta cascade;
      drop table if exists perguntas cascade;
      drop table if exists questionarios cascade;
      drop table if exists categorias_pergunta cascade;
      drop table if exists acompanhantes cascade;
      drop table if exists pacientes cascade;
      drop table if exists colaboradores cascade;
      drop table if exists profissionais cascade;
      drop table if exists consentimentos_lgpd cascade;
      drop table if exists refresh_tokens cascade;
      drop table if exists usuarios cascade;
      drop table if exists tenant_configuracoes cascade;
      drop table if exists tenants cascade;
    `);
  }
}
