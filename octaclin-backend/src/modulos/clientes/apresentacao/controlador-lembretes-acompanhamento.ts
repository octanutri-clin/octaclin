import { Body, Controller, Get, Header, Patch, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min, ValidateNested } from 'class-validator';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoLembretesAcompanhamento } from '../aplicacao/servico-lembretes-acompanhamento';

class PlanoLembreteDto {
  @IsBoolean() ativo: boolean;
  @IsInt() @Min(1) @Max(30) intervaloDias: number;
}

class TarefasLembreteDto {
  @IsBoolean() ativo: boolean;
  @IsInt() @Min(0) @Max(168) antecedenciaHoras: number;
}

class AtualizarLembretesDto {
  @ValidateNested() @Type(() => PlanoLembreteDto) plano: PlanoLembreteDto;
  @ValidateNested() @Type(() => TarefasLembreteDto) tarefas: TarefasLembreteDto;
}

@Controller('cliente/lembretes-acompanhamento')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Client')
@Permissoes('cliente.configuracoes.gerenciar')
export class ControladorLembretesAcompanhamento {
  constructor(private readonly servico: ServicoLembretesAcompanhamento, private readonly auditoria: ServicoAuditoria) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  obter(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.obter(usuario.tenantId);
  }

  @Patch()
  @Header('Cache-Control', 'private, no-store')
  async atualizar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Body() dados: AtualizarLembretesDto) {
    const configuracao = await this.servico.atualizar(usuario.tenantId, dados);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
      acao: 'cliente.lembretes_acompanhamento.atualizar', recursoTipo: 'tenant', recursoId: usuario.tenantId,
      ip: requisicao.ip, userAgent: requisicao.headers['user-agent'],
      metadados: { planoAtivo: configuracao.plano.ativo, tarefasAtivas: configuracao.tarefas.ativo,
        intervaloDias: configuracao.plano.intervaloDias, antecedenciaHoras: configuracao.tarefas.antecedenciaHoras }
    });
    return configuracao;
  }
}
