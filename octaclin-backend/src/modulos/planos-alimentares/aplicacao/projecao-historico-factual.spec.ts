import { construirAnaliseFactual } from './construtor-analise-factual';
import type { EntradaConstrutorAnaliseFactual } from './construtor-analise-factual';
import { compararBaseComposicaoHistorica, projetarResumoHistoricoFactual } from './projecao-registro-factual';
import { criarSnapshotMicronutrientes } from '../dominio/micronutrientes';

function entrada(valores:Record<string,{estado:'conhecido';valor:number}>|undefined):EntradaConstrutorAnaliseFactual {
 const micronutrientes=valores?criarSnapshotMicronutrientes(valores,100,100):undefined;
 const snapshot={origem:'catalogo',alimentoComposicaoId:'alimento-sintetico',codigoOrigem:'A1',descricao:'Alimento sintético',preparacao:'Cozido',
  fonte:{codigo:'TACO-v1',baseCodigo:'TACO',versao:'1',nome:'Fonte sintética',hashConteudo:'a'.repeat(64)},
  nutrientesPor100g:{energiaKcal:10},nutrientesPorcao:{energiaKcal:10},...(micronutrientes?{micronutrientes}:{})};
 return {escopo:{tenantId:'tenant-sintetico',pacienteId:'paciente-sintetico'},
  origem:{planoId:'plano-sintetico',versaoId:'versao-sintetica',numero:1,status:'publicada',registradaEm:'2026-11-04T12:00:00.000Z'},
  ativo:true,selecionado:true,refeicoes:[{identidadeId:'refeicao-sintetica',ativa:true,selecionada:true,itens:[{porcaoGramas:100,snapshot}]}]};
}
const meta={id:'registro-sintetico',criadoEm:new Date('2026-11-04T12:01:00.000Z')};

describe('M10 projeção de histórico factual',()=>{
 it('preserva zero conhecido, desconhecido e subtotal parcial sem apresentar parcial como total',()=>{
  const completo=construirAnaliseFactual(entrada({ferroMg:{estado:'conhecido',valor:0}}));
  const desconhecido=construirAnaliseFactual(entrada(undefined));
  const baseParcial=entrada({ferroMg:{estado:'conhecido',valor:2}});
  const parcial=construirAnaliseFactual({...baseParcial,refeicoes:[...baseParcial.refeicoes,
   {identidadeId:'refeicao-sintetica-2',ativa:true,selecionada:true,itens:[{porcaoGramas:100,snapshot:{origem:'manual',nutrientesPor100g:{energiaKcal:5},nutrientesPorcao:{energiaKcal:5}}}]}
  ]});
  const zero=projetarResumoHistoricoFactual(meta,completo),sem=projetarResumoHistoricoFactual(meta,desconhecido),parte=projetarResumoHistoricoFactual(meta,parcial);
  expect(zero.nutrientes.ferroMg).toMatchObject({estado:'COMPLETO',total:0});
  expect(sem.nutrientes.ferroMg).toMatchObject({estado:'DESCONHECIDO'});expect(sem.nutrientes.ferroMg).not.toHaveProperty('total');
  expect(parte.nutrientes.ferroMg).toMatchObject({estado:'PARCIAL',quantidadeConhecida:2});expect(parte.nutrientes.ferroMg).not.toHaveProperty('total');
 });
 it('usa somente campos autorizados e marca referências indisponíveis',()=>{
  const registro=construirAnaliseFactual(entrada({ferroMg:{estado:'conhecido',valor:3}}));
  const resumo=projetarResumoHistoricoFactual(meta,registro);
  expect(resumo).toMatchObject({schemaVersao:1,registro:{id:meta.id},origem:{planoId:'plano-sintetico',numero:1},referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'}});
  expect(resumo.comparacaoBaseComposicao).toBe('SEM_REGISTRO_ANTERIOR');
  expect(JSON.stringify(resumo)).not.toMatch(/tenantId|pacienteId|hashConteudo|composicao_fonte|CANARIO|alimento-sintetico/);
  expect(resumo.nutrientes.calcioMg).toHaveProperty('unidade','mg');
 });
 it('compara base de composição com registro mais antigo sem projetar o hash',()=>{
  const anterior=construirAnaliseFactual(entrada({ferroMg:{estado:'conhecido',valor:1}}));
  const igual=construirAnaliseFactual(entrada({ferroMg:{estado:'conhecido',valor:1}}));
  const diferente=construirAnaliseFactual(entrada({ferroMg:{estado:'conhecido',valor:2}}));
  const entradaSemBase=entrada(undefined);const semBase=construirAnaliseFactual({...entradaSemBase,refeicoes:[{...entradaSemBase.refeicoes[0],itens:[{porcaoGramas:100,snapshot:null}]}]});
  expect(compararBaseComposicaoHistorica(igual,anterior)).toBe('IGUAL');
  expect(compararBaseComposicaoHistorica(diferente,anterior)).toBe('DIFERENTE');
  expect(compararBaseComposicaoHistorica(semBase,anterior)).toBe('NAO_COMPARAVEL');
  expect(compararBaseComposicaoHistorica(anterior,undefined)).toBe('SEM_REGISTRO_ANTERIOR');
  expect(JSON.stringify(projetarResumoHistoricoFactual(meta,diferente))).not.toMatch(/conteudoHash|hashConteudo/);
 });
});
