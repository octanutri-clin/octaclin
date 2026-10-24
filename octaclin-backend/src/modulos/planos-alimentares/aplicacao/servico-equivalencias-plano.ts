import { ContextosMedidas, resolverMedidasDocumento } from '../dominio/medidas-caseiras';
import { ServicoMedidasCaseiras } from './servico-medidas-caseiras';
import { projetarMedidaEquivalente } from '../dominio/medida-equivalencia';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { fingerprintEquivalencia, fatosSemanticosEquivalencia as semantica } from '../dominio/fingerprint-equivalencia';
export { fingerprintEquivalencia } from '../dominio/fingerprint-equivalencia';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { PlanoAlimentarOrm } from '../infraestrutura/plano-alimentar.orm';
import { PlanoAlimentarVersaoOrm } from '../infraestrutura/plano-alimentar-versao.orm';
import { FontesGruposSubstituicoes } from './fontes-grupos-substituicoes';
import { ServicoGruposSubstituicoes } from './servico-grupos-substituicoes';
import { PedidoEquivalencias, validarPedidoEquivalencias } from './dtos-equivalencias';
import { calcularEquivalencia, FatosComposicaoEquivalencia, ResultadoEquivalencia } from '../dominio/equivalencia-nutriente';
import { simularTrocaNaRefeicao, FatosItemRefeicao, ImpactoRefeicao } from '../dominio/impacto-equivalencia-refeicao';
import { AlimentoEdicao, AlternativaEdicao, ItemEdicao, numeroEdicao } from '../dominio/edicao-plano';
import { FatosPreservadosEquivalencia, resolverFatosEquivalencia } from './fatos-equivalencia-plano';
import { lerSnapshotEdicaoGrupos } from './snapshot-edicao-grupos';
import { validarContextosCustom } from '../dominio/aplicacao-alimentos-personalizados';
export interface LinhaPreviaEquivalencia {chaveCliente:string;alimento?:FatosComposicaoEquivalencia;resultado:ResultadoEquivalencia;impacto?:ImpactoRefeicao;fingerprint?:string;medidas?:{itens:Array<{id:string;revisao:number;nome:string;quantidade:string;aproximada:boolean;podeAplicarQuantidade:boolean;gramasAposMedida?:string;quantidadeReferencia:number;pesoReferenciaGramas:number}>;total:number;pagina:number;limite:number}}
export interface PreviaEquivalenciasDto {fingerprint:string;rascunhoRevisao:number;nutriente:PedidoEquivalencias['nutriente'];principal:FatosComposicaoEquivalencia;alternativas:LinhaPreviaEquivalencia[]}
@Injectable()
export class ServicoEquivalenciasPlano {
 constructor(private readonly executor:ExecutorTenant,private readonly crypto:CriptografiaDadosSensiveis,private readonly fontes:FontesGruposSubstituicoes,private readonly grupos:ServicoGruposSubstituicoes,private readonly medidas:ServicoMedidasCaseiras = new ServicoMedidasCaseiras(executor,crypto)){}
 async autorizar(g:EntityManager,tenantId:string,pacienteId:string,planoId:string,u:UsuarioAutenticado,p:PedidoEquivalencias){
  if(u.tenantId!==tenantId||u.papel!=='Professional'||!u.permissoes.includes('planos_alimentares.gerenciar'))throw new ForbiddenException('Operação não permitida.');
  const profissionalId=await resolverProfissionalIdDoUsuario(g,tenantId,u);
  const paciente=await g.getRepository(PacienteOrm).findOne({where:{id:pacienteId,tenantId,profissionalResponsavelId:profissionalId,arquivadoEm:IsNull()},lock:{mode:'pessimistic_read'}});
  if(!paciente)throw new NotFoundException('Paciente não encontrado.');
  const plano=await g.getRepository(PlanoAlimentarOrm).findOne({where:{id:planoId,tenantId,pacienteId,arquivadoEm:IsNull()},lock:{mode:'pessimistic_read'}});
  if(!plano)throw new NotFoundException('Plano não encontrado.');
  const versao=await g.getRepository(PlanoAlimentarVersaoOrm).findOne({where:{id:p.versaoId,tenantId,planoId,publicadaEm:IsNull(),descartadaEm:IsNull()},lock:{mode:'pessimistic_read'}});
  if(!versao||versao.rascunhoRevisao!==p.rascunhoRevisaoEsperada)throw new ConflictException('O rascunho mudou. Reabra a prévia.');
  return {profissionalId:profissionalId!,versao};
 }
 async prever(tenantId:string,pacienteId:string,planoId:string,u:UsuarioAutenticado,entrada:unknown):Promise<PreviaEquivalenciasDto>{
  if(u.tenantId!==tenantId||u.papel!=='Professional'||!u.permissoes.includes('planos_alimentares.gerenciar'))throw new ForbiddenException('Operação não permitida.');
  let p:PedidoEquivalencias;try{p=validarPedidoEquivalencias({ ...(entrada as object) });}catch{throw new BadRequestException('Pedido de equivalência inválido.');}
  return this.executor.executar(tenantId,g=>this.preverNaTransacao(g,tenantId,pacienteId,planoId,u,p));
 }
 async preverNaTransacao(g:EntityManager,tenantId:string,pacienteId:string,planoId:string,u:UsuarioAutenticado,p:PedidoEquivalencias):Promise<PreviaEquivalenciasDto>{
  p=validarPedidoEquivalencias(p);
  const {profissionalId,versao}=await this.autorizar(g,tenantId,pacienteId,planoId,u,p);
  let preservados:FatosPreservadosEquivalencia={custom:{},catalogos:{}};
  let medidasSalvas:ContextosMedidas={};
  try{
   if(versao.edicaoSnapshotCriptografado){
    const snapshot=lerSnapshotEdicaoGrupos(JSON.parse(this.crypto.descriptografar(versao.edicaoSnapshotCriptografado)));
    preservados.catalogos=snapshot.catalogos;preservados.equivalencias=Object.create(null);
    // Apenas contextos autenticados do servidor; referências no pedido não
    // conferem acesso a outra fonte nem a outro pai editorial.
    const pais=new Map(p.documentoEdicao.refeicoes.flatMap(r=>r.itens).map(i=>[i.chaveCliente,i]));
    for(const c of Object.values(snapshot.equivalencias??{})){
     const pai=pais.get(c.itemChave);if(!pai)continue;
     if(pai.substituicoes?.some(a=>a.chaveCliente===c.alternativaChave))preservados.equivalencias![c.alternativaChave]={identidade:c.alternativa.identidade,fatos:c.alternativa};
     preservados.equivalencias![c.itemChave]={identidade:c.principal.identidade,fatos:c.principal};
    }
   }
   if(versao.medidasCaseirasSnapshotCriptografado){
    const snapshot=JSON.parse(this.crypto.descriptografar(versao.medidasCaseirasSnapshotCriptografado));
    if(snapshot?.schemaVersao!==1||!snapshot.contextos||typeof snapshot.contextos!=='object'||Array.isArray(snapshot.contextos))throw new Error('Snapshot inválido.');
    medidasSalvas=snapshot.contextos;
   }
   if(versao.alimentosPersonalizadosSnapshotCriptografado)preservados.custom=validarContextosCustom(JSON.parse(this.crypto.descriptografar(versao.alimentosPersonalizadosSnapshotCriptografado)));
  }catch{throw new ServiceUnavailableException('Contexto de edição indisponível.');}
  const resolverMedida=async(a:AlimentoEdicao)=>{
   const quantidade=numeroEdicao(a.quantidade);if(quantidade===undefined)throw new BadRequestException('Informe a quantidade da medida.');
   const contextos=await resolverMedidasDocumento({schemaVersao:1,refeicoes:[{chaveCliente:'medidas-food05',itens:[{...a,substituicoes:[]} as ItemEdicao]}]},medidasSalvas,
    (id,ref,q,origem)=>this.medidas.resolverAplicacao(g,tenantId,u,id,ref,q,origem));
   const contexto=contextos[a.chaveCliente];if(!contexto?.porcaoGramas)throw new BadRequestException('Medida inválida.');
   return contexto;
  };
  const refeicao=p.documentoEdicao.refeicoes.find(r=>r.itens.some(i=>i.chaveCliente===p.itemChave))!;
  const principalEntrada=refeicao.itens.find(i=>i.chaveCliente===p.itemChave)!;
  const resolver=(a:AlimentoEdicao,pai?:string)=>resolverFatosEquivalencia(g,tenantId,profissionalId,a,this.fontes,preservados,pai);
  if(principalEntrada.medidaCaseira)principalEntrada.porcaoGramas=(await resolverMedida(principalEntrada)).porcaoGramas;
  const principal=await resolver(principalEntrada);
  const itens:FatosItemRefeicao[]=[];
  for(const item of refeicao.itens){let composicao:FatosComposicaoEquivalencia;try{composicao=item.chaveCliente===p.itemChave?principal:await resolver(item);}catch{composicao={identidade:'indisponivel',descricao:'Indisponível',baseGramas:'100',nutrientes:{}};}itens.push({chaveCliente:item.chaveCliente,porcaoGramas:String(numeroEdicao(item.porcaoGramas)??''),composicao});}
  const contexto={tenantId,usuarioId:u.usuarioId,profissionalId,pacienteId,planoId,versaoId:versao.id,revisao:versao.rascunhoRevisao,itemChave:p.itemChave,nutriente:p.nutriente,politica:p.politica,principal:semantica(principal),porcaoPrincipal:numeroEdicao(principalEntrada.porcaoGramas),refeicao:itens.map(i=>({chave:i.chaveCliente,porcao:i.porcaoGramas,fatos:semantica(i.composicao)}))};
  const alternativas:LinhaPreviaEquivalencia[]=[];
  for(const alternativa of p.alternativas){
   try{
    if(alternativa.origemGrupo&&!preservados.catalogos[alternativa.chaveCliente]&&!preservados.custom[alternativa.chaveCliente]){
     const e=await this.grupos.resolverAplicacao(g,tenantId,u,alternativa.origemGrupo);
     const id=alternativa.alimentoPersonalizado?.id??alternativa.alimentoComposicaoId;
     if(e.alimentoId!==id)throw new ConflictException('Referência divergente do grupo.');
    }
    const alimento=await resolver(alternativa,p.itemChave);
    if(alimento.identidade===principal.identidade)throw new ConflictException('A alternativa já é o principal.');
    let porcao=alternativa.porcaoGramas===undefined?undefined:String(numeroEdicao(alternativa.porcaoGramas)??'');
    let medidaAplicada:unknown;
    if(alternativa.medidaCaseira){const m=await resolverMedida(alternativa);porcao=String(m.porcaoGramas);medidaAplicada={id:m.referencia.id,revisao:m.referencia.revisao,quantidade:numeroEdicao(alternativa.quantidade),peso:m.porcaoGramas};}

    const resultado=calcularEquivalencia({principal,alternativa:alimento,porcaoPrincipalGramas:String(numeroEdicao(principalEntrada.porcaoGramas)),nutriente:p.nutriente,politica:p.politica,porcaoEfetiva:porcao});
    const fingerprint=fingerprintEquivalencia({...contexto,chaveAlternativa:alternativa.chaveCliente,alternativa:semantica(alimento),porcaoEfetiva:resultado.estado==='calculavel'?resultado.porcaoEfetivaGramas:porcao,medidaAplicada});
    let medidas:LinhaPreviaEquivalencia['medidas'];
    const idMedida=alternativa.alimentoPersonalizado?.id??alternativa.alimentoComposicaoId;
    if(idMedida&&resultado.estado==='calculavel'){
     try{const lista=await this.medidas.listarNaTransacao(g,tenantId,idMedida,u,{pagina:1,limite:25},alternativa.alimentoPersonalizado?'custom':'catalogo');medidas={...lista,itens:lista.itens.map(m=>({id:m.id,revisao:m.revisao,quantidadeReferencia:m.quantidadeReferencia,pesoReferenciaGramas:m.pesoReferenciaGramas,...projetarMedidaEquivalente(resultado.porcaoEfetivaGramas,m)}))};}catch{medidas={itens:[],total:0,pagina:1,limite:25};}
    }
    alternativas.push({chaveCliente:alternativa.chaveCliente,alimento,resultado,fingerprint,...(medidas?{medidas}:{}),...(resultado.estado==='calculavel'?{impacto:simularTrocaNaRefeicao(itens,p.itemChave,{chaveCliente:alternativa.chaveCliente,porcaoGramas:resultado.porcaoEfetivaGramas,composicao:alimento})}:{})});
   }catch{alternativas.push({chaveCliente:alternativa.chaveCliente,resultado:{estado:'indisponivel',motivo:'referencia_indisponivel',nutriente:p.nutriente}});}
  }
  return {fingerprint:fingerprintEquivalencia({...contexto,alternativas:alternativas.map(a=>({chave:a.chaveCliente,fingerprint:a.fingerprint,estado:a.resultado.estado}))}),rascunhoRevisao:versao.rascunhoRevisao,nutriente:p.nutriente,principal,alternativas};
 }
}
