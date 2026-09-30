import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoRetornosSemConsulta } from '../aplicacao/servico-retornos-sem-consulta';

class LoteRetornoDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(25) @ArrayUnique() @IsUUID('4', { each: true })
  pacienteIds: string[];
}

class AprovarLoteRetornoDto extends LoteRetornoDto {
  @IsUUID('4')
  loteId: string;
}

@Controller('pacientes/retornos')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional', 'SuperAdmin')
@Permissoes('pacientes.gerenciar', 'comunicacoes.mensagens.enviar')
export class ControladorRetornosSemConsulta {
  constructor(
    private readonly servico: ServicoRetornosSemConsulta,
    private readonly auditoria: ServicoAuditoria
  ) {}

  @Post('simulacoes')
  async simular(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: LoteRetornoDto) {
    return { itens: await this.servico.simular(usuario.tenantId, usuario, dados.pacienteIds) };
  }

  @Post('aprovacoes')
  async aprovar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: AprovarLoteRetornoDto, @Req() requisicao: Request) {
    const resultado = await this.servico.aprovar(usuario.tenantId, usuario, dados.pacienteIds, dados.loteId);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.retorno_lote.aprovar',
      recursoTipo: 'paciente',
      ip: requisicao.ip,
      userAgent: requisicao.headers['user-agent'],
      metadados: { selecionados: dados.pacienteIds.length, enfileirados: resultado.totalEnfileirado }
    });
    return resultado;
  }
}
