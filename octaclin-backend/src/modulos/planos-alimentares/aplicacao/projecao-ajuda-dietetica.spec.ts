import {projetarAjudaDietetica} from './projecao-ajuda-dietetica';
import {AJUDA_DIETETICA} from '../dominio/explicacoes-dieteticas';
describe('M09 projeção de explicações próprias sem contexto clínico ou tabelas',()=>{
 it('reutiliza o catálogo versionado com fonte identificável e sem habilitar comparações',()=>{
  const a=projetarAjudaDietetica();expect(a.schemaVersao).toBe(1);expect(a.comparacoesHabilitadas).toBe(false);
  expect(a.topicos.map(t=>t.codigo)).toEqual(['RDA','AI','UL','planejado','parcial','indisponibilidade','limites']);
  for(const [codigo,texto] of Object.entries(AJUDA_DIETETICA))expect(a.topicos.find(t=>t.codigo===codigo)?.texto).toBe(texto);
  expect(a.fontes).toEqual([{id:'nih-ods-nutrient-recommendations',titulo:expect.any(String),url:'https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx',consultadaEm:'2026-11-02'}]);
  expect(JSON.stringify(a)).not.toMatch(/valorReferencia|nutrientesPor100g|pacienteId|tenantId|Criptograf|proveniencia/);
 });
 it('cada projeção é independente: resposta alterada não muda o catálogo ou outra análise',()=>{
  const a=projetarAjudaDietetica(),b=projetarAjudaDietetica();
  a.topicos[0].texto='CANARIO_PRIVADO';a.fontes[0].url='https://example.invalid/';a.topicos.splice(1);
  expect(projetarAjudaDietetica()).toEqual(b);expect(AJUDA_DIETETICA.RDA).not.toContain('CANARIO_PRIVADO');
 });
});
