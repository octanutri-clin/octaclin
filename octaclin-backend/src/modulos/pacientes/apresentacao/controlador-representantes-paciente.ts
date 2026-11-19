import { Body, Controller, Header, HttpCode, HttpException, InternalServerErrorException, Param, ParseUUIDPipe, Post, UseFilters, UseGuards } from '@nestjs/common';
import { IsIn, IsString, IsUUID, isUUID, MaxLength } from 'class-validator';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { FeatureFlag, GuardaFeatureFlag } from '../../../infraestrutura/feature-flags/guarda-feature-flag';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { FiltroRestricoesClinicas } from '../../planos-alimentares/apresentacao/controlador-restricoes-clinicas';
import { ServicoVinculosRepresentacao } from '../aplicacao/servico-vinculos-representacao';
import { TIPOS_VERIFICACAO_REPRESENTACAO } from '../infraestrutura/vinculo-representacao-paciente.orm';

class RegistrarRepresentanteDto {
  @IsUUID() representanteUsuarioId: string;
  @IsIn([...TIPOS_VERIFICACAO_REPRESENTACAO]) tipoVerificacao: string;
}

/** O e-mail só viaja no corpo (nunca na URL); a validação de formato é do serviço, com resposta genérica. */
class BuscarCandidatoRepresentanteDto {
  @IsString() @MaxLength(254) email: string;
}

function projetarIdentificacao(valor: unknown): Record<string, string> {
  const r = (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {}) as Record<string, unknown>;
  if (r.tipo === 'nome_ficha' && typeof r.nome === 'string' && r.nome.trim() && r.nome.length <= 300) return { tipo: 'nome_ficha', nome: r.nome };
  if (r.tipo === 'email_mascarado' && typeof r.email === 'string' && r.email.includes('***') && r.email.length <= 260) return { tipo: 'email_mascarado', email: r.email };
  throw new InternalServerErrorException('Operação indisponível.');
}

function corpoVazio(dados: unknown): void {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
}

function projetarVinculo(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new InternalServerErrorException('Operação indisponível.');
  const r = valor as Record<string, unknown>;
  if (typeof r.id !== 'string' || !isUUID(r.id) || typeof r.representanteUsuarioId !== 'string' || !isUUID(r.representanteUsuarioId) ||
    !(TIPOS_VERIFICACAO_REPRESENTACAO as readonly unknown[]).includes(r.tipoVerificacao) ||
    !(r.verificadoEm instanceof Date) || !Number.isFinite(r.verificadoEm.getTime())) throw new InternalServerErrorException('Operação indisponível.');
  return { id: r.id, representanteUsuarioId: r.representanteUsuarioId, tipoVerificacao: r.tipoVerificacao, verificadoEm: r.verificadoEm.toISOString(),
    identificacao: projetarIdentificacao(r.identificacao) };
}

/**
 * FOOD06 P2d-3a: a equipe do paciente (Professional responsável ou Collaborator com a carteira delegada) administra quem o
 * representa no portal. Atrás da flag `restricoes.clinicas`. A guarda só filtra papel e leitura; a autorização real
 * (carteira atual, delegação vigente, representante elegível) é do serviço, sob lock e na transação.
 */
@Controller('pacientes/:pacienteId/representantes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag)
@FeatureFlag('restricoes.clinicas')
@Papeis('Professional', 'Collaborator')
@UseFilters(FiltroRestricoesClinicas)
export class ControladorRepresentantesPaciente {
  constructor(private readonly vinculos: ServicoVinculosRepresentacao) {}

  @Post('listar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string, @Body() dados: unknown): Promise<unknown> {
    corpoVazio(dados);
    const lista = await this.vinculos.listar(usuario, pacienteId);
    if (!Array.isArray(lista)) throw new InternalServerErrorException('Operação indisponível.');
    return { itens: lista.map(projetarVinculo) };
  }

  /**
   * P3-0b: busca da conta pelo e-mail exato. Resposta `{ candidato: null }` igual para "não existe" e "não elegível";
   * 429 quando a cota do usuário acaba.
   */
  @Post('candidato/buscar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async buscarCandidato(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: BuscarCandidatoRepresentanteDto): Promise<unknown> {
    const r = await this.vinculos.buscarCandidato(usuario, pacienteId, dados.email) as unknown as Record<string, unknown>;
    if (!r || typeof r !== 'object' || !('candidato' in r)) throw new InternalServerErrorException('Operação indisponível.');
    if (r.candidato === null) return { candidato: null };
    const c = (r.candidato ?? {}) as Record<string, unknown>;
    if (typeof c.usuarioId !== 'string' || !isUUID(c.usuarioId)) throw new InternalServerErrorException('Operação indisponível.');
    return { candidato: { usuarioId: c.usuarioId, identificacao: projetarIdentificacao(c.identificacao) } };
  }

  @Post('registrar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async registrar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: RegistrarRepresentanteDto): Promise<unknown> {
    return projetarVinculo(await this.vinculos.registrar(usuario, pacienteId, dados.representanteUsuarioId, dados.tipoVerificacao));
  }

  @Post(':vinculoId/revogar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async revogar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('vinculoId', ParseUUIDPipe) vinculoId: string, @Body() dados: unknown): Promise<unknown> {
    corpoVazio(dados);
    const r = await this.vinculos.revogar(usuario, pacienteId, vinculoId) as unknown as Record<string, unknown>;
    if (!r || r.id !== vinculoId.toLowerCase() || r.revogado !== true) throw new InternalServerErrorException('Operação indisponível.');
    return { id: r.id, revogado: true };
  }
}
