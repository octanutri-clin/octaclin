import { construirAnaliseFactual,lerRegistroAnaliseFactual,AnaliseFactualInvalidaError,type EntradaConstrutorAnaliseFactual } from './construtor-analise-factual';
import { criarSnapshotMicronutrientes } from '../dominio/micronutrientes';
const entrada=():EntradaConstrutorAnaliseFactual=>({escopo:{tenantId:'tenant-sintetico',pacienteId:'paciente-sintetico'},origem:{planoId:'plano-sintetico',versaoId:'versao-sintetica',numero:1,status:'publicada',registradaEm:'2026-11-03T12:00:00.000Z'},ativo:true,selecionado:true,refeicoes:[{identidadeId:'refeicao',ativa:true,selecionada:true,itens:[{porcaoGramas:100,snapshot:{origem:'manual',nutrientesPor100g:{energiaKcal:120},nutrientesPorcao:{energiaKcal:120},micronutrientes:criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor:0}},100,100)}}]}]});
const comContexto=()=>({...entrada(),contexto:{nascimento:'1990-01-01',dataAnalise:'2026-11-03',populacaoReferencia:'feminina',populacaoConfirmada:true,gestacao:'nao',lactacao:'nao',aplicabilidade:'confirmada',mesmoDiaPlanejado:true,tabagismo:'nao'} as const});
const registro=(e=entrada())=>JSON.parse(JSON.stringify(construirAnaliseFactual(e)));
describe('leitor versionado de registro factual',()=>{
 it.each([entrada,comContexto])('recupera exatamente registro congelado sem fonte viva %p',fabricar=>{
  const original=registro(fabricar()),texto=JSON.stringify(original),lido=lerRegistroAnaliseFactual(texto);
  expect(lido).toEqual(original);expect(Object.isFrozen(lido)).toBe(true);expect(Object.isFrozen(lido.versao.estado.refeicoes[0].itens[0])).toBe(true);
  expect(lido.analise.cobertura.nutrientes.ferroMg.total).toBe(0);expect(lido.analise.cobertura.nutrientes.selenioMcg.estado).toBe('DESCONHECIDO');
  expect(JSON.stringify(lido)).not.toContain('1990-01-01');
 });
 it('preserva ausência de snapshot, refeições excluídas e avisos de precisão histórica',()=>{
  const e=entrada();e.refeicoes[0].itens.push({snapshot:null});e.refeicoes.push({identidadeId:'inativa',ativa:false,selecionada:true,itens:[{snapshot:{descricao:'NÃO GUARDAR'}}]});
  expect(lerRegistroAnaliseFactual(JSON.stringify(registro(e)))).toEqual(registro(e));
 });
 it.each(['schemaVersao','motorVersao','referencias','avisos','analise','versao'])('rejeita campo adulterado %s',campo=>{
  const r=registro();r[campo]='INVÁLIDO';expect(()=>lerRegistroAnaliseFactual(JSON.stringify(r))).toThrow(AnaliseFactualInvalidaError);
 });
 it('não aceita totais ou marcadores incoerentes com os fatos congelados',()=>{
  for(const alterar of [(r:any)=>r.analise.calculo.nutrientes.energiaKcal.total=999,(r:any)=>r.versao.bases.planejamento={esquemaVersao:'food06-bases-v1',conteudoHash:'a'.repeat(64)}]){
   const r=registro();alterar(r);expect(()=>lerRegistroAnaliseFactual(JSON.stringify(r))).toThrow(AnaliseFactualInvalidaError);
  }
 });
 it.each(['contextoLivre','__proto__','constructor'])('recusa campos extras em qualquer profundidade: %s',chave=>{
  for(const extrair of [(r:any)=>r,(r:any)=>r.versao.estado.refeicoes[0].itens[0],(r:any)=>r.analise.cobertura]){
   const r=registro();Object.defineProperty(extrair(r),chave,{value:'CANARIO',enumerable:true});
   expect(()=>lerRegistroAnaliseFactual(JSON.stringify(r))).toThrow(AnaliseFactualInvalidaError);
  }
 });
 it.each([null,{},'{}','null','[]','{','x'.repeat(10*1024*1024+1)])('falha fechada para texto inválido ou fora do limite',valor=>{
  expect(()=>lerRegistroAnaliseFactual(valor as string)).toThrow(AnaliseFactualInvalidaError);
 });
 it('valida contexto resolvido sem deduzir nascimento nem mudar elegibilidade',()=>{
  for(const alterar of [(r:any)=>r.contexto.dataAnalise='2026-02-30',(r:any)=>r.contexto.resolvido.idadeAnos=-1,(r:any)=>r.contexto.resolvido.motivos=['inventado'],(r:any)=>r.contexto.resolvido.contexto.elegivel=false,(r:any)=>r.contexto.resolvido.nascimento='1990-01-01']){
   const r=registro(comContexto());alterar(r);expect(()=>lerRegistroAnaliseFactual(JSON.stringify(r))).toThrow(AnaliseFactualInvalidaError);
  }
 });
 it('contexto incompleto continua inelegível e não recebe inferências',()=>{
  const e:EntradaConstrutorAnaliseFactual=comContexto();delete e.contexto!.nascimento;
  const r=registro(e);expect(lerRegistroAnaliseFactual(JSON.stringify(r))).toEqual(r);expect(r.contexto.resolvido.contexto.elegivel).toBe(false);
 });
});

it.each(['0.5','1.5','2.5','0.000000001','1e-99','0.'+'0'.repeat(50)+'1','1.2300000000000000000000000000000000000000001'])('reabre porção racional exata sem arredondamento: %s',gramas=>{
 const e=entrada();e.refeicoes[0].itens[0].porcaoGramas=gramas;
 const r=registro(e);expect(lerRegistroAnaliseFactual(JSON.stringify(r))).toEqual(r);
});
it.each([['1','3'],['1','0'],['2','2'],['0','1'],['1','02'],['1'],[1,2]].map(r=>[r]))('recusa razão não canônica ou não decimal %p',racional=>{
 const r=registro();r.versao.estado.refeicoes[0].itens[0].porcaoRegistroGramas=racional;
 expect(()=>lerRegistroAnaliseFactual(JSON.stringify(r))).toThrow(AnaliseFactualInvalidaError);
});
it('compatibilidade: snapshot antigo sem porção documentada continua parcial, sem quantidade inferida',()=>{
 const e=entrada();delete e.refeicoes[0].itens[0].porcaoGramas;
 const r=registro(e);expect(lerRegistroAnaliseFactual(JSON.stringify(r))).toEqual(r);expect(r.avisos).toContain('planejamento_nao_documentado');
});

it('não contorna a recusa do escritor a quantidade sem representação numérica positiva',()=>{
 const e=entrada();e.refeicoes[0].itens[0].porcaoGramas='1e-999';expect(()=>construirAnaliseFactual(e)).toThrow(AnaliseFactualInvalidaError);
});
it.each(['menor','nascimento_futuro','nascimento_ausente','populacao_nao_confirmada','gestacao','lactacao','aplicabilidade','mesmo_dia_nao_confirmado'])('preserva contexto registrado sem reclassificar: %s',caso=>{
 const e:EntradaConstrutorAnaliseFactual=comContexto(),c=e.contexto!;
 if(caso==='menor')c.nascimento='2010-01-01';
 if(caso==='nascimento_futuro')c.nascimento='2030-01-01';
 if(caso==='nascimento_ausente')delete c.nascimento;
 if(caso==='populacao_nao_confirmada')c.populacaoConfirmada=false;
 if(caso==='gestacao')c.gestacao='sim';
 if(caso==='lactacao')c.lactacao='nao_informada';
 if(caso==='aplicabilidade')c.aplicabilidade='nao_aplicavel';
 if(caso==='mesmo_dia_nao_confirmado')c.mesmoDiaPlanejado=false;
 const r=registro(e);expect(lerRegistroAnaliseFactual(JSON.stringify(r))).toEqual(r);
});
it.each(['idade_com_futuro','idade_com_ausente','dois_motivos_sem_idade','fora_escopo_sem_idade'])('rejeita contexto impossível para o resolver mesmo com marcador coerente: %s',caso=>{
 const r=registro(comContexto()),res=r.contexto.resolvido;
 res.contexto.elegivel=false;
 if(caso==='idade_com_futuro')res.motivos=['nascimento_futuro'];
 if(caso==='idade_com_ausente')res.motivos=['nascimento_nao_informado'];
 if(caso==='dois_motivos_sem_idade'){delete res.idadeAnos;res.motivos=['nascimento_futuro','nascimento_nao_informado'];}
 if(caso==='fora_escopo_sem_idade'){delete res.idadeAnos;res.motivos=['nascimento_nao_informado','idade_fora_do_escopo'];}
 // Somente este contexto tem número inteiro (idade). O marcador não é autorização.
 const canonico=(v:any):any=>typeof v==='number'?{decimal:[String(v),'1']}:Array.isArray(v)?v.map(canonico):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonico(v[k])])):v;
 r.versao.bases.contexto.conteudoHash=require('node:crypto').createHash('sha256').update(JSON.stringify(canonico(r.contexto))).digest('hex');
 expect(()=>lerRegistroAnaliseFactual(JSON.stringify(r))).toThrow(AnaliseFactualInvalidaError);
});
