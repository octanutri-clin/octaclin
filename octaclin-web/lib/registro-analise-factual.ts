import { ErroApiPlanoAlimentar } from './plano-alimentar-api';
import type { SelecaoCalculoLocal } from './plano-alimentar-api';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Congela somente os identificadores e revisões necessários ao comando autorizado pelo servidor. */
export function prepararRegistroFactual(plano:SelecaoCalculoLocal,chave:string){
 const ids=plano.refeicoes.filter(r=>r.selecionada).map(r=>r.identidadeId);
 if(!plano.ativoParaPaciente||![plano.planoId,plano.versaoId,chave,...ids].every(v=>UUID.test(v))||!Number.isSafeInteger(plano.numeroVersao)||plano.numeroVersao<1||!Number.isSafeInteger(plano.ativacaoRevisao)||plano.ativacaoRevisao<0||ids.length>50||new Set(ids.map(v=>v.toLowerCase())).size!==ids.length)throw new Error('Seleção inválida.');
 return {registro:{chaveIdempotencia:chave,origem:{planoId:plano.planoId,versaoId:plano.versaoId,numero:plano.numeroVersao,status:'publicada' as const}},selecao:{ativacaoRevisaoEsperada:plano.ativacaoRevisao,identidadesRefeicoes:ids}};
}
export type ComandoRegistroFactual = ReturnType<typeof prepararRegistroFactual>;
export async function registrarAnaliseFactual(pacienteId:string,comando:ComandoRegistroFactual,signal:AbortSignal):Promise<{id:string;criadoEm:string}>{
 const resposta=await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/analises-factuais`,{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(comando)});
 if(!resposta.ok)throw new ErroApiPlanoAlimentar(resposta.status,'Não foi possível confirmar o registro.');
 try{const r=await resposta.json();if(r?.schemaVersao!==1||typeof r.registro?.id!=='string'||!UUID.test(r.registro.id)||typeof r.registro.criadoEm!=='string'||!Number.isFinite(Date.parse(r.registro.criadoEm)))throw new Error();return {id:r.registro.id,criadoEm:r.registro.criadoEm};}
 catch{throw new ErroApiPlanoAlimentar(502,'Não foi possível conferir o registro.');}
}
