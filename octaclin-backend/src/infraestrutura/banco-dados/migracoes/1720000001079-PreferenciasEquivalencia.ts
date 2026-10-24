import { MigrationInterface, QueryRunner } from 'typeorm';
/** @aplicacao fora-de-banda — configurações apenas; rollback da aplicação conserva dados. */
export class PreferenciasEquivalencia1720000001079 implements MigrationInterface {
  name = 'PreferenciasEquivalencia1720000001079';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`alter table profissionais
      add column preferencias_equivalencia jsonb not null default '{"schemaVersao":1,"unidades":"gramas_e_medida_disponivel","casasGramas":3,"casasNutrientes":2,"passoPorcaoGramas":"1","modoComparacao":"detalhado"}'::jsonb,
      add column preferencias_equivalencia_revisao integer not null default 0
        check (preferencias_equivalencia_revisao >= 0),
      add constraint profissionais_preferencias_equivalencia_validas check (
        jsonb_typeof(preferencias_equivalencia) = 'object'
        and preferencias_equivalencia ?& array['schemaVersao','unidades','casasGramas','casasNutrientes','passoPorcaoGramas','modoComparacao']
        and preferencias_equivalencia - array['schemaVersao','unidades','casasGramas','casasNutrientes','passoPorcaoGramas','modoComparacao'] = '{}'::jsonb
        and preferencias_equivalencia->'schemaVersao' = '1'::jsonb
        and preferencias_equivalencia->'unidades' in ('"gramas"'::jsonb,'"gramas_e_medida_disponivel"'::jsonb)
        and preferencias_equivalencia->'casasGramas' in ('0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb)
        and preferencias_equivalencia->'casasNutrientes' in ('0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb)
        and preferencias_equivalencia->'passoPorcaoGramas' in ('"1"'::jsonb,'"0.1"'::jsonb,'"0.01"'::jsonb,'"0.001"'::jsonb)
        and preferencias_equivalencia->'modoComparacao' in ('"compacto"'::jsonb,'"detalhado"'::jsonb)
      );`);
  }
  async down(_q: QueryRunner): Promise<void> { throw new Error('Rollback recusado: preservar preferências e schema aditivo.'); }
}
