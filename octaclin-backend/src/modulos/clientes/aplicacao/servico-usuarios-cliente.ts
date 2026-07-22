import { createHash, randomBytes } from 'crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { TokenRedefinicaoSenhaOrm } from '../../auth/infraestrutura/token-redefinicao-senha.orm';
import { AdaptadorEmailSmtp } from '../../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { CriarUsuarioClienteDto, PapelUsuarioClienteAdministrativo, UsuarioClienteRespostaDto } from './dtos';

const papeisAdministrativos = ['Client', 'Professional', 'Collaborator'] satisfies PapelUsuarioClienteAdministrativo[];

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ServicoUsuariosCliente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly senhas: ServicoSenhas,
    private readonly email: AdaptadorEmailSmtp
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
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(UsuarioOrm);
      const repositorioTokens = gerenciador.getRepository(TokenRedefinicaoSenhaOrm);
      const emailNormalizado = dados.email.trim().toLowerCase();
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

      const token = `${tenantId}.${randomBytes(32).toString('base64url')}`;
      const linkPrimeiroAcesso = this.montarLinkPrimeiroAcesso(token);
      const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const payload = {
        origem: 'convite_usuario_cliente',
        criadoPorUsuarioId: usuarioCriadorId,
        role: dados.role,
        convidadoEm: new Date().toISOString()
      };

      await repositorioTokens.save(
        repositorioTokens.create({
          tenantId,
          usuarioId: usuario.id,
          emailHash,
          tokenHash: hashToken(token),
          status: 'pendente',
          expiraEm,
          payload
        })
      );

      try {
        await this.enviarEmailConvite(emailNormalizado, linkPrimeiroAcesso, dados.role);
      } catch (erro) {
        await repositorioTokens.update(
          { tenantId, tokenHash: hashToken(token) },
          {
            payload: {
              ...payload,
              emailErro: erro instanceof Error ? erro.message : 'Falha desconhecida no envio.'
            }
          }
        );
      }

      return {
        ...this.mapearResposta(usuario),
        convite: {
          expiraEm,
          linkPrimeiroAcesso: this.deveExporLinkPrimeiroAcesso() ? linkPrimeiroAcesso : undefined
        }
      };
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

  private ehPapelAdministrativo(role: string): role is PapelUsuarioClienteAdministrativo {
    return papeisAdministrativos.includes(role as PapelUsuarioClienteAdministrativo);
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

  private montarLinkPrimeiroAcesso(token: string) {
    const baseUrl = (process.env.OCTACLIN_WEB_URL ?? process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const url = new URL('/recuperar-senha', baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private deveExporLinkPrimeiroAcesso() {
    return process.env.NODE_ENV !== 'production' || process.env.EXPOR_LINK_RECUPERACAO_SENHA === 'true';
  }
}
