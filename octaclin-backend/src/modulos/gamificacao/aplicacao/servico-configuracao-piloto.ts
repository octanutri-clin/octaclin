import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { CHAVE_PILOTO, exigirGestorPiloto } from '../dominio/piloto-gamificacao';

export interface ConfiguracaoPiloto { conquistas: boolean; comunidade: boolean; versao: number; operacaoAprovada: boolean }
export interface MutacaoConfiguracaoPiloto { conquistas: boolean; comunidade: boolean; versaoEsperada: number }

@Injectable()
export class ServicoConfiguracaoPiloto {
  constructor(private readonly executor: ExecutorTenant) {}

  private autorizar(tenantId: string, u: UsuarioAutenticado) {
    exigirGestorPiloto(u);
    if (tenantId !== u.tenantId && u.papel !== 'SuperAdmin') throw new ForbiddenException('Configuracao fora do escopo.');
  }

  operacaoAprovada(): boolean { return process.env.GAMIFICACAO_PILOTO_OPERACAO_APROVADA === 'true'; }

  async ler(m: EntityManager, tenantId: string): Promise<ConfiguracaoPiloto> {
    const row = await m.getRepository(TenantConfiguracaoOrm).findOne({ where: { tenantId, chave: CHAVE_PILOTO } });
    const valor = row?.valor;
    return { conquistas: valor?.conquistas === true, comunidade: valor?.comunidade === true,
      versao: Number.isSafeInteger(valor?.versao) ? Number(valor?.versao) : 0, operacaoAprovada: this.operacaoAprovada() };
  }

  async exigir(m: EntityManager, tenantId: string, recurso: 'conquistas' | 'comunidade') {
    const config = await this.ler(m, tenantId);
    if (!config.operacaoAprovada || !config[recurso]) throw new ForbiddenException('Piloto indisponivel.');
  }

  async obter(tenantId: string, u: UsuarioAutenticado) {
    this.autorizar(tenantId, u);
    return this.executor.executar(tenantId, m => this.ler(m, tenantId));
  }

  async atualizar(tenantId: string, u: UsuarioAutenticado, d: MutacaoConfiguracaoPiloto) {
    this.autorizar(tenantId, u);
    if ((d.conquistas || d.comunidade) && !this.operacaoAprovada()) throw new ForbiddenException('Piloto aguarda liberacao operacional.');
    return this.executor.executar(tenantId, async m => {
      await m.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`gamificacao317:${tenantId}`]);
      const config = await this.ler(m, tenantId);
      if (config.versao !== d.versaoEsperada) throw new ConflictException('Configuracao mudou. Confira novamente.');
      const repo = m.getRepository(TenantConfiguracaoOrm);
      const row = await repo.findOne({ where: { tenantId, chave: CHAVE_PILOTO } });
      const valor = { conquistas: d.conquistas, comunidade: d.comunidade, versao: config.versao + 1 };
      await repo.save(repo.create({ id: row?.id, tenantId, chave: CHAVE_PILOTO, valor, criadoEm: row?.criadoEm }));
      return { ...valor, operacaoAprovada: this.operacaoAprovada() };
    });
  }
}
