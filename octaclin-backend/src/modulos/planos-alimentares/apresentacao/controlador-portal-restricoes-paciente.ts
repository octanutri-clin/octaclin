import { Body, Controller, Header, HttpCode, HttpException, InternalServerErrorException, Param, ParseUUIDPipe, Post, UseFilters, UseGuards } from '@nestjs/common';
import { Allow, ArrayMaxSize, IsArray, IsIn, IsUUID, isUUID } from 'class-validator';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { FeatureFlag, GuardaFeatureFlag } from '../../../infraestrutura/feature-flags/guarda-feature-flag';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { validarConteudoRestricao } from '../dominio/conteudo-restricao';
import { CHAVES_TEXTO_PORTAL_SOLICITACAO } from '../dominio/projecao-portal-solicitacao';
import { CHAVES_SELO_PORTAL_RESTRICAO } from '../dominio/projecao-portal-restricoes';
import { ServicoPortalRestricoes } from '../aplicacao/servico-portal-restricoes';
import { ServicoRegistroPendenciaRestricao } from '../aplicacao/servico-registro-pendencia-restricao';
import { FiltroRestricoesClinicas, projetarRegistro, RegistrarPendenciaDto } from './controlador-restricoes-clinicas';

class CriarPedidoDto {
  @IsUUID() chaveCriacao: string;
  @IsIn(['correcao', 'remocao']) tipo: string;
  @IsUUID() restricaoId: string;
  // Itens validados no domínio (`validarPedidoSolicitacao`), com entrada fechada.
  @IsArray() @ArrayMaxSize(200) @Allow() itens: unknown[];
}

const ISO = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
function corpoVazio(dados: unknown): void {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Reflect.ownKeys(dados).length !== 0) throw new HttpException('Solicitação inválida.', 400);
}
function indisponivel(): never { throw new InternalServerErrorException('Operação indisponível.'); }

/** Allowlist do pedido no portal (reconfere a projeção do domínio antes de sair). */
function projetarPedido(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return indisponivel();
  const r = valor as Record<string, unknown>;
  if (typeof r.id !== 'string' || !isUUID(r.id) || !['correcao', 'remocao', 'inclusao'].includes(r.tipo as string) ||
    !CHAVES_TEXTO_PORTAL_SOLICITACAO.includes(r.chaveTexto as string) || !ISO(r.criadoEm) || typeof r.podeCancelar !== 'boolean' ||
    (r.decididoEm !== undefined && !ISO(r.decididoEm)) || (r.explicacao !== undefined && typeof r.explicacao !== 'string')) return indisponivel();
  return { id: r.id, tipo: r.tipo, chaveTexto: r.chaveTexto, criadoEm: r.criadoEm, podeCancelar: r.podeCancelar,
    ...(r.decididoEm !== undefined ? { decididoEm: r.decididoEm, explicacao: r.explicacao } : {}) };
}

/** Allowlist do resumo Q11 (reconfere a projeção do domínio antes de sair). */
function projetarResumo(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || !Array.isArray((valor as { restricoes?: unknown }).restricoes)) return indisponivel();
  const r = valor as { restricoes: Array<Record<string, unknown>>; ultimaConfirmacaoEm?: unknown };
  if (r.ultimaConfirmacaoEm !== undefined && !ISO(r.ultimaConfirmacaoEm)) return indisponivel();
  const restricoes = r.restricoes.map(x => {
    const alvo = x?.alvo as Record<string, unknown> | undefined;
    if (!x || typeof x.id !== 'string' || !isUUID(x.id) || !CHAVES_SELO_PORTAL_RESTRICAO.includes(x.selo as string) || typeof x.natureza !== 'string' ||
      !alvo || typeof alvo.tipo !== 'string') return indisponivel();
    return { id: x.id, selo: x.selo, natureza: x.natureza, ...(typeof x.subtipoClinico === 'string' ? { subtipoClinico: x.subtipoClinico } : {}),
      alvo: typeof alvo.id === 'string' ? { tipo: alvo.tipo, id: alvo.id } : { tipo: alvo.tipo },
      ...(typeof x.alvoDeclarado === 'string' ? { alvoDeclarado: x.alvoDeclarado } : {}),
      ...(typeof x.gravidade === 'string' ? { gravidade: x.gravidade } : {}) };
  });
  return { restricoes, ...(r.ultimaConfirmacaoEm !== undefined ? { ultimaConfirmacaoEm: r.ultimaConfirmacaoEm } : {}) };
}

/**
 * FOOD06 P2d-3b: portal de restrições de UM paciente escolhido (o próprio ou um representado). O `pacienteId` da rota é
 * só seletor: o serviço prova o acesso com `autorizarPacientePortal`, sob lock e na transação. Atrás da flag
 * `restricoes.clinicas` (padrão desligada). Nada aqui confirma restrição; a declaração vira pendência.
 */
@Controller('portal/pacientes/:pacienteId/restricoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag)
@FeatureFlag('restricoes.clinicas')
@Papeis('Patient')
@UseFilters(FiltroRestricoesClinicas)
export class ControladorPortalRestricoesPaciente {
  constructor(private readonly portal: ServicoPortalRestricoes, private readonly registro: ServicoRegistroPendenciaRestricao) {}

  @Post('resumo') @HttpCode(200) @Permissoes('portal.acessar') @Header('Cache-Control', 'private, no-store')
  async resumo(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string, @Body() dados: unknown): Promise<unknown> {
    corpoVazio(dados);
    return projetarResumo(await this.portal.resumo(usuario, pacienteId));
  }

  @Post('declarar') @HttpCode(200) @Permissoes('portal.acessar') @Header('Cache-Control', 'private, no-store')
  async declarar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: RegistrarPendenciaDto): Promise<unknown> {
    let conteudo: ReturnType<typeof validarConteudoRestricao>;
    try { conteudo = validarConteudoRestricao(dados.conteudo); } catch { throw new HttpException('Solicitação inválida.', 400); }
    // Projeção própria do portal: só o id e o selo de "informada por você". Nunca revisão nem desfecho da conferência
    // (uma repetição da mesma chave depois da decisão da equipe não revela rejeição nem inativação).
    const r = projetarRegistro(await this.registro.registrar(usuario, pacienteId, { chaveCriacao: dados.chaveCriacao, conteudo }));
    return { id: r.id, selo: 'restricoes.portal.informada_por_voce' };
  }

  @Post('pedidos/listar') @HttpCode(200) @Permissoes('portal.acessar') @Header('Cache-Control', 'private, no-store')
  async listarPedidos(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string, @Body() dados: unknown): Promise<unknown> {
    corpoVazio(dados);
    const lista = await this.portal.listarPedidos(usuario, pacienteId) as { itens?: unknown; maisAntigos?: unknown };
    if (!lista || !Array.isArray(lista.itens) || typeof lista.maisAntigos !== 'boolean') return indisponivel();
    return { itens: lista.itens.map(projetarPedido), maisAntigos: lista.maisAntigos };
  }

  @Post('pedidos/criar') @HttpCode(200) @Permissoes('portal.acessar') @Header('Cache-Control', 'private, no-store')
  async criarPedido(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: CriarPedidoDto): Promise<unknown> {
    return projetarPedido(await this.portal.criarPedido(usuario, pacienteId,
      { chaveCriacao: dados.chaveCriacao, tipo: dados.tipo, restricaoId: dados.restricaoId, itens: dados.itens }));
  }

  @Post('pedidos/:solicitacaoId/cancelar') @HttpCode(200) @Permissoes('portal.acessar') @Header('Cache-Control', 'private, no-store')
  async cancelarPedido(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('solicitacaoId', ParseUUIDPipe) solicitacaoId: string, @Body() dados: unknown): Promise<unknown> {
    corpoVazio(dados);
    return projetarPedido(await this.portal.cancelarPedido(usuario, pacienteId, solicitacaoId));
  }
}
