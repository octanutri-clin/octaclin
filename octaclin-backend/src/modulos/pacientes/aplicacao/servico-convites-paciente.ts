import { createHash, randomBytes } from 'crypto';
import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { contextoAcessoPorPapel } from '../../auth/dominio/permissoes';
import { ServicoAuth } from '../../auth/aplicacao/servico-auth';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { listarDocumentosLegaisPaciente } from './documentos-legais-paciente';
import { AtivarConvitePacienteDto, CriarConvitePacienteDto } from './dtos';
import { ConvitePacienteOrm } from '../infraestrutura/convite-paciente.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';

export interface ConvitePacienteResposta {
  id: string;
  pacienteId: string;
  email: string;
  status: string;
  expiraEm: Date;
  token: string;
  linkAtivacao: string;
}

export interface ConvitePacientePublico {
  pacienteId: string;
  nomePaciente: string;
  email: string;
  status: string;
  expiraEm: Date;
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

function extrairTenantToken(token: string) {
  const [tenantId, segredo] = token.split('.', 2);
  if (!tenantId || !segredo) throw new BadRequestException('Convite invalido.');
  return tenantId;
}

@Injectable()
export class ServicoConvitesPaciente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly senhas: ServicoSenhas,
    private readonly servicoAuth: ServicoAuth
  ) {}

  async criarConvite(
    tenantId: string,
    usuarioCriadorId: string,
    pacienteId: string,
    dados: CriarConvitePacienteDto
  ): Promise<ConvitePacienteResposta> {
    const email = normalizarEmail(dados.email);
    const token = `${tenantId}.${randomBytes(32).toString('base64url')}`;
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const convite = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: pacienteId, tenantId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
      if (paciente.usuarioId) throw new ConflictException('Paciente ja possui acesso ativo.');

      const repositorio = gerenciador.getRepository(ConvitePacienteOrm);
      const convitesPendentes = await repositorio.find({
        where: { tenantId, pacienteId, status: 'pendente', revogadoEm: IsNull() }
      });
      const revogadoEm = new Date();
      for (const convitePendente of convitesPendentes) {
        convitePendente.status = 'revogado';
        convitePendente.revogadoEm = revogadoEm;
        await repositorio.save(convitePendente);
      }

      return repositorio.save(
        repositorio.create({
          tenantId,
          pacienteId,
          criadoPorUsuarioId: usuarioCriadorId,
          emailHash: this.criptografia.gerarHashBusca(email),
          emailCriptografado: this.criptografia.criptografar(email),
          tokenHash: tokenHash(token),
          status: 'pendente',
          expiraEm,
          payload: {
            canal: 'link',
            origem: 'console',
            criadoEm: new Date().toISOString()
          }
        })
      );
    });

    return {
      id: convite.id,
      pacienteId: convite.pacienteId,
      email,
      status: convite.status,
      expiraEm: convite.expiraEm,
      token,
      linkAtivacao: this.montarLinkAtivacao(token)
    };
  }

  async obterConvitePublico(token: string): Promise<ConvitePacientePublico> {
    const tenantId = extrairTenantToken(token);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const convite = await gerenciador.getRepository(ConvitePacienteOrm).findOne({
        where: { tenantId, tokenHash: tokenHash(token) }
      });
      this.validarConvite(convite);

      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: convite!.pacienteId, tenantId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');

      return {
        pacienteId: paciente.id,
        nomePaciente: this.criptografia.descriptografar(paciente.nomeCriptografado),
        email: this.criptografia.descriptografar(convite!.emailCriptografado),
        status: convite!.status,
        expiraEm: convite!.expiraEm
      };
    });
  }

  async ativarConvite(dados: AtivarConvitePacienteDto) {
    if (!dados.aceiteTermosUso || !dados.aceitePoliticaPrivacidade || !dados.aceiteLgpd) {
      throw new BadRequestException('Aceite dos termos, politica de privacidade e LGPD e obrigatorio para ativar o acesso.');
    }

    const tenantId = extrairTenantToken(dados.token);
    const contextoPaciente = contextoAcessoPorPapel('Patient');

    const ativacao = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioConvites = gerenciador.getRepository(ConvitePacienteOrm);
      const convite = await repositorioConvites.findOne({
        where: { tenantId, tokenHash: tokenHash(dados.token) }
      });
      this.validarConvite(convite);

      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: { id: convite!.pacienteId, tenantId, arquivadoEm: IsNull() }
      });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
      if (paciente.usuarioId) throw new ConflictException('Paciente ja possui acesso ativo.');

      const email = this.criptografia.descriptografar(convite!.emailCriptografado);
      const usuario = await gerenciador.getRepository(UsuarioOrm).save(
        gerenciador.getRepository(UsuarioOrm).create({
          tenantId,
          emailHash: convite!.emailHash,
          emailCriptografado: convite!.emailCriptografado,
          senhaHash: this.senhas.gerarHash(dados.senha),
          role: 'Patient',
          ativo: true
        })
      );

      paciente.usuarioId = usuario.id;
      await gerenciador.getRepository(PacienteOrm).save(paciente);

      const repositorioConsentimentos = gerenciador.getRepository(ConsentimentoLgpdOrm);
      const aceitoEm = new Date();
      for (const documento of listarDocumentosLegaisPaciente(dados)) {
        await repositorioConsentimentos.save(
          repositorioConsentimentos.create({
            tenantId,
            usuarioId: usuario.id,
            tipo: documento.tipo,
            versao: documento.versao,
            aceitoEm,
            metadados: {
              pacienteId: paciente.id,
              conviteId: convite!.id,
              origem: 'primeiro_acesso',
              perfil: documento.perfil,
              documentoLegal: documento.tipo
            }
          })
        );
      }

      convite!.status = 'aceito';
      convite!.aceitoEm = new Date();
      convite!.usuarioId = usuario.id;
      await repositorioConvites.save(convite!);
      return {
        pacienteId: paciente.id,
        usuarioId: usuario.id,
        tenantId,
        email,
        usuario
      };
    });

    // O refresh token referencia o usuario criado acima. A sessao precisa ser
    // emitida somente depois do commit para evitar uma segunda transacao lendo
    // um usuario ainda invisivel.
    const sessao = await this.servicoAuth.emitirSessaoUsuario(ativacao.usuario);
    return {
      pacienteId: ativacao.pacienteId,
      usuarioId: ativacao.usuarioId,
      tenantId: ativacao.tenantId,
      email: ativacao.email,
      ...sessao,
      destinoInicial: contextoPaciente.destinoInicial
    };
  }

  private validarConvite(convite?: ConvitePacienteOrm | null): asserts convite is ConvitePacienteOrm {
    if (!convite) throw new NotFoundException('Convite nao encontrado.');
    if (convite.status !== 'pendente' || convite.revogadoEm) throw new GoneException('Convite indisponivel.');
    if (convite.expiraEm <= new Date()) throw new GoneException('Convite expirado.');
  }

  private montarLinkAtivacao(token: string) {
    const baseUrl = (process.env.OCTACLIN_WEB_URL ?? process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const url = new URL('/primeiro-acesso', baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }
}
