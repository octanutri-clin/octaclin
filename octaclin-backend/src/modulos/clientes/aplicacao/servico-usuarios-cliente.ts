import { createHash, randomBytes } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import {
  montarChaveProtecaoAbuso,
  POLITICA_CONVITES_ADMIN,
  ServicoProtecaoAbuso
} from '../../auth/aplicacao/servico-protecao-abuso';
import { TokenRedefinicaoSenhaOrm } from '../../auth/infraestrutura/token-redefinicao-senha.orm';
import { RefreshTokenOrm } from '../../auth/infraestrutura/refresh-token.orm';
import { AdaptadorEmailSmtp } from '../../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import {
  ConviteUsuarioClienteRespostaDto,
  AtualizarPapelUsuarioClienteDto,
  CriarUsuarioClienteDto,
  HistoricoConviteUsuarioClienteRespostaDto,
  PapelUsuarioClienteAdministrativo,
  UsuarioClienteRespostaDto
} from './dtos';
import { ServicoPortalCliente } from './servico-portal-cliente';

const papeisAdministrativos = ['Client', 'Professional', 'Collaborator'] satisfies PapelUsuarioClienteAdministrativo[];

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function textoPayload(payload: Record<string, unknown>, chave: string): string | undefined {
  const valor = payload[chave];
  return typeof valor === 'string' ? valor : undefined;
}

@Injectable()
export class ServicoUsuariosCliente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly senhas: ServicoSenhas,
    private readonly email: AdaptadorEmailSmtp,
    private readonly portalCliente: ServicoPortalCliente,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
  ) {}

  async listar(tenantId: string): Promise<{ itens: UsuarioClienteRespostaDto[]; total: number }> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const usuarios = await gerenciador.getRepository(UsuarioOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' }
      });
      const itens = usuarios
        .filter((usuario) => this.ehPapelAdministrativo(usuario.role))
        .map((usuario) => this.mapearResposta(usuario));

      return { itens, total: itens.length };
    });
  }

  async criar(tenantId: string, usuarioCriadorId: string, dados: CriarUsuarioClienteDto): Promise<UsuarioClienteRespostaDto> {
    const emailNormalizado = dados.email.trim().toLowerCase();
    const nomeProfissional = dados.nomeProfissional?.trim();
    if (dados.role === 'Professional' && !nomeProfissional) {
      throw new BadRequestException('Informe o nome do profissional para enviar este convite.');
    }
    await this.protecaoAbuso.consumirTentativa(
      montarChaveProtecaoAbuso('convite-admin', tenantId, emailNormalizado),
      POLITICA_CONVITES_ADMIN
    );
    await this.garantirLimitePermitido(tenantId, 'usuariosAdministrativos');

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(UsuarioOrm);
      const emailHash = this.criptografia.gerarHashBusca(dados.email);
      const existente = await repositorio.findOne({ where: { tenantId, emailHash } });

      if (existente) {
        throw new ConflictException('Ja existe usuario com este email nesta conta.');
      }

      const usuario = await repositorio.save(
        repositorio.create({
          tenantId,
          emailHash,
          emailCriptografado: this.criptografia.criptografar(emailNormalizado),
          senhaHash: this.senhas.gerarHash(`convite.${randomBytes(24).toString('base64url')}`),
          role: dados.role,
          ativo: true
        })
      );

      if (dados.role === 'Professional') {
        await gerenciador.getRepository(ProfissionalOrm).save(
          gerenciador.getRepository(ProfissionalOrm).create({
            tenantId,
            usuarioId: usuario.id,
            nomeCriptografado: this.criptografia.criptografar(nomeProfissional as string),
            registroProfissional: dados.registroProfissional?.trim() || undefined,
            especialidade: dados.especialidade?.trim() || undefined
          })
        );
      }

      const convite = await this.criarTokenConvite(gerenciador, {
        tenantId,
        usuarioId: usuario.id,
        emailHash,
        email: emailNormalizado,
        role: dados.role,
        criadoPorUsuarioId: usuarioCriadorId
      });

      return {
        ...this.mapearResposta(usuario),
        convite: {
          expiraEm: convite.expiraEm,
          linkPrimeiroAcesso: convite.linkPrimeiroAcesso
        }
      };
    });
  }

  async listarConvites(tenantId: string): Promise<{ itens: ConviteUsuarioClienteRespostaDto[]; total: number }> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const tokens = await gerenciador.getRepository(TokenRedefinicaoSenhaOrm).find({
        where: { tenantId, status: 'pendente' },
        order: { criadoEm: 'DESC' }
      });
      const itens: ConviteUsuarioClienteRespostaDto[] = [];

      for (const token of tokens.filter((item) => this.ehTokenConviteAdministrativo(item))) {
        const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
          where: { id: token.usuarioId, tenantId }
        });
        if (!usuario || !this.ehPapelAdministrativo(usuario.role)) continue;

        itens.push({
          id: token.id,
          usuarioId: token.usuarioId,
          tenantId: token.tenantId,
          email: this.criptografia.descriptografar(usuario.emailCriptografado),
          role: (textoPayload(token.payload, 'role') ?? usuario.role) as PapelUsuarioClienteAdministrativo,
          status: token.status,
          expiraEm: token.expiraEm,
          criadoEm: token.criadoEm,
          criadoPorUsuarioId: textoPayload(token.payload, 'criadoPorUsuarioId'),
          emailErro: textoPayload(token.payload, 'emailErro')
        });
      }

      return { itens, total: itens.length };
    });
  }

  async listarHistoricoConvites(tenantId: string): Promise<{ itens: HistoricoConviteUsuarioClienteRespostaDto[]; total: number }> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const tokens = await gerenciador.getRepository(TokenRedefinicaoSenhaOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' }
      });
      const itens: HistoricoConviteUsuarioClienteRespostaDto[] = [];

      for (const token of tokens
        .filter((item) => this.ehTokenConviteAdministrativo(item))
        .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())) {
        const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
          where: { id: token.usuarioId, tenantId }
        });
        if (!usuario || !this.ehPapelAdministrativo(usuario.role)) continue;

        itens.push(this.mapearHistoricoConvite(token, usuario));
      }

      return { itens, total: itens.length };
    });
  }

  async exportarHistoricoConvitesCsv(tenantId: string): Promise<string> {
    const historico = await this.listarHistoricoConvites(tenantId);
    const cabecalho = [
      'email',
      'role',
      'status',
      'criado_em',
      'expira_em',
      'usado_em',
      'revogado_em',
      'criado_por',
      'reenviado_por',
      'revogado_por',
      'motivo_revogacao',
      'email_erro'
    ];
    const linhas = historico.itens.map((item) =>
      [
        item.email,
        item.role,
        item.status,
        this.dataIso(item.criadoEm),
        this.dataIso(item.expiraEm),
        this.dataIso(item.usadoEm),
        this.dataIso(item.revogadoEm),
        item.criadoPorUsuarioId ?? '',
        item.reenviadoPorUsuarioId ?? '',
        item.revogadoPorUsuarioId ?? '',
        item.motivoRevogacao ?? '',
        item.emailErro ?? ''
      ]
        .map((valor) => this.campoCsv(valor))
        .join(',')
    );

    return [cabecalho.join(','), ...linhas].join('\n');
  }

  async reenviarConvite(tenantId: string, usuarioExecutorId: string, usuarioId: string): Promise<UsuarioClienteRespostaDto> {
    await this.protecaoAbuso.consumirTentativa(
      montarChaveProtecaoAbuso('convite-admin-reenvio', tenantId, usuarioId),
      POLITICA_CONVITES_ADMIN
    );

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const usuario = await this.obterUsuarioConvidavel(gerenciador, tenantId, usuarioId);
      await this.revogarTokensPendentes(gerenciador, tenantId, usuarioId, usuarioExecutorId, 'reenviado');
      const email = this.criptografia.descriptografar(usuario.emailCriptografado);
      const convite = await this.criarTokenConvite(gerenciador, {
        tenantId,
        usuarioId,
        emailHash: usuario.emailHash,
        email,
        role: usuario.role as PapelUsuarioClienteAdministrativo,
        reenviadoPorUsuarioId: usuarioExecutorId
      });

      return {
        ...this.mapearResposta(usuario),
        convite: {
          expiraEm: convite.expiraEm,
          linkPrimeiroAcesso: convite.linkPrimeiroAcesso
        }
      };
    });
  }

  async revogarConvite(tenantId: string, usuarioExecutorId: string, usuarioId: string): Promise<void> {
    if (usuarioExecutorId === usuarioId) {
      throw new ForbiddenException('O gestor logado nao pode revogar o proprio convite.');
    }

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.obterUsuarioConvidavel(gerenciador, tenantId, usuarioId);
      await this.revogarTokensPendentes(gerenciador, tenantId, usuarioId, usuarioExecutorId, 'revogado');
      await gerenciador.getRepository(UsuarioOrm).update({ id: usuarioId, tenantId }, { ativo: false });
    });
  }

  async desativar(tenantId: string, usuarioAtualId: string, usuarioId: string): Promise<void> {
    if (usuarioAtualId === usuarioId) {
      throw new ForbiddenException('O gestor logado nao pode desativar o proprio acesso.');
    }

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(UsuarioOrm);
      const usuario = await repositorio.findOne({ where: { id: usuarioId, tenantId } });
      if (!usuario || !this.ehPapelAdministrativo(usuario.role)) {
        throw new NotFoundException('Usuario administrativo nao encontrado.');
      }

      await repositorio.update({ id: usuarioId, tenantId }, { ativo: false });
    });
  }

  async atualizarPapel(
    tenantId: string,
    usuarioAtualId: string,
    usuarioId: string,
    dados: AtualizarPapelUsuarioClienteDto
  ): Promise<UsuarioClienteRespostaDto> {
    if (usuarioAtualId === usuarioId) {
      throw new ForbiddenException('O gestor logado nao pode alterar o proprio acesso.');
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioUsuarios = gerenciador.getRepository(UsuarioOrm);
      const usuario = await repositorioUsuarios.findOne({ where: { id: usuarioId, tenantId } });
      if (!usuario || !this.ehPapelAdministrativo(usuario.role) || usuario.role === 'Client') {
        throw new NotFoundException('Usuario administrativo nao encontrado.');
      }
      if (usuario.role === dados.role) return this.mapearResposta(usuario);

      const repositorioProfissionais = gerenciador.getRepository(ProfissionalOrm);
      const perfil = await repositorioProfissionais.findOne({ where: { tenantId, usuarioId } });

      if (dados.role === 'Professional') {
        if (!perfil && !dados.nomeProfissional?.trim()) {
          throw new BadRequestException('Informe o nome do profissional para liberar o acesso clinico.');
        }
        if (perfil) {
          perfil.arquivadoEm = null;
          if (dados.nomeProfissional?.trim()) perfil.nomeCriptografado = this.criptografia.criptografar(dados.nomeProfissional.trim());
          if (dados.registroProfissional !== undefined) perfil.registroProfissional = dados.registroProfissional.trim() || undefined;
          if (dados.especialidade !== undefined) perfil.especialidade = dados.especialidade.trim() || undefined;
          await repositorioProfissionais.save(perfil);
        } else {
          await repositorioProfissionais.save(
            repositorioProfissionais.create({
              tenantId,
              usuarioId,
              nomeCriptografado: this.criptografia.criptografar(dados.nomeProfissional!.trim()),
              registroProfissional: dados.registroProfissional?.trim() || undefined,
              especialidade: dados.especialidade?.trim() || undefined
            })
          );
        }
      } else if (perfil && !perfil.arquivadoEm) {
        const [pacientesVinculados, consultasFuturas] = await Promise.all([
          gerenciador.getRepository(PacienteOrm).count({
            where: { tenantId, profissionalResponsavelId: perfil.id, arquivadoEm: IsNull() }
          }),
          gerenciador.getRepository(AgendaConsultaOrm).count({
            where: { tenantId, profissionalId: perfil.id, status: In(['agendada', 'reagendada']) }
          })
        ]);
        if (pacientesVinculados || consultasFuturas) {
          throw new ConflictException('Reatribua pacientes e consultas futuras antes de remover o acesso profissional.');
        }
        perfil.arquivadoEm = new Date();
        await repositorioProfissionais.save(perfil);
      }

      usuario.role = dados.role;
      const atualizado = await repositorioUsuarios.save(usuario);
      await gerenciador.getRepository(RefreshTokenOrm).update(
        { tenantId, usuarioId },
        { revogadoEm: new Date() }
      );
      return this.mapearResposta(atualizado);
    });
  }

  private ehPapelAdministrativo(role: string): role is PapelUsuarioClienteAdministrativo {
    return papeisAdministrativos.includes(role as PapelUsuarioClienteAdministrativo);
  }

  private async garantirLimitePermitido(tenantId: string, recurso: 'usuariosAdministrativos') {
    const limite = await this.portalCliente.checarLimite(tenantId, recurso);
    if (!limite.permitido) {
      throw new ForbiddenException(limite.mensagem ?? 'Limite do plano atingido para esta acao.');
    }
  }

  private ehTokenConviteAdministrativo(token: TokenRedefinicaoSenhaOrm) {
    return token.payload?.origem === 'convite_usuario_cliente';
  }

  private async obterUsuarioConvidavel(gerenciador: EntityManager, tenantId: string, usuarioId: string): Promise<UsuarioOrm> {
    const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({ where: { id: usuarioId, tenantId } });
    if (!usuario || !this.ehPapelAdministrativo(usuario.role) || usuario.role === 'Client') {
      throw new NotFoundException('Usuario administrativo convidado nao encontrado.');
    }
    return usuario;
  }

  private mapearResposta(usuario: UsuarioOrm): UsuarioClienteRespostaDto {
    return {
      id: usuario.id,
      tenantId: usuario.tenantId,
      email: this.criptografia.descriptografar(usuario.emailCriptografado),
      role: usuario.role as PapelUsuarioClienteAdministrativo,
      ativo: usuario.ativo,
      ultimoLoginEm: usuario.ultimoLoginEm,
      criadoEm: usuario.criadoEm,
      atualizadoEm: usuario.atualizadoEm
    };
  }

  private mapearHistoricoConvite(
    token: TokenRedefinicaoSenhaOrm,
    usuario: UsuarioOrm
  ): HistoricoConviteUsuarioClienteRespostaDto {
    return {
      id: token.id,
      usuarioId: token.usuarioId,
      tenantId: token.tenantId,
      email: this.criptografia.descriptografar(usuario.emailCriptografado),
      role: (textoPayload(token.payload, 'role') ?? usuario.role) as PapelUsuarioClienteAdministrativo,
      status: token.status,
      expiraEm: token.expiraEm,
      criadoEm: token.criadoEm,
      usadoEm: token.usadoEm,
      revogadoEm: token.revogadoEm,
      convidadoEm: textoPayload(token.payload, 'convidadoEm'),
      criadoPorUsuarioId: textoPayload(token.payload, 'criadoPorUsuarioId'),
      reenviadoPorUsuarioId: textoPayload(token.payload, 'reenviadoPorUsuarioId'),
      revogadoPorUsuarioId: textoPayload(token.payload, 'revogadoPorUsuarioId'),
      motivoRevogacao: textoPayload(token.payload, 'motivoRevogacao'),
      emailErro: textoPayload(token.payload, 'emailErro')
    };
  }

  private async enviarEmailConvite(destino: string, linkPrimeiroAcesso: string, role: string) {
    const texto = [
      'Voce recebeu um convite para acessar o OctaClin.',
      '',
      `Perfil do acesso: ${role}.`,
      '',
      `Crie sua senha pelo link: ${linkPrimeiroAcesso}`,
      '',
      'Se voce nao reconhece este convite, ignore este email.'
    ].join('\n');

    await this.email.enviar({
      canal: {
        id: 'convite-usuario-cliente',
        tenantId: 'sistema',
        tipo: 'email',
        nome: 'Email convite usuario cliente',
        ativo: true,
        configuracao: {}
      },
      template: {
        id: 'convite-usuario-cliente',
        tenantId: 'sistema',
        canal: 'email',
        nome: 'Convite usuario cliente',
        aprovado: true,
        conteudo: {
          assunto: 'Convite para acessar o OctaClin',
          texto
        }
      },
      payload: {
        destino,
        assunto: 'Convite para acessar o OctaClin',
        texto,
        linkPrimeiroAcesso,
        role
      }
    });
  }

  private async criarTokenConvite(
    gerenciador: EntityManager,
    dados: {
      tenantId: string;
      usuarioId: string;
      emailHash: string;
      email: string;
      role: string;
      criadoPorUsuarioId?: string;
      reenviadoPorUsuarioId?: string;
    }
  ) {
    const repositorioTokens = gerenciador.getRepository(TokenRedefinicaoSenhaOrm);
    const token = `${dados.tenantId}.${randomBytes(32).toString('base64url')}`;
    const linkPrimeiroAcesso = this.montarLinkPrimeiroAcesso(token);
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const payload = {
      origem: 'convite_usuario_cliente',
      criadoPorUsuarioId: dados.criadoPorUsuarioId,
      reenviadoPorUsuarioId: dados.reenviadoPorUsuarioId,
      role: dados.role,
      convidadoEm: new Date().toISOString()
    };

    await repositorioTokens.save(
      repositorioTokens.create({
        tenantId: dados.tenantId,
        usuarioId: dados.usuarioId,
        emailHash: dados.emailHash,
        tokenHash: hashToken(token),
        status: 'pendente',
        expiraEm,
        payload
      })
    );

    try {
      await this.enviarEmailConvite(dados.email, linkPrimeiroAcesso, dados.role);
    } catch (erro) {
      await repositorioTokens.update(
        { tenantId: dados.tenantId, tokenHash: hashToken(token) },
        {
          payload: {
            ...payload,
            emailErro: erro instanceof Error ? erro.message : 'Falha desconhecida no envio.'
          }
        }
      );
    }

    return {
      expiraEm,
      linkPrimeiroAcesso: this.deveExporLinkPrimeiroAcesso() ? linkPrimeiroAcesso : undefined
    };
  }

  private async revogarTokensPendentes(
    gerenciador: EntityManager,
    tenantId: string,
    usuarioId: string,
    usuarioExecutorId: string,
    motivo: string
  ) {
    const repositorioTokens = gerenciador.getRepository(TokenRedefinicaoSenhaOrm);
    const tokens = await repositorioTokens.find({
      where: { tenantId, status: 'pendente' },
      order: { criadoEm: 'DESC' }
    });
    const agora = new Date();

    for (const token of tokens.filter((item: TokenRedefinicaoSenhaOrm) => item.usuarioId === usuarioId && this.ehTokenConviteAdministrativo(item))) {
      token.status = 'revogado';
      token.revogadoEm = agora;
      token.payload = {
        ...token.payload,
        revogadoPorUsuarioId: usuarioExecutorId,
        motivoRevogacao: motivo
      };
      await repositorioTokens.save(token);
    }
  }

  private montarLinkPrimeiroAcesso(token: string) {
    const baseUrl = (process.env.OCTACLIN_WEB_URL ?? process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const url = new URL('/recuperar-senha', baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private deveExporLinkPrimeiroAcesso() {
    return process.env.NODE_ENV !== 'production' || process.env.EXPOR_LINK_RECUPERACAO_SENHA === 'true';
  }

  private dataIso(valor?: Date) {
    return valor instanceof Date ? valor.toISOString() : '';
  }

  private campoCsv(valor: string) {
    return /[",\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
  }
}
