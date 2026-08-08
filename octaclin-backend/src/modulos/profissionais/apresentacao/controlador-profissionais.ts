import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtualizarProfissionalDto, CriarProfissionalDto } from '../aplicacao/dtos';
import { ServicoProfissionais } from '../aplicacao/servico-profissionais';

@Controller('profissionais')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional')
@Permissoes('profissionais.ler')
export class ControladorProfissionais {
  constructor(
    private readonly servicoProfissionais: ServicoProfissionais,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Post()
  @Papeis('SuperAdmin')
  @Permissoes('profissionais.gerenciar')
  async criar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarProfissionalDto
  ) {
    const profissional = await this.servicoProfissionais.criar(usuario.tenantId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'profissionais.criar',
      recursoTipo: 'profissional',
      recursoId: profissional.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { especialidade: dados.especialidade }
    });
    return profissional;
  }

  @Get()
  async listar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Query('pagina', new ParseIntPipe({ optional: true })) pagina = 1,
    @Query('limite', new ParseIntPipe({ optional: true })) limite = 25
  ) {
    const resultado = await this.servicoProfissionais.listar(usuario.tenantId, usuario, pagina, limite);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'profissionais.listar_dados_sensiveis',
      recursoTipo: 'profissional',
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { pagina, limite, total: resultado.total }
    });
    return resultado;
  }

  @Get('arquivados')
  @Papeis('SuperAdmin')
  @Permissoes('profissionais.gerenciar')
  async listarArquivados(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Query('pagina', new ParseIntPipe({ optional: true })) pagina = 1,
    @Query('limite', new ParseIntPipe({ optional: true })) limite = 25
  ) {
    const resultado = await this.servicoProfissionais.listarArquivados(usuario.tenantId, pagina, limite);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'profissionais.lixeira.listar',
      recursoTipo: 'profissional',
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { pagina, limite, total: resultado.total }
    });
    return resultado;
  }

  @Get(':id')
  async obter(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const profissional = await this.servicoProfissionais.obterPorId(usuario.tenantId, id, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'profissionais.obter_dados_sensiveis',
      recursoTipo: 'profissional',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao)
    });
    return profissional;
  }

  @Patch(':id')
  @Permissoes('profissionais.gerenciar')
  async atualizar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarProfissionalDto
  ) {
    const profissional = await this.servicoProfissionais.atualizar(usuario.tenantId, id, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'profissionais.atualizar',
      recursoTipo: 'profissional',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { especialidade: dados.especialidade }
    });
    return profissional;
  }

  @Patch(':id/restaurar')
  @Papeis('SuperAdmin')
  @Permissoes('profissionais.gerenciar')
  async restaurar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.servicoProfissionais.restaurar(usuario.tenantId, id);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'profissionais.restaurar',
      recursoTipo: 'profissional',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao)
    });
  }

  @Delete(':id')
  @Papeis('SuperAdmin')
  @Permissoes('profissionais.gerenciar')
  async arquivar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.servicoProfissionais.arquivar(usuario.tenantId, id);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'profissionais.arquivar',
      recursoTipo: 'profissional',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao)
    });
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
