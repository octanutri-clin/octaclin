import { dataCivilHoje } from '../dominio/piloto-gamificacao';
import { obterTimezoneClinicoDoTenant } from '../../../infraestrutura/tempo/timezone-clinico';
import { ocultarAutorPiloto317 } from './invalidar-contexto-piloto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { exigirAdulto, exigirAutorProfissional, exigirNomeExibicao, MAX_CIRCULOS, MAX_MEMBROS, TERMO_COMUNIDADE } from '../dominio/piloto-gamificacao';
import { ComandoPiloto, ContextoGamificacaoPiloto, ContextoPiloto } from './contexto-piloto';
import { PaginaPiloto } from './servico-conquistas-piloto';

export interface CirculoPiloto { id:string;profissional_id:string;estado_piloto:string;versao_piloto:number;snapshot_criptografado:Buffer;criado_texto:string }
export interface PerfilMembro { id:string;paciente_id:string;nome:string;geracao:number;versao_piloto:number;usuario_aceite_id:string }
interface CirculoListagem extends CirculoPiloto { estado_membro: string | null; membro_versao: number | null; geracao: number | null; convite_expira_em: Date | null }
interface SnapshotNome { nome:string;dataNascimento:string;profissionalId:string;usuarioId:string }

@Injectable()
export class ServicoCirculosPiloto {
  constructor(private readonly base: ContextoGamificacaoPiloto) {}
  async circulo(c: ContextoPiloto,id:string,privacidade=false): Promise<CirculoPiloto> {
    const [r]=await c.m.query(`select *,criado_em::text as criado_texto from circulos_pacientes where tenant_id=$1 and id=$2 and modelo_versao=317 for update`,[c.u.tenantId,id]);
    const responsavel=c.profissionalId ?? c.paciente?.profissional_responsavel_id;
    if (!r || (c.profissionalId ? r.profissional_id!==responsavel : (!privacidade && r.profissional_id!==responsavel))) throw new NotFoundException('Circulo nao encontrado no escopo.');
    if (!privacidade && r.estado_piloto!=='ativo') throw new ForbiddenException('Circulo indisponivel.');
    return r;
  }
  async perfis(c: ContextoPiloto,r: CirculoPiloto): Promise<Map<string,PerfilMembro>> {
    const rows=await c.m.query(`select m.*,p.data_nascimento::text,p.usuario_id,p.profissional_responsavel_id from membros_circulo m
      join pacientes p on p.id=m.paciente_id and p.tenant_id=m.tenant_id
      join usuarios u on u.id=p.usuario_id and u.tenant_id=p.tenant_id
      join profissionais pr on pr.tenant_id=p.tenant_id and pr.id=$4
      join usuarios pu on pu.tenant_id=pr.tenant_id and pu.id=pr.usuario_id
      join tenants t on t.id=p.tenant_id
      where m.tenant_id=$1 and m.circulo_id=$2 and m.estado_piloto='ativo' and m.revogado_em is null
        and m.termo_versao=$3 and m.usuario_aceite_id=p.usuario_id and p.profissional_responsavel_id=$4
        and p.arquivado_em is null and p.status_ciclo_vida='ACTIVE' and u.ativo=true and u.role='Patient'
        and pr.arquivado_em is null and pu.ativo=true and pu.role='Professional' and t.status='ativo'
      order by m.id limit 50 for share of p,u,pr,pu,t`,[c.u.tenantId,r.id,TERMO_COMUNIDADE,r.profissional_id]);
    const hoje=c.hoje ?? dataCivilHoje(new Date(),await obterTimezoneClinicoDoTenant(c.m,c.u.tenantId));
    const result=new Map<string,PerfilMembro>();
    for (const row of rows) {
      try { exigirAdulto(row.data_nascimento,hoje); } catch { continue; }
      let snapshot:SnapshotNome;
      try { snapshot=this.base.conteudo.ler<SnapshotNome>(`${c.u.tenantId}:membro:${row.id}:nome`,row.nome_criptografado); } catch { continue; }
      if (snapshot.dataNascimento!==row.data_nascimento || snapshot.profissionalId!==r.profissional_id || snapshot.usuarioId!==row.usuario_id) continue;
      result.set(row.paciente_id,{id:row.id,paciente_id:row.paciente_id,nome:snapshot.nome,geracao:row.geracao,versao_piloto:row.versao_piloto,usuario_aceite_id:row.usuario_aceite_id});
    }
    return result;
  }
  async participante(c: ContextoPiloto,r: CirculoPiloto) {
    if (!c.paciente) throw new ForbiddenException('Acesso exclusivo do paciente.');
    const perfis=await this.perfis(c,r),member=perfis.get(c.paciente.id);
    if (!member) throw new ForbiddenException('Participacao indisponivel. Confira um novo convite.');
    return {member,perfis};
  }
  async criar(u:UsuarioAutenticado,d:ComandoPiloto & {nome:string;objetivo:string}) {
    exigirAutorProfissional(u);
    if (!d.nome?.trim() || d.nome.length>160 || !d.objetivo?.trim() || d.objetivo.length>160) throw new BadRequestException('Confira os campos do circulo.');
    return this.base.executar(u,'comunidade',c => this.base.comando(c,'circulo.criar','novo',d,{nome:d.nome,objetivo:d.objetivo},async()=>{
      if (d.versaoEsperada!==0) throw new BadRequestException('Versao inicial invalida.');
      const [count]=await c.m.query(`select count(*)::int as total from circulos_pacientes where tenant_id=$1 and profissional_id=$2 and modelo_versao=317 and estado_piloto='ativo'`,[u.tenantId,c.profissionalId]);
      if (count.total>=MAX_CIRCULOS) throw new ForbiddenException('Limite de circulos ativos atingido.');
      const id=randomUUID();
      await c.m.query(`insert into circulos_pacientes(id,tenant_id,profissional_id,nome,objetivo,privado,modelo_versao,snapshot_criptografado) values($1,$2,$3,'Circulo privado','Comunidade privada',true,317,$4)`,[id,u.tenantId,c.profissionalId,this.base.conteudo.cifrar(`${u.tenantId}:circulo:${id}`,{nome:d.nome.trim(),objetivo:d.objetivo.trim()})]);
      return {id,versao:1,estado:'ativo'};
    }));
  }
  async convidar(u:UsuarioAutenticado,id:string,pacienteId:string,d:ComandoPiloto) {
    exigirAutorProfissional(u);
    return this.base.executar(u,'comunidade',async c=>{
      const r=await this.circulo(c,id);await this.base.paciente(c,pacienteId);
      return this.base.comando(c,'circulo.convidar',`${id}:${pacienteId}`,d,{},async()=>{
        const [old]=await c.m.query(`select * from membros_circulo where tenant_id=$1 and circulo_id=$2 and paciente_id=$3 for update`,[u.tenantId,id,pacienteId]);
        this.base.versao(old?.versao_piloto ?? 0,d.versaoEsperada);
        if (old) await this.ocultarAutor(c,id,pacienteId);
        const generation=(old?.geracao ?? 0)+1;
        const [row]=await c.m.query(`insert into membros_circulo(tenant_id,circulo_id,paciente_id,estado_piloto,geracao,autor_convite_usuario_id,convite_expira_em)
          values($1,$2,$3,'convidado',$4,$5,now()+interval '7 days') on conflict(tenant_id,circulo_id,paciente_id) do update
          set estado_piloto='convidado',geracao=$4,autor_convite_usuario_id=$5,convite_expira_em=now()+interval '7 days',versao_piloto=membros_circulo.versao_piloto+1,
            revogado_em=now(),usuario_aceite_id=null,aceito_em=null,termo_versao=null,nome_criptografado=null,eliminar_em=null
          returning versao_piloto,convite_expira_em`,[u.tenantId,id,pacienteId,generation,u.usuarioId]);
        return {id,geracao:generation,versao:row.versao_piloto,estado:'convidado',expiraEm:new Date(row.convite_expira_em).toISOString()};
      });
    });
  }
  async aceitar(u:UsuarioAutenticado,id:string,d:ComandoPiloto & {geracao:number;termoVersao:string;nomeExibicao:string}) {
    if (u.papel!=='Patient') throw new ForbiddenException('Acesso exclusivo do paciente.');
    const nome=exigirNomeExibicao(d.nomeExibicao);
    return this.base.executar(u,'comunidade',async c=>{
      const r=await this.circulo(c,id),p=c.paciente!;
      const [membro]=await c.m.query(`select * from membros_circulo where tenant_id=$1 and circulo_id=$2 and paciente_id=$3 for update`,[u.tenantId,id,p.id]);
      if (!membro || membro.geracao!==d.geracao || !['convidado','ativo'].includes(membro.estado_piloto) || d.termoVersao!==TERMO_COMUNIDADE) throw new ForbiddenException('Convite ou termo indisponivel.');
      if (membro.estado_piloto==='convidado' && new Date(membro.convite_expira_em).getTime()<=Date.now()) throw new ForbiddenException('Convite expirado.');
      return this.base.comando(c,'circulo.aceitar',id,d,{geracao:d.geracao,termoVersao:d.termoVersao,nomeExibicao:nome},async()=>{
        this.base.versao(membro.versao_piloto,d.versaoEsperada);
        if (membro.estado_piloto!=='convidado') throw new ForbiddenException('Participacao ja confirmada.');
        const [count]=await c.m.query(`select count(*)::int as total from membros_circulo where tenant_id=$1 and circulo_id=$2 and estado_piloto='ativo'`,[u.tenantId,id]);
        if (count.total>=MAX_MEMBROS) throw new ForbiddenException('Limite de participantes atingido.');
        await c.m.query(`update membros_circulo set estado_piloto='ativo',nome_criptografado=$4,usuario_aceite_id=$5,termo_versao=$6,aceito_em=now(),revogado_em=null,versao_piloto=versao_piloto+1 where tenant_id=$1 and circulo_id=$2 and paciente_id=$3`,[u.tenantId,id,p.id,this.base.conteudo.cifrar(`${u.tenantId}:membro:${membro.id}:nome`,{nome,dataNascimento:p.data_nascimento,profissionalId:r.profissional_id,usuarioId:u.usuarioId}),u.usuarioId,TERMO_COMUNIDADE]);
        return {id,estado:'ativo',geracao:membro.geracao,versao:membro.versao_piloto+1};
      });
    });
  }
  async ocultarAutor(c:ContextoPiloto,id:string,pacienteId?:string) {
    await ocultarAutorPiloto317(c.m,c.u.tenantId,id,pacienteId);
  }
  async sair(u:UsuarioAutenticado,id:string,d:ComandoPiloto) {
    if (u.papel!=='Patient') throw new ForbiddenException('Acesso exclusivo do paciente.');
    return this.base.executar(u,'comunidade',async c=>{
      await this.circulo(c,id,true);const p=c.paciente!;
      const [membro]=await c.m.query(`select * from membros_circulo where tenant_id=$1 and circulo_id=$2 and paciente_id=$3`,[u.tenantId,id,p.id]);
      if (!membro) throw new NotFoundException('Participacao nao encontrada.');
      return this.base.comando(c,'circulo.sair',id,d,{},async()=>{
        this.base.versao(membro.versao_piloto,d.versaoEsperada);await this.ocultarAutor(c,id,p.id);
        await c.m.query(`update membros_circulo set estado_piloto='saiu',revogado_em=now(),eliminar_em=least(coalesce(eliminar_em,now()+interval '90 days'),now()+interval '90 days'),versao_piloto=versao_piloto+1 where tenant_id=$1 and circulo_id=$2 and paciente_id=$3`,[u.tenantId,id,p.id]);
        return {id,estado:'saiu',versao:membro.versao_piloto+1};
      });
    },true);
  }
  async encerrar(u:UsuarioAutenticado,id:string,d:ComandoPiloto) {
    exigirAutorProfissional(u);
    return this.base.executar(u,'comunidade',async c=>{
      const r=await this.circulo(c,id,true);
      return this.base.comando(c,'circulo.encerrar',id,d,{},async()=>{
        if(r.estado_piloto!=='ativo') throw new ForbiddenException('Circulo ja encerrado.');
        this.base.versao(r.versao_piloto,d.versaoEsperada);await this.ocultarAutor(c,id);
        await c.m.query(`update membros_circulo set estado_piloto='revogado',revogado_em=now(),eliminar_em=least(coalesce(eliminar_em,now()+interval '90 days'),now()+interval '90 days'),versao_piloto=versao_piloto+1 where tenant_id=$1 and circulo_id=$2`,[u.tenantId,id]);
        await c.m.query(`update circulos_pacientes set estado_piloto='encerrado',eliminar_em=now()+interval '90 days',versao_piloto=versao_piloto+1 where tenant_id=$1 and id=$2`,[u.tenantId,id]);
        return {id,estado:'encerrado',versao:r.versao_piloto+1};
      });
    });
  }
  async listar(u:UsuarioAutenticado,pagina:PaginaPiloto) {
    return this.base.executar(u,'comunidade',async c=>{
      let destinatarios:{clinica:string;profissional:string}|undefined;
      if(c.paciente){
        const [responsavel]=await c.m.query(`select t.nome as clinica,pr.nome_criptografado from tenants t join profissionais pr on pr.tenant_id=t.id
          where t.id=$1 and pr.id=$2 and pr.arquivado_em is null for share of t,pr`,[u.tenantId,c.paciente.profissional_responsavel_id]);
        if(!responsavel)throw new ForbiddenException('Contexto do aceite indisponivel.');
        destinatarios={clinica:responsavel.clinica,profissional:this.base.conteudo.lerNomeCadastral(responsavel.nome_criptografado)};
      }
      const escopo=`${u.tenantId}:circulos:${u.usuarioId}`;
      const cursor=pagina.cursor ? this.base.conteudo.abrirCursor<{data:string;id:string}>(escopo,pagina.cursor) : undefined;
      const rows: CirculoListagem[]=await c.m.query(`select r.*,r.criado_em::text as criado_texto,m.estado_piloto as estado_membro,m.versao_piloto as membro_versao,m.geracao,m.convite_expira_em from circulos_pacientes r
        left join membros_circulo m on m.tenant_id=r.tenant_id and m.circulo_id=r.id and m.paciente_id=$3
        where r.tenant_id=$1 and r.profissional_id=$2 and r.modelo_versao=317 and r.snapshot_criptografado is not null and ($3::uuid is null or (m.estado_piloto='ativo' or (m.estado_piloto='convidado' and m.convite_expira_em>now())))
          and ($4::timestamptz is null or (r.criado_em,r.id)<($4::timestamptz,$5::uuid)) order by r.criado_em desc,r.id desc limit 21`,[u.tenantId,c.profissionalId ?? c.paciente!.profissional_responsavel_id,c.paciente?.id ?? null,cursor?.data ?? null,cursor?.id ?? null]);
      const slice=rows.slice(0,20),last=slice.at(-1);
      return {itens:slice.map(r=>{
        const body=this.base.conteudo.ler<{nome:string;objetivo:string}>(`${u.tenantId}:circulo:${r.id}`,r.snapshot_criptografado);
        return {id:r.id,nome:body.nome,objetivo:body.objetivo,estado:r.estado_piloto,versao:r.versao_piloto,...(c.paciente ? {destinatarios,participacao:r.estado_membro,participacaoVersao:r.membro_versao,geracao:r.geracao,conviteExpiraEm:r.convite_expira_em,termoVersao:TERMO_COMUNIDADE} : {})};
      }),temMais:rows.length>20,...(rows.length>20 && last ? {proximoCursor:this.base.conteudo.cursor(escopo,{data:last.criado_texto,id:last.id})} : {})};
    });
  }
  async obterConvite(u:UsuarioAutenticado,id:string,pacienteId:string) {
    exigirAutorProfissional(u);
    return this.base.executar(u,'comunidade',async c=>{
      await this.circulo(c,id);await this.base.paciente(c,pacienteId);
      const [row]=await c.m.query('select estado_piloto,versao_piloto,geracao,convite_expira_em from membros_circulo where tenant_id=$1 and circulo_id=$2 and paciente_id=$3',[u.tenantId,id,pacienteId]);
      return {id,estado:row?.estado_piloto ?? 'nao_convidado',versao:row?.versao_piloto ?? 0,geracao:row?.geracao ?? 0,expiraEm:row?.convite_expira_em ?? null};
    });
  }
  async revogar(u:UsuarioAutenticado,id:string,pacienteId:string,d:ComandoPiloto) {
    exigirAutorProfissional(u);
    return this.base.executar(u,'comunidade',async c=>{
      await this.circulo(c,id,true);await this.base.paciente(c,pacienteId);
      const [row]=await c.m.query('select versao_piloto from membros_circulo where tenant_id=$1 and circulo_id=$2 and paciente_id=$3',[u.tenantId,id,pacienteId]);
      if(!row) throw new NotFoundException('Participacao nao encontrada.');
      return this.base.comando(c,'circulo.revogar',`${id}:${pacienteId}`,d,{},async()=>{
        this.base.versao(row.versao_piloto,d.versaoEsperada);await this.ocultarAutor(c,id,pacienteId);
        await c.m.query("update membros_circulo set estado_piloto='revogado',revogado_em=now(),eliminar_em=least(coalesce(eliminar_em,now()+interval '90 days'),now()+interval '90 days'),versao_piloto=versao_piloto+1 where tenant_id=$1 and circulo_id=$2 and paciente_id=$3",[u.tenantId,id,pacienteId]);
        return {id,estado:'revogado',versao:row.versao_piloto+1};
      });
    });
  }

  async listarParticipacoes(u:UsuarioAutenticado,pagina:PaginaPiloto) {
    if(u.papel!=='Patient') throw new ForbiddenException('Acesso exclusivo do paciente.');
    return this.base.executar(u,'comunidade',async c=>{
      const escopo=`${u.tenantId}:${u.usuarioId}:privacidade:circulos`;
      const cursor=pagina.cursor ? this.base.conteudo.abrirCursor<{id:string}>(escopo,pagina.cursor) : undefined;
      const rows:{id:string;circulo_id:string;versao_piloto:number;estado_piloto:string;geracao:number}[]=await c.m.query(`select mb.id,mb.circulo_id,mb.versao_piloto,mb.estado_piloto,mb.geracao from membros_circulo mb join circulos_pacientes r on r.tenant_id=mb.tenant_id and r.id=mb.circulo_id and r.modelo_versao=317 where mb.tenant_id=$1 and mb.paciente_id=$2 and ($3::uuid is null or mb.id>$3::uuid) order by mb.id limit 21`,[u.tenantId,c.paciente!.id,cursor?.id ?? null]);
      const slice=rows.slice(0,20),last=slice.at(-1);
      return {itens:slice.map(r=>({id:r.circulo_id,versao:r.versao_piloto,geracao:r.geracao,estado:r.estado_piloto})),temMais:rows.length>20,...(rows.length>20 && last ? {proximoCursor:this.base.conteudo.cursor(escopo,{id:last.id})} : {})};
    },true);
  }

}
