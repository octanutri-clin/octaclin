import { ErroApiPlanoAlimentar } from './plano-alimentar-api';
import type { PlanoAlimentarApi, SelecaoCalculoLocal } from './plano-alimentar-api';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Congela somente os identificadores e revisões necessários ao comando autorizado pelo servidor. */
export type FonteRegistroFactual=SelecaoCalculoLocal & {rascunhoRevisao?:number};
export interface ConfirmacoesContextoFactual {
 populacaoReferencia:'masculina'|'feminina'|'nao_informada';populacaoConfirmada:boolean;
 gestacao:'sim'|'nao'|'nao_informada';lactacao:'sim'|'nao'|'nao_informada';
 aplicabilidade:'confirmada'|'nao_aplicavel'|'nao_informada';mesmoDiaPlanejado:boolean;tabagismo:'sim'|'nao'|'nao_informado';
}
export function prepararRegistroFactual(plano:FonteRegistroFactual,chave:string,confirmacoes?:ConfirmacoesContextoFactual){
 const ids=plano.refeicoes.filter(r=>r.selecionada).map(r=>r.identidadeId);
 if(plano.rascunhoRevisao!==undefined&&(!Number.isSafeInteger(plano.rascunhoRevisao)||plano.rascunhoRevisao<1))throw new Error('Revisão inválida.');
 if(!plano.ativoParaPaciente||![plano.planoId,plano.versaoId,chave,...ids].every(v=>UUID.test(v))||!Number.isSafeInteger(plano.numeroVersao)||plano.numeroVersao<1||!Number.isSafeInteger(plano.ativacaoRevisao)||plano.ativacaoRevisao<0||ids.length>50||new Set(ids.map(v=>v.toLowerCase())).size!==ids.length)throw new Error('Seleção inválida.');
 return {registro:{chaveIdempotencia:chave,origem:{planoId:plano.planoId,versaoId:plano.versaoId,numero:plano.numeroVersao,...(plano.rascunhoRevisao!==undefined?{status:'rascunho' as const,rascunhoRevisao:plano.rascunhoRevisao}:{status:'publicada' as const})}},selecao:{ativacaoRevisaoEsperada:plano.ativacaoRevisao,identidadesRefeicoes:ids},...(confirmacoes===undefined?{}:{confirmacoes:copiarConfirmacoesContexto(confirmacoes)})};
}
export type ComandoRegistroFactual = ReturnType<typeof prepararRegistroFactual>;
export async function registrarAnaliseFactual(pacienteId:string,comando:ComandoRegistroFactual,signal:AbortSignal):Promise<{id:string;criadoEm:string}>{
 const resposta=await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/analises-factuais`,{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(comando)});
 if(!resposta.ok)throw new ErroApiPlanoAlimentar(resposta.status,'Não foi possível confirmar o registro.');
 try{const r=await resposta.json();if(r?.schemaVersao!==1||typeof r.registro?.id!=='string'||!UUID.test(r.registro.id)||typeof r.registro.criadoEm!=='string'||!Number.isFinite(Date.parse(r.registro.criadoEm)))throw new Error();return {id:r.registro.id,criadoEm:r.registro.criadoEm};}
 catch{throw new ErroApiPlanoAlimentar(502,'Não foi possível conferir o registro.');}
}

/** Somente documento salvo/materializado e mapeamento explícito, sem reconciliação por posição. */
export function fonteRegistroRascunho(plano:PlanoAlimentarApi):FonteRegistroFactual|null {
 const v=plano.draft,documento=v?.documentoEdicao,mapa=v?.ativacaoEdicao;
 if(!v||v.edicaoEstado!=='materializada'||!documento||!mapa||!Number.isSafeInteger(v.rascunhoRevisao)||!v.rascunhoRevisao||!plano.ativoParaPaciente)return null;
 const chaves=documento.refeicoes.map(r=>r.chaveCliente),porChave=new Map(mapa.map(r=>[r.chaveCliente,r]));
 if(mapa.length!==chaves.length||porChave.size!==mapa.length||new Set(chaves).size!==chaves.length||chaves.some(k=>!porChave.has(k))||new Set(mapa.map(r=>r.identidadeId)).size!==mapa.length)return null;
 return {planoId:plano.id,titulo:plano.titulo,versaoId:v.id,numeroVersao:v.numero,rascunhoRevisao:v.rascunhoRevisao,publicadaEm:v.criadoEm,ativacaoRevisao:plano.ativacaoRevisao??-1,ativoParaPaciente:true,refeicoes:documento.refeicoes.map((r,ordem)=>({identidadeId:porChave.get(r.chaveCliente)!.identidadeId,nome:r.nome||'Refeição sem nome',ordem,ativa:porChave.get(r.chaveCliente)!.ativa,selecionada:true}))};
}

/** Validação do contrato de envio, sem cálculo de elegibilidade clínica no navegador. */
export function copiarConfirmacoesContexto(c:ConfirmacoesContextoFactual):ConfirmacoesContextoFactual {
 const campos=['populacaoReferencia','populacaoConfirmada','gestacao','lactacao','aplicabilidade','mesmoDiaPlanejado','tabagismo'];
 const falhar=():never=>{throw new Error('Confirmações inválidas.');};
 if(!c||typeof c!=='object'||Array.isArray(c)||![Object.prototype,null].includes(Object.getPrototypeOf(c)))return falhar();
 const descritores=Object.getOwnPropertyDescriptors(c);
 if(Reflect.ownKeys(c).length!==campos.length||Reflect.ownKeys(c).some(k=>typeof k!=='string'||!campos.includes(k))||campos.some(k=>!descritores[k]?.enumerable||!Object.hasOwn(descritores[k],'value')))return falhar();
 if(!['masculina','feminina','nao_informada'].includes(c.populacaoReferencia)||typeof c.populacaoConfirmada!=='boolean'||typeof c.mesmoDiaPlanejado!=='boolean'||!['sim','nao','nao_informada'].includes(c.gestacao)||!['sim','nao','nao_informada'].includes(c.lactacao)||!['confirmada','nao_aplicavel','nao_informada'].includes(c.aplicabilidade)||!['sim','nao','nao_informado'].includes(c.tabagismo))return falhar();
 return {populacaoReferencia:c.populacaoReferencia,populacaoConfirmada:c.populacaoConfirmada,gestacao:c.gestacao,lactacao:c.lactacao,aplicabilidade:c.aplicabilidade,mesmoDiaPlanejado:c.mesmoDiaPlanejado,tabagismo:c.tabagismo};
}
export function confirmacoesContextoIniciais():ConfirmacoesContextoFactual {
 return {populacaoReferencia:'nao_informada',populacaoConfirmada:false,gestacao:'nao_informada',lactacao:'nao_informada',aplicabilidade:'nao_informada',mesmoDiaPlanejado:false,tabagismo:'nao_informado'};
}
