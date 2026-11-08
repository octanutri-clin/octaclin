import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {pacienteId,planoIds,idsRefeicoes,resultado,prepararConsole} from './fixtures/console-pa06.mjs';
import {CAMPOS_MICRONUTRIENTES_PLANO} from '../../lib/micronutrientes-plano.ts';
const id='20000000-0000-4000-8000-000000000096';
const contexto={schemaVersao:1,dataAnalise:'2026-11-06',idadeAnos:36,populacaoReferencia:'feminina',mesmoDiaPlanejado:false,tabagismo:'nao_informado',motivos:[]};
function registro(){return {schemaVersao:1,registro:{id,criadoEm:'2026-11-06T12:00:00.000Z'},origem:{planoId:planoIds[0],versaoId:'versao-a',numero:1,status:'publicada',registradaEm:'2026-10-15T12:00:00.000Z'},motorVersao:'food06-v1',referencias:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'},bases:{planejamentoDocumentado:true,composicaoDocumentada:true,contextoDocumentado:true},comparacaoAnterior:{planejamento:'SEM_REGISTRO_ANTERIOR',composicaoFonte:'SEM_REGISTRO_ANTERIOR',referencia:'SEM_REGISTRO_ANTERIOR',contexto:'SEM_REGISTRO_ANTERIOR',cobertura:Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,'SEM_REGISTRO_ANTERIOR']))},nutrientes:Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,{codigo:c.codigo,unidade:c.unidade,estado:c.codigo==='ferroMg'?'COMPLETO':'DESCONHECIDO',...(c.codigo==='ferroMg'?{total:0}:{}),contagens:{incluidos:2,conhecidos:c.codigo==='ferroMg'?2:0,semComposicao:c.codigo==='ferroMg'?0:2,incompativeis:0,naoResolvidos:0},causas:c.codigo==='ferroMg'?[]:[{codigo:'ausente',quantidade:2}]}]))};}
function relatorio(){const r=registro();return {schemaVersao:2,motorVersao:'food06-relatorio-factual-v2',geradoEm:'2026-11-06T14:00:00.000Z',registro:r.registro,origem:r.origem,referencias:r.referencias,contextoClinico:{estado:'resumo_documentado',resumo:contexto},fontesComposicao:{estado:'nao_projetadas_neste_contrato'},avisos:[],limites:['alimentacao_planejada_nao_consumo_real','ausencia_nao_equivale_a_zero','sem_diagnostico_ou_recomendacao','composicao_congelada_sem_catalogo_atual'],selecao:{planoAtivo:true,planoSelecionado:true,refeicoes:[{identidadeId:idsRefeicoes[0],ativa:true,selecionada:true}]},analise:{calculo:{nutrientes:Object.fromEntries(['energiaKcal','proteinasG','carboidratosG','gordurasG'].map(c=>[c,{codigo:c,unidade:c==='energiaKcal'?'kcal':'g',estado:'completo',total:c==='energiaKcal'?200:10,itensIncluidos:2,itensComValor:2}]))},cobertura:{schemaVersao:1,nutrientes:r.nutrientes}}};}
for(const modo of ['normal','revogado','alterado','formato_invalido','pdf','legado','historico_revogado'])test(`FOOD06 contexto histórico e relatório versionado: ${modo}`,async({page},testInfo)=>{
 test.skip(modo==='pdf'&&process.env.FOOD06_PDF_REAL!=='true','PDF real opt-in exige pdftotext.');
 await prepararConsole(page);let chamadas=0,conferirImpressao=false;const pedidos=[],pedidosHistorico=[];
 await page.route(u=>u.pathname.endsWith('/selecao-calculo'),r=>r.fulfill({status:200,json:{planoId:planoIds[0],ativoParaPaciente:true,ativacaoRevisao:1,versao:{id:'versao-a',numero:1,publicadaEm:'2026-10-15T12:00:00.000Z'},refeicoes:[{identidadeId:idsRefeicoes[0],nome:'Refeição A',ordem:0,ativa:true}]}}));
 await page.route(u=>u.pathname.endsWith('/calculo-combinado'),r=>r.fulfill({status:200,json:resultado(2)}));
 await page.route(u=>u.pathname.endsWith('/analises-factuais/historico'),r=>{const body=r.request().postDataJSON();pedidosHistorico.push(body);if(modo==='historico_revogado'&&body.cursorId)return r.fulfill({status:401,json:{message:'CANARIO_PRIVADO'}});return r.fulfill({status:200,json:{schemaVersao:1,itens:[{...registro(),...(body.incluirContexto&&modo!=='legado'?{contextoConfirmado:contexto}:{})}],temMais:modo==='historico_revogado'&&!!body.incluirContexto,...(modo==='historico_revogado'&&body.incluirContexto?{proximoCursor:{id,criadoEm:'2026-11-06T12:00:00.000000Z'}}:{})}});});
 await page.route(u=>u.pathname.endsWith('/analises-factuais/relatorio'),r=>{pedidos.push(r.request().postDataJSON());chamadas++;if(modo==='revogado'&&conferirImpressao)return r.fulfill({status:403,json:{message:'CANARIO_PRIVADO'}});const p=relatorio();if(modo==='alterado'&&conferirImpressao)p.contextoClinico.resumo={...contexto,tabagismo:'sim'};if(modo==='formato_invalido'){p.schemaVersao=1;p.motorVersao='food06-relatorio-factual-v1';p.contextoClinico={estado:'nao_documentado_no_relatorio'};}return r.fulfill({status:200,json:p});});
 let textoPdf='',terminou=false;
 if(modo==='pdf'){const {execFileSync}=await import('node:child_process');await page.exposeFunction('__pdfContexto',async()=>{await page.pdf({path:testInfo.outputPath('relatorio-contextual.pdf'),format:'A4',tagged:true,printBackground:true});textoPdf=execFileSync('pdftotext',['-layout',testInfo.outputPath('relatorio-contextual.pdf'),'-'],{encoding:'utf8'});terminou=true;});}
 await page.addInitScript(pdf=>{window.print=async()=>{window.__impressaoContexto=(window.__impressaoContexto??0)+1;if(pdf)await window.__pdfContexto();window.dispatchEvent(new Event('afterprint'));};},modo==='pdf');
 await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`,{waitUntil:'domcontentloaded'});await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);await page.getByRole('button',{name:'Adicionar',exact:true}).click();await expect(page.getByText('200 kcal',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ver histórico de micronutrientes',exact:true}).click();await expect(page.getByRole('button',{name:'Conferir relatório da análise 1',exact:true})).toBeVisible();
 await page.getByRole('checkbox',{name:'Carregar contextos registrados',exact:true}).check();if(modo==='legado'){await expect(page.getByText('Há contexto registrado, mas seus detalhes não estão disponíveis nesta consulta.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Conferir relatório com contexto da análise 1',exact:true})).toHaveCount(0);await expect(page.getByText('Tabagismo: não informado',{exact:true})).toHaveCount(0);return;}const detalhes=page.getByRole('row',{name:/^Análise 1/}).getByText('Contexto registrado',{exact:true});await detalhes.focus();await page.keyboard.press('Enter');await expect(page.getByRole('row',{name:/^Análise 1/}).getByText('Contexto registrado nesta análise:',{exact:false})).toBeVisible();if(modo==='normal')expect((await new AxeBuilder({page}).include('[aria-label="Histórico de micronutrientes planejados"]').analyze()).violations).toEqual([]);await expect(page.getByRole('row',{name:/^Análise 1/})).toContainText('06/11/2026');if(modo==='historico_revogado'){await page.getByRole('button',{name:'Carregar registros anteriores',exact:true}).click();await expect(page.getByRole('row',{name:/^Análise 1/})).toHaveCount(0);await expect(page.getByText('Tabagismo: não informado',{exact:true})).toHaveCount(0);await expect(page.locator('body')).not.toContainText('CANARIO_PRIVADO');return;}
 await page.getByRole('button',{name:'Conferir relatório com contexto da análise 1',exact:true}).click();
 if(modo==='formato_invalido'){await expect(page.getByRole('alert').filter({hasText:'Não foi possível conferir o relatório autorizado.'})).toContainText('Não foi possível conferir o relatório');expect(await page.evaluate(()=>window.__impressaoContexto??0)).toBe(0);return;}
 const previa=page.getByRole('region',{name:'Prévia do relatório factual',exact:true});await expect(previa).toContainText('Contexto registrado nesta análise');await expect(previa).toContainText('06/11/2026');await expect(previa).toContainText('Tabagismo: não informado');await expect(previa).toContainText('não descreve necessariamente as condições atuais');
 if(modo==='normal'){expect((await new AxeBuilder({page}).include('[data-food06-exportacao]').analyze()).violations).toEqual([]);await previa.screenshot({path:testInfo.outputPath('contexto-relatorio.png')});}
 if(modo==='pdf')await page.evaluate(()=>{const outra=document.createElement('article');outra.className='folha-documento';outra.textContent='CANARIO_OUTRA_FOLHA';document.body.append(outra);});const antesImprimir=pedidos.length;conferirImpressao=true;await previa.getByRole('button',{name:'Imprimir / salvar PDF',exact:true}).click();
 if(modo==='revogado'||modo==='alterado'){await expect(previa).toHaveCount(0);if(modo==='revogado'){await expect(page.getByRole('alert').filter({hasText:'Não foi possível confirmar o acesso à seleção.'})).toBeVisible();await expect(page.getByText('Tabagismo: não informado',{exact:true})).toHaveCount(0);}else await expect(page.getByRole('alert').filter({hasText:'Não foi possível conferir o relatório autorizado.'})).toContainText('Nenhum conteúdo foi enviado à impressão');expect(await page.evaluate(()=>window.__impressaoContexto??0)).toBe(0);}else{await expect.poll(()=>page.evaluate(()=>window.__impressaoContexto??0)).toBe(1);if(modo==='pdf'){expect(terminou).toBe(true);expect(textoPdf).toContain('06/11/2026');expect(textoPdf).toContain('Contexto registrado nesta análise');expect(textoPdf).toContain('Tabagismo: não informado');expect(textoPdf).not.toContain('CANARIO_PRIVADO');expect(textoPdf).not.toContain('CANARIO_OUTRA_FOLHA');expect(textoPdf).not.toContain('Paciente sintético');expect(textoPdf).not.toContain('Imprimir / salvar PDF');}await previa.getByRole('button',{name:'Cancelar prévia',exact:true}).click();}
 expect(pedidos.length).toBe(antesImprimir+1);for(const pedido of pedidos)expect(pedido).toEqual({registroId:id,versaoRelatorio:2});expect(pedidosHistorico).toEqual([{limite:10},{limite:10,incluirContexto:true}]);
});

/* FOOD06 M01 — origem registrada por nutriente no relatório formato 2 (aditivo). */
test('FOOD06 M01 relatório formato 2 mostra a origem registrada por nutriente e a limitação, sem violações axe',async({page},testInfo)=>{
 await prepararConsole(page);
 await page.route(u=>u.pathname.endsWith('/selecao-calculo'),r=>r.fulfill({status:200,json:{planoId:planoIds[0],ativoParaPaciente:true,ativacaoRevisao:1,versao:{id:'versao-a',numero:1,publicadaEm:'2026-10-15T12:00:00.000Z'},refeicoes:[{identidadeId:idsRefeicoes[0],nome:'Refeição A',ordem:0,ativa:true}]}}));
 await page.route(u=>u.pathname.endsWith('/calculo-combinado'),r=>r.fulfill({status:200,json:resultado(2)}));
 await page.route(u=>u.pathname.endsWith('/analises-factuais/historico'),r=>{const body=r.request().postDataJSON();return r.fulfill({status:200,json:{schemaVersao:1,itens:[{...registro(),...(body.incluirContexto?{contextoConfirmado:contexto}:{})}],temMais:false}});});
 await page.route(u=>u.pathname.endsWith('/analises-factuais/relatorio'),r=>{
  const p=relatorio(),n=p.analise.cobertura.nutrientes;
  p.fontesPorNutriente={schemaVersao:1,vinculo:'origem_do_registro_de_composicao',nutrientes:Object.fromEntries(Object.entries(n).map(([codigo,v])=>[codigo,{contribuintes:v.contagens.conhecidos,fontes:codigo==='ferroMg'&&v.contagens.conhecidos?[{tipo:'manual',quantidade:v.contagens.conhecidos}]:[],semOrigemDocumentada:codigo==='ferroMg'?0:v.contagens.conhecidos,fontesNaoDetalhadas:0}]))};
  return r.fulfill({status:200,json:p});
 });
 const pdfReal=process.env.FOOD06_PDF_REAL==='true';let textoPdf='';
 if(pdfReal){const {execFileSync}=await import('node:child_process');await page.exposeFunction('__pdfOrigem',async()=>{await page.pdf({path:testInfo.outputPath('m01-origem.pdf'),format:'A4',tagged:true,printBackground:true});textoPdf=execFileSync('pdftotext',[testInfo.outputPath('m01-origem.pdf'),'-'],{encoding:'utf8'});});}
 await page.addInitScript(pdf=>{window.print=async()=>{window.__impressaoOrigem=(window.__impressaoOrigem??0)+1;if(pdf)await window.__pdfOrigem();window.dispatchEvent(new Event('afterprint'));};},pdfReal);
 await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`,{waitUntil:'domcontentloaded'});await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);await page.getByRole('button',{name:'Adicionar',exact:true}).click();await expect(page.getByText('200 kcal',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ver histórico de micronutrientes',exact:true}).click();await page.getByRole('checkbox',{name:'Carregar contextos registrados',exact:true}).check();
 const detalhes=page.getByRole('row',{name:/^Análise 1/}).getByText('Contexto registrado',{exact:true});await detalhes.focus();await page.keyboard.press('Enter');
 await page.getByRole('button',{name:'Conferir relatório com contexto da análise 1',exact:true}).click();
 const previa=page.getByRole('region',{name:'Prévia do relatório factual',exact:true});
 await expect(previa.getByRole('columnheader',{name:/^Origem registrada/})).toBeVisible();
 await expect(previa.getByRole('row',{name:/^Ferro /})).toContainText('0 mg');
 await expect(previa.getByRole('row',{name:/^Ferro /})).toContainText('Entrada manual · 2 alimentos');
 await expect(previa.getByRole('row',{name:/^Selênio /})).toContainText('Sem valor conhecido');
 await expect(previa).toContainText('Não comprova que a base mediu este nutriente nem indica confiança científica.');
 expect((await new AxeBuilder({page}).include('[data-food06-exportacao]').analyze()).violations).toEqual([]);
 await previa.screenshot({path:testInfo.outputPath('m01-relatorio-origem.png')});
 await previa.getByRole('button',{name:'Imprimir / salvar PDF',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__impressaoOrigem??0)).toBe(1);
 if(pdfReal){await expect.poll(()=>textoPdf.length).toBeGreaterThan(0);const t=textoPdf.replace(/\s+/g,' ');expect(t).toContain('Origem registrada');expect(t).toContain('do registro de composição; não prova medição');expect(t).toContain('Entrada manual');/* pdftotext intercala linhas quebradas de células vizinhas: conta o prefixo, não a frase inteira. */expect((t.match(/Sem valor/g)??[]).length).toBe(21);expect(t).toContain('Não comprova que a base mediu este nutriente');expect(t).toContain('0 mg');}
});

/* FOOD06 M01 — NUX06/NUX07: origem ausente no relatório e PDF com 50 grupos de fonte. */
async function abrirRelatorioM01(page,montar){
 await prepararConsole(page);
 await page.route(u=>u.pathname.endsWith('/selecao-calculo'),r=>r.fulfill({status:200,json:{planoId:planoIds[0],ativoParaPaciente:true,ativacaoRevisao:1,versao:{id:'versao-a',numero:1,publicadaEm:'2026-10-15T12:00:00.000Z'},refeicoes:[{identidadeId:idsRefeicoes[0],nome:'Refeição A',ordem:0,ativa:true}]}}));
 await page.route(u=>u.pathname.endsWith('/calculo-combinado'),r=>r.fulfill({status:200,json:resultado(2)}));
 await page.route(u=>u.pathname.endsWith('/analises-factuais/historico'),r=>{const body=r.request().postDataJSON();return r.fulfill({status:200,json:{schemaVersao:1,itens:[{...registro(),...(body.incluirContexto?{contextoConfirmado:contexto}:{})}],temMais:false}});});
 await page.route(u=>u.pathname.endsWith('/analises-factuais/relatorio'),r=>r.fulfill({status:200,json:montar(relatorio())}));
 await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`,{waitUntil:'domcontentloaded'});await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);await page.getByRole('button',{name:'Adicionar',exact:true}).click();await expect(page.getByText('200 kcal',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ver histórico de micronutrientes',exact:true}).click();await page.getByRole('checkbox',{name:'Carregar contextos registrados',exact:true}).check();
 const detalhes=page.getByRole('row',{name:/^Análise 1/}).getByText('Contexto registrado',{exact:true});await detalhes.focus();await page.keyboard.press('Enter');
 await page.getByRole('button',{name:'Conferir relatório com contexto da análise 1',exact:true}).click();
 return page.getByRole('region',{name:'Prévia do relatório factual',exact:true});
}
test('FOOD06 M01 relatório formato 2 sem origem por nutriente diz que ela não foi disponibilizada, sem coluna vazia',async({page})=>{
 const previa=await abrirRelatorioM01(page,p=>p);
 await expect(previa).toContainText('Origem por nutriente não disponibilizada neste relatório.');
 await expect(previa.getByRole('columnheader',{name:/^Origem registrada/})).toHaveCount(0);
 await expect(previa.getByRole('row',{name:/^Ferro /})).toContainText('0 mg');
});
test('FOOD06 M01 relatório com 50 grupos de fonte não corta linhas e declara as fontes adicionais, inclusive no PDF real',async({page},testInfo)=>{
 const pdfReal=process.env.FOOD06_PDF_REAL==='true';let textoPdf='';
 if(pdfReal){const {execFileSync}=await import('node:child_process');await page.exposeFunction('__pdf50',async()=>{await page.pdf({path:testInfo.outputPath('m01-50-grupos.pdf'),format:'A4',tagged:true,printBackground:true});textoPdf=execFileSync('pdftotext',[testInfo.outputPath('m01-50-grupos.pdf'),'-'],{encoding:'utf8'});});}
 await page.addInitScript(pdf=>{window.print=async()=>{if(pdf)await window.__pdf50();window.__impressao50=1;window.dispatchEvent(new Event('afterprint'));};},pdfReal);
 const GRUPOS=50,EXTRAS=7;
 const previa=await abrirRelatorioM01(page,p=>{
  const n=p.analise.cobertura.nutrientes,ferro=n.ferroMg;
  // 57 itens conhecidos de ferro: 50 grupos detalhados (1 item cada) + 7 em fontes adicionais.
  const total=GRUPOS+EXTRAS;
  for(const nut of Object.values(n)){Object.assign(nut.contagens,{incluidos:total,conhecidos:nut===ferro?total:0,semComposicao:nut===ferro?0:total});nut.causas=nut===ferro?[]:[{codigo:'ausente',quantidade:total}];}
  for(const m of Object.values(p.analise.calculo.nutrientes)){m.itensIncluidos=total;if(m.estado==='completo')m.itensComValor=total;}
  p.fontesComposicao={estado:'nao_projetadas_neste_contrato'};
  p.fontesPorNutriente={schemaVersao:1,vinculo:'origem_do_registro_de_composicao',nutrientes:Object.fromEntries(Object.keys(n).map(codigo=>[codigo,codigo==='ferroMg'
   ?{contribuintes:total,fontes:Array.from({length:GRUPOS},(_,i)=>({tipo:'USDA',codigo:'usda_fdc_foundation',versao:`2025.${i+1}`,quantidade:1})),semOrigemDocumentada:0,fontesNaoDetalhadas:EXTRAS}
   :{contribuintes:0,fontes:[],semOrigemDocumentada:0,fontesNaoDetalhadas:0}]))};
  return p;
 });
 const linha=previa.getByRole('row',{name:/^Ferro /});
 await expect(linha).toContainText('versão 2025.1 ·');await expect(linha).toContainText('versão 2025.50 ·');
 await expect(linha).toContainText('7 alimentos em fontes adicionais não detalhadas');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await previa.getByRole('button',{name:'Imprimir / salvar PDF',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__impressao50??0)).toBe(1);
 if(pdfReal){await expect.poll(()=>textoPdf.length).toBeGreaterThan(0);const t=textoPdf.replace(/\s+/g,' ');expect(t).toContain('versão 2025.1 ');expect(t).toContain('versão 2025.50 ');expect(t).toContain('7 alimentos em fontes adicionais não detalhadas');expect(t).toContain('Não comprova que a base mediu este nutriente');
  // Medição de impressão de várias páginas: o cabeçalho da tabela se repete e o nome do nutriente acompanha a célula?
  const paginas=textoPdf.split('\f').filter(x=>x.trim());
  const comLista=paginas.filter(x=>/versão 2025\.\d+/.test(x));
  testInfo.annotations.push({type:'medicao-pdf',description:JSON.stringify({paginas:paginas.length,paginasComLista:comLista.length,cabecalhoEmCada:comLista.every(x=>x.includes('Origem registrada')),nomeDoNutrienteEmCada:comLista.every(x=>x.includes('Ferro'))})});
  expect(paginas.length).toBeGreaterThan(1);
  expect(comLista.length).toBeGreaterThan(0);
  for(const pg of comLista){expect(pg).toContain('Origem registrada');expect(pg).toContain('Ferro');}
}
});

/* FOOD06 M01 — o relatório com origem é alcançável para análise sem contexto, e o histórico mostra a origem. */
test('FOOD06 M01 histórico mostra a origem do nutriente e oferece o relatório com origem para análise sem contexto',async({page})=>{
 await prepararConsole(page);const pedidos=[];
 await page.route(u=>u.pathname.endsWith('/selecao-calculo'),r=>r.fulfill({status:200,json:{planoId:planoIds[0],ativoParaPaciente:true,ativacaoRevisao:1,versao:{id:'versao-a',numero:1,publicadaEm:'2026-10-15T12:00:00.000Z'},refeicoes:[{identidadeId:idsRefeicoes[0],nome:'Refeição A',ordem:0,ativa:true}]}}));
 await page.route(u=>u.pathname.endsWith('/calculo-combinado'),r=>r.fulfill({status:200,json:resultado(2)}));
 await page.route(u=>u.pathname.endsWith('/analises-factuais/historico'),r=>{
  const item=registro(),conhecidos=Object.fromEntries(Object.entries(item.nutrientes).map(([k,v])=>[k,v.contagens.conhecidos]));
  item.fontesPorNutriente={schemaVersao:1,vinculo:'origem_do_registro_de_composicao',nutrientes:Object.fromEntries(Object.keys(item.nutrientes).map(k=>[k,{contribuintes:conhecidos[k],fontes:conhecidos[k]?[{tipo:'manual',quantidade:conhecidos[k]}]:[],semOrigemDocumentada:0,fontesNaoDetalhadas:0}]))};
  return r.fulfill({status:200,json:{schemaVersao:1,itens:[item],temMais:false}});
 });
 await page.route(u=>u.pathname.endsWith('/analises-factuais/relatorio'),r=>{
  pedidos.push(r.request().postDataJSON());const p=relatorio(),n=p.analise.cobertura.nutrientes;
  p.contextoClinico={estado:'nao_registrado'};
  p.fontesPorNutriente={schemaVersao:1,vinculo:'origem_do_registro_de_composicao',nutrientes:Object.fromEntries(Object.entries(n).map(([k,v])=>[k,{contribuintes:v.contagens.conhecidos,fontes:v.contagens.conhecidos?[{tipo:'manual',quantidade:v.contagens.conhecidos}]:[],semOrigemDocumentada:0,fontesNaoDetalhadas:0}]))};
  return r.fulfill({status:200,json:p});
 });
 await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`,{waitUntil:'domcontentloaded'});await page.getByLabel('Adicionar plano desta página').selectOption(planoIds[0]);await page.getByRole('button',{name:'Adicionar',exact:true}).click();await expect(page.getByText('200 kcal',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ver histórico de micronutrientes',exact:true}).click();
 const linha=page.getByRole('row',{name:/^Análise 1/});
 await expect(linha.locator('[data-origem-linha]')).toContainText('Inclui entrada manual (2 alimentos)');
 // Sem contexto carregado ou registrado, o relatório com origem continua alcançável, sem passos extras.
 await expect(page.getByRole('button',{name:'Conferir relatório da análise 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Conferir relatório com origem por nutriente da análise 1',exact:true}).click();
 const previa=page.getByRole('region',{name:'Prévia do relatório factual',exact:true});
 await expect(previa.getByRole('columnheader',{name:/^Origem registrada/})).toBeVisible();
 await expect(previa.getByRole('row',{name:/^Ferro /})).toContainText('Entrada manual · 2 alimentos');
 await expect(previa).toContainText('Contexto não registrado nesta análise');
 expect(pedidos.length).toBeGreaterThan(0);for(const pedido of pedidos)expect(pedido).toEqual({registroId:id,versaoRelatorio:2});
 expect((await new AxeBuilder({page}).include('[data-food06-exportacao]').analyze()).violations).toEqual([]);
});
