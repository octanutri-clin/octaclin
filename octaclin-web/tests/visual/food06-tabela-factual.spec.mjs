import {ajudaSintetica} from '../../scripts/fixtures/ajuda-dietetica.ts';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pacienteId, planoIds, idsRefeicoes, resultado, prepararConsole } from './fixtures/console-pa06.mjs';
function analise(entrada,quantidade) {
  const incluidos=quantidade??entrada.selecoes.reduce((n,s)=>n+s.identidadesRefeicoes.length*2,0);
  const macros=new Set(['energiaKcal','proteinasG','carboidratosG','gordurasG','fibrasG','sodioMg']);
  const nutrientes=Object.fromEntries(Object.entries(resultado(0).nutrientes).filter(([c])=>!macros.has(c)).map(([codigo,n])=>[codigo,{
    codigo,unidade:n.unidade,estado:incluidos?'DESCONHECIDO':'INDISPONIVEL',contagens:{incluidos,conhecidos:0,semComposicao:incluidos,incompativeis:0,naoResolvidos:0},causas:[{codigo:incluidos?'ausente':'sem_componentes',quantidade:incluidos}]
  }]));
  if(incluidos){
    Object.assign(nutrientes.calcioMg,{estado:'COMPLETO',total:0,contagens:{incluidos,conhecidos:incluidos,semComposicao:0,incompativeis:0,naoResolvidos:0},causas:[]});
    Object.assign(nutrientes.ferroMg,{estado:'PARCIAL',quantidadeConhecida:1.2,contagens:{incluidos,conhecidos:1,semComposicao:incluidos-1,incompativeis:0,naoResolvidos:0},causas:[{codigo:'ausente',quantidade:incluidos-1}]});
  }
  return {ajuda:ajudaSintetica(),schemaVersao:1,motorVersao:'food06-factual-v1',calculadoEm:'2026-10-31T12:00:00.000Z',publicacoes:entrada.selecoes.map(s=>({planoId:s.planoId,versaoId:s.versaoIdEsperada,ativacaoRevisao:s.ativacaoRevisaoEsperada})),comparacoes:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},cobertura:{schemaVersao:1,nutrientes}};
}
async function preparar(page,quantidade) {
  await prepararConsole(page);
  await page.route(url=>url.pathname.endsWith('/selecao-calculo'),route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({planoId:planoIds[0],ativoParaPaciente:true,ativacaoRevisao:1,versao:{id:'versao-a',numero:1,publicadaEm:'2026-10-15T12:00:00.000Z'},refeicoes:[{identidadeId:idsRefeicoes[0],nome:'Refeição A',ordem:0,ativa:true}]})}));
  await page.route(url=>url.pathname.endsWith('/calculo-combinado'),route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(resultado(quantidade??route.request().postDataJSON().selecoes.reduce((n,s)=>n+s.identidadesRefeicoes.length*2,0)))}));
  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`,{waitUntil:'domcontentloaded'});
  await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);
  await page.getByRole('button',{name:'Adicionar',exact:true}).click();
  await expect(page.getByText(`${new Intl.NumberFormat('pt-BR').format((quantidade??2)*100)} kcal`)).toBeVisible();
}
const regiao=page=>page.getByRole('region',{name:'Micronutrientes da seleção',exact:true});
function registroHistorico(id,criadoEm,estado='COMPLETO',valor=0){
 const codigos=Object.keys(analise({selecoes:[{planoId:planoIds[0],versaoIdEsperada:'versao-a',ativacaoRevisaoEsperada:1,identidadesRefeicoes:[idsRefeicoes[0]]}]},1).cobertura.nutrientes);
 const nutrientes=Object.fromEntries(codigos.map(codigo=>{const unidade=analise({selecoes:[{planoId:planoIds[0],versaoIdEsperada:'versao-a',ativacaoRevisaoEsperada:1,identidadesRefeicoes:[idsRefeicoes[0]]}]},1).cobertura.nutrientes[codigo].unidade;return [codigo,{codigo,unidade,estado:'DESCONHECIDO',contagens:{incluidos:2,conhecidos:0,semComposicao:2,incompativeis:0,naoResolvidos:0},causas:[{codigo:'ausente',quantidade:2}]}];}));
 const n=nutrientes.ferroMg;n.estado=estado;n.contagens={incluidos:2,conhecidos:estado==='COMPLETO'?2:1,semComposicao:estado==='COMPLETO'?0:1,incompativeis:0,naoResolvidos:0};n.causas=estado==='COMPLETO'?[]:[{codigo:'ausente',quantidade:1}];if(estado==='COMPLETO')n.total=valor;else n.quantidadeConhecida=valor;
 const comparacaoAnterior={planejamento:'IGUAL',composicaoFonte:estado==='COMPLETO'?'DIFERENTE':'SEM_REGISTRO_ANTERIOR',referencia:'NAO_COMPARAVEL',contexto:'IGUAL',cobertura:Object.fromEntries(codigos.map(codigo=>[codigo,estado==='COMPLETO'?'DIFERENTE':'SEM_REGISTRO_ANTERIOR']))};
 return {schemaVersao:1,registro:{id,criadoEm},origem:{planoId:planoIds[0],versaoId:'versao-a',numero:1,status:'publicada',registradaEm:'2026-10-15T12:00:00.000Z'},comparacaoAnterior,motorVersao:'food06-v1',nutrientes,referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},bases:{planejamentoDocumentado:true,composicaoDocumentada:true,contextoDocumentado:true}};
}
test('FOOD06 carrega sob demanda, diferencia zero/parcial/ausente, filtra e atende teclado/axe',async({page},testInfo)=>{
  let pedidos=0;
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes'),route=>{pedidos++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(analise(route.request().postDataJSON()))});});
  await preparar(page);expect(pedidos).toBe(0);
  const botao=await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).boundingBox();
  const cartao=await page.getByText('200 kcal',{exact:true}).boundingBox();
  expect(botao.y).toBeLessThan(cartao.y);
  await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).focus();await page.keyboard.press('Enter');
  const r=regiao(page);await expect(r.getByRole('row',{name:/^Cálcio /})).toContainText('0 mg');
  await expect(r.getByRole('row',{name:/^Ferro /})).toContainText('1,2 mg contabilizados');
  await expect(r).toContainText('total real desconhecido');
  await expect(r.getByRole('row',{name:/^Selênio /})).toContainText('Composição desconhecida');
  await r.getByText('Detalhes de Ferro',{exact:true}).click();await expect(r).toContainText('Composição ausente: 1');
  await r.getByRole('button',{name:'Fechar micronutrientes e cobertura',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('food06-interface.png'),fullPage:false});
  await r.getByLabel('Grupo de nutrientes').selectOption('vitaminas');await expect(r.getByRole('rowheader',{name:'Cálcio',exact:true})).toHaveCount(0);
  await r.getByRole('button',{name:'Limpar filtros'}).click();
  await r.getByLabel('Cobertura dos dados').selectOption('PARCIAL');await expect(r.getByRole('rowheader')).toHaveText(['Ferro']);
  await r.getByRole('button',{name:'Limpar filtros'}).click();
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const tabela=r.getByRole('region',{name:'Tabela de micronutrientes, role horizontalmente se necessário'});
  await tabela.focus();await page.keyboard.press('ArrowRight');
  await expect.poll(()=>tabela.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
  expect((await new AxeBuilder({page}).include('[aria-label="Micronutrientes da seleção"]').analyze()).violations).toEqual([]);
});
test('FOOD06409 impede resultado antigo e permite tentar novamente sem alterar seleção',async({page})=>{
  let pedidos=0;
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes'),route=>{pedidos++;return route.fulfill(pedidos===1?{status:409,contentType:'application/json',body:'{"message":"Seleção alterada."}'}:{status:200,contentType:'application/json',body:JSON.stringify(analise(route.request().postDataJSON()))});});
  await preparar(page);await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).click();
  await expect(regiao(page).getByRole('alert')).toContainText('Atualize a seleção');expect(pedidos).toBe(1);
  await regiao(page).getByRole('button',{name:'Atualizar seleção',exact:true}).click();await expect(regiao(page).getByRole('rowheader',{name:'Ferro',exact:true})).toBeVisible();
  expect(pedidos).toBe(2);
});
test('FOOD06 resposta atrasada não restaura composição da seleção anterior',async({page})=>{
  let liberar;const barreira=new Promise(resolve=>liberar=resolve);let pedidos=0;
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes'),async route=>{
    const corpo=analise(route.request().postDataJSON());pedidos++;
    if(pedidos===1)await barreira;
    try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(corpo)});}catch{/* Request sintético abortado após mudar seleção. */}
  });
  await preparar(page);await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).click();
  await expect.poll(()=>pedidos).toBe(1);await page.getByRole('checkbox',{name:'Refeição A'}).uncheck();
  await expect(regiao(page)).toContainText('Nenhum alimento ativo incluído');liberar();
  await expect(regiao(page)).not.toContainText('1,2 mg contabilizados');
});

for(const acao of ['focus','online','recalculo'])test(`FOOD06 invalidação ${acao} retira subtotal quando o acesso é revogado`,async({page})=>{
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes'),route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(analise(route.request().postDataJSON()))}));
  await preparar(page);await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).click();
  await expect(regiao(page)).toContainText('1,2 mg contabilizados');
  await page.route(url=>url.pathname.endsWith('/selecao-calculo'),route=>route.fulfill({status:403,json:{message:'Acesso indisponível'}}));
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes'),route=>route.fulfill({status:403,json:{message:'Acesso indisponível'}}));
  await page.route(url=>url.pathname.endsWith('/calculo-combinado'),route=>route.fulfill({status:403,json:{message:'Acesso indisponível'}}));
  if(acao==='recalculo')await page.getByRole('button',{name:'Recalcular agora',exact:true}).click();
  else await page.evaluate(a=>window.dispatchEvent(new Event(a)),acao);
  await expect(regiao(page)).not.toContainText('1,2 mg contabilizados');
  await expect(regiao(page)).toContainText('Resultado oculto');
});


test('FOOD06 resposta inválida não apresenta composição completa nem erro interno',async({page})=>{
  let pedidos=0;
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes'),route=>{
    pedidos++;const corpo=analise(route.request().postDataJSON());
    if(pedidos===1){corpo.cobertura.nutrientes.calcioMg.total=-1;corpo.interno='canario-interno-sintetico';}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(corpo)});
  });
  await preparar(page);await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).click();
  await expect(regiao(page).getByRole('alert')).toContainText('Não foi possível carregar uma análise válida');
  await expect(regiao(page).getByRole('rowheader')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('canario-interno-sintetico');
  await regiao(page).getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(regiao(page).getByRole('rowheader',{name:'Cálcio',exact:true})).toBeVisible();
});

test('FOOD06 contribuições abre sob demanda e permite teclado',async({page})=>{
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes'),route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(analise(route.request().postDataJSON()))}));
  await preparar(page);await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).click();
  await expect(regiao(page).getByRole('button',{name:'Ver alimentos de Cálcio',exact:true})).toBeVisible();
});

test('FOOD06 contribuições pagina, usa a seleção inteira e oculta tudo após403',async({page},testInfo)=>{
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes'),route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(analise(route.request().postDataJSON(),26))}));
  let pedidos=0;
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes/contribuicoes'),route=>{
    pedidos++;const q=route.request().postDataJSON(),a=analise(q,26),c=a.cobertura.nutrientes[q.codigo];
    const porcao={codigo:q.codigo,unidade:'mg',estado:'COMPLETO',total:0,contagens:{incluidos:1,conhecidos:1,semComposicao:0,incompativeis:0,naoResolvidos:0},causas:[]};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...a,motorVersao:'food06-contribuicoes-v1',codigo:q.codigo,pagina:q.pagina,limite:q.limite,total:26,cobertura:c,refeicoes:[{planoId:q.selecoes[0].planoId,identidadeRefeicao:q.selecoes[0].identidadesRefeicoes[0],nome:'Almoço sintético',cobertura:c,itens:Array.from({length:q.pagina===1?25:1},(_,i)=>({itemId:`10000000-0000-4000-8000-${String((q.pagina-1)*25+i+1).padStart(12,'0')}`,descricao:`Alimento sintético ${(q.pagina-1)*25+i+1}`,quantidade:'1.5',unidade:'porção',porcaoGramas:'100',cobertura:porcao}))}]})});
  });
  await preparar(page,26);await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).click();
  const r=regiao(page);await expect(r.getByRole('rowheader',{name:'Cálcio',exact:true})).toBeVisible();expect(pedidos).toBe(0);
  await r.getByRole('button',{name:'Ver alimentos de Cálcio',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(r.getByText('Alimento sintético 1',{exact:true})).toBeVisible();
  await expect(r).toContainText('1,5 porção');await expect(r).toContainText('Página 1 de 2: 26 alimentos');
  expect((await new AxeBuilder({page}).include('[aria-label="Micronutrientes da seleção"]').analyze()).violations).toEqual([]);
  await r.getByRole('button',{name:'Próxima página de Cálcio',exact:true}).click();
  await expect(r.getByText('Alimento sintético 26',{exact:true})).toBeVisible();await expect(r.getByText('Alimento sintético 1',{exact:true})).toHaveCount(0);
  await expect(r.getByRole('button',{name:'Próxima página de Cálcio',exact:true})).toBeDisabled();
  await r.getByRole('region',{name:'Alimentos de Cálcio',exact:true}).scrollIntoViewIfNeeded();
  await r.getByRole('region',{name:'Alimentos de Cálcio',exact:true}).screenshot({path:testInfo.outputPath('food06-contribuicoes.png')});
  await page.route(url=>url.pathname.endsWith('/analise-micronutrientes/contribuicoes'),route=>route.fulfill({status:403,contentType:'application/json',body:'{"message":"canario-segredo"}'}));
  await r.getByRole('button',{name:'Página anterior de Cálcio',exact:true}).click();
  await expect(r.getByRole('rowheader',{name:'Cálcio',exact:true})).toHaveCount(0);
  await expect(r).not.toContainText('Alimento sintético');await expect(r).not.toContainText('canario-segredo');
  await expect(page.getByText('2.600 kcal',{exact:true})).toHaveCount(0);
});

test('FOOD06 fonte, ordem global e consulta exata da origem publicada',async({page},testInfo)=>{
  const refeicaoId='10000000-0000-4000-8000-000000000010';
  const ids=['10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000012'];
  let origemPedidos=0,ultimaOrdem;
  await page.route(u=>u.pathname.endsWith('/analise-micronutrientes'),r=>r.fulfill({status:200,json:analise(r.request().postDataJSON())}));
  await page.route(u=>u.pathname.endsWith('/analise-micronutrientes/contribuicoes'),r=>{
    const q=r.request().postDataJSON(),a=analise(q);ultimaOrdem=q.ordem;
    const c=a.cobertura.nutrientes[q.codigo],porcao={...c,contagens:{incluidos:1,conhecidos:1,semComposicao:0,incompativeis:0,naoResolvidos:0}};
    return r.fulfill({status:200,json:{...a,motorVersao:'food06-contribuicoes-v1',codigo:q.codigo,pagina:q.pagina,limite:q.limite,ordem:q.ordem,total:2,cobertura:c,refeicoes:[{planoId:q.selecoes[0].planoId,identidadeRefeicao:q.selecoes[0].identidadesRefeicoes[0],refeicaoId,versaoNumero:1,nome:'Almoço sintético',cobertura:c,itens:ids.map((id,i)=>({itemId:id,posicaoSelecao:i+1,descricao:`Original ${i+1}`,quantidade:'1.5',unidade:'porção',porcaoGramas:'100',cobertura:porcao,composicao:{origem:'catalogo',preparacao:'Cozido',fonte:{codigo:'TACO',nome:'Fonte sintética',versao:'v1'}}}))}]}});
  });
  await page.route(u=>u.pathname.endsWith('/versoes/1'),r=>{origemPedidos++;return r.fulfill({status:200,json:{id:'versao-a',numero:1,status:'publicada',publicadaEm:'2026-10-31T12:00:00Z',objetivos:'CANARIO_PRIVADO',refeicoes:[{id:refeicaoId,nome:'Almoço sintético',itens:ids.map((id,i)=>({id,descricao:`Original ${i+1}`,quantidade:1.5,unidade:'porção',porcaoGramas:100}))}]}});});
  await preparar(page);await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).click();
  await page.getByRole('button',{name:'Ver alimentos de Cálcio',exact:true}).click();
  const detalhe=page.getByRole('region',{name:'Alimentos de Cálcio',exact:true});
  await expect(detalhe).toContainText('Preparo: Cozido');expect(origemPedidos).toBe(0);
  if(testInfo.project.name==='mobile-chromium')expect((await detalhe.boundingBox()).width).toBeLessThanOrEqual(page.viewportSize().width-32);
  await detalhe.getByLabel('Ordenar alimentos de Cálcio').selectOption('contribuicao');
  await expect.poll(()=>ultimaOrdem).toBe('contribuicao');
  if(testInfo.project.name==='mobile-chromium'){expect((await detalhe.boundingBox()).width).toBeLessThanOrEqual(page.viewportSize().width-32);expect(await detalhe.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
  await detalhe.screenshot({path:testInfo.outputPath('food06-fonte-ordem.png')});
  const botao=detalhe.getByRole('button',{name:'Consultar origem de Original 1',exact:true});
  await botao.focus();await page.keyboard.press('Enter');
  const dialogo=page.getByRole('dialog',{name:'Origem publicada',exact:true});await expect(dialogo).toContainText('Versão 1');
  await expect(dialogo).toContainText('Almoço sintético');await expect(dialogo).toContainText('Original 2');
  await expect(dialogo).not.toContainText('CANARIO_PRIVADO');
  await dialogo.screenshot({path:testInfo.outputPath('food06-origem-publicada.png')});
  expect((await new AxeBuilder({page}).include('[role="dialog"]').analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');await expect(dialogo).toHaveCount(0);await expect(botao).toBeFocused();
  await page.route(u=>u.pathname.endsWith('/versoes/1'),r=>r.fulfill({status:200,json:{id:'versao-errada',numero:1,status:'publicada',publicadaEm:'2026-10-31T12:00:00Z',refeicoes:[]}}));
  await botao.click();await expect(dialogo.getByRole('alert')).toContainText('Não foi possível confirmar');
  await expect(dialogo).not.toContainText('Original 2');await page.keyboard.press('Escape');
  let liberar,solicitado=false;const barreira=new Promise(resolve=>liberar=resolve);
  await page.route(u=>u.pathname.endsWith('/versoes/1'),async r=>{solicitado=true;await barreira;try{await r.fulfill({status:200,json:{id:'versao-a',numero:1,status:'publicada',publicadaEm:'2026-10-31T12:00:00Z',refeicoes:[{id:refeicaoId,nome:'Resposta tardia sintética',itens:ids.map(id=>({id,descricao:'Tardia',quantidade:1,unidade:'porção',porcaoGramas:100}))}]}});}catch{/* Fetch sintético cancelado. */}});
  await botao.click();await expect.poll(()=>solicitado).toBe(true);await page.keyboard.press('Escape');liberar();
  await expect(dialogo).toHaveCount(0);await expect(page.locator('body')).not.toContainText('Resposta tardia sintética');
  await page.route(u=>u.pathname.endsWith('/versoes/1'),r=>r.fulfill({status:403,json:{message:'CANARIO_INTERNO'}}));
  await botao.click();await expect(page.getByText('200 kcal',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('body')).not.toContainText('CANARIO_INTERNO');
});

test('FOOD06 M10 histórico pagina registros parciais sem interpolar e mantém tabela acessível',async({page})=>{
 const idAtual='20000000-0000-4000-8000-000000000010',idAnterior='20000000-0000-4000-8000-000000000011';let chamadas=0;
 await page.route(u=>u.pathname.endsWith('/analise-micronutrientes'),r=>r.fulfill({status:200,json:analise(r.request().postDataJSON())}));
 await page.route(u=>u.pathname.endsWith('/analises-factuais/historico'),r=>{
  chamadas++;
  const atual=chamadas===1,registro=registroHistorico(atual?idAtual:idAnterior,atual?'2026-11-05T12:00:00.000Z':'2026-11-04T12:00:00.000Z',atual?'COMPLETO':'PARCIAL',atual?0:1.25);
  return r.fulfill({status:200,json:{schemaVersao:1,itens:[registro],temMais:atual,...(atual?{proximoCursor:{id:idAtual,criadoEm:'2026-11-05T12:00:00.000000Z'}}:{})}});
 });
 await preparar(page);await page.getByRole('button',{name:'Ver histórico de micronutrientes',exact:true}).click();
 const historico=page.getByRole('region',{name:'Histórico de micronutrientes planejados',exact:true});
 await expect(historico.getByRole('row')).toHaveCount(2);await expect(historico).toContainText('0 mg');await expect(historico).toContainText('Os pontos não são ligados');
 await expect(historico).toContainText('causa não é determinada');
 await historico.getByText('Ver dimensões',{exact:true}).first().click();
 await expect(historico).toContainText('Composição e fonte: Diferente (a causa não é determinada)');
 await expect(historico).toContainText('o contexto inclui data e confirmações registradas');
 await expect(historico.locator('polyline,path')).toHaveCount(0);await expect(historico.locator('circle')).toHaveCount(1);
 await historico.getByRole('button',{name:'Carregar registros anteriores',exact:true}).click();
 await expect(historico.getByRole('row')).toHaveCount(3);await expect(historico).toContainText('1,25 mg contabilizados; total real desconhecido');await expect(historico).toContainText('Fim do histórico disponível.');
 expect(chamadas).toBe(2);
 await historico.getByLabel('Nutriente no histórico').selectOption('selenioMcg');await expect(historico).toContainText('Composição desconhecida');await expect(historico.locator('circle')).toHaveCount(0);
 expect((await new AxeBuilder({page}).include('[aria-label="Histórico de micronutrientes planejados"]').analyze()).violations).toEqual([]);
});

test('FOOD06 M10 revogação de acesso no histórico invalida também a análise atual',async({page})=>{
 const id='20000000-0000-4000-8000-000000000020';
 await page.route(u=>u.pathname.endsWith('/analise-micronutrientes'),r=>r.fulfill({status:200,json:analise(r.request().postDataJSON())}));
 await page.route(u=>u.pathname.endsWith('/analises-factuais/historico'),r=>r.fulfill({status:200,json:{schemaVersao:1,itens:[registroHistorico(id,'2026-11-05T12:00:00.000Z')],temMais:true,proximoCursor:{id,criadoEm:'2026-11-05T12:00:00.000000Z'}}}));
 await preparar(page);await page.getByRole('button',{name:'Ver histórico de micronutrientes',exact:true}).click();
 const historico=page.getByRole('region',{name:'Histórico de micronutrientes planejados',exact:true});
 await expect(historico).toContainText('0 mg');
 await page.route(u=>u.pathname.endsWith('/analises-factuais/historico'),r=>r.fulfill({status:403,contentType:'application/json',body:'{"message":"CANARIO_ACESSO_NEGADO"}'}));
 await historico.getByRole('button',{name:'Carregar registros anteriores',exact:true}).click();
 await expect(historico.getByRole('button',{name:'Ver histórico de micronutrientes',exact:true})).toBeDisabled();
 await expect(regiao(page).getByRole('rowheader')).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('CANARIO_ACESSO_NEGADO');
 await expect(page.locator('body')).not.toContainText('200 kcal');
});
