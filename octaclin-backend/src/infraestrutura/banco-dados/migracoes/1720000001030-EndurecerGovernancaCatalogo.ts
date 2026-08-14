import { createHash } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { calcularHashLegadoTaco } from './1720000001029-AtivarLegadoTacoGovernado';

const CODIGO = 'taco_nepa_unicamp';
const VERSAO = 'taco-4a-cmvcol-taco3-v1';
const BASE = 'cmvcol_taco3';
const CHECKSUM = 'a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14';
const HASH_CONTEUDO = '82c22bc4c72720f9786478b5ba0c6947316b23c4cddfd365781ee2ffb7f481e7';
const TOTAL = 583;

interface FonteCanonica {
  id: string;
  checksum_arquivo: string;
  hash_conteudo: string;
}

interface AlimentoCanonico {
  id: string;
  importacao_id?: string | null;
  hash_registro?: string | null;
  codigo_origem: string;
  nome: string;
  energia_kcal?: string | null;
  proteinas_g?: string | null;
  carboidratos_g?: string | null;
  lipidios_g?: string | null;
  fibras_g?: string | null;
  sodio_mg?: string | null;
  micronutrientes?: Record<string, unknown> | null;
}

function valorCanonico(valor?: string | null): string | null {
  return valor === undefined || valor === null ? null : String(Number(valor));
}

export function calcularHashRegistroTaco(linha: AlimentoCanonico): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        codigoOrigem: linha.codigo_origem,
        nome: linha.nome,
        baseGramas: '100',
        energiaKcal: valorCanonico(linha.energia_kcal),
        proteinasG: valorCanonico(linha.proteinas_g),
        carboidratosG: valorCanonico(linha.carboidratos_g),
        lipidiosG: valorCanonico(linha.lipidios_g),
        fibrasG: valorCanonico(linha.fibras_g),
        sodioMg: valorCanonico(linha.sodio_mg),
        micronutrientes: { categoria: String(linha.micronutrientes?.categoria ?? '') }
      })
    )
    .digest('hex');
}

export class EndurecerGovernancaCatalogo1720000001030 implements MigrationInterface {
  name = 'EndurecerGovernancaCatalogo1720000001030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table tentativas_importacao_catalogo (
        id uuid primary key default gen_random_uuid(),
        catalogo_codigo varchar(80) not null,
        versao varchar(80) not null,
        base_codigo varchar(80) not null,
        checksum_arquivo char(64) not null,
        hash_conteudo char(64) not null,
        status varchar(20) not null,
        erro_sanitizado text,
        executor varchar(180) not null,
        iniciada_em timestamptz not null default now(),
        concluida_em timestamptz,
        constraint tentativas_importacao_catalogo_status_check
          check (status in ('em_execucao', 'concluida', 'falhou', 'ignorada')),
        constraint tentativas_importacao_catalogo_hashes_check
          check (checksum_arquivo ~ '^[0-9a-f]{64}$' and hash_conteudo ~ '^[0-9a-f]{64}$')
      );
      create index idx_tentativas_importacao_catalogo_data
        on tentativas_importacao_catalogo (catalogo_codigo, iniciada_em desc);
    `);

    const fontes = (await queryRunner.query(
      `select id, checksum_arquivo, hash_conteudo
         from fontes_composicao_alimentos
        where codigo = $1 and versao = $2 and base_codigo = $3 and situacao = 'ativa'`,
      [CODIGO, VERSAO, BASE]
    )) as FonteCanonica[];
    if (fontes.length > 1) throw new Error('Governanca TACO invalida: mais de uma fonte canonica ativa.');

    if (fontes.length === 1) {
      const fonte = fontes[0];
      if (fonte.checksum_arquivo !== CHECKSUM || fonte.hash_conteudo !== HASH_CONTEUDO) {
        throw new Error('Governanca TACO invalida: hashes da fonte canonica divergentes.');
      }
      const alimentos = (await queryRunner.query(
        `select id, importacao_id, hash_registro, codigo_origem, nome, energia_kcal,
                proteinas_g, carboidratos_g, lipidios_g, fibras_g, sodio_mg, micronutrientes
           from alimentos_composicao
          where fonte_id = $1`,
        [fonte.id]
      )) as AlimentoCanonico[];
      if (alimentos.length !== TOTAL || calcularHashLegadoTaco(alimentos) !== HASH_CONTEUDO) {
        throw new Error('Governanca TACO invalida: fonte canonica ativa sem os 583 alimentos conhecidos.');
      }

      let [importacao] = (await queryRunner.query(
        `select id
           from importacoes_catalogo_composicao
          where fonte_versao_id = $1 and checksum_arquivo = $2 and hash_conteudo = $3
            and status = 'concluida'`,
        [fonte.id, CHECKSUM, HASH_CONTEUDO]
      )) as Array<{ id: string }>;
      if (!importacao) {
        [importacao] = (await queryRunner.query(
          `insert into importacoes_catalogo_composicao (
             fonte_versao_id, checksum_arquivo, hash_conteudo, status,
             total_registros, manifesto, concluida_em, executor
           ) values ($1, $2, $3, 'concluida', $4,
             '{"origem":"backfill-governanca-fase-234","legado":true}'::jsonb,
             now(), 'migracao-fase-234-hardening')
           returning id`,
          [fonte.id, CHECKSUM, HASH_CONTEUDO, TOTAL]
        )) as Array<{ id: string }>;
      }

      const hashes = alimentos.map((alimento) => ({
        id: alimento.id,
        hash: calcularHashRegistroTaco(alimento)
      }));
      const precisaBackfill = alimentos.some(
        (alimento, indice) =>
          alimento.importacao_id !== importacao.id || alimento.hash_registro !== hashes[indice].hash
      );
      if (precisaBackfill) {
        await queryRunner.query('alter table alimentos_composicao disable trigger trg_proteger_alimento_fonte_versionada');
        await queryRunner.query(
          `update alimentos_composicao alimento
              set importacao_id = $1, hash_registro = dados.hash
             from jsonb_to_recordset($2::jsonb) as dados(id uuid, hash char(64))
            where alimento.id = dados.id and alimento.fonte_id = $3`,
          [importacao.id, JSON.stringify(hashes), fonte.id]
        );
        await queryRunner.query('alter table alimentos_composicao enable trigger trg_proteger_alimento_fonte_versionada');
      }

      await queryRunner.query(
        `insert into eventos_governanca_fontes (
           fonte_versao_id, situacao_anterior, situacao_nova, motivo, ator
         )
         select $1, 'em_validacao', 'ativa',
                'Fonte TACO canonica validada integralmente no hardening da Fase 234.',
                'migracao-fase-234-hardening'
          where not exists (
            select 1 from eventos_governanca_fontes
             where fonte_versao_id = $1 and situacao_nova = 'ativa'
          )`,
        [fonte.id]
      );
    }

    await queryRunner.query(`
      create or replace function proteger_alimento_fonte_versionada()
      returns trigger
      language plpgsql
      as $$
      declare
        estado_antigo varchar(20);
        estado_novo varchar(20);
      begin
        if tg_op in ('UPDATE', 'DELETE') then
          select situacao into estado_antigo
            from fontes_composicao_alimentos where id = old.fonte_id;
        end if;
        if tg_op in ('INSERT', 'UPDATE') then
          select situacao into estado_novo
            from fontes_composicao_alimentos where id = new.fonte_id;
          if new.importacao_id is not null and not exists (
            select 1 from importacoes_catalogo_composicao importacao
             where importacao.id = new.importacao_id
               and importacao.fonte_versao_id = new.fonte_id
          ) then
            raise exception 'Importacao do alimento nao pertence a fonte versionada.';
          end if;
        end if;
        if tg_op = 'INSERT' and estado_novo <> 'em_validacao' then
          raise exception 'Alimentos so podem ser carregados em fonte em validacao.';
        end if;
        if tg_op in ('UPDATE', 'DELETE') and estado_antigo in ('ativa', 'suspensa', 'revogada') then
          raise exception 'Alimento de fonte versionada ativa, suspensa ou revogada e imutavel.';
        end if;
        if tg_op = 'UPDATE' and estado_novo in ('ativa', 'suspensa', 'revogada') then
          raise exception 'Alimento nao pode ser transferido para fonte ativa, suspensa ou revogada.';
        end if;
        if tg_op = 'DELETE' then return old; end if;
        return new;
      end;
      $$;

      create function validar_ativacao_fonte_catalogo()
      returns trigger
      language plpgsql
      as $$
      declare
        importacao uuid;
        total_declarado integer;
        total_alimentos integer;
      begin
        if new.situacao = 'ativa' and (tg_op = 'INSERT' or old.situacao <> 'ativa') then
          select id, total_registros into importacao, total_declarado
            from importacoes_catalogo_composicao
           where fonte_versao_id = new.id
             and checksum_arquivo = new.checksum_arquivo
             and hash_conteudo = new.hash_conteudo
             and status = 'concluida';
          if importacao is null then
            raise exception 'Ativacao exige importacao concluida com os hashes da fonte.';
          end if;
          select count(*) into total_alimentos
            from alimentos_composicao where fonte_id = new.id;
          if total_alimentos = 0 or total_declarado is distinct from total_alimentos then
            raise exception 'Ativacao exige total de alimentos consistente com a importacao.';
          end if;
          if exists (
            select 1 from alimentos_composicao
             where fonte_id = new.id
               and (importacao_id is distinct from importacao or hash_registro is null)
          ) then
            raise exception 'Ativacao exige proveniencia em todos os alimentos.';
          end if;
        end if;
        return new;
      end;
      $$;

      create constraint trigger trg_validar_ativacao_fonte_catalogo
        after insert or update on fontes_composicao_alimentos
        deferrable initially immediate
        for each row execute function validar_ativacao_fonte_catalogo();

      do $$
      declare
        papel text;
      begin
        foreach papel in array array['octaclin_runtime_integracao', 'octaclin_app_producao'] loop
          if exists (select 1 from pg_roles where rolname = papel) then
            execute format(
              'grant select on catalogos_composicao_alimentos, fontes_composicao_alimentos, alimentos_composicao, importacoes_catalogo_composicao, eventos_governanca_fontes, tentativas_importacao_catalogo to %I',
              papel
            );
            execute format(
              'revoke insert, update, delete, truncate on catalogos_composicao_alimentos, fontes_composicao_alimentos, alimentos_composicao, importacoes_catalogo_composicao, eventos_governanca_fontes, tentativas_importacao_catalogo from %I',
              papel
            );
          end if;
        end loop;
      end;
      $$;
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Migration 1030 e forward-only: o hardening do catalogo nao deve ser revertido.');
  }
}
