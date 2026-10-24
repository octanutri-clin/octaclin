import { ServicoMedidasCaseiras } from './servico-medidas-caseiras';
import { projetarMedidaEquivalente } from '../dominio/medida-equivalencia';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { createHash } from 'crypto';
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
import { AlimentoEdicao, AlternativaEdicao, numeroEdicao } from '../dominio/edicao-plano';
import { FatosPreservadosEquivalencia, resolverFatosEquivalencia } from './fatos-equivalencia-plano';
import { lerSnapshotEdicaoGrupos } from './snapshot-edicao-grupos';
import { validarContextosCustom } from '../dominio/aplicacao-alimentos-personalizados';
export interface LinhaPreviaEquivalencia {chaveCliente:string;alimento?:FatosComposicaoEquivalencia;resultado:ResultadoEquivalencia;impacto?:ImpactoRefeicao;fingerprint?:string;medidas?:{itens:Array<{id:string;revisao:number;nome:string;quantidade:string;aproximada:boolean;podeAplicarQuantidade:boolean;gramasAposMedida?:string;quantidadeReferencia:number;pesoReferenciaGramas:number}>;total:number;pagina:number;limite:number}}
export interface PreviaEquivalenciasDto {fingerprint:string;rascunhoRevisao:number;nutriente:PedidoEquivalencias['nutriente'];principal:FatosComposicaoEquivalencia;alternativas:LinhaPreviaEquivalencia[]}
function canonico(v:unknown):unknown {if(Array.isArray(v))return v.map(canonico);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonico(x)]));return v;}
export function fingerprintEquivalencia(v:unknown):string {return createHash('sha256').update(JSON.stringify(canonico(v))).digest('hex');}
function semantica(f:FatosComposicaoEquivalencia) {return {identidade:f.identidade,preparacao:f.preparacao?.trim().replace(/\s+/g,' ').toLowerCase(),baseGramas:f.baseGramas,nutrientes:f.nutrientes,fonte:f.fonte};}
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
  try{
   if(versao.edicaoSnapshotCriptografado)preservados.catalogos=lerSnapshotEdicaoGrupos(JSON.parse(this.crypto.descriptografar(versao.edicaoSnapshotCriptografado))).catalogos;
   if(versao.alimentosPersonalizadosSnapshotCriptografado)preservados.custom=validarContextosCustom(JSON.parse(this.crypto.descriptografar(versao.alimentosPersonalizadosSnapshotCriptografado)));
  }catch{throw new ServiceUnavailableException('Contexto de edição indisponível.');}
  const refeicao=p.documentoEdicao.refeicoes.find(r=>r.itens.some(i=>i.chaveCliente===p.itemChave))!;
  const principalEntrada=refeicao.itens.find(i=>i.chaveCliente===p.itemChave)!;
  const resolver=(a:AlimentoEdicao,pai?:string)=>resolverFatosEquivalencia(g,tenantId,profissionalId,a,this.fontes,preservados,pai);
  if(principalEntrada.medidaCaseira){
   const quantidade=numeroEdicao(principalEntrada.quantidade);if(quantidade===undefined)throw new BadRequestException('Informe a quantidade da medida do principal.');
   const id=principalEntrada.alimentoPersonalizado?.id??principalEntrada.alimentoComposicaoId!;
   const medida=await this.medidas.resolverAplicacao(g,tenantId,u,id,principalEntrada.medidaCaseira,quantidade,principalEntrada.alimentoPersonalizado?'custom':'catalogo');principalEntrada.porcaoGramas=medida.porcaoGramas;
  }
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
    if(alternativa.medidaCaseira){const quantidade=numeroEdicao(alternativa.quantidade);if(quantidade===undefined)throw new BadRequestException('Informe quantidade da medida.');const id=alternativa.alimentoPersonalizado?.id??alternativa.alimentoComposicaoId!;const m=await this.medidas.resolverAplicacao(g,tenantId,u,id,alternativa.medidaCaseira,quantidade,alternativa.alimentoPersonalizado?'custom':'catalogo');porcao=String(m.porcaoGramas);medidaAplicada={id:m.referencia.id,revisao:m.referencia.revisao,quantidade,peso:m.porcaoGramas};}

    const resultado=calcularEquivalencia({principal,alternativa:alimento,porcaoPrincipalGramas:String(numeroEdicao(principalEntrada.porcaoGramas)),nutriente:p.nutriente,politica:p.politica,porcaoEfetiva:porcao});
    const fingerprint=fingerprintEquivalencia({...contexto,chaveAlternativa:alternativa.chaveCliente,alternativa:semantica(alimento),porcaoEditada:porcao,medidaAplicada});
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
