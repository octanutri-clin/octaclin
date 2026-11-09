import { randomUUID } from 'node:crypto';
import { construirAnaliseFactual } from './construtor-analise-factual';
import { compararVersoesFactuais } from '../dominio/comparacao-versoes-factuais';
import { criarSnapshotMicronutrientes } from '../dominio/micronutrientes';
import { projetarRegistroFactual,projetarComparacaoFactual,projetarMetadadosRegistro } from './projecao-registro-factual';
const m={id:randomUUID(),criadoEm:new Date('2026-11-03T12:00:00.000Z')};
const criar=()=>construirAnaliseFactual({escopo:{tenantId:randomUUID(),pacienteId:randomUUID()},origem:{planoId:randomUUID(),versaoId:randomUUID(),numero:1,status:'publicada',registradaEm:'2026-11-01T12:00:00.000Z'},ativo:true,selecionado:true,refeicoes:[{identidadeId:randomUUID(),ativa:true,selecionada:true,itens:[{porcaoGramas:100,snapshot:{origem:'manual',nutrientesPorcao:{energiaKcal:0},micronutrientes:criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor:0}},100,100)}}]}]});
it('metadados são mínimos, com instante real da captura em ISO',()=>{expect(projetarMetadadosRegistro({...m,token:'CANARIO'} as typeof m)).toEqual({id:m.id,criadoEm:'2026-11-03T12:00:00.000Z'});});
it('projeção de análise não retorna corpo protegido/contexto/hashes',()=>{
 const r=criar(),p=projetarRegistroFactual(m,r);expect(p.registro.id).toBe(m.id);expect(p.origem).toEqual(r.versao.origem);
 expect(p.analise.calculo.nutrientes.energiaKcal.total).toBe(0);expect(p.analise.cobertura.nutrientes.ferroMg.total).toBe(0);expect(p.analise.cobertura.nutrientes.selenioMcg.estado).toBe('DESCONHECIDO');
 expect(JSON.stringify(p)).not.toMatch(/tenantId|pacienteId|conteudoHash|snapshot|nutrientesPor100g|nascimento|"contexto":|confirmacaoOrigem/);
});
it('campos extras em raízes e nutrientes não atravessam allowlists',()=>{
 const r=JSON.parse(JSON.stringify(criar()));r.segredo='CANARIO';r.analise.segredo='CANARIO';r.analise.calculo.nutrientes.energiaKcal.segredo='CANARIO';r.analise.cobertura.nutrientes.ferroMg.contagens.segredo='CANARIO';r.analise.cobertura.nutrientes.ferroMg.causas.push({codigo:'ausente',quantidade:0,segredo:'CANARIO'});
 expect(JSON.stringify(projetarRegistroFactual(m,r))).not.toContain('CANARIO');
});
it('comparação inclui metadados dos registros e distingue instante de versão e captura',()=>{
 const a=criar(),b=JSON.parse(JSON.stringify(a));b.origem=undefined;b.versao.origem.versaoId=randomUUID();const c=compararVersoesFactuais(a.versao,b.versao);
 const p=projetarComparacaoFactual(m,{...m,id:randomUUID()},c,a,b);
 expect(p.antes.registro).toEqual(projetarMetadadosRegistro(m));expect(p.antes.origem).toEqual(a.versao.origem);expect(p.atribuicaoCausal).toBe('nao_estabelecida');
 expect(p.comparacao.antes.calculo.nutrientes.energiaKcal.total).toBe(0);expect(p.referencias).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
 expect(JSON.stringify(p)).not.toMatch(/tenantId|pacienteId|conteudoHash|snapshot|nascimento|confirmacaoOrigem/);
});
it('expõe apenas a seleção congelada necessária para interpretar o total, sem snapshots',()=>{
 const r=criar(),p=projetarRegistroFactual(m,r);
 expect((p as any).selecao).toEqual({planoAtivo:true,planoSelecionado:true,refeicoes:[{identidadeId:r.versao.estado.refeicoes[0].identidadeId,ativa:true,selecionada:true}]});
 expect(JSON.stringify((p as any).selecao)).not.toMatch(/itens|snapshot|descricao|nutrientes/);
});

it('projeta contexto confirmado mínimo e versionado sem nascimento ou ativação DRI',()=>{
 const base=criar(),r=construirAnaliseFactual({escopo:base.versao.escopo,origem:base.versao.origem,ativo:true,selecionado:true,refeicoes:[],contexto:{nascimento:'1990-01-01',dataAnalise:'2026-11-06',populacaoReferencia:'feminina',populacaoConfirmada:true,gestacao:'nao',lactacao:'nao',aplicabilidade:'confirmada',mesmoDiaPlanejado:false,tabagismo:'nao_informado'}});
 const p=projetarRegistroFactual(m,r) as unknown as Record<string,unknown>;
 expect(p.contextoConfirmado).toEqual({schemaVersao:1,dataAnalise:'2026-11-06',idadeAnos:36,populacaoReferencia:'feminina',mesmoDiaPlanejado:false,tabagismo:'nao_informado',motivos:[]});
 expect(JSON.stringify(p)).not.toMatch(/1990-01-01|"nascimento"|confirmacaoOrigem|"elegivel"/);expect(p.referencias).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
 expect(projetarRegistroFactual(m,criar())).not.toHaveProperty('contextoConfirmado');
});
