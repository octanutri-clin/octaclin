import { contextoSessao318 } from "../dominio/rascunhos-clinicos";
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  Papeis,
  Permissoes,
  UsuarioAtual,
} from "../../auth/apresentacao/decorators";
import { GuardaJwt } from "../../auth/apresentacao/guarda-jwt";
import { GuardaPapeis } from "../../auth/apresentacao/guarda-papeis";
import { GuardaPermissoes } from "../../auth/apresentacao/guarda-permissoes";
import { UsuarioAutenticado } from "../../auth/dominio/usuario-autenticado";
import { ContextoRascunhos318 } from "../aplicacao/contexto-rascunhos318";
import { ServicoRascunhosClinicosIa } from "../aplicacao/servico-rascunhos-clinicos";
import {
  ConfirmarRascunho318Dto,
  Configurar318Dto,
  Credencial318Dto,
  GerarRascunho318Dto,
  MutarCredencial318Dto,
} from "./rascunhos318-dtos";
@Controller("ia/rascunhos")
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis("Professional")
@Permissoes("ia.executar", "pacientes.gerenciar")
export class ControladorRascunhos318 {
  constructor(
    private readonly servico: ServicoRascunhosClinicosIa,
    private readonly contexto: ContextoRascunhos318,
  ) {}
  @Get("modelos")
  @Header("Cache-Control", "no-store")
  modelos(
    @UsuarioAtual()
    u: UsuarioAutenticado,
  ) {
    return this.contexto.executar(u, async (c) => ({
      contextoSessao: contextoSessao318(u),
      modelos: this.contexto.operacaoAprovada()
        ? this.contexto.modelos.map((m) => ({
            id: m.id,
            versao: m.versao,
            nome: m.nome,
            maxOutputTokens: m.maxOutputTokens,
            padrao: m.padrao,
            precoEntradaMilhaoUsd: m.precoEntradaMilhaoUsd,
            precoSaidaMilhaoUsd: m.precoSaidaMilhaoUsd,
            precoEm: m.precoEm,
          }))
        : [],
      configuracao: await this.contexto.config(c.m, u.tenantId),
    }));
  }
  @Get("credencial")
  @Header("Cache-Control", "no-store")
  credencial(
    @UsuarioAtual()
    u: UsuarioAutenticado,
  ) {
    return this.contexto.obterCredencial(u);
  }
  @Put("credencial")
  @Header("Cache-Control", "no-store")
  definir(
    @UsuarioAtual()
    u: UsuarioAutenticado,
    @Body()
    d: Credencial318Dto,
  ) {
    return this.contexto.definirCredencial(u, d);
  }
  @Delete("credencial")
  @Header("Cache-Control", "no-store")
  remover(
    @UsuarioAtual()
    u: UsuarioAutenticado,
    @Body()
    d: MutarCredencial318Dto,
  ) {
    return this.contexto.removerCredencial(u, d);
  }
  @Get("pacientes/:id/fontes")
  @Header("Cache-Control", "no-store")
  fontes(
    @UsuarioAtual()
    u: UsuarioAutenticado,
    @Param("id", ParseUUIDPipe)
    id: string,
  ) {
    return this.servico.fontes(u, id);
  }
  @Post("pacientes/:id/pre-consulta")
  @Header("Cache-Control", "no-store")
  preConsulta(
    @UsuarioAtual()
    u: UsuarioAutenticado,
    @Param("id", ParseUUIDPipe)
    id: string,
    @Body()
    d: GerarRascunho318Dto,
  ) {
    return this.servico.gerar(u, id, d, "pre_consulta");
  }
  @Post("pacientes/:id/evolucao")
  @Header("Cache-Control", "no-store")
  evolucao(
    @UsuarioAtual()
    u: UsuarioAutenticado,
    @Param("id", ParseUUIDPipe)
    id: string,
    @Body()
    d: GerarRascunho318Dto,
  ) {
    return this.servico.gerar(u, id, d, "evolucao");
  }
  @Post("pacientes/:id/confirmar")
  @Header("Cache-Control", "no-store")
  confirmar(
    @UsuarioAtual()
    u: UsuarioAutenticado,
    @Param("id", ParseUUIDPipe)
    id: string,
    @Body()
    d: ConfirmarRascunho318Dto,
  ) {
    return this.servico.confirmar(u, id, d);
  }
}
@Controller("ia/rascunhos/configuracao")
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis("Client")
@Permissoes("cliente.configuracoes.gerenciar")
export class ControladorConfigRascunhos318 {
  constructor(private readonly contexto: ContextoRascunhos318) {}
  @Get()
  @Header("Cache-Control", "no-store")
  obter(
    @UsuarioAtual()
    u: UsuarioAutenticado,
  ) {
    return this.contexto.configurar(u);
  }
  @Patch()
  @Header("Cache-Control", "no-store")
  configurar(
    @UsuarioAtual()
    u: UsuarioAutenticado,
    @Body()
    d: Configurar318Dto,
  ) {
    return this.contexto.configurar(u, d);
  }
}

@Controller("operacoes/tenants/:tenantId/ia-rascunhos")
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis("SuperAdmin")
@Permissoes("operacoes.tenants.gerenciar")
export class ControladorOperacoesRascunhos318 {
  constructor(private readonly contexto: ContextoRascunhos318) {}
  @Get() @Header("Cache-Control", "no-store") obter(
    @UsuarioAtual() u: UsuarioAutenticado,
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
  ) {
    return this.contexto.configurarOperacoes(u, tenantId);
  }
  @Patch() @Header("Cache-Control", "no-store") configurar(
    @UsuarioAtual() u: UsuarioAutenticado,
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body() d: Configurar318Dto,
  ) {
    return this.contexto.configurarOperacoes(u, tenantId, d);
  }
}
