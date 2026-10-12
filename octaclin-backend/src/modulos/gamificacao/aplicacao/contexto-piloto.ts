import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, HttpException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { exigirAdulto, exigirAutorProfissional } from '../dominio/piloto-gamificacao';
import { ServicoConfiguracaoPiloto } from './servico-configuracao-piloto';

@Injectable()
export class ConteudoPiloto {
  constructor(private readonly cripto: CriptografiaDadosSensiveis) {}
  lerNomeCadastral(bytes:Buffer):string {
    try {
      const valor=this.cripto.descriptografar(bytes);
      if(!valor.trim()||valor.length>1000)throw new Error();
      return valor;
    }catch{throw new ConflictException('Contexto do aceite indisponivel.');}
  }
  cifrar(escopo: string, dados: unknown): Buffer { return this.cripto.criptografar(JSON.stringify({ escopo, dados })); }
  ler<T>(escopo: string, bytes: Buffer): T {
    try {
      const body = JSON.parse(this.cripto.descriptografar(bytes)) as { escopo: string; dados: T };
      if (body.escopo !== escopo) throw new Error();
      return body.dados;
    } catch { throw new ConflictException('Conteudo indisponivel.'); }
  }
  cursor(escopo: string, dados: unknown): string { return this.cifrar(`cursor:${escopo}`, dados).toString('base64url'); }
  abrirCursor<T>(escopo: string, cursor: string): T {
    if (cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new BadRequestException('Cursor invalido.');
    return this.ler<T>(`cursor:${escopo}`, Buffer.from(cursor, 'base64url'));
  }
}

export interface PacientePiloto { id: string; profissional_responsavel_id: string; usuario_id: string | null; data_nascimento: string }
export interface ContextoPiloto { m: EntityManager; u: UsuarioAutenticado; paciente?: PacientePiloto; profissionalId?: string }
export interface ComandoPiloto { chave: string; versaoEsperada: number }

function normalizar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizar);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([,x]) => x !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,x]) => [k, normalizar(x)]));
  return v;
}

@Injectable()
export class ContextoGamificacaoPiloto {
  constructor(private readonly executor: ExecutorTenant, readonly conteudo: ConteudoPiloto, private readonly config: ServicoConfiguracaoPiloto) {}

  async executar<T>(u: UsuarioAutenticado, recurso: 'conquistas' | 'comunidade', operacao: (c: ContextoPiloto) => Promise<T>, privacidade = false): Promise<T> {
    if (u.papel !== 'Patient') exigirAutorProfissional(u);
    return this.executor.executar(u.tenantId, async m => {
      // A deliberately bounded pilot: one serialization point per tenant, same as configuration.
      // Reads also take it so revocation/response projection cannot interleave.
      await m.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`gamificacao317:${u.tenantId}`]);
      if (!privacidade) await this.config.exigir(m, u.tenantId, recurso);
      const [tenant] = await m.query(`select id from tenants where id=$1 and status='ativo' and ciclo_vida_status in ('primeiro_uso_validado','acompanhamento_48h','ativo','ativo_assistido') for share`, [u.tenantId]);
      if (!tenant) throw new ForbiddenException('Piloto indisponivel.');
      const [actor] = await m.query(`select id from usuarios where tenant_id=$1 and id=$2 and ativo=true and role=$3 for share`, [u.tenantId,u.usuarioId,u.papel]);
      if (!actor) throw new ForbiddenException('Acesso nao autorizado.');
      if (u.sessaoId) {
        const [session] = await m.query('select id from sessoes_usuario where tenant_id=$1 and usuario_id=$2 and id=$3 and revogado_em is null and expira_em>now() for share', [u.tenantId,u.usuarioId,u.sessaoId]);
        if (!session) throw new ForbiddenException('Sessao indisponivel.');
      }
      const c: ContextoPiloto = { m, u };
      if (u.papel === 'Professional') {
        const profissionais = await m.query(`select id from profissionais where tenant_id=$1 and usuario_id=$2 and arquivado_em is null for share`, [u.tenantId,u.usuarioId]);
        if (profissionais.length!==1) throw new ForbiddenException('Acesso nao autorizado.');
        c.profissionalId = profissionais[0].id;
      } else {
        const sql = privacidade
          ? `select id,usuario_id,profissional_responsavel_id,data_nascimento::text from pacientes where tenant_id=$1 and usuario_id=$2 for update`
          : `select p.id,p.usuario_id,p.profissional_responsavel_id,p.data_nascimento::text from pacientes p
          join profissionais pr on pr.id=p.profissional_responsavel_id and pr.tenant_id=p.tenant_id
          join usuarios pu on pu.id=pr.usuario_id and pu.tenant_id=pr.tenant_id
          where p.tenant_id=$1 and p.usuario_id=$2 and p.arquivado_em is null and p.status_ciclo_vida='ACTIVE'
            and pr.arquivado_em is null and pu.ativo=true and pu.role='Professional' for update of p for share of pr,pu`;
        const pacientes = await m.query(sql, [u.tenantId,u.usuarioId]);
        const p = pacientes.length===1 ? pacientes[0] : undefined;
        if (!p) throw new ForbiddenException('Participacao indisponivel.');
        if (!privacidade) exigirAdulto(p.data_nascimento); c.paciente=p;
      }
      return operacao(c);
    });
  }

  async paciente(c: ContextoPiloto, id: string): Promise<PacientePiloto> {
    if (!c.profissionalId) throw new ForbiddenException('Acao exclusiva do profissional responsavel.');
    const [p] = await c.m.query(`select id,usuario_id,profissional_responsavel_id,data_nascimento::text from pacientes
      where tenant_id=$1 and id=$2 and profissional_responsavel_id=$3 and arquivado_em is null and status_ciclo_vida='ACTIVE' for update`, [c.u.tenantId,id,c.profissionalId]);
    if (!p) throw new NotFoundException('Paciente nao encontrado no escopo.');
    exigirAdulto(p.data_nascimento); return p;
  }

  async comando<T>(c: ContextoPiloto, acao: string, alvo: string, d: ComandoPiloto, corpo: unknown, executar: () => Promise<T>, quota?: 'conteudo' | 'reacao' | 'denuncia'): Promise<T> {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(d.chave)) throw new BadRequestException('Chave invalida.');
    const escopo = `${c.u.tenantId}:comando:${c.u.usuarioId}:${d.chave}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(normalizar({ acao,alvo,corpo,versaoEsperada:d.versaoEsperada }))).digest('hex');
    const [row] = await c.m.query(`select acao,fingerprint_criptografado,resultado_criptografado,expirado_em from comandos_gamificacao where tenant_id=$1 and usuario_id=$2 and chave=$3`, [c.u.tenantId,c.u.usuarioId,d.chave]);
    if (row) {
      if (row.expirado_em || !row.fingerprint_criptografado) throw new ConflictException('Comando expirado. Confira novamente e use nova chave.');
      if (row.acao !== acao || this.conteudo.ler<string>(`${escopo}:fingerprint`, row.fingerprint_criptografado) !== fingerprint) throw new ConflictException('Chave ja usada com outra operacao.');
      return this.conteudo.ler<T>(`${escopo}:resultado`, row.resultado_criptografado);
    }
    if (quota) {
      const [count] = await c.m.query(`select count(*)::int as total from comandos_gamificacao where tenant_id=$1 and usuario_id=$2 and acao like $3 and criado_em>now()-interval '1 minute'`, [c.u.tenantId,c.u.usuarioId,`${quota}.%`]);
      if (count.total >= { conteudo:10,reacao:30,denuncia:5 }[quota]) throw new HttpException('Limite temporario de publicacoes. Tente novamente.',429);
    }
    const result = await executar();
    await c.m.query(`insert into comandos_gamificacao(tenant_id,usuario_id,chave,acao,fingerprint_criptografado,resultado_criptografado) values ($1,$2,$3,$4,$5,$6)`, [c.u.tenantId,c.u.usuarioId,d.chave,acao,this.conteudo.cifrar(`${escopo}:fingerprint`,fingerprint),this.conteudo.cifrar(`${escopo}:resultado`,result)]);
    return result;
  }

  versao(atual: number, esperada: number) { if (atual !== esperada) throw new ConflictException('Recurso mudou. Confira novamente.'); }
}
