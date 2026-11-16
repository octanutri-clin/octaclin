import { Body, Controller, Header, HttpCode, HttpException, InternalServerErrorException, Param, ParseUUIDPipe, Post, UseFilters, UseGuards } from '@nestjs/common';
import { IsUUID, isUUID } from 'class-validator';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { FeatureFlag, GuardaFeatureFlag } from '../../../infraestrutura/feature-flags/guarda-feature-flag';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { FiltroRestricoesClinicas } from '../../planos-alimentares/apresentacao/controlador-restricoes-clinicas';
import { ServicoDelegacoesCarteira } from '../aplicacao/servico-delegacoes-carteira';

class ConcederDelegacaoDto {
  @IsUUID() colaboradorUsuarioId: string;
}

function projetarDelegacao(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new InternalServerErrorException('Operação indisponível.');
  const r = valor as Record<string, unknown>;
  if (typeof r.id !== 'string' || !isUUID(r.id) || typeof r.colaboradorUsuarioId !== 'string' || !isUUID(r.colaboradorUsuarioId) ||
    !(r.concedidaEm instanceof Date) || !Number.isFinite(r.concedidaEm.getTime())) throw new InternalServerErrorException('Operação indisponível.');
  return { id: r.id, colaboradorUsuarioId: r.colaboradorUsuarioId, concedidaEm: r.concedidaEm.toISOString() };
}

/**
 * FOOD06 P2d-2: o titular Professional administra quem pode registrar pendências na carteira dele. Atrás da flag
 * `restricoes.clinicas` (único consumidor hoje). A autorização real (titular ativo, alvo Collaborator ativo do tenant,
 * sem auto-delegação) é do serviço, sob lock e na transação.
 */
@Controller('profissional/delegacoes-carteira')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag)
@FeatureFlag('restricoes.clinicas')
@Papeis('Professional')
@UseFilters(FiltroRestricoesClinicas)
export class ControladorDelegacoesCarteira {
  constructor(private readonly delegacoes: ServicoDelegacoesCarteira) {}

  @Post('listar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: unknown): Promise<unknown> {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
    const lista = await this.delegacoes.listar(usuario);
    if (!Array.isArray(lista)) throw new InternalServerErrorException('Operação indisponível.');
    return { itens: lista.map(projetarDelegacao) };
  }

  @Post('conceder') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async conceder(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: ConcederDelegacaoDto): Promise<unknown> {
    return projetarDelegacao(await this.delegacoes.conceder(usuario, dados.colaboradorUsuarioId));
  }

  @Post(':delegacaoId/revogar') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async revogar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('delegacaoId', ParseUUIDPipe) delegacaoId: string,
    @Body() dados: unknown): Promise<unknown> {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
    const r = await this.delegacoes.revogar(usuario, delegacaoId) as unknown as Record<string, unknown>;
    if (!r || r.id !== delegacaoId.toLowerCase() || r.revogada !== true) throw new InternalServerErrorException('Operação indisponível.');
    return { id: r.id, revogada: true };
  }
}
