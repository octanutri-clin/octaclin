import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { exigirAutorProfissional, TERMO_CONQUISTAS } from '../dominio/piloto-gamificacao';
import { ComandoPiloto, ContextoGamificacaoPiloto, ContextoPiloto } from './contexto-piloto';

export interface SnapshotConquista { titulo: string; descricao?: string; icone: string }
interface Conquista { id: string; paciente_id: string; versao_piloto: number; compartilhado: boolean; geracao_compartilhamento: number; snapshot_criptografado: Buffer; conquistado_em: Date; profissional_compartilhamento_id: string | null }
export interface PaginaPiloto { cursor?: string }

@Injectable()
export class ServicoConquistasPiloto {
  constructor(private readonly base: ContextoGamificacaoPiloto) {}
  private async obter(c: ContextoPiloto, pacienteId: string, id: string): Promise<Conquista> {
    const [r] = await c.m.query(`select * from paciente_badges where tenant_id=$1 and paciente_id=$2 and id=$3 and modelo_versao=317 for update`, [c.u.tenantId,pacienteId,id]);
    if (!r) throw new NotFoundException('Conquista nao encontrada no escopo.');
    return r;
  }
  private projetar(c: ContextoPiloto, r: Conquista) {
    const body = this.base.conteudo.ler<SnapshotConquista>(`${c.u.tenantId}:conquista:${r.id}`,r.snapshot_criptografado);
    return { id:r.id,titulo:body.titulo,...(body.descricao ? { descricao:body.descricao } : {}),icone:body.icone,
      criadoEm:r.conquistado_em,origem:'Registrada por profissional da clinica',versao:r.versao_piloto,
      compartilhado:r.compartilhado,geracao:r.geracao_compartilhamento };
  }
  async conceder(u: UsuarioAutenticado, pacienteId: string, d: ComandoPiloto & SnapshotConquista) {
    exigirAutorProfissional(u);
    if (!d.titulo?.trim() || d.titulo.length>120 || (d.descricao?.length ?? 0)>1000 || !['award','heart','book','calendar','check'].includes(d.icone)) throw new BadRequestException('Confira os campos da conquista.');
    return this.base.executar(u,'conquistas',async c => {
      await this.base.paciente(c,pacienteId);
      return this.base.comando(c,'conquista.conceder',pacienteId,d,{titulo:d.titulo,descricao:d.descricao,icone:d.icone},async () => {
        if (d.versaoEsperada!==0) throw new BadRequestException('Versao inicial invalida.');
        const id=randomUUID(),badgeId=randomUUID();
        await c.m.query(`insert into badges(id,tenant_id,nome,icone_svg,regra_conquista) values($1,$2,'Conquista privada',$3,'{"modo":"manual","modelo":317}'::jsonb)`,[badgeId,u.tenantId,d.icone]);
        await c.m.query(`insert into paciente_badges(id,tenant_id,paciente_id,badge_id,modelo_versao,autor_usuario_id,profissional_id,snapshot_criptografado)
          values($1,$2,$3,$4,317,$5,$6,$7)`,[id,u.tenantId,pacienteId,badgeId,u.usuarioId,c.profissionalId,this.base.conteudo.cifrar(`${u.tenantId}:conquista:${id}`,{titulo:d.titulo.trim(),descricao:d.descricao?.trim(),icone:d.icone})]);
        return { id,versao:1,compartilhado:false,geracao:0 };
      });
    });
  }
  async compartilhar(u: UsuarioAutenticado,pacienteId: string,id: string,d: ComandoPiloto & { compartilhado: boolean }) {
    exigirAutorProfissional(u);
    return this.base.executar(u,'conquistas',async c => {
      await this.base.paciente(c,pacienteId); const r=await this.obter(c,pacienteId,id);
      return this.base.comando(c,'conquista.compartilhar',id,d,{compartilhado:d.compartilhado},async () => {
        this.base.versao(r.versao_piloto,d.versaoEsperada);
        const geracao=r.geracao_compartilhamento+(d.compartilhado && (!r.compartilhado || r.profissional_compartilhamento_id!==c.profissionalId) ? 1 : 0);
        await c.m.query(`update paciente_badges set compartilhado=$4,geracao_compartilhamento=$5,versao_piloto=versao_piloto+1,profissional_compartilhamento_id=$6 where tenant_id=$1 and paciente_id=$2 and id=$3`,[u.tenantId,pacienteId,id,d.compartilhado,geracao,c.profissionalId]);
        return { id,versao:r.versao_piloto+1,compartilhado:d.compartilhado,geracao };
      });
    });
  }
  async listarProfissional(u: UsuarioAutenticado,pacienteId: string,pagina: PaginaPiloto) {
    exigirAutorProfissional(u);
    return this.base.executar(u,'conquistas',async c => {
      await this.base.paciente(c,pacienteId); return this.listar(c,pacienteId,pagina,false);
    });
  }
  async listarPortal(u: UsuarioAutenticado,pagina: PaginaPiloto) {
    if (u.papel!=='Patient') throw new ForbiddenException('Acesso exclusivo do paciente.');
    return this.base.executar(u,'conquistas', c => this.listar(c,c.paciente!.id,pagina,true));
  }
  private async listar(c: ContextoPiloto,pacienteId: string,pagina: PaginaPiloto,portal: boolean) {
    const escopo=`${c.u.tenantId}:conquistas:${pacienteId}:${portal ? c.u.usuarioId : c.profissionalId}`;
    const cursor=pagina.cursor ? this.base.conteudo.abrirCursor<{id:string;data:string}>(escopo,pagina.cursor) : undefined;
    const rows: (Conquista & { criado_texto:string;aceito:boolean;consentimento_versao:number })[]=await c.m.query(`
      select b.*,b.conquistado_em::text as criado_texto,
        (cs.aceito_em is not null and cs.revogado_em is null and cs.termo_versao=$7) as aceito,coalesce(cs.versao,0) as consentimento_versao
      from paciente_badges b left join consentimentos_conquistas cs on cs.tenant_id=b.tenant_id and cs.paciente_id=b.paciente_id and cs.conquista_id=b.id and cs.geracao=b.geracao_compartilhamento and cs.usuario_id=$3
      where b.tenant_id=$1 and b.paciente_id=$2 and b.modelo_versao=317
        and ($4::boolean=false or (b.compartilhado=true and b.profissional_compartilhamento_id=$8))
        and ($5::timestamptz is null or (b.conquistado_em,b.id)<($5::timestamptz,$6::uuid))
      order by b.conquistado_em desc,b.id desc limit 21`,[c.u.tenantId,pacienteId,c.u.usuarioId,portal,cursor?.data ?? null,cursor?.id ?? null,TERMO_CONQUISTAS,c.paciente?.profissional_responsavel_id ?? null]);
    const slice=rows.slice(0,20),last=slice.at(-1);
    return { itens:slice.map(r => portal && !r.aceito ? {id:r.id,geracao:r.geracao_compartilhamento,termoVersao:TERMO_CONQUISTAS,aceito:false,consentimentoVersao:r.consentimento_versao} : {...this.projetar(c,r),...(portal ? {aceito:true,termoVersao:TERMO_CONQUISTAS,consentimentoVersao:r.consentimento_versao} : {})}),
      ...(rows.length>20 && last ? {proximoCursor:this.base.conteudo.cursor(escopo,{id:last.id,data:last.criado_texto})} : {}),temMais:rows.length>20 };
  }
  async consentir(u: UsuarioAutenticado,id: string,d: ComandoPiloto & { aceitar:boolean;geracao:number;termoVersao:string }) {
    if (u.papel!=='Patient') throw new ForbiddenException('Acesso exclusivo do paciente.');
    return this.base.executar(u,'conquistas',async c => {
      const p=c.paciente!,r=await this.obter(c,p.id,id);
      if ((d.aceitar && d.geracao!==r.geracao_compartilhamento) || d.geracao<1 || d.geracao>r.geracao_compartilhamento) throw new ConflictException('Compartilhamento mudou. Confira novamente.');
      if (d.aceitar && (!r.compartilhado || r.profissional_compartilhamento_id!==p.profissional_responsavel_id || d.geracao!==r.geracao_compartilhamento || d.termoVersao!==TERMO_CONQUISTAS)) throw new ForbiddenException('Compartilhamento ou termo indisponivel.');
      return this.base.comando(c,'conquista.consentir',id,d,{aceitar:d.aceitar,geracao:d.geracao,termoVersao:d.termoVersao},async () => {
        const [atual]=await c.m.query(`select * from consentimentos_conquistas where tenant_id=$1 and paciente_id=$2 and conquista_id=$3 and usuario_id=$4 and geracao=$5`,[u.tenantId,p.id,id,u.usuarioId,d.geracao]);
        if(!d.aceitar && !atual) throw new NotFoundException('Aceite nao encontrado.');
        this.base.versao(atual?.versao ?? 0,d.versaoEsperada);
        await c.m.query(`insert into consentimentos_conquistas(tenant_id,paciente_id,conquista_id,usuario_id,geracao,termo_versao,aceito_em,revogado_em)
          values($1,$2,$3,$4,$5,$6,case when $7 then now() else null end,case when $7 then null else now() end)
          on conflict(tenant_id,paciente_id,conquista_id,usuario_id,geracao) do update set aceito_em=case when $7 then now() else consentimentos_conquistas.aceito_em end,revogado_em=case when $7 then null else now() end,termo_versao=$6,versao=consentimentos_conquistas.versao+1`,[u.tenantId,p.id,id,u.usuarioId,d.geracao,d.termoVersao,d.aceitar]);
        return {id,aceito:d.aceitar,geracao:d.geracao,consentimentoVersao:(atual?.versao ?? 0)+1};
      });
    },!d.aceitar);
  }
  async listarConsentimentos(u:UsuarioAutenticado,pagina:PaginaPiloto) {
    if(u.papel!=='Patient') throw new ForbiddenException('Acesso exclusivo do paciente.');
    return this.base.executar(u,'conquistas',async c=>{
      const escopo=`${u.tenantId}:${u.usuarioId}:privacidade:conquistas`;
      const cursor=pagina.cursor ? this.base.conteudo.abrirCursor<{id:string}>(escopo,pagina.cursor) : undefined;
      const rows:{id:string;conquista_id:string;geracao:number;versao:number;termo_versao:string;revogado_em:Date|null;aceito_em:Date|null}[]=await c.m.query(`select id,conquista_id,geracao,versao,termo_versao,revogado_em,aceito_em from consentimentos_conquistas where tenant_id=$1 and paciente_id=$2 and usuario_id=$3 and ($4::uuid is null or id>$4::uuid) order by id limit 21`,[u.tenantId,c.paciente!.id,u.usuarioId,cursor?.id ?? null]);
      const slice=rows.slice(0,20),last=slice.at(-1);
      return {itens:slice.map(r=>({id:r.conquista_id,geracao:r.geracao,consentimentoVersao:r.versao,termoVersao:r.termo_versao,aceito:r.aceito_em!==null && r.revogado_em===null})),temMais:rows.length>20,...(rows.length>20 && last ? {proximoCursor:this.base.conteudo.cursor(escopo,{id:last.id})} : {})};
    },true);
  }

}
