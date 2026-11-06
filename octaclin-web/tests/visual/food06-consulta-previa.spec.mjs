import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {prepararPrevia} from './fixtures/food06-previa.mjs';
import {respostaConsultaTeor} from './fixtures/food06-consulta-teor.mjs';
const nome='Arroz conhecido sintético';
for(const modo of ['cancelar','confirmar','editar','conflito','indisponivel','tardio','posse'])test(`M11 seleção factual alimenta somente proposta M04: ${modo}`,async({page,context},testInfo)=>{
 const c=await prepararPrevia(page);let liberar,sinalizar;const inicio=new Promise(r=>sinalizar=r),barreira=new Promise(r=>liberar=r);let consultas=0;
 await page.route(u=>u.pathname.endsWith('/catalogo/teor-micronutriente/consulta'),async r=>{consultas++;const p=r.request().postDataJSON();sinalizar();if(modo==='tardio')await barreira;try{return await r.fulfill({status:200,json:respostaConsultaTeor(p)});}catch{/* consulta cancelada pelo cliente */}});
 if(modo==='indisponivel')await page.route(u=>u.pathname.endsWith('/rascunho/previa-micronutrientes'),r=>r.fulfill({status:422,json:{message:'CANARIO_COMPOSIÇÃO'}}));
 if(modo==='conflito')c.falhar(409);
 if(modo==='confirmar')await page.route(u=>u.pathname.endsWith('/previa-micronutrientes/confirmar'),r=>{const p=r.request().postDataJSON();c.confirmacoes.push(p);const d=c.detalhe.draft,alvo=d.documentoEdicao.refeicoes[0].itens[0];d.rascunhoRevisao++;Object.assign(alvo,{quantidade:75,unidade:'g',porcaoGramas:75,alimentoComposicaoId:p.operacao.alimentoComposicaoId,descricao:nome});return r.fulfill({status:200,json:d});});
 await page.getByRole('button',{name:'Simular alteração de Alimento sintético',exact:true}).click();const modal=page.getByRole('dialog',{name:'Simular alteração alimentar',exact:true});await modal.getByLabel('Operação',{exact:true}).selectOption('substituir_catalogo');
 await modal.getByRole('button',{name:'Consultar alimentos por micronutriente',exact:true}).click();const consulta=modal.getByRole('region',{name:'Consulta de composição do catálogo',exact:true});await consulta.getByLabel('Nome do alimento',{exact:true}).fill('Arroz');await consulta.getByLabel('Porção comum (g)',{exact:true}).fill('75');await consulta.getByLabel('Porção comum (g)',{exact:true}).press('Enter');
 if(modo==='tardio'){await inicio;await modal.getByRole('button',{name:'Cancelar',exact:true}).click();liberar();await expect(modal).toHaveCount(0);await expect(page.getByText(nome,{exact:true})).toHaveCount(0);expect(c.pedidos).toHaveLength(0);expect(c.confirmacoes).toHaveLength(0);return;}
 await expect(consulta.getByRole('button',{name:'Usar 75 g na prévia de Arroz sem composição',exact:true})).toBeDisabled();
 await consulta.getByRole('button',{name:`Usar 75 g na prévia de ${nome}`,exact:true}).click();
 await expect(modal.getByLabel('Peso proposto (g)',{exact:true})).toBeFocused();
 await expect(modal.getByLabel('Quantidade proposta',{exact:true})).toHaveValue('75');await expect(modal.getByLabel('Peso proposto (g)',{exact:true})).toHaveValue('75');await expect(modal.getByLabel('Unidade proposta',{exact:true})).toHaveValue('g');await expect(modal).toContainText('Consulta usada para preencher a proposta');await expect(modal).toContainText('sintetica-v1');expect(c.pedidos).toHaveLength(0);expect(c.confirmacoes).toHaveLength(0);expect(c.saves).toHaveLength(0);if(modo==='cancelar')await modal.screenshot({path:testInfo.outputPath('food06-m11-selecao.png')});
 if(modo==='posse'){
  const segunda=await context.newPage();await prepararPrevia(segunda,c);await segunda.getByRole('button',{name:'Editar nesta aba',exact:true}).click();await expect(page.locator('[data-pa07-aviso]')).toBeVisible();await expect(modal).toHaveCount(0);expect(c.pedidos).toHaveLength(0);expect(c.confirmacoes).toHaveLength(0);await segunda.close();return;
 }
 await modal.getByRole('button',{name:'Calcular prévia',exact:true}).click();
 if(modo==='indisponivel'){await expect(modal.getByRole('alert')).toContainText('Não foi possível conferir a prévia');await expect(modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true})).toHaveCount(0);await expect(modal.getByLabel('Peso proposto (g)',{exact:true})).toHaveValue('75');await expect(modal).not.toContainText('CANARIO_COMPOSIÇÃO');expect(c.confirmacoes).toHaveLength(0);return;}
 await expect(modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true})).toBeVisible();expect(c.pedidos).toHaveLength(1);expect(c.pedidos[0].operacao).toEqual({tipo:'substituir_catalogo',refeicaoChave:'r-sintetica',itemChave:'i-sintetico',quantidade:75,unidade:'g',porcaoGramas:75,alimentoComposicaoId:'30000000-0000-4000-8000-000000000001'});expect(c.saves).toHaveLength(0);
 if(modo==='editar'){await modal.getByLabel('Peso proposto (g)',{exact:true}).fill('80');await expect(modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true})).toHaveCount(0);await expect(modal.getByText(/Consulta usada para preencher a proposta/)).toHaveCount(0);expect(c.confirmacoes).toHaveLength(0);}
 else if(modo==='confirmar'||modo==='conflito'){
  await modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true}).click();expect(c.confirmacoes).toHaveLength(1);expect(c.confirmacoes[0].fingerprintEsperado).toBe('a'.repeat(64));
  if(modo==='confirmar'){await expect(modal).toHaveCount(0);await expect(page.getByLabel(/Por[cç][aã]o \(g\)/).first()).toHaveValue('75');await expect(page.getByLabel('Unidade',{exact:true}).first()).toHaveValue('g');}
  else{await expect(page.getByRole('alert').filter({hasText:/Não foi possível confirmar/})).toBeVisible();await expect(page.locator('body')).not.toContainText('CANARIO_PRIVADO');}
 }else{
  expect((await new AxeBuilder({page}).include('[role="dialog"]').analyze()).violations).toEqual([]);await modal.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(modal).toHaveCount(0);expect(c.confirmacoes).toHaveLength(0);await expect(page.getByLabel(/Por[cç][aã]o \(g\)/).first()).toHaveValue('100');
 }
 expect(consultas).toBe(1);
});
