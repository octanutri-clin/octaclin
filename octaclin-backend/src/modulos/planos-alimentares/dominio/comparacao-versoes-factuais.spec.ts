import { compararVersoesFactuais,DIMENSOES_VERSAO,ComparacaoVersoesInvalidaError,type VersaoFactualResolvida } from './comparacao-versoes-factuais';
import { compararCenariosFactuais } from './previa-dietetica';
import { criarSnapshotMicronutrientes } from './micronutrientes';
const base=(hash='a',esquemaVersao='food06-bases-v1')=>({esquemaVersao,conteudoHash:hash.repeat(64)});
function versao(ferro:number|null=2):VersaoFactualResolvida {
 return {escopo:{tenantId:'tenant-sintetico',pacienteId:'paciente-sintetico'},origem:{planoId:'plano-sintetico',versaoId:'v1',numero:1,status:'publicada',registradaEm:'2026-11-01T12:00:00.000Z'},
  estado:{planoId:'plano-sintetico',ativo:true,selecionado:true,refeicoes:[{identidadeId:'r1',ativa:true,selecionada:true,itens:[{contextoClinico:'CANARIO_INTERNO',nutrientesPorcao:{energiaKcal:100,proteinasG:10,carboidratosG:20,gordurasG:2},micronutrientes:criarSnapshotMicronutrientes(ferro===null?{}:{ferroMg:{estado:'conhecido',valor:ferro}},100,100)}]}]},
  bases:Object.fromEntries(DIMENSOES_VERSAO.map(d=>[d,base()]))};
}
describe('M07 comparação factual interna de versões',()=>{
 it('reutiliza exatamente a PA06/M04 sem consulta a catálogo ou soma das versões',()=>{
  const a=versao(2),b=versao(3);b.origem.versaoId='v2';b.origem.numero=2;
  const r=compararVersoesFactuais(a,b);
  expect(r.comparacao).toEqual(compararCenariosFactuais([a.estado],[b.estado]));
  expect(r.escopoComparacao).toBe('total_de_cada_versao_separadamente');
  expect(r.comparacao.diferencas.ferroMg.delta).toMatchObject({estado:'calculavel',diferenca:1});
  expect(r.comparacao.referencias.estado).toBe('indisponivel');expect(r.atribuicaoCausal).toBe('nao_estabelecida');
 });
 it.each(DIMENSOES_VERSAO)('isola mudança documentada %s sem atribuir causa',d=>{
  const a=versao(),b=versao();b.bases![d]=base('b');const r=compararVersoesFactuais(a,b);
  expect(r.bases[d]).toBe('alterada');for(const outra of DIMENSOES_VERSAO.filter(x=>x!==d))expect(r.bases[outra]).toBe('igual');
  expect(r.atribuicaoCausal).toBe('nao_estabelecida');expect(r.comparacao.diferencas.ferroMg.delta).toMatchObject({diferenca:0});
 });
 it('duas ausências não provam contexto ou referência iguais; não projeta hashes/contexto',()=>{
  const a=versao(),b=versao();delete a.bases;delete b.bases;
  const r=compararVersoesFactuais(a,b);expect(Object.values(r.bases)).toEqual(Array(4).fill('nao_documentada'));
  expect(JSON.stringify(r)).not.toMatch(/tenantId|pacienteId|conteudoHash|CANARIO_INTERNO|contextoClinico/);
 });
 it.each([null,{}, {esquemaVersao:'food06-bases-v1',conteudoHash:'x'}, {esquemaVersao:'food06-bases-v1',conteudoHash:42}])('marcador malformado não inventa alteração %p',v=>{
  const a=versao(),b=versao();b.bases!.contexto=v;expect(compararVersoesFactuais(a,b).bases.contexto).toBe('nao_documentada');
 });
 it('esquemas divergentes ou não suportados não são tratados como mudança de dieta',()=>{
  const a=versao(),b=versao();b.bases!.planejamento=base('a','outro-v2');
  expect(compararVersoesFactuais(a,b).bases.planejamento).toBe('incompativel');a.bases!.planejamento=base('a','outro-v2');
  expect(compararVersoesFactuais(a,b).bases.planejamento).toBe('incompativel');
 });
 it('representação hexadecimal não gera alteração visual falsa',()=>{
  const a=versao(),b=versao();b.bases!.composicao_fonte=base('A');expect(compararVersoesFactuais(a,b).bases.composicao_fonte).toBe('igual');
 });
 it('rascunhos com mesmo número mantêm revisões editoriais distintas',()=>{
  const a=versao(),b=versao();a.origem.status=b.origem.status='rascunho';a.origem.rascunhoRevisao=2;b.origem.rascunhoRevisao=3;
  const r=compararVersoesFactuais(a,b);expect(r.antes.rascunhoRevisao).toBe(2);expect(r.depois.rascunhoRevisao).toBe(3);
 });
 it.each([undefined,0,-1,1.2,NaN])('rascunho exige revisão válida, sem resolver a mais recente %p',v=>{
  const a=versao();a.origem.status='rascunho';a.origem.rascunhoRevisao=v;expect(()=>compararVersoesFactuais(a,versao())).toThrow(ComparacaoVersoesInvalidaError);
 });
 it.each(['tenantId','pacienteId'] as const)('escopo divergente é rejeitado sem expor %s',campo=>{
  const a=versao();a.escopo[campo]='CANARIO_SECRETO';expect(()=>compararVersoesFactuais(a,versao())).toThrow('Estados de versões indisponíveis para comparação.');
 });
 it.each(['2026-02-31T12:00:00.000Z','invalida','2026-11-01'])('data exata inválida rejeitada %s',data=>{
  const a=versao();a.origem.registradaEm=data;expect(()=>compararVersoesFactuais(a,versao())).toThrow(ComparacaoVersoesInvalidaError);
 });
 it('porção congelada não é multiplicada outra vez e alternativa disponível não conta',()=>{
  const a=versao(),b=versao(3);Object.assign(b.estado.refeicoes[0].itens[0] as object,{quantidade:1.5,porcaoGramas:150,substituicoes:[{nutrientesPorcao:{energiaKcal:9000}}]});
  expect(compararVersoesFactuais(a,b).comparacao.depois.calculo.nutrientes.energiaKcal.total).toBe(100);
 });
 it('parcial conserva conhecido e impede delta completo por nutriente',()=>{
  const a=versao(2),b=versao(3);b.estado.refeicoes[0].itens.push(versao(null).estado.refeicoes[0].itens[0]);
  const r=compararVersoesFactuais(a,b);expect(r.comparacao.depois.cobertura.nutrientes.ferroMg).toMatchObject({estado:'PARCIAL',quantidadeConhecida:3});
  expect(r.comparacao.diferencas.ferroMg.delta.estado).toBe('indisponivel');expect(r.cobertura.ferroMg).toBe('alterada');
 });
 it('zero conhecido não vira ausência ou percentual diário',()=>{
  const r=compararVersoesFactuais(versao(0),versao(2));expect(r.comparacao.antes.cobertura.nutrientes.ferroMg.total).toBe(0);
  expect(r.comparacao.diferencas.ferroMg.delta).toMatchObject({diferenca:2,percentual:{estado:'indisponivel',motivo:'base_zero'}});
 });
 it('não modifica envelopes, não usa a comparação anterior como fonte e não transporta campos extras',()=>{
  const a=versao(),b=versao(3);Object.assign(a.origem,{privado:'CANARIO_INTERNO'});const original=JSON.stringify([a,b]);
  const r=compararVersoesFactuais(a,b);r.antes.numero=999;r.comparacao.depois.cobertura.nutrientes.ferroMg.total=999;
  expect(JSON.stringify([a,b])).toBe(original);expect(JSON.stringify(r)).not.toContain('CANARIO_INTERNO');
  expect(compararVersoesFactuais(a,b).comparacao.depois.cobertura.nutrientes.ferroMg.total).toBe(3);
 });
});


it('M07 não executa getters de marcadores ou normaliza campos desconhecidos em fatos',()=>{
 const a=versao(),b=versao();let chamadas=0;
 b.bases!.contexto=Object.defineProperty({},'conteudoHash',{enumerable:true,get(){chamadas++;return 'b'.repeat(64);}});
 expect(compararVersoesFactuais(a,b).bases.contexto).toBe('nao_documentada');expect(chamadas).toBe(0);
});
it.each([null,{}, {status:'CANARIO_INTERNO'}, {status:42}, {rascunhoRevisao:1}, {numero:0}, {versaoId:''}])('M07 rejeita identificação incompleta sem diagnóstico ou coerção %p',delta=>{
 const a=versao();a.origem=(delta===null?null:{...a.origem,...delta}) as unknown as typeof a.origem;
 if(delta&&Object.keys(delta).length===0)delete (a.origem as Partial<typeof a.origem>).versaoId;
 expect(()=>compararVersoesFactuais(a,versao())).toThrow(ComparacaoVersoesInvalidaError);
});
it('M07 não aceita estrutura de outro plano ou refeições duplicadas',()=>{
 const a=versao();a.estado.planoId='outro-plano';expect(()=>compararVersoesFactuais(a,versao())).toThrow(ComparacaoVersoesInvalidaError);
 const b=versao();b.estado.refeicoes.push(b.estado.refeicoes[0]);expect(()=>compararVersoesFactuais(b,versao())).toThrow(ComparacaoVersoesInvalidaError);
});
it('M07 preserva schema de micronutrientes desconhecido sem delta enganoso',()=>{
 const a=versao(),b=versao();const item=b.estado.refeicoes[0].itens[0] as {micronutrientes:{mapeamentoVersao:string}};
 item.micronutrientes.mapeamentoVersao='desconhecido';const r=compararVersoesFactuais(a,b);
 expect(r.comparacao.depois.cobertura.nutrientes.ferroMg.estado).toBe('INDISPONIVEL');expect(r.comparacao.diferencas.ferroMg.delta.estado).toBe('indisponivel');
});
it('M07 mudanças numéricas não são mudanças de cobertura ou prova de melhora',()=>{
 const r=compararVersoesFactuais(versao(2),versao(3));expect(r.cobertura.ferroMg).toBe('igual');expect(r.atribuicaoCausal).toBe('nao_estabelecida');
});
it('M07 respeita exclusão registrada no estado sem consultar ativação atual do catálogo',()=>{
 const a=versao(),b=versao();b.estado.refeicoes[0].ativa=false;const r=compararVersoesFactuais(a,b);
 expect(r.comparacao.depois.calculo.itensIncluidos).toBe(0);expect(r.comparacao.diferencas.ferroMg.delta.estado).toBe('indisponivel');
});
