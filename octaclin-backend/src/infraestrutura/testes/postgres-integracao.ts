import { DataSource } from 'typeorm';
import { ReconhecimentoAlimentarOrm } from '../../modulos/ia/infraestrutura/reconhecimento-alimentar.orm';
import { ArquivoMidiaOrm } from '../../modulos/mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../../modulos/pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../modulos/profissionais/infraestrutura/profissional.orm';

const NOME_BANCO_INTEGRACAO = /^octaclin_test_[a-z0-9_]+$/;

/**
 * A suite de integracao apaga o schema antes de criar as tabelas de teste.
 * Ela so pode ser habilitada em uma base explicitamente reservada para isso.
 */
export function obterUrlPostgresIntegracao(): string | undefined {
  const url = process.env.OCTACLIN_POSTGRES_INTEGRACAO_URL;
  if (!url || process.env.OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR !== 'APAGAR') return undefined;

  validarUrlPostgresIntegracao(url);

  return url;
}

export function criarFonteDadosPostgresIntegracao(url: string): DataSource {
  validarUrlPostgresIntegracao(url);

  return new DataSource({
    type: 'postgres',
    url,
    entities: [ProfissionalOrm, PacienteOrm, ArquivoMidiaOrm, ReconhecimentoAlimentarOrm],
    logging: false
  });
}

export async function prepararSchemaPostgresIntegracao(fonteDados: DataSource): Promise<void> {
  await fonteDados.dropDatabase();
  await fonteDados.query(`
    create extension if not exists "uuid-ossp";
    create table profissionais (
      id uuid primary key default uuid_generate_v4(),
      tenant_id uuid not null,
      usuario_id uuid not null,
      nome_criptografado bytea not null,
      registro_profissional varchar(80),
      especialidade varchar(120),
      arquivado_em timestamptz,
      criado_em timestamptz not null default now(),
      atualizado_em timestamptz not null default now()
    );
    create table pacientes (
      id uuid primary key default uuid_generate_v4(),
      tenant_id uuid not null,
      usuario_id uuid,
      profissional_responsavel_id uuid not null,
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
    create table arquivos_midia (
      id uuid primary key default uuid_generate_v4(),
      tenant_id uuid not null,
      paciente_id uuid not null,
      tipo varchar(40) not null,
      bucket varchar(120) not null,
      chave_objeto text not null,
      mime_type varchar(120) not null,
      tamanho_bytes bigint not null,
      hash_conteudo varchar(128),
      metadados jsonb not null default '{}'::jsonb,
      criado_em timestamptz not null default now()
    );
    create table food_recognition_cache (
      id uuid primary key default uuid_generate_v4(),
      tenant_id uuid not null,
      paciente_id uuid not null,
      arquivo_midia_id uuid not null,
      provedor varchar(80) not null,
      imagem_hash varchar(128) not null,
      alimentos_detectados jsonb not null default '[]'::jsonb,
      peso_estimado_gramas numeric(8,2),
      calorias_estimadas numeric(8,2),
      confianca_media numeric(5,2),
      criado_em timestamptz not null default now(),
      unique (tenant_id, provedor, imagem_hash)
    );
  `);
}

function validarUrlPostgresIntegracao(url: string): void {
  const banco = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!NOME_BANCO_INTEGRACAO.test(banco)) {
    throw new Error('O banco de integracao deve iniciar com octaclin_test_.');
  }
}
