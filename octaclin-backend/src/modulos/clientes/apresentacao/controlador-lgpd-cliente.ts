import { Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoLgpdCliente } from '../aplicacao/servico-lgpd-cliente';

@Controller('cliente/lgpd/solicitacoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Client')
@Permissoes('cliente.acessar')
export class ControladorLgpdCliente {
  constructor(private readonly servico: ServicoLgpdCliente, private readonly auditoria: ServicoAuditoria) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() filtros: Record<string, unknown>) {
    const resultado = await this.servico.listar(usuario.tenantId, filtros);
    await this.registrar(usuario, 'cliente.lgpd.listar');
    return resultado;
  }

  @Get(':protocolo')
  @Header('Cache-Control', 'private, no-store')
  async detalhe(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('protocolo') protocolo: string) {
    const resultado = await this.servico.obterDetalhe(usuario.tenantId, protocolo);
    await this.registrar(usuario, 'cliente.lgpd.detalhe');
    return resultado;
  }

  @Post(':protocolo/assumir')
  @Header('Cache-Control', 'private, no-store')
  async assumir(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('protocolo') protocolo: string) {
    const resultado = await this.servico.assumirTratativa(usuario.tenantId, usuario.usuarioId, protocolo);
    await this.registrar(usuario, 'cliente.lgpd.assumir');
    return resultado;
  }

  @Post(':protocolo/rascunho')
  @Header('Cache-Control', 'private, no-store')
  async prepararRascunho(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('protocolo') protocolo: string) {
    const resultado = await this.servico.prepararResposta(usuario.tenantId, protocolo);
    await this.registrar(usuario, 'cliente.lgpd.preparar_rascunho');
    return resultado;
  }

  private registrar(usuario: UsuarioAutenticado, acao: string) {
    return this.auditoria.registrar({
      tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
      acao, recursoTipo: 'solicitacao_lgpd', garantirRetentativa: true
    });
  }
}
