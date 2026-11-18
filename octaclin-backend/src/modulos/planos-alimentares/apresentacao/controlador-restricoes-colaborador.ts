import { Body, Controller, Header, HttpCode, HttpException, Param, ParseUUIDPipe, Post, UseFilters, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { FeatureFlag, GuardaFeatureFlag } from '../../../infraestrutura/feature-flags/guarda-feature-flag';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { validarConteudoRestricao } from '../dominio/conteudo-restricao';
import { ServicoLeituraRestricao } from '../aplicacao/servico-leitura-restricao';
import { ServicoRegistroPendenciaRestricao } from '../aplicacao/servico-registro-pendencia-restricao';
import { ConsultarRestricaoDto, FiltroRestricoesClinicas, projetarConsulta, projetarListagem, projetarRegistro, RegistrarPendenciaDto } from './controlador-restricoes-clinicas';

/**
 * FOOD06 P2d-2 (Q6): o Collaborator com carteira delegada só REGISTRA pendência e lê o que ele mesmo registrou.
 * Nunca confirma, rejeita, inativa, reconfirma nem decide pedidos. A delegação é provada no serviço, sob lock, na
 * mesma transação; a guarda só filtra papel, permissão de leitura e a flag `restricoes.clinicas` (padrão desligada).
 */
@Controller('colaborador/pacientes/:pacienteId/restricoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag)
@FeatureFlag('restricoes.clinicas')
@Papeis('Collaborator')
@UseFilters(FiltroRestricoesClinicas)
export class ControladorRestricoesColaborador {
  constructor(private readonly leitura: ServicoLeituraRestricao, private readonly registro: ServicoRegistroPendenciaRestricao) {}

  @Post('registrar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async registrar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: RegistrarPendenciaDto): Promise<unknown> {
    let conteudo: ReturnType<typeof validarConteudoRestricao>;
    try { conteudo = validarConteudoRestricao(dados.conteudo); } catch { throw new HttpException('Solicitação inválida.', 400); }
    return projetarRegistro(await this.registro.registrar(usuario, pacienteId, { chaveCriacao: dados.chaveCriacao, conteudo }));
  }

  /** FOOD06 P3-0a: só as restrições que o próprio colaborador registrou. */
  @Post('listar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: unknown): Promise<unknown> {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
    return projetarListagem(await this.leitura.listar(usuario, pacienteId));
  }

  @Post('consultar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async consultar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: ConsultarRestricaoDto): Promise<unknown> {
    return projetarConsulta(await this.leitura.consultarAutoria(usuario, pacienteId, dados.restricaoId));
  }
}
