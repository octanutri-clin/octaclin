import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {prepararPrevia} from './fixtures/food06-previa.mjs';
test('M04 prévia mostra antes/depois sem gravar, cancelar conserva o editor e atende teclado',async({page},testInfo)=>{
 const c=await prepararPrevia(page);
 const botao=page.getByRole('button',{name:'Simular alteração de Alimento sintético',exact:true});
 await botao.click();const modal=page.getByRole('dialog',{name:'Simular alteração alimentar',exact:true});
 await modal.getByLabel('Peso proposto (g)',{exact:true}).fill('150');await modal.getByLabel('Quantidade proposta',{exact:true}).fill('1,5');
 await modal.getByRole('button',{name:'Calcular prévia',exact:true}).click();
 await expect(modal.getByRole('row',{name:/Ferro/})).toContainText('3');await expect(modal).toContainText('Desconhecido');
 expect(c.pedidos).toHaveLength(1);expect(c.confirmacoes).toHaveLength(0);expect(c.saves).toHaveLength(0);
 await modal.screenshot({path:testInfo.outputPath('food06-m04-previa.png')});
 expect((await new AxeBuilder({page}).include('[role="dialog"]').analyze()).violations).toEqual([]);
 await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);await expect(botao).toBeFocused();expect(c.confirmacoes).toHaveLength(0);
});
test('M04 confirmação exige revisão válida e mantém autosave de sessenta segundos após ACK',async({page})=>{
 await page.clock.install();const c=await prepararPrevia(page);
 await page.getByRole('button',{name:'Simular alteração de Alimento sintético',exact:true}).click();const modal=page.getByRole('dialog',{name:'Simular alteração alimentar'});
 await modal.getByLabel('Peso proposto (g)',{exact:true}).fill('150');await modal.getByLabel('Quantidade proposta',{exact:true}).fill('1,5');
 await modal.getByRole('button',{name:'Calcular prévia',exact:true}).click();await expect(modal.getByRole('row',{name:/Ferro/})).toContainText('3');
 await modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(c.confirmacoes).toHaveLength(1);expect(c.confirmacoes[0].rascunhoRevisaoEsperada).toBe(1);expect(c.saves).toHaveLength(0);
 const peso=page.getByLabel(/Por[cç][aã]o \(g\)/).first();await expect(peso).toHaveValue('150');
 await peso.fill('200');await page.clock.fastForward(59_000);expect(c.saves).toHaveLength(0);await page.clock.fastForward(2_000);
 await expect.poll(()=>c.saves.length).toBe(1);expect(c.saves[0].rascunhoRevisaoEsperada).toBe(2);
});
test('M04 conflito na confirmação mantém campos locais e não faz retry ou autosave cego',async({page})=>{
 const c=await prepararPrevia(page);c.falhar(409);
 await page.getByRole('button',{name:'Simular alteração de Alimento sintético',exact:true}).click();const modal=page.getByRole('dialog',{name:'Simular alteração alimentar'});
 await modal.getByLabel('Peso proposto (g)',{exact:true}).fill('150');await modal.getByRole('button',{name:'Calcular prévia',exact:true}).click();await expect(modal.getByRole('row',{name:/Ferro/})).toBeVisible();
 await modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:/Não foi possível confirmar/})).toBeVisible();
 expect(c.confirmacoes).toHaveLength(1);expect(c.saves).toHaveLength(0);await expect(page.locator('body')).not.toContainText('CANARIO_PRIVADO');
});
test('M04 PA07 aguarda a confirmação em voo antes de transferir a edição',async({page,context})=>{
 const c=await prepararPrevia(page);let liberar,sinalizar;const iniciou=new Promise(r=>sinalizar=r),barreira=new Promise(r=>liberar=r);
 await page.route(u=>u.pathname.endsWith('/previa-micronutrientes/confirmar'),async r=>{
  const p=r.request().postDataJSON();sinalizar();await barreira;
  c.detalhe.draft.rascunhoRevisao++;c.detalhe.draft.documentoEdicao.refeicoes[0].itens[0].porcaoGramas=p.operacao.porcaoGramas;
  try{await r.fulfill({status:200,json:c.detalhe.draft});}catch{/* Cancelar transporte não reverte comando recebido. */}
 });
 const segunda=await context.newPage();await prepararPrevia(segunda,c);
 await page.getByRole('button',{name:'Simular alteração de Alimento sintético',exact:true}).click();const modal=page.getByRole('dialog',{name:'Simular alteração alimentar'});
 await modal.getByLabel('Peso proposto (g)',{exact:true}).fill('150');await modal.getByRole('button',{name:'Calcular prévia',exact:true}).click();await expect(modal.getByRole('row',{name:/Ferro/})).toBeVisible();
 await modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true}).click();await iniciou;
 try{
  await segunda.getByRole('button',{name:'Editar nesta aba',exact:true}).click();
  await expect(segunda.locator('[data-pa07-aviso]')).toContainText('Aguardando a outra aba');
  await expect(segunda.getByRole('button',{name:'Adicionar alimento',exact:true}).first()).toBeDisabled();
 }finally{liberar();}
 await expect(segunda.locator('[data-pa07-aviso]')).toHaveCount(0);
 await segunda.getByRole('button',{name:'Expandir todas',exact:true}).click();
 await expect(segunda.getByLabel(/Por[cç][aã]o \(g\)/).first()).toHaveValue('150');
});
test('M04 cancelar prévia em voo impede resposta tardia de restaurar dados',async({page})=>{
 const c=await prepararPrevia(page);let liberar,sinalizar;const iniciou=new Promise(r=>sinalizar=r),barreira=new Promise(r=>liberar=r);
 await page.route(u=>u.pathname.endsWith('/previa-micronutrientes'),async r=>{sinalizar();await barreira;try{await r.fulfill({status:200,json:{contextoClinico:'CANARIO_PRIVADO'}});}catch{/* Leitura cancelada. */}});
 await page.getByRole('button',{name:'Simular alteração de Alimento sintético',exact:true}).click();const modal=page.getByRole('dialog',{name:'Simular alteração alimentar'});
 await modal.getByRole('button',{name:'Calcular prévia',exact:true}).click();await iniciou;await modal.getByRole('button',{name:'Cancelar',exact:true}).click();liberar();
 await expect(modal).toHaveCount(0);await expect(page.locator('body')).not.toContainText('CANARIO_PRIVADO');expect(c.confirmacoes).toHaveLength(0);expect(c.saves).toHaveLength(0);
});
test('M04 trocar catálogo mantém destino/preparo explícitos e exige nova prévia após editar',async({page})=>{
 const c=await prepararPrevia(page);
 await page.route(u=>u.pathname.endsWith('/planos-alimentares/alimentos'),r=>r.fulfill({status:200,json:{itens:[{id:'10000000-0000-4000-8000-000000000001',nome:'Arroz sintético',preparacao:'Cozido',disponivelParaCalculo:true,fonte:{codigo:'sintetica',nome:'Fonte sintética',versao:'1'},nutrientesPor100g:{energiaKcal:100}}],fontes:[],total:1,pagina:1,limite:20}}));
 await page.getByRole('button',{name:'Simular alteração de Alimento sintético',exact:true}).click();const modal=page.getByRole('dialog',{name:'Simular alteração alimentar'});
 await modal.getByLabel('Operação',{exact:true}).selectOption('substituir_catalogo');await modal.getByLabel('Buscar alimento de destino',{exact:true}).fill('Arroz');await modal.getByRole('button',{name:/Arroz sintético · Cozido/}).click();
 await modal.getByRole('button',{name:'Calcular prévia',exact:true}).click();await expect(modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true})).toBeVisible();
 expect(c.pedidos[0].operacao).toMatchObject({tipo:'substituir_catalogo',alimentoComposicaoId:'10000000-0000-4000-8000-000000000001'});
 await modal.getByLabel('Peso proposto (g)',{exact:true}).fill('175');await expect(modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true})).toHaveCount(0);expect(c.confirmacoes).toHaveLength(0);
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();expect(c.saves).toHaveLength(0);
});
