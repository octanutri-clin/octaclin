import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Header, HttpCode, HttpException, InternalServerErrorException,
  Param, ParseUUIDPipe, Post, UseFilters, UseGuards } from '@nestjs/common';
import { Allow, Equals, IsBoolean, IsDefined, IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength, isUUID } from 'class-validator';
import type { Response } from 'express';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { validarConteudoRestricao } from '../dominio/conteudo-restricao';
import { ServicoLeituraRestricao } from '../aplicacao/servico-leitura-restricao';
import { ServicoConfirmacaoRestricao } from '../aplicacao/servico-confirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from '../aplicacao/servico-registro-pendencia-restricao';

class ConsultarRestricaoDto {
  @IsUUID() restricaoId: string;
}
class RegistrarPendenciaDto {
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

function projetarAcao(valor: unknown, id: string, revisao: number, campo: 'estado' | 'confirmacao', esperado: string): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new InternalServerErrorException('Operação indisponível.');
  const r = valor as Record<string, unknown>;
  if (r.id !== id.toLowerCase() || r.revisao !== revisao + 1 || r[campo] !== esperado) throw new InternalServerErrorException('Operação indisponível.');
  return { id: r.id, revisao: r.revisao, [campo]: esperado };
}

/** Sanitiza erros inclusive das guardas; não registra conteúdo nem causa. */
@Catch()
class FiltroRestricoesClinicas implements ExceptionFilter {
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

/** Contrato isolado para testes; não registrado no módulo enquanto P2 estiver incompleta. */
@Controller('pacientes/:pacienteId/restricoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional')
@UseFilters(FiltroRestricoesClinicas)
export class ControladorRestricoesClinicas {
  constructor(private readonly leitura: ServicoLeituraRestricao, private readonly decisao: ServicoConfirmacaoRestricao,
    private readonly registro: ServicoRegistroPendenciaRestricao) {}

  @Post('registrar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async registrar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: RegistrarPendenciaDto): Promise<unknown> {
    let conteudo: ReturnType<typeof validarConteudoRestricao>;
    try { conteudo = validarConteudoRestricao(dados.conteudo); } catch { throw new HttpException('Solicitação inválida.', 400); }
    const valor = await this.registro.registrar(usuario, pacienteId, { chaveCriacao: dados.chaveCriacao, conteudo });
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new InternalServerErrorException('Operação indisponível.');
    const r = valor as Record<string, unknown>;
    if (typeof r.id !== 'string' || !isUUID(r.id) || !Number.isSafeInteger(r.revisao) || Number(r.revisao) < 1 ||
      !['ativa', 'em_reavaliacao', 'inativa'].includes(r.estado as string) ||
      !['pendente', 'confirmada', 'rejeitada'].includes(r.confirmacao as string)) throw new InternalServerErrorException('Operação indisponível.');
    return { id: r.id, revisao: r.revisao, estado: r.estado, confirmacao: r.confirmacao };
  }

  @Post('consultar')
  @HttpCode(200)
  @Permissoes('pacientes.ler')
  @Header('Cache-Control', 'private, no-store')
  async consultar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: ConsultarRestricaoDto): Promise<unknown> {
    const valor = await this.leitura.consultar(usuario, pacienteId, dados.restricaoId) as Record<string, unknown>;
    try {
      const conteudo = validarConteudoRestricao(valor.conteudo);
      if (typeof valor.id !== 'string' || !isUUID(valor.id) || !Number.isSafeInteger(valor.revisao) || Number(valor.revisao) < 1 ||
        !['profissional', 'colaborador', 'declaracao_paciente', 'questionario_legado'].includes(valor.origem as string) ||
        !['ativa', 'em_reavaliacao', 'inativa'].includes(valor.estado as string) ||
        !['pendente', 'confirmada', 'rejeitada'].includes(valor.confirmacao as string)) throw new Error('Projeção inválida.');
      return { id: valor.id, revisao: valor.revisao, origem: valor.origem, estado: valor.estado, confirmacao: valor.confirmacao, conteudo };
    } catch { throw new InternalServerErrorException('Operação indisponível.'); }
  }

  @Post(':restricaoId/confirmar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async confirmar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('restricaoId', ParseUUIDPipe) restricaoId: string, @Body() dados: RevisaoRestricaoDto): Promise<unknown> {
    const valor = await this.decisao.confirmar(usuario, pacienteId, restricaoId, dados.revisao);
    return projetarAcao(valor, restricaoId, dados.revisao, 'confirmacao', 'confirmada');
  }

  @Post(':restricaoId/rejeitar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async rejeitar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('restricaoId', ParseUUIDPipe) restricaoId: string, @Body() dados: RejeitarRestricaoDto): Promise<unknown> {
    const valor = await this.decisao.rejeitar(usuario, pacienteId, restricaoId, dados.revisao, { justificativa: dados.justificativa });
    return projetarAcao(valor, restricaoId, dados.revisao, 'confirmacao', 'rejeitada');
  }

  @Post(':restricaoId/inativar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async inativar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('restricaoId', ParseUUIDPipe) restricaoId: string, @Body() dados: InativarRestricaoDto): Promise<unknown> {
    const valor = await this.decisao.inativar(usuario, pacienteId, restricaoId, dados.revisao,
      { motivo: dados.motivo, justificativa: dados.justificativa, confirmacaoEmDoisPassos: dados.confirmacaoEmDoisPassos });
    return projetarAcao(valor, restricaoId, dados.revisao, 'estado', 'inativa');
  }

  @Post(':restricaoId/reavaliar') @HttpCode(200) @Permissoes('pacientes.ler') @Header('Cache-Control', 'private, no-store')
  async reavaliar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('restricaoId', ParseUUIDPipe) restricaoId: string, @Body() dados: ReavaliarRestricaoDto): Promise<unknown> {
    const valor = await this.decisao.alterarReavaliacao(usuario, pacienteId, restricaoId, dados.revisao, dados.destino);
    return projetarAcao(valor, restricaoId, dados.revisao, 'estado', dados.destino);
  }
}
