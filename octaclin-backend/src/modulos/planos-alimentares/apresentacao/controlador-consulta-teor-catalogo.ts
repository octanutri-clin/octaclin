import { Body, Controller, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ConsultaTeorCatalogoDto } from '../aplicacao/dto-consulta-teor-catalogo';
import { ServicoConsultaTeorCatalogo } from '../aplicacao/servico-consulta-teor-catalogo';

@Controller('planos-alimentares/catalogo/teor-micronutriente')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional')
export class ControladorConsultaTeorCatalogo {
  constructor(private readonly servico: ServicoConsultaTeorCatalogo) {}
  @Post('consulta')
  @HttpCode(200)
  @Permissoes('planos_alimentares.ler')
  @Header('Cache-Control', 'private, no-store')
  consultar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: ConsultaTeorCatalogoDto) {
    return this.servico.consultar(usuario.tenantId, usuario, dto);
  }
}
