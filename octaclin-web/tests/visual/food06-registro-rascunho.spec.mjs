import {test,expect} from '@playwright/test';
import {prepararPrevia} from './fixtures/food06-previa.mjs';
for(const status of [200,503])test(`FOOD06 registra revisão exata do rascunho e bloqueia alterações locais: ${status}`,async({page})=>{
 const enviados=[];
 await page.route(u=>u.pathname.endsWith('/analises-factuais'),r=>{enviados.push(r.request().postDataJSON());return r.fulfill({status,json:{schemaVersao:1,registro:{id:'00000000-0000-4000-8000-000000000005',criadoEm:'2026-11-05T12:00:00.000Z'}}});});
 await prepararPrevia(page,{ajustarDetalhe:d=>{d.id='00000000-0000-4000-8000-000000000001';d.draft.id='00000000-0000-4000-8000-000000000002';d.draft.ativacaoEdicao[0].identidadeId='00000000-0000-4000-8000-000000000003';}});
 const r=page.getByRole('region',{name:'Salvar análise factual',exact:true});
 await r.getByRole('combobox',{name:'Plano a registrar'}).selectOption('00000000-0000-4000-8000-000000000001');await r.getByRole('button',{name:'Conferir análise antes de salvar'}).click();await expect(r).toContainText('rascunho revisão 1');expect(enviados).toHaveLength(0);
 await r.getByRole('button',{name:'Confirmar e salvar análise'}).click();if(status===200)await expect(r.getByRole('status')).toContainText('Análise salva');else await expect(r.getByRole('alert')).toContainText('A gravação pode ter ocorrido');expect(enviados[0].registro.origem).toMatchObject({status:'rascunho',rascunhoRevisao:1,versaoId:'00000000-0000-4000-8000-000000000002'});
 await page.getByRole('textbox',{name:'Objetivo clínico',exact:true}).fill('Mudança sintética');await expect(r).toHaveCount(0);await expect(page.getByText(/Registro indisponível: atualize e confira o acesso à seleção/)).toBeVisible();if(status===503)await expect(page.getByText(/Uma gravação anterior pode ter ocorrido/)).toBeVisible();expect(enviados).toHaveLength(1);
});
