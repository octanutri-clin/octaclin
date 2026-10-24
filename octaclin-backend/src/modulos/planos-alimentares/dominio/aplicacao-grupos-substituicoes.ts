import { AlimentoEdicao, AlternativaEdicao, DocumentoEdicaoPlano, numeroEdicao, validarDocumentoEdicaoPlano } from './edicao-plano';
import { EntradaGrupoSnapshot, IntencaoGrupo, OrigemGrupoSnapshot, porcaoGrupoValida, validarIntencaoGrupo } from './grupos-substituicoes';
export type { IntencaoGrupo, OrigemGrupoSnapshot } from './grupos-substituicoes';
export class ConflitoAplicacaoGrupo extends Error {}
export class DocumentoGrupoInvalido extends Error {}
function validarDocumentoGrupo(d: DocumentoEdicaoPlano) {try{return validarDocumentoEdicaoPlano(d);}catch{throw new DocumentoGrupoInvalido('Documento ou limite de aplicação inválido.');}}
function identidade(a: AlimentoEdicao): string|undefined { return a.alimentoComposicaoId?`catalogo:${a.alimentoComposicaoId.toLowerCase()}`:a.alimentoPersonalizado?`custom:${a.alimentoPersonalizado.id.toLowerCase()}`:undefined; }
function mesmaRef(a: IntencaoGrupo,b: IntencaoGrupo) { return a.grupoId===b.grupoId&&a.revisao===b.revisao&&a.entradaId===b.entradaId&&a.aplicacaoId===b.aplicacaoId; }
function mesmaPorcao(a: AlimentoEdicao,b: AlimentoEdicao) {return numeroEdicao(a.porcaoGramas)===numeroEdicao(b.porcaoGramas);}
export interface AlternativaAnteriorGrupo { itemChave: string; alimento: AlternativaEdicao }
export async function resolverGruposDocumento(
  documento: DocumentoEdicaoPlano,anterior: DocumentoEdicaoPlano|null,resolver:(ref:IntencaoGrupo)=>Promise<EntradaGrupoSnapshot>,
  materializadas: Record<string,AlternativaAnteriorGrupo>={}
):Promise<Record<string,OrigemGrupoSnapshot>> {
  const d=validarDocumentoGrupo(documento),prev=new Map<string,AlternativaAnteriorGrupo>(Object.entries(materializadas));
  for(const r of anterior?.refeicoes??[])for(const i of r.itens)for(const a of i.substituicoes??[])prev.set(a.chaveCliente,{itemChave:i.chaveCliente,alimento:a});
  const acoes=new Map<string,{pai:string;chave:string}>();
  for(const [chave,p]of prev)if(p.alimento.origemGrupo)acoes.set(`${p.alimento.origemGrupo.aplicacaoId}:${p.alimento.origemGrupo.entradaId}`,{pai:p.itemChave,chave});
  const origens:Record<string,OrigemGrupoSnapshot>=Object.create(null);
  for(const r of d.refeicoes)for(const i of r.itens){
    const novas=new Set<string>(),replays=new Set<string>();
    for(const a of i.substituicoes??[]) {
      const anteriorAlt=prev.get(a.chaveCliente),ant=anteriorAlt?.alimento;
      if(!a.origemGrupo&&ant?.origemGrupo&&identidade(a)===identidade(ant))a.origemGrupo=ant.origemGrupo;
      if(!a.origemGrupo)continue;
      const ref=validarIntencaoGrupo(a.origemGrupo);a.origemGrupo=ref;
      const conhecida=acoes.get(`${ref.aplicacaoId}:${ref.entradaId}`);
      if(conhecida&&conhecida.pai!==i.chaveCliente)throw new ConflitoAplicacaoGrupo('Aplicação pertence a outro item. Confira a cópia.');
      if(conhecida&&conhecida.chave!==a.chaveCliente){
        if(!(i.substituicoes??[]).some(b=>b.chaveCliente===conhecida.chave))throw new ConflitoAplicacaoGrupo('Aplicação já salva com outra identidade.');
        replays.add(a.chaveCliente);continue;
      }
      const preservar=ant?.origemGrupo&&anteriorAlt?.itemChave===i.chaveCliente&&mesmaRef(ref,ant.origemGrupo)&&identidade(a)===identidade(ant);
      if(!preservar){
        if(!porcaoGrupoValida(numeroEdicao(a.porcaoGramas))||!porcaoGrupoValida(numeroEdicao(a.quantidade))||!a.unidade?.trim())throw new ConflitoAplicacaoGrupo('Informe a porção válida da aplicação.');
        const entrada=await resolver(ref),c=entrada.composicao;
        a.alimentoComposicaoId=entrada.origem==='catalogo'?entrada.alimentoId:undefined;
        a.alimentoPersonalizado=entrada.origem==='custom'?{id:entrada.alimentoId,revisao:entrada.revisao!,aplicacaoId:ref.aplicacaoId}:undefined;
        a.descricao=c.descricao;a.nutrientesPor100g={...c.nutrientesPor100g};
        a.micronutrientesPor100g=entrada.origem==='custom'?{...c.micronutrientesPor100g}:undefined;
        a.medidaCaseira=null;a.liberadaParaPaciente=false;a.preferida=false;novas.add(a.chaveCliente);
        acoes.set(`${ref.aplicacaoId}:${ref.entradaId}`, { pai: i.chaveCliente, chave: a.chaveCliente });
      }
    }
    const mantidas=(i.substituicoes??[]).filter(a=>!replays.has(a.chaveCliente)&&!novas.has(a.chaveCliente));
    for(const a of i.substituicoes??[]){
      if(!novas.has(a.chaveCliente))continue;
      const id=identidade(a);
      if(id&&id===identidade(i))continue;
      const iguais=mantidas.filter(b=>identidade(b)===id);
      if(iguais.some(b=>mesmaPorcao(a,b)))continue;
      if(iguais.length&&!a.origemGrupo?.confirmarPorcaoDistinta)throw new ConflitoAplicacaoGrupo('Mesmo alimento com porções diferentes: confirme a decisão.');
      mantidas.push(a);
    }
    // Conserva posição das alternativas antigas e ordem de seleção das novas.
    i.substituicoes=mantidas;
    for(const a of mantidas)if(a.origemGrupo&&porcaoGrupoValida(numeroEdicao(a.porcaoGramas))&&porcaoGrupoValida(numeroEdicao(a.quantidade))){
      origens[a.chaveCliente]={...a.origemGrupo,schemaVersao:1,porcaoAplicadaGramas:numeroEdicao(a.porcaoGramas)!,quantidadeAplicada:numeroEdicao(a.quantidade)!,unidadeAplicada:a.unidade!};
    }
  }
  const validado=validarDocumentoGrupo(d);documento.refeicoes=validado.refeicoes;return origens;
}
