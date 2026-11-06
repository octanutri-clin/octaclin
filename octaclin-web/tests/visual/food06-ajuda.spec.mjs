import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {prepararPrevia,previaFactual} from './fixtures/food06-previa.mjs';
import {ajudaSintetica} from '../../scripts/fixtures/ajuda-dietetica.ts';
test('M09 prévia oferece explicações por teclado e fontes sem enviar contexto externo',async({page},testInfo)=>{
 const c=await prepararPrevia(page);let externas=0;
 await page.route('https://ods.od.nih.gov/**',async r=>{externas++;await r.abort();});
 await page.route(u=>u.pathname.endsWith('/rascunho/previa-micronutrientes'),r=>r.fulfill({status:200,json:{...previaFactual(r.request().postDataJSON()),ajuda:ajudaSintetica()}}));
 await page.getByRole('button',{name:'Simular alteração de Alimento sintético',exact:true}).click();const modal=page.getByRole('dialog',{name:'Simular alteração alimentar',exact:true});
 await modal.getByLabel('Peso proposto (g)',{exact:true}).fill('150');await modal.getByRole('button',{name:'Calcular prévia',exact:true}).click();
 await expect(modal.getByRole('row',{name:/Ferro/})).toBeVisible();
 const ajuda=modal.getByText('Como interpretar estes valores',{exact:true});await ajuda.focus();await page.keyboard.press('Enter');
 await modal.getByText('Ingestão recomendada (RDA)',{exact:true}).click();await expect(modal).toContainText('não comprova deficiência');
 const fonte=modal.getByRole('link',{name:'NIH ODS — Nutrient Recommendations',exact:true});await expect(fonte).toHaveAttribute('href','https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx');await expect(fonte).toHaveAttribute('rel',/noreferrer/);await expect(fonte).toHaveAttribute('referrerpolicy','no-referrer');
 expect(externas).toBe(0);expect(c.confirmacoes).toHaveLength(0);expect(c.saves).toHaveLength(0);
 expect((await new AxeBuilder({page}).include('[role="dialog"]').analyze()).violations).toEqual([]);
 await modal.screenshot({path:`/tmp/food06-m09-${testInfo.project.name}.png`});
 await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);
});

async function prepararTabela(page,invalida=false){
 const {prepararConsole,pacienteId,planoIds,idsRefeicoes,resultado}=await import('./fixtures/console-pa06.mjs');
 const {CAMPOS_MICRONUTRIENTES_PLANO}=await import('../../lib/micronutrientes-plano.ts');
 await prepararConsole(page);
 await page.route(u=>u.pathname.endsWith('/selecao-calculo'),r=>r.fulfill({status:200,json:{planoId:planoIds[0],ativoParaPaciente:true,ativacaoRevisao:1,versao:{id:'versao-a',numero:1,publicadaEm:'2026-10-15T12:00:00Z'},refeicoes:[{identidadeId:idsRefeicoes[0],nome:'Refeição A',ordem:0,ativa:true}]}}));
 await page.route(u=>u.pathname.endsWith('/calculo-combinado'),r=>r.fulfill({status:200,json:resultado(2)}));
 await page.route(u=>u.pathname.endsWith('/analise-micronutrientes'),r=>{
  const p=r.request().postDataJSON(),ajuda=ajudaSintetica();if(invalida)ajuda.fontes[0].url='https://example.invalid/?paciente=CANARIO_PRIVADO';
  return r.fulfill({status:200,json:{schemaVersao:1,motorVersao:'food06-factual-v1',calculadoEm:'2026-11-02T12:00:00Z',publicacoes:p.selecoes.map(s=>({planoId:s.planoId,versaoId:s.versaoIdEsperada,ativacaoRevisao:s.ativacaoRevisaoEsperada})),comparacoes:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},ajuda,cobertura:{schemaVersao:1,nutrientes:Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,{codigo:c.codigo,unidade:c.unidade,estado:c.codigo==='calcioMg'?'COMPLETO':'DESCONHECIDO',...(c.codigo==='calcioMg'?{total:0}:{}),contagens:{incluidos:2,conhecidos:c.codigo==='calcioMg'?2:0,semComposicao:c.codigo==='calcioMg'?0:2,incompativeis:0,naoResolvidos:0},causas:c.codigo==='calcioMg'?[]:[{codigo:'ausente',quantidade:2}]}]))}}});
 });
 await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`,{waitUntil:'domcontentloaded'});
 await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);await page.getByRole('button',{name:'Adicionar',exact:true}).click();
 await page.getByRole('button',{name:'Ver micronutrientes e cobertura',exact:true}).click();
 return page.getByRole('region',{name:'Micronutrientes da seleção',exact:true});
}
test('M09 tabela mostra limites RDA AI UL e composição parcial sem ativar referência',async({page})=>{
 const r=await prepararTabela(page);await expect(r.getByRole('row',{name:/Cálcio/})).toContainText('0 mg');
 const summary=r.getByText('Como interpretar estes valores',{exact:true});await summary.focus();await page.keyboard.press('Enter');
 for(const [titulo,texto] of [['Ingestão adequada (AI)','não permite concluir inadequação'],['Limite superior (UL)','não garante segurança individual'],['Dados parciais e desconhecidos','total real desconhecido']]){
  const topico=r.getByText(titulo,{exact:true});await topico.focus();await page.keyboard.press('Enter');await expect(r).toContainText(texto);
 }
 await expect(r).toContainText('permanecem indisponíveis');
 expect((await new AxeBuilder({page}).include('[aria-label="Micronutrientes da seleção"]').analyze()).violations).toEqual([]);
 await page.locator('html').evaluate(e=>{e.style.fontSize='200%';});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('M09 ajuda inválida não apaga zero conhecido nem expõe href ou conteúdo estranho',async({page})=>{
 const r=await prepararTabela(page,true);await expect(r.getByRole('row',{name:/Cálcio/})).toContainText('0 mg');
 await expect(r).toContainText('O conteúdo de ajuda está indisponível');await expect(r.getByRole('link',{name:/NIH/})).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('CANARIO_PRIVADO');await expect(page.locator('a[href*="example.invalid"]')).toHaveCount(0);
});
test('M09 resposta legada sem ajuda mantém prévia e não apresenta guia inventado',async({page})=>{
 await prepararPrevia(page);
 await page.route(u=>u.pathname.endsWith('/rascunho/previa-micronutrientes'),r=>{const p=previaFactual(r.request().postDataJSON());delete p.ajuda;return r.fulfill({status:200,json:p});});
 await page.getByRole('button',{name:'Simular alteração de Alimento sintético',exact:true}).click();const modal=page.getByRole('dialog',{name:'Simular alteração alimentar'});
 await modal.getByLabel('Peso proposto (g)',{exact:true}).fill('150');await modal.getByRole('button',{name:'Calcular prévia',exact:true}).click();
 await expect(modal.getByRole('row',{name:/Ferro/})).toContainText('3');await expect(modal.getByText('Como interpretar estes valores',{exact:true})).toHaveCount(0);
 await expect(modal.getByRole('button',{name:'Confirmar alteração no rascunho',exact:true})).toBeEnabled();
});
