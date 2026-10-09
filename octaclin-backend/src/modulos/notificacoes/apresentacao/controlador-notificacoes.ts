import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ListarNotificacoesDto, MarcarNotificacoesComResumosLidasDto, PreferenciasNotificacaoDto } from '../aplicacao/dtos';
import { ServicoPreferenciasNotificacoes } from '../aplicacao/servico-preferencias-notificacoes';
import { ServicoNotificacoes } from '../aplicacao/servico-notificacoes';

/**
 * Sem permissao propria: quem acessa o console le a propria caixa e ninguem le a
 * de outro, porque o filtro e o `usuarioId` do JWT. Sem auditoria pelo mesmo
 * motivo — a notificacao nao carrega dado clinico, so o ponteiro para o recurso,
 * cuja leitura ja e auditada onde precisa ser.
 */
@Controller('notificacoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
@Permissoes('console.acessar')
export class ControladorNotificacoes {
  constructor(
    private readonly servicoNotificacoes: ServicoNotificacoes,
    private readonly servicoPreferencias: ServicoPreferenciasNotificacoes
  ) {}

  @Get()
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() filtro: ListarNotificacoesDto) {
    return this.servicoNotificacoes.listar(usuario, filtro.limite);
  }

  @Post('lidas')
  marcarLidas(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: MarcarNotificacoesComResumosLidasDto) {
    return this.servicoNotificacoes.marcarLidas(usuario, dados.ids, dados.idsResumos);
  }

  @Get('preferencias')
  obterPreferencias(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPreferencias.obter(usuario);
  }

  @Put('preferencias')
  salvarPreferencias(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: PreferenciasNotificacaoDto) {
    return this.servicoPreferencias.salvar(usuario, dados);
  }

  @Post('resumos/gerar')
  gerarResumos(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoNotificacoes.gerarResumoPendente(usuario);
  }
}
