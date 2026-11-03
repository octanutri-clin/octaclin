import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isUUID } from 'class-validator';
import { IsNull, type EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { RegistroAnaliseFactualOrm } from '../infraestrutura/registro-analise-factual.orm';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { construirAnaliseFactual, lerRegistroAnaliseFactual, type EntradaConstrutorAnaliseFactual, type RegistroAnaliseFactual } from './construtor-analise-factual';
import { compararVersoesFactuais, type IdentidadeVersaoFactual, type ComparacaoVersoesFactuais } from '../dominio/comparacao-versoes-factuais';
export interface ComandoRegistroFactual { chaveIdempotencia:string;origem:Omit<IdentidadeVersaoFactual,'registradaEm'> }
/** Carregador server-side deve revalidar fonte, identidade e revisão na MESMA transação. Não é body HTTP. */
export type CarregarAnaliseFactual=(g:EntityManager)=>Promise<EntradaConstrutorAnaliseFactual>;
const LIMITE_CIPHER = 10 * 1024 * 1024;
type MetadadosRegistro = { id: string; criadoEm: Date };
const projetar = (r: MetadadosRegistro): MetadadosRegistro => ({ id: r.id, criadoEm: r.criadoEm });
function uuid(v: unknown): string {
 if(typeof v !== 'string' || !isUUID(v)) throw new BadRequestException('Identificador inválido.');
 return v.toLowerCase();
}
function campos(v: unknown, permitidos: string[]): Record<string,unknown> {
 if(!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype,null].includes(Object.getPrototypeOf(v)) ||
  Reflect.ownKeys(v).some(k => typeof k !== 'string' || !permitidos.includes(k)) ||
  Object.values(Object.getOwnPropertyDescriptors(v)).some(d => !d.enumerable || !Object.hasOwn(d,'value')))
  throw new BadRequestException('Comando inválido.');
 return v as Record<string,unknown>;
}
function validarComando(v: ComandoRegistroFactual): ComandoRegistroFactual {
 const c=campos(v,['chaveIdempotencia','origem']), o=campos(c.origem,['planoId','versaoId','numero','status','rascunhoRevisao']);
 if(!Number.isSafeInteger(o.numero) || Number(o.numero)<1 || !['publicada','rascunho'].includes(o.status as string) ||
  (o.status==='rascunho' ? !Number.isSafeInteger(o.rascunhoRevisao)||Number(o.rascunhoRevisao)<1 : o.rascunhoRevisao!==undefined))
  throw new BadRequestException('Origem inválida.');
 return {chaveIdempotencia:uuid(c.chaveIdempotencia),origem:{planoId:uuid(o.planoId),versaoId:uuid(o.versaoId),numero:o.numero as number,status:o.status as 'publicada'|'rascunho',
  ...(o.status==='rascunho'?{rascunhoRevisao:o.rascunhoRevisao as number}:{})}};
}
/** Infraestrutura interna: sem endpoint e sem carregador de planos integrado neste incremento. */
@Injectable()
export class ServicoRegistrosAnaliseFactual {
 constructor(private readonly executor:ExecutorTenant,private readonly crypto:CriptografiaDadosSensiveis){}
 /** Retorno protegido para composição interna, nunca entidade/DTO HTTP. */
 async ler(tenant:string,paciente:string,usuario:UsuarioAutenticado,registroId:string):Promise<RegistroAnaliseFactual>{
  const tenantId=uuid(tenant),pacienteId=uuid(paciente),id=uuid(registroId);this.autorizar(tenantId,usuario,false);
  return this.executor.executar(tenantId,async g=>{
   await this.carteira(g,tenantId,pacienteId,usuario);
   return this.decifrarRegistro(await this.obterRegistro(g,tenantId,pacienteId,id));
  });
 }
 async comparar(tenant:string,paciente:string,usuario:UsuarioAutenticado,antesId:string,depoisId:string):Promise<ComparacaoVersoesFactuais>{
  const tenantId=uuid(tenant),pacienteId=uuid(paciente),a=uuid(antesId),b=uuid(depoisId);this.autorizar(tenantId,usuario,false);
  return this.executor.executar(tenantId,async g=>{
   await this.carteira(g,tenantId,pacienteId,usuario);
   // Autorizar os DOIS recursos antes de abrir qualquer conteúdo. Sem nested tx.
   const antes=await this.obterRegistro(g,tenantId,pacienteId,a),depois=await this.obterRegistro(g,tenantId,pacienteId,b);
   return compararVersoesFactuais(this.decifrarRegistro(antes).versao,this.decifrarRegistro(depois).versao);
  });
 }
 private async obterRegistro(g:EntityManager,tenantId:string,pacienteId:string,id:string):Promise<RegistroAnaliseFactualOrm>{
  const r=await g.getRepository(RegistroAnaliseFactualOrm).findOne({where:{tenantId,pacienteId,id}});
  if(!r)throw new NotFoundException('Registro indisponível.');
  return r;
 }
 private decifrarRegistro(r:RegistroAnaliseFactualOrm):RegistroAnaliseFactual{
  try{
   const registro=lerRegistroAnaliseFactual(this.conteudoAnterior(r));
   if(registro.versao.escopo.tenantId!==r.tenantId||registro.versao.escopo.pacienteId!==r.pacienteId)throw new Error();
   return registro;
  }catch{throw new UnprocessableEntityException('Registro indisponível para conferência.');}
 }
 private autorizar(tenantId:string,u:UsuarioAutenticado,escrita:boolean):void {
  if(u.papel!=='Professional'||uuid(u.tenantId)!==tenantId||!u.permissoes.includes('planos_alimentares.ler')||
   (escrita&&!u.permissoes.includes('planos_alimentares.gerenciar')))throw new ForbiddenException('Operação não autorizada.');
  uuid(u.usuarioId);
 }
 private async carteira(g:EntityManager,tenantId:string,pacienteId:string,u:UsuarioAutenticado):Promise<string> {
  const profissional=await g.getRepository(ProfissionalOrm).findOne({select:{id:true},
   where:{usuarioId:uuid(u.usuarioId),tenantId,arquivadoEm:IsNull()},lock:{mode:'pessimistic_read'}});
  if(!profissional)throw new NotFoundException('Paciente indisponível.');
  const profissionalId=profissional.id;
  const paciente=await g.getRepository(PacienteOrm).findOne({select:{id:true,profissionalResponsavelId:true},
   where:{id:pacienteId,tenantId,profissionalResponsavelId:profissionalId,arquivadoEm:IsNull()},lock:{mode:'pessimistic_read'}});
  if(!paciente)throw new NotFoundException('Paciente indisponível.');
  return profissionalId;
 }
 private vinculo(r:RegistroAnaliseFactualOrm) {
  return {id:r.id,tenantId:r.tenantId,pacienteId:r.pacienteId,profissionalId:r.profissionalId,usuarioId:r.usuarioId,chaveIdempotencia:r.chaveIdempotencia};
 }
 private conteudoAnterior(r:RegistroAnaliseFactualOrm):string {
  try {
   const e=campos(JSON.parse(this.crypto.descriptografar(r.conteudoCriptografado)),['schemaVersao','tipo','vinculo','conteudo']);
   const vinculo=campos(e.vinculo,['id','tenantId','pacienteId','profissionalId','usuarioId','chaveIdempotencia']);
   if(!e||e.schemaVersao!==1||e.tipo!=='food06-registro-protegido-v1'||typeof e.conteudo!=='string'||
    Object.keys(vinculo).length!==6||Object.entries(this.vinculo(r)).some(([k,v])=>vinculo[k]!==v))throw new Error();
   return e.conteudo;
  }catch{throw new UnprocessableEntityException('Registro indisponível para conferência.');}
 }
 async registrar(tenant:string,paciente:string,usuario:UsuarioAutenticado,entrada:ComandoRegistroFactual,carregar:CarregarAnaliseFactual):Promise<MetadadosRegistro>{
  const tenantId=uuid(tenant),pacienteId=uuid(paciente);this.autorizar(tenantId,usuario,true);
  const comando=validarComando(entrada),usuarioId=uuid(usuario.usuarioId);
  if(typeof carregar!=='function')throw new BadRequestException('Carregador indisponível.');
  return this.executor.executar(tenantId,async g=>{
   const profissionalId=await this.carteira(g,tenantId,pacienteId,usuario);
   // Mesma ordem: profissional -> paciente -> chave. Sem retries cegos.
   await g.query('select pg_advisory_xact_lock(hashtextextended($1, 0))',[`${tenantId}:${usuarioId}:${comando.chaveIdempotencia}`]);
   const registro=construirAnaliseFactual(await carregar(g)),v=registro.versao,o=comando.origem;
   if(v.escopo.tenantId!==tenantId||v.escopo.pacienteId!==pacienteId||v.origem.planoId!==o.planoId||v.origem.versaoId!==o.versaoId||
    v.origem.numero!==o.numero||v.origem.status!==o.status||v.origem.rascunhoRevisao!==o.rascunhoRevisao)
    throw new ConflictException('Origem alterada. Confira novamente a versão.');
   const conteudo=JSON.stringify(registro),repo=g.getRepository(RegistroAnaliseFactualOrm);
   const anterior=await repo.findOne({where:{tenantId,usuarioId,chaveIdempotencia:comando.chaveIdempotencia}});
   if(anterior){
    if(anterior.pacienteId!==pacienteId||anterior.profissionalId!==profissionalId)throw new ConflictException('Chave já utilizada em outra operação.');
    if(this.conteudoAnterior(anterior)!==conteudo)throw new ConflictException('Chave já utilizada com conteúdo diferente.');
    return projetar(anterior);
   }
   const r=repo.create({id:randomUUID(),tenantId,pacienteId,profissionalId,usuarioId,chaveIdempotencia:comando.chaveIdempotencia});
   const envelope=JSON.stringify({schemaVersao:1,tipo:'food06-registro-protegido-v1',vinculo:this.vinculo(r),conteudo});
   if(Buffer.byteLength(envelope)>LIMITE_CIPHER-1024)throw new BadRequestException('Análise excede o limite de registro.');
   r.conteudoCriptografado=this.crypto.criptografar(envelope);
   await repo.insert(r);
   await registrarAuditoriaNaTransacao(g,{tenantId,usuarioId,acao:'analises_factuais.registrar',recursoTipo:'analise_factual',recursoId:r.id,metadados:{}});
   // O timestamp é gerado pelo banco; não reconstruir uma data de aplicação.
   const salvo=await repo.findOneOrFail({select:{id:true,criadoEm:true},where:{tenantId,id:r.id}});
   return projetar(salvo);
  });
 }
 async listar(tenant:string,paciente:string,usuario:UsuarioAutenticado,pagina=1,limite=25):Promise<{itens:MetadadosRegistro[];total:number;pagina:number;limite:number}>{
  const tenantId=uuid(tenant),pacienteId=uuid(paciente);this.autorizar(tenantId,usuario,false);
  if(!Number.isSafeInteger(pagina)||pagina<1||pagina>10000||!Number.isSafeInteger(limite)||limite<1||limite>100)throw new BadRequestException('Paginação inválida.');
  return this.executor.executar(tenantId,async g=>{
   await this.carteira(g,tenantId,pacienteId,usuario);
   const [itens,total]=await g.getRepository(RegistroAnaliseFactualOrm).findAndCount({select:{id:true,criadoEm:true},where:{tenantId,pacienteId},
    order:{criadoEm:'DESC',id:'DESC'},skip:(pagina-1)*limite,take:limite});
   return {itens:itens.map(projetar),total,pagina,limite};
  });
 }
}
