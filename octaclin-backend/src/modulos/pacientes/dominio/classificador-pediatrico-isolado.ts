/** Motor técnico isolado REV9; NÃO consumido por serviços/rotas assistenciais.
 * Referências são fornecidas por porta explícita, sem downloads, dataset ou ativação implícita.
 */
import { ContextoPediatrico, INDICADORES_PEDIATRICOS, IndicadorPediatrico } from './antropometria-pediatrica';
import { idadePediatrica } from './idade-pediatrica';
import { politicaPrematuridadeCandidata } from './politica-prematuridade-candidata';
import { referenciaOmsRev9, normalizarMedidaOmsRev9, PROTOCOLO_PEDIATRICO_REV9 } from './protocolo-pediatrico-rev9';
import { ParametrosLms, percentilNormal, escoreLognormal } from './calculo-crescimento';
import { classificacaoSisvanCandidata, escoreComCaudas } from './indicadores-pediatricos-candidatos';
interface Fonte extends ParametrosLms { id: string; hash: string; caudas: boolean; mu?: number; sigma?: number }
export type ProvedorReferenciaPediatrica = (pedido: { indicador: IndicadorPediatrico; familia: 'OMS2006'|'OMS2007'|'INTERGROWTH'; eixo: number; sexo: 'masculino'|'feminino'; tecnica?: 'deitado'|'em_pe' }) => Fonte | undefined;
interface Entrada { contexto: ContextoPediatrico; avalia: string; pesoKg?: number; alturaCm?: number; gestante?: boolean }
interface Resultado { estado: 'experimental'|'bloqueado'|'reconferir'; motivo?: string; protocolo: typeof PROTOCOLO_PEDIATRICO_REV9; fonte?: { id: string; hash: string }; familia?: string; idadeEfetivaDias?: number; zBruto?: number; classificacao?: string; percentil?: number | string; alturaUtilizada?: { originalCm: number; usadoCm: number; ajusteCm: number } }
export function classificarPediatriaIsolada(e: Entrada, provedor: ProvedorReferenciaPediatrica): Record<IndicadorPediatrico,Resultado> {
  const resultado={} as Record<IndicadorPediatrico,Resultado>;
  const c=e.contexto;
  let dias: number|undefined, familiaIg=false, motivoGlobal: string|undefined;
  if (c.confirmado !== true) motivoGlobal='contexto_nao_confirmado';
  else if (e.gestante) motivoGlobal='contexto_gestacional';
  else if (!c.nascimento) motivoGlobal='nascimento_ausente';
  else if (c.sexoCurva==='nao_informado') motivoGlobal='sexo_curva_nao_informado';
  else if (c.nascimentoTipo==='nao_informado') motivoGlobal='contexto_nascimento_indeterminado';
  else {
    const cron=idadePediatrica(c.nascimento,e.avalia);dias=cron.dias;
    if (cron.anosCompletos>=20) motivoGlobal='fora_da_faixa_pediatrica';
    else if (c.nascimentoTipo==='prematuro') {
      if (c.semanasNascimento===undefined || c.diasNascimento===undefined || !['documentada','informada'].includes(c.origemGestacional!)) motivoGlobal='idade_gestacional_indeterminada';
      else {
        const p=politicaPrematuridadeCandidata(c.nascimento,e.avalia,c.semanasNascimento,c.diasNascimento);
        if (c.tipoMedida==='nascimento' || cron.dias<=2) motivoGlobal='medida_neonatal_fora_do_pos_natal';
        else if (p.referenciaProposta==='sem_classificacao') motivoGlobal='fora_da_referencia_neonatal';
        else if (p.referenciaProposta==='intergrowth') {
          familiaIg=true;dias=p.idadePosMenstrualDias;
          if (c.tipoMedida!=='pos_natal' || c.gestacaoUnica!=='sim' || c.malformacaoImportante!=='nao' || c.restricaoCrescimentoFetal!=='nao' || c.morbidadePosNatalGrave!=='nao' || !['documentada','informada'].includes(c.origemElegibilidade!)) motivoGlobal='referencia_nao_validada_para_contexto';
        } else dias=p.referenciaProposta==='oms_corrigida' ? p.idadeCorrigidaDias : cron.dias;
      }
    }
  }
  for (const indicador of INDICADORES_PEDIATRICOS) {
    const bloquear=(motivo:string) => { resultado[indicador]={estado:'bloqueado',motivo,protocolo:PROTOCOLO_PEDIATRICO_REV9}; };
    if (motivoGlobal) {bloquear(motivoGlobal);continue;}
    if (familiaIg && (indicador==='imc_idade'||indicador==='peso_estatura')) {bloquear('indicador_nao_fornecido_pelo_intergrowth');continue;}
    const peso=indicador!=='estatura_idade', altura=indicador!=='peso_idade';
    if (peso && c.edema!=='nao') {bloquear(c.edema==='sim'?'edema_presente':'edema_nao_avaliado');continue;}
    if ((peso && e.pesoKg===undefined)||(altura && e.alturaCm===undefined)) {bloquear('medida_ausente');continue;}
    if ((peso && (!Number.isFinite(e.pesoKg)||e.pesoKg!<=0))||(altura && (!Number.isFinite(e.alturaCm)||e.alturaCm!<=0))) {bloquear('medida_invalida');continue;}
    try {
      const ref=familiaIg ? undefined : referenciaOmsRev9(indicador,dias!,c.nascimento!,e.avalia);
      if (!familiaIg&&!ref) {bloquear('fora_da_referencia');continue;}
      if (familiaIg&&altura&&c.tecnica!=='deitado') {bloquear('comprimento_recumbente_exigido');continue;}
      const linear=altura ? familiaIg ? {originalCm:e.alturaCm!,usadoCm:e.alturaCm!,ajusteCm:0} : normalizarMedidaOmsRev9(e.alturaCm!,c.tecnica,dias!) : undefined;
      const familia=familiaIg?'INTERGROWTH':ref!.familia;
      const fonte=provedor({indicador,familia,eixo:indicador==='peso_estatura'?linear!.usadoCm:familiaIg?dias!:ref!.parametro,sexo:c.sexoCurva as 'masculino'|'feminino',tecnica:linear ? familiaIg||dias!<731?'deitado':'em_pe':undefined});
      if (!fonte) {bloquear('referencia_ausente');continue;}
      if (!fonte.id||!/^[a-f0-9]{64}$/.test(fonte.hash)) {bloquear('referencia_sem_procedencia');continue;}
      const valor=indicador==='imc_idade'?e.pesoKg!/(linear!.usadoCm/100)**2:indicador==='estatura_idade'?linear!.usadoCm:e.pesoKg!;
      // A regra de caudas é do indicador ratificado, nunca uma opção do provider.
      const z=familiaIg ? escoreLognormal(valor,fonte.mu!,fonte.sigma!) : escoreComCaudas(valor,fonte,indicador!=='estatura_idade');
      const base={protocolo:PROTOCOLO_PEDIATRICO_REV9,fonte:{id:fonte.id,hash:fonte.hash},familia,idadeEfetivaDias:dias,zBruto:z,alturaUtilizada:linear};
      const limiteInf=indicador==='estatura_idade'||indicador==='peso_idade'?-6:-5, limiteSup=indicador==='estatura_idade'?6:5;
      if (!familiaIg&&(z<limiteInf||z>limiteSup)) {resultado[indicador]={...base,estado:'reconferir',motivo:'flag_estatistica'};continue;}
      const p=percentilNormal(z);
      const percentil = !familiaIg&&Math.abs(z)>3 ? z<0?'abaixo_do_limite_de_percentil_da_referencia':'acima_do_limite_de_percentil_da_referencia' : familiaIg&&(p.valor===undefined||p.valor<.1||p.valor>99.9) ? z<0?'<P0,1':'>P99,9' : p.valor;
      resultado[indicador]={...base,estado:'experimental',...(familiaIg?{motivo:'plausibilidade_neonatal_nao_validada'}:{}),percentil,classificacao:familiaIg?undefined:classificacaoSisvanCandidata(indicador,z,ref!.faixaSisvan)};
    } catch (erro) {bloquear(erro instanceof Error&&['tecnica_exige_reconferencia','tecnica_nao_informada'].includes(erro.message)?erro.message:'dominio_matematico_invalido');}
  }
  return resultado;
}
