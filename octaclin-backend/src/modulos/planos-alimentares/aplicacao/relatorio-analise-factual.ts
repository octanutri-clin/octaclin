import type { resumirFontesRegistro } from './fontes-relatorio-factual';
import type { projetarRegistroFactual } from './projecao-registro-factual';
type ProjecaoRegistro=ReturnType<typeof projetarRegistroFactual>;
/** Entrada exclusivamente da projeção server-side autorizada, nunca do body HTTP. */
export function prepararRelatorioFactual(p:ProjecaoRegistro & {fontesComposicao?:ReturnType<typeof resumirFontesRegistro>},geradoEm=new Date()){
 return {schemaVersao:1 as const,motorVersao:'food06-relatorio-factual-v1' as const,geradoEm:geradoEm.toISOString(),
  registro:{id:p.registro.id,criadoEm:p.registro.criadoEm},
  origem:{planoId:p.origem.planoId,versaoId:p.origem.versaoId,numero:p.origem.numero,status:p.origem.status,registradaEm:p.origem.registradaEm,...(p.origem.status==='rascunho'?{rascunhoRevisao:p.origem.rascunhoRevisao}:{})},
  selecao:p.selecao,analise:p.analise,referencias:{estado:'indisponivel' as const,motivo:'referencias_nao_habilitadas' as const},
  contextoClinico:{estado:'nao_documentado_no_relatorio' as const},fontesComposicao:p.fontesComposicao??{estado:'nao_projetadas_neste_contrato' as const},avisos:[...p.avisos],ajuda:p.ajuda,
  limites:['alimentacao_planejada_nao_consumo_real','ausencia_nao_equivale_a_zero','sem_diagnostico_ou_recomendacao','composicao_congelada_sem_catalogo_atual'] as const};
}
