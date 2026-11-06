import {respostaConsultaTeor as resposta} from './fixtures/food06-consulta-teor.mjs';
import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {prepararConsole,pacienteId,planoIds,idsRefeicoes,resultado} from './fixtures/console-pa06.mjs';
const fim='/catalogo/teor-micronutriente/consulta';

async function preparar(page){
 await prepararConsole(page);
 await page.route(u=>u.pathname.endsWith('/selecao-calculo'),r=>r.fulfill({status:200,json:{planoId:planoIds[0],ativoParaPaciente:true,ativacaoRevisao:1,versao:{id:'versao-a',numero:1,publicadaEm:'2026-10-15T12:00:00.000Z'},refeicoes:[{identidadeId:idsRefeicoes[0],nome:'Refeição A',ordem:0,ativa:true}]}}));
 await page.route(u=>u.pathname.endsWith('/calculo-combinado'),r=>r.fulfill({status:200,json:resultado(2)}));
 await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`,{waitUntil:'domcontentloaded'});
 await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);await page.getByRole('button',{name:'Adicionar',exact:true}).click();await expect(page.getByText('200 kcal',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Consultar alimentos por micronutriente',exact:true}).focus();await page.keyboard.press('Enter');
 return page.getByRole('region',{name:'Consulta de composição do catálogo',exact:true});
}
for(const modo of ['normal','vazio','erro','revogado','tardio','filtro','pequeno','cancelar','sessao','selecao'])test(`FOOD06 consulta factual do catálogo: ${modo}`,async({page},info)=>{
 let liberar;const aguardar=new Promise(r=>{liberar=r;});const pedidos=[];let contar=0;let gravacoes=0;
 await page.route(u=>u.pathname.endsWith(fim),async r=>{const q=r.request().postDataJSON();pedidos.push(q);contar++;if(modo==='erro'&&contar===1)return r.fulfill({status:503,json:{mensagem:'CANARIO_PRIVADO'}});if((modo==='revogado'||modo==='sessao')&&q.pagina===2)return r.fulfill({status:modo==='sessao'?401:403,json:{mensagem:'CANARIO_PRIVADO'}});if((modo==='tardio'||modo==='cancelar'||modo==='selecao')&&contar===1)await aguardar;try{return await r.fulfill({status:200,json:resposta(q,modo)});}catch{/* cancelamento de request de fixture */}});
 page.on('request',r=>{if(r.url().includes('/api/')&&/publicacao|rascunho\/edicao|previa-micronutrientes\/confirmar/.test(r.url()))gravacoes++;});
 const regiao=await preparar(page);await regiao.getByLabel('Nome do alimento', {exact:true}).fill('Arroz');await regiao.getByRole('button',{name:'Consultar',exact:true}).click();
 if(modo==='selecao'){await expect(regiao.getByRole('button',{name:'Cancelar consulta',exact:true})).toBeVisible();await page.getByRole('button',{name:'Remover do cálculo',exact:true}).click();await expect(regiao).toHaveCount(0);liberar();await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);await page.getByRole('button',{name:'Adicionar',exact:true}).click();await expect(page.getByText('200 kcal',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Consultar alimentos por micronutriente',exact:true}).click();await expect(page.getByText('Arroz conhecido sintético',{exact:true})).toHaveCount(0);expect(pedidos).toHaveLength(1);}
 else if(modo==='tardio'||modo==='cancelar'){
  await expect(regiao.getByRole('button',{name:'Cancelar consulta',exact:true})).toBeVisible();
  if(modo==='tardio')await regiao.getByLabel('Nome do alimento',{exact:true}).fill('Feijão');else await regiao.getByRole('button',{name:'Cancelar consulta',exact:true}).click();liberar();
  await expect(regiao.getByText('Arroz conhecido sintético',{exact:true})).toHaveCount(0);await expect(regiao.getByRole('button',{name:'Consultar',exact:true})).toBeEnabled();
  if(modo==='tardio'){await regiao.getByRole('button',{name:'Consultar',exact:true}).click();await expect(regiao.getByText('Arroz conhecido sintético',{exact:true})).toBeVisible();expect(pedidos[1].busca).toBe('Feijão');}
 }else if(modo==='vazio'){await expect(regiao.getByText('Nenhum alimento encontrado nesta página com os filtros informados.',{exact:true})).toBeVisible();}
 else if(modo==='pequeno'){await expect(regiao.getByRole('row',{name:/Arroz muito pequeno/})).toContainText('Positivo abaixo da precisão de cálculo');}
 else{
  if(modo==='erro'){await expect(regiao.getByRole('alert')).toContainText('Não foi possível consultar');await expect(regiao).not.toContainText('CANARIO_PRIVADO');await regiao.getByRole('button',{name:'Consultar',exact:true}).click();}
  await expect(regiao.getByText('Arroz conhecido sintético',{exact:true})).toBeVisible();
  if(modo==='revogado'||modo==='sessao'){await regiao.getByRole('button',{name:'Próxima página de alimentos',exact:true}).click();await expect(page.getByText('Arroz conhecido sintético',{exact:true})).toHaveCount(0);await expect(page.locator('body')).not.toContainText('CANARIO_PRIVADO');}
  if(modo==='filtro'){await regiao.getByLabel('Porção comum (g)',{exact:true}).fill('1,5');await expect(regiao.getByText('Arroz conhecido sintético',{exact:true})).toHaveCount(0);await regiao.getByRole('combobox',{name:'Fonte de composição',exact:true}).selectOption('taco_nepa_unicamp');await regiao.getByRole('button',{name:'Consultar',exact:true}).click();await expect(regiao.getByText('Arroz conhecido sintético',{exact:true})).toBeVisible();expect(pedidos[1]).toMatchObject({porcaoGramas:1.5,fonteCodigo:'taco_nepa_unicamp',pagina:1});await regiao.getByLabel('Porção comum (g)',{exact:true}).fill('0');await regiao.getByRole('button',{name:'Consultar',exact:true}).click();await expect(regiao.getByRole('alert')).toContainText('0,001');expect(pedidos).toHaveLength(2);}
  if(modo==='normal'){
   await expect(regiao.getByRole('row',{name:/Arroz zero sintético/})).toContainText('0 mg');await expect(regiao.getByRole('row',{name:/Arroz sem composição/})).toContainText('Composição ausente');await expect(regiao.getByRole('row',{name:/Arroz traço sintético/})).toContainText('Traço sem quantidade determinada');await expect(regiao.getByRole('row',{name:/Arroz com unidade incompatível/})).toContainText('Unidade incompatível');await expect(regiao).toContainText('Teor ordenado somente entre os alimentos desta página');await expect(regiao).toContainText('50 g');
   expect((await new AxeBuilder({page}).include('[aria-label="Consulta de composição do catálogo"]').analyze()).violations).toEqual([]);
   await regiao.getByRole('button',{name:'Próxima página de alimentos',exact:true}).focus();await page.keyboard.press('Enter');await expect(regiao.getByText('Arroz da segunda página',{exact:true})).toBeVisible();await expect(regiao.getByText('Arroz conhecido sintético',{exact:true})).toHaveCount(0);await expect(regiao.getByRole('button',{name:'Próxima página de alimentos',exact:true})).toBeDisabled();await regiao.getByRole('button',{name:'Página anterior de alimentos',exact:true}).click();await expect(regiao.getByText('Arroz conhecido sintético',{exact:true})).toBeVisible();
   await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);const tabela=regiao.getByRole('region',{name:'Tabela de composição dos alimentos, role horizontalmente se necessário',exact:true});await tabela.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>tabela.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);await regiao.screenshot({path:info.outputPath('consulta-teor.png')});
  }
 }
 expect(gravacoes).toBe(0);for(const pedido of pedidos){expect(pedido).not.toHaveProperty('pacienteId');expect(pedido).not.toHaveProperty('tenantId');}
});
