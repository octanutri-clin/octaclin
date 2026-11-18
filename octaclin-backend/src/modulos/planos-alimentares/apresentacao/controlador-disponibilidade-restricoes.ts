import { Body, Controller, Header, HttpCode, HttpException, Post, UseFilters, UseGuards } from '@nestjs/common';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { ServicoFeatureFlags } from '../../../infraestrutura/feature-flags/servico-feature-flags';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { FiltroRestricoesClinicas } from './controlador-restricoes-clinicas';

/**
 * FOOD06 P3-0a (achado MÉDIA da revisão R4 da #555): diz à web se a flag `restricoes.clinicas` está ligada para o tenant
 * de quem pergunta, para a tela não mostrar a entrada e depois um "sem acesso". De propósito SEM a guarda da flag: é a
 * própria pergunta. Devolve só um booleano; o tenant vem do JWT; nenhuma leitura de dado clínico.
 */
@Controller('restricoes/disponibilidade')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('Professional', 'Collaborator', 'Patient')
@UseFilters(FiltroRestricoesClinicas)
export class ControladorDisponibilidadeRestricoes {
  constructor(private readonly flags: ServicoFeatureFlags) {}

  @Post() @HttpCode(200) @Header('Cache-Control', 'private, no-store')
  async consultar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: unknown): Promise<{ habilitada: boolean }> {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
    return { habilitada: (await this.flags.habilitada(usuario.tenantId, 'restricoes.clinicas')) === true };
  }
}
