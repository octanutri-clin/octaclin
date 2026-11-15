import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Header, HttpCode, HttpException, InternalServerErrorException,
  Param, ParseUUIDPipe, Post, UseFilters, UseGuards } from '@nestjs/common';
import { IsUUID, isUUID } from 'class-validator';
import type { Response } from 'express';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { validarConteudoRestricao } from '../dominio/conteudo-restricao';
import { ServicoLeituraRestricao } from '../aplicacao/servico-leitura-restricao';

class ConsultarRestricaoDto {
  @IsUUID() restricaoId: string;
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
  constructor(private readonly leitura: ServicoLeituraRestricao) {}

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
}
