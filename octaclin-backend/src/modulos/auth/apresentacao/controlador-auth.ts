import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { LoginDto, RedefinirSenhaDto, RenovarTokenDto, SolicitarRecuperacaoSenhaDto, ValidarTokenRedefinicaoSenhaDto } from '../aplicacao/dtos';
import { ServicoRecuperacaoSenha } from '../aplicacao/servico-recuperacao-senha';
import { ServicoAuth } from '../aplicacao/servico-auth';
import { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import { UsuarioAtual } from './decorators';
import { GuardaJwt } from './guarda-jwt';
import { GuardaLimiteLogin } from './guarda-limite-login';

@Controller('auth')
export class ControladorAuth {
  constructor(
    private readonly servicoAuth: ServicoAuth,
    private readonly servicoRecuperacaoSenha: ServicoRecuperacaoSenha
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(GuardaLimiteLogin)
  login(@Body() dados: LoginDto) {
    return this.servicoAuth.login(dados);
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

  @Post('sair')
  @HttpCode(204)
  async sair(@Body() dados: RenovarTokenDto) {
    await this.servicoAuth.revogar(dados.refreshToken);
  }
}
