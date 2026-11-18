import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Header, HttpCode, HttpException, InternalServerErrorException,
  Param, ParseUUIDPipe, Post, UseFilters, UseGuards } from '@nestjs/common';
import { Allow, ArrayMaxSize, Equals, IsArray, IsBoolean, IsDefined, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, isUUID } from 'class-validator';
import type { Response } from 'express';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { FeatureFlag, GuardaFeatureFlag } from '../../../infraestrutura/feature-flags/guarda-feature-flag';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { validarConteudoRestricao } from '../dominio/conteudo-restricao';
import { ServicoLeituraRestricao } from '../aplicacao/servico-leitura-restricao';
import { ServicoConfirmacaoRestricao } from '../aplicacao/servico-confirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from '../aplicacao/servico-registro-pendencia-restricao';
import { ServicoReconfirmacaoRestricao } from '../aplicacao/servico-reconfirmacao-restricao';
import { ServicoSolicitacoesRestricao } from '../aplicacao/servico-solicitacoes-restricao';

export class ConsultarRestricaoDto {
  @IsUUID() restricaoId: string;
}
export class RegistrarPendenciaDto {
  @IsUUID() chaveCriacao: string;
  @IsDefined() @Allow() conteudo: unknown;
}
class RevisaoRestricaoDto {
  @IsInt() @Min(1) @Max(2147483646) revisao: number;
}
class RejeitarRestricaoDto extends RevisaoRestricaoDto {
  @IsString() @MinLength(1) @MaxLength(4000) justificativa: string;
}
class InativarRestricaoDto extends RejeitarRestricaoDto {
  @IsIn(['registro_incorreto', 'informacao_clinica_revisada', 'solicitacao_fundamentada', 'outro']) motivo: string;
  @IsBoolean() @Equals(true) confirmacaoEmDoisPassos: boolean;
}
class ReavaliarRestricaoDto extends RevisaoRestricaoDto {
  @IsIn(['ativa', 'em_reavaliacao']) destino: 'ativa' | 'em_reavaliacao';
}
class ReconfirmarRestricaoDto {
  @IsUUID() avaliacaoId: string;
  @IsInt() @Min(1) @Max(2147483646) revisaoAvaliacao: number;
  @IsUUID() chaveIdempotencia: string;
  @IsIn(['presencial', 'teleconsulta', 'portal', 'contato_documentado']) meio: string;
  @IsBoolean() @Equals(true) atestacao: boolean;
  @IsIn(['pendencia_mantida', 'alteracao_informada', 'sem_alteracao', 'sem_restricoes_declaradas']) resultado: string;
  @IsOptional() @IsUUID() restricaoId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(2147483646) revisaoRestricao?: number;
  @IsOptional() @IsBoolean() @Equals(true) confirmacaoExplicitaAusencia?: boolean;
}

class DecidirSolicitacaoDto extends RevisaoRestricaoDto {
  @IsIn(['atendida', 'parcial', 'recusada']) estadoFinal: string;
  @IsString() @MinLength(1) @MaxLength(4000) explicacaoPaciente: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) justificativaInterna?: string;
  // Estrutura dos itens validada no domínio (`validarDesfechoSolicitacao`), com entrada fechada.
  @IsArray() @ArrayMaxSize(200) @Allow() alterados: unknown[];
  @IsArray() @ArrayMaxSize(200) @Allow() inalterados: unknown[];
}

const CAMPOS_SOLICITACAO_PROFISSIONAL = ['id', 'tipo', 'estado', 'revisao', 'restricaoId', 'criadoEm', 'pedido', 'decididoEm',
  'explicacaoPaciente', 'justificativaInterna', 'desfecho'] as const;
/** Allowlist da lista para o profissional: só os campos acima, e só se o serviço devolveu um item bem formado. */
function projetarSolicitacaoProfissional(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new InternalServerErrorException('Operação indisponível.');
  const r = valor as Record<string, unknown>;
  if (typeof r.id !== 'string' || !isUUID(r.id) || !Number.isSafeInteger(r.revisao)) throw new InternalServerErrorException('Operação indisponível.');
  return Object.fromEntries(CAMPOS_SOLICITACAO_PROFISSIONAL.filter(k => r[k] !== undefined).map(k => [k, r[k]]));
}

function projetarAcao(valor: unknown, id: string, revisao: number, campo: 'estado' | 'confirmacao', esperado: string): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new InternalServerErrorException('Operação indisponível.');
  const r = valor as Record<string, unknown>;
  if (r.id !== id.toLowerCase() || r.revisao !== revisao + 1 || r[campo] !== esperado) throw new InternalServerErrorException('Operação indisponível.');
  return { id: r.id, revisao: r.revisao, [campo]: esperado };
}

/** Allowlist da resposta do registro de pendência (Professional e Collaborator). */
export function projetarRegistro(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new InternalServerErrorException('Operação indisponível.');
  const r = valor as Record<string, unknown>;
  if (typeof r.id !== 'string' || !isUUID(r.id) || !Number.isSafeInteger(r.revisao) || Number(r.revisao) < 1 ||
    !['ativa', 'em_reavaliacao', 'inativa'].includes(r.estado as string) ||
    !['pendente', 'confirmada', 'rejeitada'].includes(r.confirmacao as string)) throw new InternalServerErrorException('Operação indisponível.');
  return { id: r.id, revisao: r.revisao, estado: r.estado, confirmacao: r.confirmacao };
}

/** Allowlist da leitura individual; o conteúdo é revalidado antes de sair. */
export function projetarConsulta(entrada: unknown): Record<string, unknown> {
  try {
    const valor = entrada as Record<string, unknown>;
    const conteudo = validarConteudoRestricao(valor.conteudo);
    if (typeof valor.id !== 'string' || !isUUID(valor.id) || !Number.isSafeInteger(valor.revisao) || Number(valor.revisao) < 1 ||
      !['profissional', 'colaborador', 'declaracao_paciente', 'questionario_legado'].includes(valor.origem as string) ||
      !['ativa', 'em_reavaliacao', 'inativa'].includes(valor.estado as string) ||
      !['pendente', 'confirmada', 'rejeitada'].includes(valor.confirmacao as string)) throw new Error('Projeção inválida.');
    return { id: valor.id, revisao: valor.revisao, origem: valor.origem, estado: valor.estado, confirmacao: valor.confirmacao, conteudo };
  } catch { throw new InternalServerErrorException('Operação indisponível.'); }
}

/** FOOD06 P3-0a: allowlist da listagem; cada item passa pela mesma projeção da leitura individual, mais `criadoEm`. */
export function projetarListagem(entrada: unknown): Record<string, unknown> {
  const valor = entrada as { escopo?: unknown; itens?: unknown };
  if (!valor || (valor.escopo !== 'completo' && valor.escopo !== 'autoria') || !Array.isArray(valor.itens)) throw new InternalServerErrorException('Operação indisponível.');
  return { escopo: valor.escopo, itens: valor.itens.map(item => {
    const criadoEm = (item as { criadoEm?: unknown })?.criadoEm;
    if (!(criadoEm instanceof Date) || Number.isNaN(criadoEm.getTime())) throw new InternalServerErrorException('Operação indisponível.');
    return { ...projetarConsulta(item), criadoEm: criadoEm.toISOString() };
  }) };
}

/** FOOD06 P3-0a: allowlist da avaliação (sem quem confirmou). */
function projetarAvaliacao(entrada: unknown): Record<string, unknown> {
  const valor = (entrada as { avaliacao?: unknown })?.avaliacao;
  if (valor === null) return { avaliacao: null };
  const a = valor as Record<string, unknown>;
  const data = (v: unknown) => v === null || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));
  if (!a || typeof a.id !== 'string' || !isUUID(a.id) || !Number.isSafeInteger(a.revisao) || Number(a.revisao) < 1 ||
    !['nao_informado', 'sem_restricoes_confirmadas', 'restricoes_registradas'].includes(a.situacao as string) ||
    !data(a.confirmadoEm) || !data(a.venceEm) || (a.situacao === 'nao_informado') !== (a.venceEm === null)) throw new InternalServerErrorException('Operação indisponível.');
  return { avaliacao: { id: a.id, revisao: a.revisao, situacao: a.situacao, confirmadoEm: a.confirmadoEm, venceEm: a.venceEm } };
}

const exigirCorpoVazio = (dados: unknown) => {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
};

/** Sanitiza erros inclusive das guardas; não registra conteúdo nem causa. */
@Catch()
export class FiltroRestricoesClinicas implements ExceptionFilter {
  catch(erro: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<Response>();
    const original = erro instanceof HttpException ? erro.getStatus() : 500;
    const status = [400, 401, 403, 409].includes(original) ? original : 500;
    resposta.setHeader('Cache-Control', 'private, no-store');
    resposta.status(status).json({ statusCode: status, message: status === 400 ? 'Solicitação inválida.' :
      status === 401 ? 'Autenticação necessária.' : status === 403 ? 'Operação não autorizada.' :
        status === 409 ? 'Operação indisponível ou concorrente.' : 'Operação indisponível.' });
  }
}

/**
 * Registrado em `ModuloRestricoes` atrás da flag `restricoes.clinicas` (padrão desligada; P2b).
 * Escritas exigem `pacientes.gerenciar` na guarda (defesa em profundidade); a autorização clínica real
 * (concessão `restricoes.confirmar` e carteira) continua no serviço, na mesma transação.
 */
@Controller('pacientes/:pacienteId/restricoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag)
@FeatureFlag('restricoes.clinicas')
@Papeis('Professional')
@UseFilters(FiltroRestricoesClinicas)
export class ControladorRestricoesClinicas {
  constructor(private readonly leitura: ServicoLeituraRestricao, private readonly decisao: ServicoConfirmacaoRestricao,
    private readonly registro: ServicoRegistroPendenciaRestricao, private readonly reconfirmacao: ServicoReconfirmacaoRestricao,
    private readonly solicitacoes: ServicoSolicitacoesRestricao) {}

  @Post('solicitacoes/listar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async listarSolicitacoes(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: unknown): Promise<unknown> {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
    const lista = await this.solicitacoes.listar(usuario, pacienteId);
    if (!Array.isArray(lista)) throw new InternalServerErrorException('Operação indisponível.');
    return { itens: lista.map(projetarSolicitacaoProfissional) };
  }

  @Post('solicitacoes/:solicitacaoId/iniciar-analise') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async iniciarAnaliseSolicitacao(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('solicitacaoId', ParseUUIDPipe) solicitacaoId: string, @Body() dados: RevisaoRestricaoDto): Promise<unknown> {
    const valor = await this.solicitacoes.iniciarAnalise(usuario, pacienteId, solicitacaoId, dados.revisao);
    return projetarAcao(valor, solicitacaoId, dados.revisao, 'estado', 'em_analise');
  }

  @Post('solicitacoes/:solicitacaoId/decidir') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async decidirSolicitacao(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('solicitacaoId', ParseUUIDPipe) solicitacaoId: string, @Body() dados: DecidirSolicitacaoDto): Promise<unknown> {
    const valor = await this.solicitacoes.decidir(usuario, pacienteId, solicitacaoId, dados.revisao, {
      estadoFinal: dados.estadoFinal, explicacaoPaciente: dados.explicacaoPaciente,
      ...(dados.justificativaInterna !== undefined ? { justificativaInterna: dados.justificativaInterna } : {}),
      alterados: dados.alterados, inalterados: dados.inalterados });
    return projetarAcao(valor, solicitacaoId, dados.revisao, 'estado', dados.estadoFinal);
  }

  @Post('listar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: unknown): Promise<unknown> {
    exigirCorpoVazio(dados);
    return projetarListagem(await this.leitura.listar(usuario, pacienteId));
  }

  @Post('avaliacao/consultar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async consultarAvaliacao(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: unknown): Promise<unknown> {
    exigirCorpoVazio(dados);
    return projetarAvaliacao(await this.leitura.consultarAvaliacao(usuario, pacienteId));
  }

  @Post('avaliacao/inicial') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async avaliacaoInicial(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: unknown): Promise<unknown> {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
    const valor = await this.reconfirmacao.garantirAvaliacaoInicial(usuario, pacienteId);
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new InternalServerErrorException('Operação indisponível.');
    const r = valor as Record<string, unknown>;
    if (typeof r.id !== 'string' || !isUUID(r.id) || !Number.isSafeInteger(r.revisao) || Number(r.revisao) < 1 ||
      !['nao_informado', 'sem_restricoes_confirmadas', 'restricoes_registradas'].includes(r.situacao as string)) throw new InternalServerErrorException('Operação indisponível.');
    return { id: r.id, revisao: r.revisao, situacao: r.situacao };
  }

  @Post('reconfirmar') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async reconfirmar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: ReconfirmarRestricaoDto): Promise<unknown> {
    const individual = dados.restricaoId !== undefined || dados.revisaoRestricao !== undefined;
    const ausencia = dados.resultado === 'sem_restricoes_declaradas';
    if ((individual && (!isUUID(dados.restricaoId) || !Number.isSafeInteger(dados.revisaoRestricao))) ||
      (ausencia && (individual || dados.confirmacaoExplicitaAusencia !== true)) ||
      (!ausencia && dados.confirmacaoExplicitaAusencia !== undefined)) throw new HttpException('Solicitação inválida.', 400);
    const entrada = { avaliacaoId: dados.avaliacaoId, revisaoAvaliacao: dados.revisaoAvaliacao, chaveIdempotencia: dados.chaveIdempotencia,
      meio: dados.meio, atestacao: dados.atestacao, ...(individual ? { restricaoId: dados.restricaoId, revisaoRestricao: dados.revisaoRestricao } : {}),
      ...(ausencia ? { confirmacaoExplicitaAusencia: true } : {}) };
    let valor: unknown;
    if (ausencia) valor = await this.reconfirmacao.registrarAusenciaDeclarada(usuario, pacienteId, entrada);
    else if (dados.resultado === 'sem_alteracao') valor = individual ? await this.reconfirmacao.registrarSemAlteracaoIndividual(usuario, pacienteId, entrada) : await this.reconfirmacao.registrarSemAlteracao(usuario, pacienteId, entrada);
    else if (dados.resultado === 'pendencia_mantida') valor = individual ? await this.reconfirmacao.registrarPendenciaIndividual(usuario, pacienteId, entrada) : await this.reconfirmacao.registrarPendencia(usuario, pacienteId, entrada);
    else valor = individual ? await this.reconfirmacao.registrarAlteracaoInformadaIndividual(usuario, pacienteId, entrada) : await this.reconfirmacao.registrarAlteracaoInformada(usuario, pacienteId, entrada);
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new InternalServerErrorException('Operação indisponível.');
    const r = valor as Record<string, unknown>;
    if (typeof r.id !== 'string' || !isUUID(r.id) || r.resultado !== dados.resultado ||
      (individual && (r.escopo !== 'restricao_individual' || r.revisaoAvaliacao !== dados.revisaoAvaliacao || r.revisaoRestricao !== dados.revisaoRestricao)) ||
      (!individual && r.escopo !== undefined)) throw new InternalServerErrorException('Operação indisponível.');
    return { id: r.id, resultado: r.resultado, ...(individual ? { escopo: 'restricao_individual', revisaoAvaliacao: dados.revisaoAvaliacao, revisaoRestricao: dados.revisaoRestricao } : {}) };
  }

  @Post('registrar') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async registrar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: RegistrarPendenciaDto): Promise<unknown> {
    let conteudo: ReturnType<typeof validarConteudoRestricao>;
    try { conteudo = validarConteudoRestricao(dados.conteudo); } catch { throw new HttpException('Solicitação inválida.', 400); }
    return projetarRegistro(await this.registro.registrar(usuario, pacienteId, { chaveCriacao: dados.chaveCriacao, conteudo }));
  }

  @Post('consultar')
  @HttpCode(200)
  @Permissoes('pacientes.ler')
  @Header('Cache-Control', 'private, no-store')
  async consultar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: ConsultarRestricaoDto): Promise<unknown> {
    return projetarConsulta(await this.leitura.consultar(usuario, pacienteId, dados.restricaoId));
  }

  @Post(':restricaoId/confirmar') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async confirmar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('restricaoId', ParseUUIDPipe) restricaoId: string, @Body() dados: RevisaoRestricaoDto): Promise<unknown> {
    const valor = await this.decisao.confirmar(usuario, pacienteId, restricaoId, dados.revisao);
    return projetarAcao(valor, restricaoId, dados.revisao, 'confirmacao', 'confirmada');
  }

  @Post(':restricaoId/rejeitar') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async rejeitar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('restricaoId', ParseUUIDPipe) restricaoId: string, @Body() dados: RejeitarRestricaoDto): Promise<unknown> {
    const valor = await this.decisao.rejeitar(usuario, pacienteId, restricaoId, dados.revisao, { justificativa: dados.justificativa });
    return projetarAcao(valor, restricaoId, dados.revisao, 'confirmacao', 'rejeitada');
  }

  @Post(':restricaoId/inativar') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async inativar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('restricaoId', ParseUUIDPipe) restricaoId: string, @Body() dados: InativarRestricaoDto): Promise<unknown> {
    const valor = await this.decisao.inativar(usuario, pacienteId, restricaoId, dados.revisao,
      { motivo: dados.motivo, justificativa: dados.justificativa, confirmacaoEmDoisPassos: dados.confirmacaoEmDoisPassos });
    return projetarAcao(valor, restricaoId, dados.revisao, 'estado', 'inativa');
  }

  @Post(':restricaoId/reavaliar') @HttpCode(200) @Permissoes('pacientes.ler', 'pacientes.gerenciar') @Header('Cache-Control', 'private, no-store')
  async reavaliar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('restricaoId', ParseUUIDPipe) restricaoId: string, @Body() dados: ReavaliarRestricaoDto): Promise<unknown> {
    const valor = await this.decisao.alterarReavaliacao(usuario, pacienteId, restricaoId, dados.revisao, dados.destino);
    return projetarAcao(valor, restricaoId, dados.revisao, 'estado', dados.destino);
  }
}
