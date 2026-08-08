import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { PoliticaProtecaoAbuso, ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import type { ContextoApiPublica } from '../dominio/contratos-integracao';
import { ApiChaveOrm } from '../infraestrutura/api-chave.orm';

const POLITICA_API_PUBLICA: PoliticaProtecaoAbuso = {
  maxTentativas: 120,
  janelaMs: 60_000,
  bloqueioMs: 60_000,
  mensagemBloqueio: 'Limite de requisicoes da chave de API excedido.'
};

const POLITICA_AUTENTICACAO_API: PoliticaProtecaoAbuso = {
  maxTentativas: 300,
  janelaMs: 60_000,
  bloqueioMs: 60_000,
  mensagemBloqueio: 'Muitas tentativas de acesso a API. Tente novamente em instantes.'
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class GuardaChaveApi implements CanActivate {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<Request & { integracaoAutenticada?: ContextoApiPublica }>();
    const autorizacao = requisicao.headers.authorization;
    const valor = autorizacao?.startsWith('Bearer ') ? autorizacao.slice(7).trim() : '';
    const partes = valor.split('.');
    if (partes.length !== 4 || partes[0] !== 'octa_live' || !UUID.test(partes[1]) || !UUID.test(partes[2]) || partes[3].length < 32) {
      throw new UnauthorizedException('Chave de API invalida.');
    }
    const [, tenantId, chaveId, segredo] = partes;
    const hashRecebido = createHash('sha256').update(segredo).digest();

    try {
      await this.protecaoAbuso.consumirTentativa(
        `api-publica-auth:${requisicao.ip || 'ip-desconhecido'}`,
        POLITICA_AUTENTICACAO_API
      );
    } catch (erro) {
      if (erro && typeof erro === 'object' && 'getStatus' in erro) throw erro;
      throw new ServiceUnavailableException('Controle de limite da API indisponivel. Tente novamente.');
    }

    const chave = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const encontrada = await gerenciador.getRepository(ApiChaveOrm).findOne({
        where: { id: chaveId, tenantId, revogadaEm: IsNull() }
      });
      if (!encontrada || (encontrada.expiraEm && encontrada.expiraEm <= new Date())) return null;
      const hashEsperado = Buffer.from(encontrada.segredoHash, 'hex');
      if (hashEsperado.length !== hashRecebido.length || !timingSafeEqual(hashEsperado, hashRecebido)) return null;
      return encontrada;
    });
    if (!chave) throw new UnauthorizedException('Chave de API invalida, expirada ou revogada.');

    try {
      await this.protecaoAbuso.consumirTentativa(`api-publica:${tenantId}:${chaveId}`, POLITICA_API_PUBLICA);
    } catch (erro) {
      if (erro && typeof erro === 'object' && 'getStatus' in erro) throw erro;
      throw new ServiceUnavailableException('Controle de limite da API indisponivel. Tente novamente.');
    }

    await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(ApiChaveOrm).update({ id: chaveId, tenantId, revogadaEm: IsNull() }, { ultimoUsoEm: new Date() })
    );
    requisicao.integracaoAutenticada = {
      tenantId,
      chaveId,
      criadoPorUsuarioId: chave.criadoPorUsuarioId,
      escopos: chave.escopos
    };
    return true;
  }
}
