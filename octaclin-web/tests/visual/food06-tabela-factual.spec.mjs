import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pacienteId, planoIds, idsRefeicoes, resultado, prepararConsole } from './fixtures/console-pa06.mjs';
function analise(entrada) {
  const incluidos=entrada.selecoes.reduce((n,s)=>n+s.identidadesRefeicoes.length*2,0);
  const macros=new Set(['energiaKcal','proteinasG','carboidratosG','gordurasG','fibrasG','sodioMg']);
  const nutrientes=Object.fromEntries(Object.entries(resultado(0).nutrientes).filter(([c])=>!macros.has(c)).map(([codigo,n])=>[codigo,{
    codigo,unidade:n.unidade,estado:incluidos?'DESCONHECIDO':'INDISPONIVEL',contagens:{incluidos,conhecidos:0,semComposicao:incluidos,incompativeis:0,naoResolvidos:0},causas:[{codigo:incluidos?'ausente':'sem_componentes',quantidade:incluidos}]
  }]));
  if(incluidos){
    Object.assign(nutrientes.calcioMg,{estado:'COMPLETO',total:0,contagens:{incluidos,conhecidos:incluidos,semComposicao:0,incompativeis:0,naoResolvidos:0},causas:[]});
    Object.assign(nutrientes.ferroMg,{estado:'PARCIAL',quantidadeConhecida:1.2,contagens:{incluidos,conhecidos:1,semComposicao:incluidos-1,incompativeis:0,naoResolvidos:0},causas:[{codigo:'ausente',quantidade:incluidos-1}]});
  }
  return {schemaVersao:1,motorVersao:'food06-factual-v1',calculadoEm:'2026-10-31T12:00:00.000Z',publicacoes:entrada.selecoes.map(s=>({planoId:s.planoId,versaoId:s.versaoIdEsperada,ativacaoRevisao:s.ativacaoRevisaoEsperada})),comparacoes:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},cobertura:{schemaVersao:1,nutrientes}};
}
async function preparar(page) {
  await prepararConsole(page);
  await page.route(url=>url.pathname.endsWith('/selecao-calculo'),route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({planoId:planoIds[0],ativoParaPaciente:true,ativacaoRevisao:1,versao:{id:'versao-a',numero:1,publicadaEm:'2026-10-15T12:00:00.000Z'},refeicoes:[{identidadeId:idsRefeicoes[0],nome:'Refeição A',ordem:0,ativa:true}]})}));
  await page.route(url=>url.pathname.endsWith('/calculo-combinado'),route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(resultado(route.request().postDataJSON().selecoes.reduce((n,s)=>n+s.identidadesRefeicoes.length*2,0)))}));
  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`,{waitUntil:'domcontentloaded'});
  await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);
  await page.getByRole('button',{name:'Adicionar',exact:true}).click();
  await expect(page.getByText('200 kcal')).toBeVisible();
}
const regiao=page=>page.getByRole('region',{name:'Micronutrientes da seleção',exact:true});
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
