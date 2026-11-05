import { compararBaseComposicaoHistorica,projetarRegistroFactual,projetarComparacaoFactual,projetarResumoHistoricoFactual } from './projecao-registro-factual';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isUUID } from 'class-validator';
import { IsNull, type EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { RegistroAnaliseFactualOrm } from '../infraestrutura/registro-analise-factual.orm';
import { PlanoAlimentarOrm } from '../infraestrutura/plano-alimentar.orm';
import { PlanoAlimentarVersaoOrm } from '../infraestrutura/plano-alimentar-versao.orm';
import { PlanoAlimentarRefeicaoOrm } from '../infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarItemOrm } from '../infraestrutura/plano-alimentar-item.orm';
import { lerEstadosRefeicoes } from '../infraestrutura/estados-refeicoes';
import { lerEstadoEdicaoPersistida } from './estado-edicao-persistida';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { construirAnaliseFactual, lerRegistroAnaliseFactual, type EntradaConstrutorAnaliseFactual, type RegistroAnaliseFactual } from './construtor-analise-factual';
import { compararVersoesFactuais, type IdentidadeVersaoFactual, type ComparacaoVersoesFactuais } from '../dominio/comparacao-versoes-factuais';
export interface ComandoRegistroFactual { chaveIdempotencia:string;origem:Omit<IdentidadeVersaoFactual,'registradaEm'> }
export interface ComandoRegistroDeVersaoFactual {
 registro:ComandoRegistroFactual;
 selecao:{ativacaoRevisaoEsperada:number;identidadesRefeicoes:string[]};
}
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
export function validarRegistroDeVersaoFactual(entrada:unknown):ComandoRegistroDeVersaoFactual {
  const e=campos(entrada,['registro','selecao']),s=campos(e.selecao,['ativacaoRevisaoEsperada','identidadesRefeicoes']);
  const registro=validarComando(e.registro as ComandoRegistroFactual),ids=s.identidadesRefeicoes;
  if(!Number.isSafeInteger(s.ativacaoRevisaoEsperada)||Number(s.ativacaoRevisaoEsperada)<0||!Array.isArray(ids)||
   Object.getPrototypeOf(ids)!==Array.prototype||ids.length>50||Object.getOwnPropertySymbols(ids).length||
   Object.keys(ids).length!==ids.length||Object.entries(Object.getOwnPropertyDescriptors(ids)).some(([k,d])=>
    k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=ids.length||!d.enumerable||!Object.hasOwn(d,'value'))))throw new BadRequestException('Seleção inválida.');
  const identidadesRefeicoes=ids.map(uuid);
  if(new Set(identidadesRefeicoes).size!==ids.length)throw new BadRequestException('Seleção inválida.');
  const selecao={ativacaoRevisaoEsperada:s.ativacaoRevisaoEsperada as number,identidadesRefeicoes};
  return {registro,selecao};
}
/** Infraestrutura interna. Nunca aceitar callbacks, snapshots ou totais como body HTTP. */
@Injectable()
export class ServicoRegistrosAnaliseFactual {
 constructor(private readonly executor:ExecutorTenant,private readonly crypto:CriptografiaDadosSensiveis){}
 async consultarApi(tenant:string,paciente:string,usuario:UsuarioAutenticado,registroId:string){
  const tenantId=uuid(tenant),pacienteId=uuid(paciente),id=uuid(registroId);this.autorizar(tenantId,usuario,false);
  return this.executor.executar(tenantId,async g=>{
   await this.carteira(g,tenantId,pacienteId,usuario);const r=await this.obterRegistro(g,tenantId,pacienteId,id);
   return projetarRegistroFactual(r,this.decifrarRegistro(r));
  });
 }
 async compararApi(tenant:string,paciente:string,usuario:UsuarioAutenticado,antesId:string,depoisId:string){
  return this.executarComparacao(tenant,paciente,usuario,antesId,depoisId,projetarComparacaoFactual);
 }
 async registrarVersao(tenant:string,paciente:string,usuario:UsuarioAutenticado,entrada:ComandoRegistroDeVersaoFactual):Promise<MetadadosRegistro>{
  const tenantId=uuid(tenant),pacienteId=uuid(paciente);this.autorizar(tenantId,usuario,true);
  const {registro,selecao}=validarRegistroDeVersaoFactual(entrada),identidadesRefeicoes=selecao.identidadesRefeicoes;
  const confirmacaoOrigem=JSON.stringify({contrato:'food06-fonte-salva-v1',origem:registro.origem,ativacaoRevisao:selecao.ativacaoRevisaoEsperada,identidades:[...identidadesRefeicoes].sort()});
  return this.registrar(tenantId,pacienteId,usuario,registro,g=>this.carregarVersao(g,tenantId,pacienteId,registro.origem,selecao),confirmacaoOrigem);
 }
 private async carregarVersao(g:EntityManager,tenantId:string,pacienteId:string,origem:ComandoRegistroFactual['origem'],selecao:ComandoRegistroDeVersaoFactual['selecao']):Promise<EntradaConstrutorAnaliseFactual>{
  // Carteira/profissional/chave já bloqueados por registrar. Writers editoriais
  // também bloqueiam paciente/plano antes da versão; não há transação aninhada.
  const plano=await g.getRepository(PlanoAlimentarOrm).findOne({select:{id:true,ativoParaPaciente:true,ativacaoRevisao:true},
   where:{id:origem.planoId,tenantId,pacienteId,arquivadoEm:IsNull()},lock:{mode:'pessimistic_read'}});
  if(!plano)throw new NotFoundException('Plano indisponível.');
  if(plano.ativacaoRevisao!==selecao.ativacaoRevisaoEsperada)throw new ConflictException('Ativação alterada. Confira novamente a seleção.');
  const versao=await g.getRepository(PlanoAlimentarVersaoOrm).findOne({select:{id:true,numero:true,publicadaEm:true,descartadaEm:true,criadoEm:true,
   rascunhoRevisao:true,edicaoProtegida:true,edicaoSnapshotCriptografado:true,edicaoMaterializadaRevisao:true},
   where:{id:origem.versaoId,tenantId,planoId:plano.id},lock:{mode:'pessimistic_read'}});
  if(!versao||versao.descartadaEm||versao.numero!==origem.numero||(versao.publicadaEm?'publicada':'rascunho')!==origem.status||
   (origem.status==='rascunho'&&versao.rascunhoRevisao!==origem.rascunhoRevisao))throw new ConflictException('Origem alterada. Confira novamente a versão.');
  if(origem.status==='rascunho'){
   const edicao=lerEstadoEdicaoPersistida(versao,b=>this.crypto.descriptografar(b));
   if(edicao.edicaoEstado==='pendente'||edicao.edicaoEstado==='indisponivel')throw new ConflictException('Materialização da revisão indisponível. Confira e salve o plano.');
  }
  const data=versao.publicadaEm??versao.criadoEm;
  if(!(data instanceof Date)||!Number.isFinite(data.getTime()))throw new UnprocessableEntityException('Data da versão indisponível.');
  const refeicoes=await g.getRepository(PlanoAlimentarRefeicaoOrm).find({select:{id:true,ordem:true},where:{tenantId,versaoId:versao.id},order:{ordem:'ASC',id:'ASC'},take:51});
  if(refeicoes.length>50)throw new UnprocessableEntityException('Limite de refeições excedido.');
  const estados=await lerEstadosRefeicoes(g,tenantId,plano.id,versao.id),mapa=new Map(estados.map(e=>[e.refeicao_id,e]));
  if(estados.length!==refeicoes.length||mapa.size!==refeicoes.length||new Set(estados.map(e=>e.identidade_id)).size!==estados.length||
   refeicoes.some(r=>!mapa.has(r.id))||estados.some(e=>typeof e.ativa!=='boolean')||selecao.identidadesRefeicoes.some(id=>!estados.some(e=>e.identidade_id===id)))
   throw new ConflictException('Identidades das refeições indisponíveis. Confira a seleção.');
  const selecionadas=new Set(selecao.identidadesRefeicoes),entrada:EntradaConstrutorAnaliseFactual={escopo:{tenantId,pacienteId},
   origem:{...origem,registradaEm:data.toISOString()},ativo:plano.ativoParaPaciente,selecionado:true,refeicoes:[]};
  let quantidade=0;
  for(const r of refeicoes){
   const estado=mapa.get(r.id)!,itens:EntradaConstrutorAnaliseFactual['refeicoes'][number]['itens']=[],selecionada=selecionadas.has(estado.identidade_id);
   if(entrada.ativo&&estado.ativa&&selecionada){
    const linhas=await g.getRepository(PlanoAlimentarItemOrm).find({select:{id:true,porcaoGramas:true,composicaoSnapshotCriptografada:true},
     where:{tenantId,refeicaoId:r.id},order:{ordem:'ASC',id:'ASC'},take:10001});
    quantidade+=linhas.length;if(quantidade>10000)throw new UnprocessableEntityException('Limite de itens excedido.');
    for(const item of linhas){
     let snapshot:unknown;
     try{snapshot=JSON.parse(this.crypto.descriptografar(item.composicaoSnapshotCriptografada));}
     catch{throw new UnprocessableEntityException('Composição indisponível para registro.');}
     itens.push({porcaoGramas:item.porcaoGramas,snapshot});
    }
   }
   entrada.refeicoes.push({identidadeId:estado.identidade_id,ativa:estado.ativa,selecionada,itens});
  }
  return entrada;
 }
 /** Retorno protegido para composição interna, nunca entidade/DTO HTTP. */
 async ler(tenant:string,paciente:string,usuario:UsuarioAutenticado,registroId:string):Promise<RegistroAnaliseFactual>{
  const tenantId=uuid(tenant),pacienteId=uuid(paciente),id=uuid(registroId);this.autorizar(tenantId,usuario,false);
  return this.executor.executar(tenantId,async g=>{
   await this.carteira(g,tenantId,pacienteId,usuario);
   return this.decifrarRegistro(await this.obterRegistro(g,tenantId,pacienteId,id));
  });
 }
 async comparar(tenant:string,paciente:string,usuario:UsuarioAutenticado,antesId:string,depoisId:string):Promise<ComparacaoVersoesFactuais>{
  return this.executarComparacao(tenant,paciente,usuario,antesId,depoisId,(_a,_b,r)=>r);
 }
 private async executarComparacao<T>(tenant:string,paciente:string,usuario:UsuarioAutenticado,antesId:string,depoisId:string,
  projetar:(a:RegistroAnaliseFactualOrm,b:RegistroAnaliseFactualOrm,r:ComparacaoVersoesFactuais,registroAntes:RegistroAnaliseFactual,registroDepois:RegistroAnaliseFactual)=>T):Promise<T>{
  const tenantId=uuid(tenant),pacienteId=uuid(paciente),a=uuid(antesId),b=uuid(depoisId);this.autorizar(tenantId,usuario,false);
  return this.executor.executar(tenantId,async g=>{
   await this.carteira(g,tenantId,pacienteId,usuario);
   // Autorizar os DOIS recursos antes de abrir qualquer conteúdo. Sem nested tx.
   const antes=await this.obterRegistro(g,tenantId,pacienteId,a),depois=await this.obterRegistro(g,tenantId,pacienteId,b);
   const registroAntes=this.decifrarRegistro(antes),registroDepois=this.decifrarRegistro(depois);
   return projetar(antes,depois,compararVersoesFactuais(registroAntes.versao,registroDepois.versao),registroAntes,registroDepois);
  });
 }
 private async obterRegistro(g:EntityManager,tenantId:string,pacienteId:string,id:string):Promise<RegistroAnaliseFactualOrm>{
  const r=await g.getRepository(RegistroAnaliseFactualOrm).findOne({where:{tenantId,pacienteId,id}});
  if(!r)throw new NotFoundException('Registro indisponível.');
  return r;
 }
 private decifrarRegistro(r:RegistroAnaliseFactualOrm):RegistroAnaliseFactual{
  try{
   const registro=lerRegistroAnaliseFactual(this.abrirEnvelope(r).conteudo);
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
 private abrirEnvelope(r:RegistroAnaliseFactualOrm):{conteudo:string;confirmacaoOrigem?:string} {
  try {
   const e=campos(JSON.parse(this.crypto.descriptografar(r.conteudoCriptografado)),['schemaVersao','tipo','vinculo','conteudo','confirmacaoOrigem']);
   const vinculo=campos(e.vinculo,['id','tenantId','pacienteId','profissionalId','usuarioId','chaveIdempotencia']);
   if((e.schemaVersao!==1&&e.schemaVersao!==2)||e.tipo!==`food06-registro-protegido-v${e.schemaVersao}`||typeof e.conteudo!=='string'||
    (e.schemaVersao===1?Object.hasOwn(e,'confirmacaoOrigem'):typeof e.confirmacaoOrigem!=='string'||!e.confirmacaoOrigem||e.confirmacaoOrigem.length>4096)||
    Object.keys(vinculo).length!==6||Object.entries(this.vinculo(r)).some(([k,v])=>vinculo[k]!==v))throw new Error();
   return {conteudo:e.conteudo,...(e.schemaVersao===2?{confirmacaoOrigem:e.confirmacaoOrigem as string}:{})};
  }catch{throw new UnprocessableEntityException('Registro indisponível para conferência.');}
 }
 async registrar(tenant:string,paciente:string,usuario:UsuarioAutenticado,entrada:ComandoRegistroFactual,carregar:CarregarAnaliseFactual,confirmacaoOrigem?:string):Promise<MetadadosRegistro>{
  const tenantId=uuid(tenant),pacienteId=uuid(paciente);this.autorizar(tenantId,usuario,true);
  const comando=validarComando(entrada),usuarioId=uuid(usuario.usuarioId);
  if(typeof carregar!=='function'||(confirmacaoOrigem!==undefined&&(typeof confirmacaoOrigem!=='string'||!confirmacaoOrigem||confirmacaoOrigem.length>4096)))throw new BadRequestException('Carregador indisponível.');
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
    const anteriorAberto=this.abrirEnvelope(anterior);
    if(anteriorAberto.conteudo!==conteudo||anteriorAberto.confirmacaoOrigem!==confirmacaoOrigem)throw new ConflictException('Chave já utilizada com conteúdo diferente.');
    return projetar(anterior);
   }
   const r=repo.create({id:randomUUID(),tenantId,pacienteId,profissionalId,usuarioId,chaveIdempotencia:comando.chaveIdempotencia});
   // v1 continua legível. Fonte real usa v2, que vincula também a confirmação
   // operacional, sem expor metadados clínicos ou inventar fatos no cálculo.
   const schemaVersao=confirmacaoOrigem===undefined?1:2;
   const envelope=JSON.stringify({schemaVersao,tipo:`food06-registro-protegido-v${schemaVersao}`,vinculo:this.vinculo(r),conteudo,...(confirmacaoOrigem===undefined?{}:{confirmacaoOrigem})});
   if(Buffer.byteLength(envelope)>LIMITE_CIPHER-1024)throw new BadRequestException('Análise excede o limite de registro.');
   r.conteudoCriptografado=this.crypto.criptografar(envelope);
   await repo.insert(r);
   await registrarAuditoriaNaTransacao(g,{tenantId,usuarioId,acao:'analises_factuais.registrar',recursoTipo:'analise_factual',recursoId:r.id,metadados:{}});
   // O timestamp é gerado pelo banco; não reconstruir uma data de aplicação.
   const salvo=await repo.findOneOrFail({select:{id:true,criadoEm:true},where:{tenantId,id:r.id}});
   return projetar(salvo);
  });
 }
 async historico(tenant:string,paciente:string,usuario:UsuarioAutenticado,limite=10,cursorId?:string,cursorCriadoEm?:string){
  const tenantId=uuid(tenant),pacienteId=uuid(paciente);this.autorizar(tenantId,usuario,false);
  if(!Number.isSafeInteger(limite)||limite<1||limite>10||(cursorId===undefined)!==(cursorCriadoEm===undefined))throw new BadRequestException('Paginação inválida.');
  let cursorData:string|undefined,cursorUuid:string|undefined;
  if(cursorId!==undefined&&cursorCriadoEm!==undefined){
   cursorUuid=uuid(cursorId);cursorData=cursorCriadoEm;
   if(!Number.isFinite(Date.parse(cursorData))||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursorData))throw new BadRequestException('Paginação inválida.');
  }
  return this.executor.executar(tenantId,async g=>{
   await this.carteira(g,tenantId,pacienteId,usuario);
   const q=g.getRepository(RegistroAnaliseFactualOrm).createQueryBuilder('registro')
    .select(['registro.id','registro.tenantId','registro.pacienteId','registro.profissionalId','registro.usuarioId','registro.chaveIdempotencia','registro.criadoEm','registro.conteudoCriptografado'])
    .where('registro.tenant_id = :tenantId AND registro.paciente_id = :pacienteId',{tenantId,pacienteId})
    .addSelect(`to_char(registro.criado_em AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')`,'cursor_criado_em')
    .orderBy('registro.criado_em','DESC').addOrderBy('registro.id','DESC').take(limite+1);
   if(cursorData&&cursorUuid)q.andWhere('(registro.criado_em < :cursorData OR (registro.criado_em = :cursorData AND registro.id < :cursorUuid))',{cursorData,cursorUuid});
   const resultado=await q.getRawAndEntities(),consultados=resultado.entities,temMais=consultados.length>limite,itens=consultados.slice(0,limite);
   const bytes=itens.reduce((soma,r)=>soma+(Buffer.isBuffer(r.conteudoCriptografado)?r.conteudoCriptografado.byteLength:Infinity),0);
   if(!Number.isSafeInteger(bytes)||bytes>10*1024*1024)throw new PayloadTooLargeException('Reduza a quantidade de registros por página.');
   const registros=itens.map(r=>this.decifrarRegistro(r)),maisAntigoConsultado=temMais?this.decifrarRegistro(consultados[limite]):undefined;
   const resumos=registros.map((r,i)=>projetarResumoHistoricoFactual(itens[i],r,compararBaseComposicaoHistorica(r,registros[i+1]??maisAntigoConsultado)));
   const ultimo=itens.at(-1),ultimoRaw=resultado.raw.at(limite-1) as {cursor_criado_em?:unknown}|undefined;
   if(temMais&&ultimo&&(typeof ultimoRaw?.cursor_criado_em!=='string'))throw new UnprocessableEntityException('Cursor do histórico indisponível.');
   return {itens:resumos,temMais,...(temMais&&ultimo?{proximoCursor:{id:ultimo.id,criadoEm:ultimoRaw!.cursor_criado_em as string}}:{})};
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
