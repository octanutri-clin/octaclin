import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { LoginDto, RenovarTokenDto } from '../aplicacao/dtos';
import { ServicoAuth } from '../aplicacao/servico-auth';
import { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import { UsuarioAtual } from './decorators';
import { GuardaJwt } from './guarda-jwt';
import { GuardaLimiteLogin } from './guarda-limite-login';

@Controller('auth')
export class ControladorAuth {
  constructor(private readonly servicoAuth: ServicoAuth) {}

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
