import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  Equals,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  Papeis,
  Permissoes,
  UsuarioAtual,
} from "../../auth/apresentacao/decorators";
import { GuardaJwt } from "../../auth/apresentacao/guarda-jwt";
import { GuardaPapeis } from "../../auth/apresentacao/guarda-papeis";
import { GuardaPermissoes } from "../../auth/apresentacao/guarda-permissoes";
import { UsuarioAutenticado } from "../../auth/dominio/usuario-autenticado";
import { Credencial318Dto } from "./rascunhos318-dtos";
import { ServicoPilotoSintetico318 } from "../aplicacao/servico-piloto-sintetico318";
export class PreviaPiloto318Dto {
  @IsString() @Matches(/^C(?:0[1-9]|[12][0-9]|30)$/) casoId!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) contextoSessao!: string;
}
export class GerarPiloto318Dto {
  @IsString() @MinLength(1) @MaxLength(30000) prova!: string;
  @IsString() @MinLength(1) @MaxLength(100) modeloId!: string;
  @IsIn(["pre_consulta", "evolucao"]) modalidade!: "pre_consulta" | "evolucao";
  @Equals(true) aceiteCobranca!: boolean;
}
@Controller("ia/rascunhos/piloto")
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis("Professional")
@Permissoes("ia.executar", "pacientes.gerenciar")
export class ControladorPilotoSintetico318 {
  constructor(private readonly service: ServicoPilotoSintetico318) {}
  @Put("credencial") @Header("Cache-Control", "no-store") credencial(
    @UsuarioAtual() u: UsuarioAutenticado,
    @Body() d: Credencial318Dto,
  ) {
    return this.service.definirCredencial(u, d);
  }
  @Get("catalogo") @Header("Cache-Control", "no-store") catalogo(
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.service.catalogo(u);
  }
  @Post("previa") @Header("Cache-Control", "no-store") previa(
    @UsuarioAtual() u: UsuarioAutenticado,
    @Body() d: PreviaPiloto318Dto,
  ) {
    return this.service.previa(u, d);
  }
  @Post("gerar") @Header("Cache-Control", "no-store") gerar(
    @UsuarioAtual() u: UsuarioAutenticado,
    @Body() d: GerarPiloto318Dto,
  ) {
    return this.service.gerar(u, d);
  }
}
