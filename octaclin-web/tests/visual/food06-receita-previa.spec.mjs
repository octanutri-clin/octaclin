import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {prepararReceitaPrevia,abrirReceita,receitaId} from './fixtures/food06-receita-previa.mjs';
test('M04 receita compara antes/depois sem gravar e cancelar mantém o plano',async({page},testInfo)=>{
 const c=await prepararReceitaPrevia(page),modal=await abrirReceita(page);
 await modal.getByRole('button',{name:'Calcular impacto no rascunho',exact:true}).click();
 await expect(modal.getByRole('row',{name:/Ferro/})).toContainText('5');
 await expect(modal).toContainText('total desconhecido');
 expect(c.pedidos).toHaveLength(1);expect(c.confirmacoes).toHaveLength(0);expect(c.saves).toHaveLength(0);
 expect(c.pedidos[0].operacao).toEqual({tipo:'inserir_receita',refeicaoChave:'r-sintetica',receitaId,receitaVersaoEsperada:3,porcoesDesejadas:1.5});
 await modal.screenshot({path:`/tmp/food06-receita-ui-${testInfo.project.name}-topo.png`});
 await modal.getByRole('button',{name:'Confirmar impacto e inserir no rascunho',exact:true}).scrollIntoViewIfNeeded();
 await modal.screenshot({path:`/tmp/food06-receita-ui-${testInfo.project.name}-acao.png`});
 expect((await new AxeBuilder({page}).include('[role="dialog"]').analyze()).violations).toEqual([]);
 const regiao=modal.getByRole('region',{name:'Comparação nutricional da proposta',exact:true});
 if(testInfo.project.name==='mobile-chromium'){
  await regiao.focus();await page.keyboard.press('ArrowRight');
  await expect.poll(()=>regiao.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 }
 await page.locator('html').evaluate(el=>{el.style.fontSize='200%';});
 await modal.getByRole('button',{name:'Confirmar impacto e inserir no rascunho',exact:true}).scrollIntoViewIfNeeded();
 await expect(modal.getByRole('button',{name:'Confirmar impacto e inserir no rascunho',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.locator('html').evaluate(el=>{el.style.fontSize='';});
 await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);expect(c.detalhe.draft.documentoEdicao.refeicoes[0].itens).toHaveLength(1);
});
test('M04 receita confirma uma vez e o autosave usa a revisão recebida',async({page})=>{
 await page.clock.install();const c=await prepararReceitaPrevia(page),modal=await abrirReceita(page);
 await modal.getByRole('button',{name:'Calcular impacto no rascunho',exact:true}).click();await expect(modal.getByRole('row',{name:/Ferro/})).toBeVisible();
 await modal.getByRole('button',{name:'Confirmar impacto e inserir no rascunho',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(c.confirmacoes).toHaveLength(1);expect(c.detalhe.draft.documentoEdicao.refeicoes[0].itens).toHaveLength(2);expect(c.saves).toHaveLength(0);
 await page.getByRole('button',{name:/Expandir refeição/}).first().click();
 await page.getByLabel(/Por[cç][aã]o \(g\)/).first().fill('200');await page.clock.fastForward(61_000);
 await expect.poll(()=>c.saves.length).toBe(1);expect(c.saves[0].rascunhoRevisaoEsperada).toBe(2);
});
test('M04 receita conflito não reaplica nem expõe mensagem interna',async({page})=>{
 const c=await prepararReceitaPrevia(page);c.falhar(409);const modal=await abrirReceita(page);
 await modal.getByRole('button',{name:'Calcular impacto no rascunho',exact:true}).click();await expect(modal.getByRole('row',{name:/Ferro/})).toBeVisible();
 await modal.getByRole('button',{name:'Confirmar impacto e inserir no rascunho',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:/Não foi possível confirmar/})).toBeVisible();
 expect(c.confirmacoes).toHaveLength(1);expect(c.saves).toHaveLength(0);expect(c.detalhe.draft.documentoEdicao.refeicoes[0].itens).toHaveLength(1);
 await expect(page.locator('body')).not.toContainText('CANARIO_PRIVADO');
});
test('M04 receita cancelar durante prévia descarta resposta tardia',async({page})=>{
 const c=await prepararReceitaPrevia(page);let liberar,iniciar;const iniciou=new Promise(r=>iniciar=r),barreira=new Promise(r=>liberar=r);
 await page.route(u=>u.pathname.endsWith('/rascunho/previa-micronutrientes'),async r=>{iniciar();await barreira;try{await r.fallback();}catch{/* consulta cancelada */}});
 const modal=await abrirReceita(page);await modal.getByRole('button',{name:'Calcular impacto no rascunho',exact:true}).click();await iniciou;
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();liberar();
 await expect(modal).toHaveCount(0);expect(c.confirmacoes).toHaveLength(0);expect(c.saves).toHaveLength(0);
 await expect(page.getByRole('button',{name:'Confirmar impacto e inserir no rascunho'})).toHaveCount(0);
});
test('M04 receita descartar comparação mantém o fluxo legado de inserção local',async({page})=>{
 const c=await prepararReceitaPrevia(page),modal=await abrirReceita(page);
 await modal.getByRole('button',{name:'Calcular impacto no rascunho',exact:true}).click();await expect(modal.getByRole('row',{name:/Ferro/})).toBeVisible();
 await expect(modal.getByRole('button',{name:'Confirmar e inserir',exact:true})).toBeDisabled();
 await modal.getByRole('button',{name:'Descartar comparação',exact:true}).click();
 await modal.getByRole('button',{name:'Confirmar e inserir',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(c.confirmacoes).toHaveLength(0);expect(c.saves).toHaveLength(0);expect(c.detalhe.draft.documentoEdicao.refeicoes[0].itens).toHaveLength(1);
 await expect(page.getByLabel(/Por[cç][aã]o \(g\)/)).toHaveCount(2);
});
test('M04 receita PA07 aguarda ACK antes de transferir a edição',async({page,context})=>{
 const c=await prepararReceitaPrevia(page);let liberar,iniciar;const iniciou=new Promise(r=>iniciar=r),barreira=new Promise(r=>liberar=r);
 await page.route(u=>u.pathname.endsWith('/previa-micronutrientes/confirmar'),async r=>{iniciar();await barreira;await r.fallback();});
 const segunda=await context.newPage();await prepararReceitaPrevia(segunda,c);await segunda.getByRole('button',{name:'Expandir todas',exact:true}).click();
 const modal=await abrirReceita(page);await modal.getByRole('button',{name:'Calcular impacto no rascunho',exact:true}).click();await expect(modal.getByRole('row',{name:/Ferro/})).toBeVisible();
 await modal.getByRole('button',{name:'Confirmar impacto e inserir no rascunho',exact:true}).click();await iniciou;
 try{
  await segunda.getByRole('button',{name:'Editar nesta aba',exact:true}).click();
  await expect(segunda.locator('[data-pa07-aviso]')).toContainText('Aguardando a outra aba');
  await expect(segunda.getByRole('button',{name:'Adicionar alimento',exact:true}).first()).toBeDisabled();
  await expect(modal.getByRole('button',{name:'Cancelar',exact:true})).toBeDisabled();
  liberar();await expect(segunda.getByRole('button',{name:'Editar nesta aba',exact:true})).toHaveCount(0);
  await segunda.getByRole('button',{name:'Expandir todas',exact:true}).click();
  await expect(segunda.getByLabel(/Por[cç][aã]o \(g\)/).last()).toHaveValue('150');expect(c.confirmacoes).toHaveLength(1);
 }finally{liberar();await segunda.close();}
});
