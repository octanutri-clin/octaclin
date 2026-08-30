import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  EncerrarSessaoDto,
  ConfirmarConfiguracaoMfaDto,
  ConcluirLoginMfaDto,
  DesafioMfaDto,
  ListarSessoesDto,
  LoginDto,
  RedefinirSenhaDto,
  ReautenticarDto,
  RenovarTokenDto,
  SolicitarRecuperacaoSenhaDto,
  ValidarTokenRedefinicaoSenhaDto
} from '../aplicacao/dtos';
import { ServicoRecuperacaoSenha } from '../aplicacao/servico-recuperacao-senha';
import { ServicoAuth } from '../aplicacao/servico-auth';
import { ServicoMfa } from '../aplicacao/servico-mfa';
import { ServicoReautenticacao } from '../aplicacao/servico-reautenticacao';
import { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import { ReautenticacaoObrigatoria, UsuarioAtual } from './decorators';
import { GuardaJwt } from './guarda-jwt';
import { GuardaLimiteLogin } from './guarda-limite-login';
import { GuardaReautenticacao } from './guarda-reautenticacao';

@Controller('auth')
export class ControladorAuth {
  constructor(
    private readonly servicoAuth: ServicoAuth,
    private readonly servicoRecuperacaoSenha: ServicoRecuperacaoSenha,
    private readonly servicoMfa: ServicoMfa,
    private readonly servicoReautenticacao: ServicoReautenticacao
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(GuardaLimiteLogin)
  login(@Body() dados: LoginDto) {
    return this.servicoAuth.login(dados);
  }

  @Post('mfa/login/configuracao')
  @HttpCode(200)
  configuracaoMfaLogin(@Body() dados: DesafioMfaDto) {
    return this.servicoMfa.obterConfiguracao(dados.desafioMfa);
  }

  @Post('mfa/login')
  @HttpCode(200)
  concluirLoginMfa(@Body() dados: ConcluirLoginMfaDto) {
    return this.servicoAuth.concluirLoginMfa(dados);
  }

  @Post('renovar')
  @HttpCode(200)
  renovar(@Body() dados: RenovarTokenDto) {
    return this.servicoAuth.renovar(dados);
  }

  @Post('recuperar-senha')
  @HttpCode(200)
  recuperarSenha(@Body() dados: SolicitarRecuperacaoSenhaDto) {
    return this.servicoRecuperacaoSenha.solicitarRecuperacao(dados);
  }

  @Post('recuperar-senha/validar')
  @HttpCode(200)
  validarTokenRecuperacao(@Body() dados: ValidarTokenRedefinicaoSenhaDto) {
    return this.servicoRecuperacaoSenha.validarToken(dados.token);
  }

  @Post('redefinir-senha')
  @HttpCode(200)
  redefinirSenha(@Body() dados: RedefinirSenhaDto) {
    return this.servicoRecuperacaoSenha.redefinirSenha(dados);
  }

  @Get('permissoes')
  @UseGuards(GuardaJwt)
  permissoes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoAuth.obterContextoAcesso(usuario);
  }

  @Get('mfa')
  @UseGuards(GuardaJwt)
  statusMfa(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoMfa.obterStatus(usuario);
  }

  @Post('reautenticar')
  @HttpCode(200)
  @UseGuards(GuardaJwt)
  reautenticar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: ReautenticarDto) {
    return this.servicoReautenticacao.reautenticar(usuario, dados.senha);
  }

  @Post('mfa/configuracao')
  @HttpCode(200)
  @ReautenticacaoObrigatoria()
  @UseGuards(GuardaJwt, GuardaReautenticacao)
  iniciarConfiguracaoMfa(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoMfa.iniciarConfiguracao(usuario);
  }

  @Post('mfa/configuracao/confirmar')
  @HttpCode(200)
  @ReautenticacaoObrigatoria()
  @UseGuards(GuardaJwt, GuardaReautenticacao)
  confirmarConfiguracaoMfa(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dados: ConfirmarConfiguracaoMfaDto
  ) {
    return this.servicoMfa.confirmarConfiguracao(usuario, dados.codigo);
  }

  @Post('mfa/codigos-recuperacao')
  @HttpCode(200)
  @ReautenticacaoObrigatoria()
  @UseGuards(GuardaJwt, GuardaReautenticacao)
  regenerarCodigosMfa(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoMfa.regenerarCodigos(usuario);
  }

  @Delete('mfa')
  @HttpCode(204)
  @ReautenticacaoObrigatoria()
  @UseGuards(GuardaJwt, GuardaReautenticacao)
  async removerMfa(@UsuarioAtual() usuario: UsuarioAutenticado) {
    await this.servicoMfa.removerFator(usuario);
  }

  @Post('sair')
  @HttpCode(204)
  async sair(@Body() dados: RenovarTokenDto) {
    await this.servicoAuth.revogar(dados.refreshToken);
  }

  @Get('sessoes')
  @UseGuards(GuardaJwt)
  listarSessoes(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() consulta: ListarSessoesDto) {
    return this.servicoAuth.listarSessoes(usuario, consulta.pagina);
  }

  @Delete('sessoes/historico')
  @HttpCode(200)
  @ReautenticacaoObrigatoria()
  @UseGuards(GuardaJwt, GuardaReautenticacao)
  limparHistoricoSessoes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoAuth.limparHistoricoSessoes(usuario);
  }

  @Delete('sessoes/:referencia')
  @HttpCode(204)
  @UseGuards(GuardaJwt)
  async encerrarSessao(@UsuarioAtual() usuario: UsuarioAutenticado, @Param() parametros: EncerrarSessaoDto) {
    await this.servicoAuth.encerrarSessao(usuario, parametros.referencia);
  }

  @Post('sessoes/encerrar-outras')
  @HttpCode(200)
  @ReautenticacaoObrigatoria()
  @UseGuards(GuardaJwt, GuardaReautenticacao)
  encerrarOutrasSessoes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoAuth.encerrarOutrasSessoes(usuario);
  }

  @Post('sessoes/encerrar-todas')
  @HttpCode(200)
  @ReautenticacaoObrigatoria()
  @UseGuards(GuardaJwt, GuardaReautenticacao)
  encerrarTodasSessoes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoAuth.encerrarTodasSessoes(usuario);
  }
}
