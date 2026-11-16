import { Body, Controller, Header, HttpCode, HttpException, InternalServerErrorException, Post, UseFilters, UseGuards } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { FeatureFlag, GuardaFeatureFlag } from '../../../infraestrutura/feature-flags/guarda-feature-flag';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoPortalRestricoes } from '../aplicacao/servico-portal-restricoes';
import { FiltroRestricoesClinicas } from './controlador-restricoes-clinicas';

/**
 * FOOD06 P2d-3a: portal de restrições do paciente, atrás da flag `restricoes.clinicas`. Nesta etapa só o seletor de
 * pacientes (próprio e representados). As rotas por paciente chegam na P2d-3b e provam o acesso no servidor.
 */
@Controller('portal/restricoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag)
@FeatureFlag('restricoes.clinicas')
@Papeis('Patient')
@UseFilters(FiltroRestricoesClinicas)
export class ControladorPortalRestricoes {
  constructor(private readonly portal: ServicoPortalRestricoes) {}

  @Post('pacientes/listar') @HttpCode(200) @Permissoes('portal.acessar') @Header('Cache-Control', 'private, no-store')
  async listarPacientes(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: unknown): Promise<unknown> {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
    const lista = await this.portal.listarPacientes(usuario);
    if (!Array.isArray(lista)) throw new InternalServerErrorException('Operação indisponível.');
    return { itens: lista.map(v => {
      const r = v as unknown as Record<string, unknown>;
      if (!r || typeof r.pacienteId !== 'string' || !isUUID(r.pacienteId) || (r.via !== 'propria' && r.via !== 'representante') ||
        typeof r.nome !== 'string') throw new InternalServerErrorException('Operação indisponível.');
      return { pacienteId: r.pacienteId, via: r.via, nome: r.nome };
    }) };
  }
}
