import { construirAnaliseFactual,AnaliseFactualInvalidaError,type EntradaConstrutorAnaliseFactual } from './construtor-analise-factual';
import { criarSnapshotMicronutrientes } from '../dominio/micronutrientes';
import { compararVersoesFactuais } from '../dominio/comparacao-versoes-factuais';
import { calcularNutrientesCombinados } from '../dominio/calculo-combinado';
function entrada():EntradaConstrutorAnaliseFactual {
 return {escopo:{tenantId:'tenant-sintetico',pacienteId:'paciente-sintetico'},origem:{planoId:'plano-sintetico',versaoId:'v1',numero:1,status:'publicada',registradaEm:'2026-11-02T12:00:00.000Z'},ativo:true,selecionado:true,refeicoes:[{identidadeId:'r1',ativa:true,selecionada:true,itens:[{porcaoGramas:'100.000',snapshot:{origem:'catalogo',alimentoComposicaoId:'a1',codigoOrigem:'01',descricao:'Nome sintético',preparacao:'Cozido',fonte:{codigo:'TACO_v1',baseCodigo:'TACO',versao:'1',nome:'Fonte sintética',hashConteudo:'a'.repeat(64)},nutrientesPor100g:{energiaKcal:100,proteinasG:10,carboidratosG:20,gordurasG:2},nutrientesPorcao:{energiaKcal:100,proteinasG:10,carboidratosG:20,gordurasG:2},micronutrientes:criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor:2}},100,100),contextoLivre:'CANARIO_INTERNO'}}]}]};
}
const snapshot=(e:EntradaConstrutorAnaliseFactual)=>e.refeicoes[0].itens[0].snapshot as Record<string,unknown>;
describe('M05/M07 construtor canônico factual interno',()=>{
 it('deriva marcadores coerentes do mesmo estado usado pela PA06 e não aceita hashes livres',()=>{
  const e=entrada();Object.assign(e,{bases:{planejamento:{conteudoHash:'b'.repeat(64)}},totais:{energiaKcal:9999}});
  const r=construirAnaliseFactual(e);
  expect(r.analise.calculo).toEqual(calcularNutrientesCombinados([r.versao.estado]));
  expect(r.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
  expect(r.versao.bases?.planejamento).toMatchObject({esquemaVersao:'food06-bases-v1',conteudoHash:expect.stringMatching(/^[a-f0-9]{64}$/)});
  expect(r.referencias.estado).toBe('indisponivel');expect(r.versao.bases?.referencia).toBeUndefined();
 });
 it('metadados visuais, IDs de linhas novas e ordem não alteram os marcadores',()=>{
  const a=entrada(),b=entrada();b.refeicoes[0].identidadeId='outro-id';b.origem.versaoId='v2';
  Object.assign(snapshot(b),{descricao:'Outro rótulo',fonte:{...(snapshot(b).fonte as object),nome:'Outro nome',capturadaEm:'2026-11-03T00:00:00.000Z'}});
  const x=construirAnaliseFactual(a),y=construirAnaliseFactual(b);expect(y.versao.bases).toEqual(x.versao.bases);
 });
 it('porção muda planejamento, não composição por100g; não multiplica novamente',()=>{
  const a=entrada(),b=entrada();b.refeicoes[0].itens[0].porcaoGramas=150;
  Object.assign(snapshot(b),{nutrientesPorcao:{energiaKcal:150,proteinasG:15,carboidratosG:30,gordurasG:3},micronutrientes:criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor:2}},100,150)});
  const r=compararVersoesFactuais(construirAnaliseFactual(a).versao,construirAnaliseFactual(b).versao);
  expect(r.bases.planejamento).toBe('alterada');expect(r.bases.composicao_fonte).toBe('igual');expect(r.comparacao.depois.calculo.nutrientes.energiaKcal.total).toBe(150);
 });
 it('mudança da composição/fonte é documentada sem alterar o planejamento quantitativo',()=>{
  const a=entrada(),b=entrada();Object.assign(snapshot(b),{fonte:{...(snapshot(b).fonte as object),versao:'2',hashConteudo:'b'.repeat(64)},micronutrientes:criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor:3}},100,100)});
  const r=compararVersoesFactuais(construirAnaliseFactual(a).versao,construirAnaliseFactual(b).versao);
  expect(r.bases.planejamento).toBe('igual');expect(r.bases.composicao_fonte).toBe('alterada');expect(r.atribuicaoCausal).toBe('nao_estabelecida');
 });
 it('gramas numéricas/textuais equivalentes e preparação com formatação equivalente não geram falso alerta',()=>{
  const a=entrada(),b=entrada();b.refeicoes[0].itens[0].porcaoGramas=100;Object.assign(snapshot(b),{preparacao:'  COZIDO  '});
  expect(construirAnaliseFactual(a).versao.bases).toEqual(construirAnaliseFactual(b).versao.bases);
 });
 it('preparação diferente não é inferida por semelhança de nome',()=>{
  const a=entrada(),b=entrada();snapshot(b).preparacao='Cru';
  expect(construirAnaliseFactual(a).versao.bases?.composicao_fonte).not.toEqual(construirAnaliseFactual(b).versao.bases?.composicao_fonte);
 });
 it('manual/legado sem identidade estável conserva fatos sem inventar identidade de alimento',()=>{
  const e=entrada();snapshot(e).origem='manual';delete snapshot(e).fonte;delete snapshot(e).codigoOrigem;delete snapshot(e).alimentoComposicaoId;
  const r=construirAnaliseFactual(e);expect(r.versao.bases?.planejamento).toBeUndefined();expect(r.avisos).toContain('planejamento_nao_documentado');
  expect(r.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
 });
 it('ausência de micronutriente permanece desconhecida, distinta de zero conhecido',()=>{
  const a=entrada(),b=entrada();delete snapshot(a).micronutrientes;snapshot(b).micronutrientes=criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor:0}},100,100);
  expect(construirAnaliseFactual(a).analise.cobertura.nutrientes.ferroMg.estado).toBe('DESCONHECIDO');
  expect(construirAnaliseFactual(b).analise.cobertura.nutrientes.ferroMg.total).toBe(0);
 });
 it('contexto é resolvido pelo domínio existente, sem nascimento/texto livre no envelope',()=>{
  const e=entrada();e.contexto={nascimento:'1990-01-01',dataAnalise:'2026-11-02',populacaoReferencia:'feminina',populacaoConfirmada:true,gestacao:'nao',lactacao:'nao',aplicabilidade:'confirmada',mesmoDiaPlanejado:true,tabagismo:'nao'};
  const r=construirAnaliseFactual(e);expect(r.contexto?.resolvido.idadeAnos).toBe(36);expect(r.versao.bases?.contexto).toBeDefined();expect(r.versao.bases?.referencia).toBeUndefined();
  expect(JSON.stringify(r)).not.toMatch(/1990-01-01|CANARIO_INTERNO|Nome sintético|Fonte sintética/);
 });
 it('não assume contexto ausente saudável nem cria referência autorizada',()=>{
  const r=construirAnaliseFactual(entrada());expect(r.contexto).toBeUndefined();expect(r.versao.bases?.contexto).toBeUndefined();expect(r.versao.bases?.referencia).toBeUndefined();
 });
 it('descarta dados de refeições não incluídas e alternativas disponíveis sem alterar os totais',()=>{
  const e=entrada();Object.assign(snapshot(e),{substituicoes:[{contextoLivre:'CANARIO_ALTERNATIVA'}]});
  e.refeicoes.push({identidadeId:'r2',ativa:false,selecionada:true,itens:[{snapshot:{contextoLivre:'CANARIO_INATIVO'}}]});
  const r=construirAnaliseFactual(e);expect(r.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
  expect(JSON.stringify(r)).not.toMatch(/CANARIO|substituicoes|descricao/);expect(r.versao.estado.refeicoes[1].itens).toEqual([]);
 });
 it('envelope é independente e imutável em profundidade, sem congelar a entrada',()=>{
  const e=entrada(),antes=JSON.stringify(e),r=construirAnaliseFactual(e);
  expect(Object.isFrozen(r)).toBe(true);expect(Object.isFrozen(r.versao.estado.refeicoes[0].itens[0])).toBe(true);
  expect(Object.isFrozen(e)).toBe(false);expect(JSON.stringify(e)).toBe(antes);expect(()=>{r.avisos.push('adulterado');}).toThrow();
 });
 it.each([0,-1,NaN,Infinity,'invalida'])('quantidade registrada inválida não é normalizada em zero %p',valor=>{
  const e=entrada();e.refeicoes[0].itens[0].porcaoGramas=valor;expect(()=>construirAnaliseFactual(e)).toThrow(AnaliseFactualInvalidaError);
 });
});

it('fonte incompleta não vira composição/fonte documentada, mantendo os fatos conhecidos',()=>{
 const e=entrada();delete (snapshot(e).fonte as Record<string,unknown>).hashConteudo;
 const r=construirAnaliseFactual(e);expect(r.versao.bases?.composicao_fonte).toBeUndefined();expect(r.avisos).toContain('composicao_nao_documentada');expect(r.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
});
it('concentração ausente impede marcador de composição sem impedir valores de porção conhecidos',()=>{
 const e=entrada();delete snapshot(e).nutrientesPor100g;const r=construirAnaliseFactual(e);
 expect(r.versao.bases?.composicao_fonte).toBeUndefined();expect(r.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
});
it('hash de fonte com mudança apenas na caixa não cria diferença de composição',()=>{
 const a=entrada(),b=entrada();(snapshot(b).fonte as Record<string,unknown>).hashConteudo='A'.repeat(64);
 expect(construirAnaliseFactual(a).versao.bases?.composicao_fonte).toEqual(construirAnaliseFactual(b).versao.bases?.composicao_fonte);
});
it('mudança da normalização customizada é rastreável sem copiar referência textual livre',()=>{
 const a=entrada(),b=entrada();
 for(const e of [a,b])Object.assign(snapshot(e),{origem:'custom',composicaoInformada:{baseGramas:100,nutrientes:{energiaKcal:100},micronutrientes:{ferroMg:2},normalizacaoVersao:'custom-v1',referencia:'CANARIO_FONTE_LIVRE'}});
 (snapshot(b).composicaoInformada as Record<string,unknown>).normalizacaoVersao='custom-v2';
 const x=construirAnaliseFactual(a),y=construirAnaliseFactual(b);expect(x.versao.bases?.composicao_fonte).not.toEqual(y.versao.bases?.composicao_fonte);expect(JSON.stringify(x)).not.toContain('CANARIO_FONTE_LIVRE');
});
it('divergência de gramas não corrige o histórico nem declara planejamento conhecido',()=>{
 const e=entrada();e.refeicoes[0].itens[0].porcaoGramas=150;const r=construirAnaliseFactual(e);
 expect(r.avisos).toContain('porcao_divergente');expect(r.versao.bases?.planejamento).toBeUndefined();expect(r.analise.calculo.nutrientes.energiaKcal.total).toBe(100);
});
it('snapshot ausente permanece não resolvido sem marcador de fonte conhecido',()=>{
 const e=entrada();e.refeicoes[0].itens[0].snapshot=null;const r=construirAnaliseFactual(e);
 expect(r.versao.bases?.composicao_fonte).toBeUndefined();expect(r.analise.cobertura.nutrientes.ferroMg.estado).toBe('INDISPONIVEL');
});
it('registro recusa esquema que não consegue reproduzir sem modificar a consulta factual existente',()=>{
 const e=entrada();(snapshot(e).micronutrientes as Record<string,unknown>).schemaVersao=99;
 expect(()=>construirAnaliseFactual(e)).toThrow(AnaliseFactualInvalidaError);
});

it('R4 arrays esparsos não produzem documentação de dados inexistentes',()=>{
 const e=entrada();e.refeicoes[0].itens=new Array(1);
 expect(()=>construirAnaliseFactual(e)).toThrow(AnaliseFactualInvalidaError);
});
it.each(['baseGramasOrigem','porcaoGramas'])('R4 %s zero é rejeitado como no produtor',campo=>{
 const e=entrada();(snapshot(e).micronutrientes as Record<string,unknown>)[campo]=0;
 expect(()=>construirAnaliseFactual(e)).toThrow(AnaliseFactualInvalidaError);
});
it('valores congelados divergentes não são alterados nem declarados coerentes silenciosamente',()=>{
 const e=entrada();(snapshot(e).nutrientesPorcao as Record<string,number>).energiaKcal=200;
 ((snapshot(e).micronutrientes as {nutrientes:Record<string,{porcao:number}>}).nutrientes.ferroMg).porcao=9;
 const r=construirAnaliseFactual(e);expect(r.analise.calculo.nutrientes.energiaKcal.total).toBe(200);expect(r.analise.cobertura.nutrientes.ferroMg.total).toBe(9);
 expect(r.avisos).toContain('porcao_divergente');expect(r.versao.bases?.planejamento).toBeUndefined();
});
it('zero conhecido permanece válido para concentração e nutriente, não para base/gramas',()=>{
 const e=entrada();Object.assign(snapshot(e),{nutrientesPor100g:{energiaKcal:0},nutrientesPorcao:{energiaKcal:0},micronutrientes:criarSnapshotMicronutrientes({ferroMg:{estado:'conhecido',valor:0}},100,100)});
 const r=construirAnaliseFactual(e);expect(r.analise.calculo.nutrientes.energiaKcal.total).toBe(0);expect(r.avisos).not.toContain('porcao_divergente');
});

it('R4 accessor de array é rejeitado antes de executar código de leitura',()=>{
 const e=entrada();let chamadas=0;Object.defineProperty(e.refeicoes[0].itens,0,{enumerable:true,get(){chamadas++;throw new Error('CANARIO_GETTER');}});
 expect(()=>construirAnaliseFactual(e)).toThrow(AnaliseFactualInvalidaError);expect(chamadas).toBe(0);
});
it('precisão histórica diferente é preservada com aviso, sem declarar corrupção ou reparar o valor',()=>{
 const e=entrada();(snapshot(e).nutrientesPorcao as Record<string,number>).energiaKcal=100.00001;
 const r=construirAnaliseFactual(e);expect(r.analise.calculo.nutrientes.energiaKcal.total).toBe(100.00001);
 expect(r.avisos).toContain('porcao_divergente');expect(r.versao.bases?.planejamento).toBeUndefined();expect(r.versao.bases?.composicao_fonte).toBeUndefined();
});

it('ausência explícita e chave ausente são equivalentes no marcador, sem transformar ausência em zero',()=>{
 const a=entrada(),b=entrada();delete (snapshot(b).micronutrientes as {nutrientes:Record<string,unknown>}).nutrientes.calcioMg;
 const x=construirAnaliseFactual(a),y=construirAnaliseFactual(b);
 expect(x.versao.bases?.composicao_fonte).toEqual(y.versao.bases?.composicao_fonte);
 expect(x.analise.cobertura.nutrientes.calcioMg.estado).toBe('DESCONHECIDO');expect(y.analise.cobertura.nutrientes.calcioMg.total).toBeUndefined();
});
