import { createHash, randomBytes } from 'crypto';
import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { AdaptadorEmailSmtp } from '../../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { RedefinirSenhaDto, SolicitarRecuperacaoSenhaDto } from './dtos';
import { TokenRedefinicaoSenhaOrm } from '../infraestrutura/token-redefinicao-senha.orm';

interface ContextoEnvioEmailRecuperacao {
  payload: Record<string, unknown>;
}

const MENSAGEM_GENERICA = 'Se os dados estiverem corretos, enviaremos um link de redefinicao de senha.';

function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

function extrairTenantToken(token: string) {
  const [tenantId, segredo] = token.split('.', 2);
  if (!tenantId || !segredo) throw new NotFoundException('Token de redefinicao invalido.');
  return tenantId;
}

function montarTextoEmail(linkRecuperacao: string) {
  return [
    'Recebemos uma solicitacao para redefinir sua senha no OctaClin.',
    '',
    `Acesse o link para criar uma nova senha: ${linkRecuperacao}`,
    '',
    'Se voce nao solicitou esta alteracao, ignore este email.'
  ].join('\n');
}

@Injectable()
export class ServicoRecuperacaoSenha {
  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly senhas: ServicoSenhas,
    private readonly email: AdaptadorEmailSmtp
  ) {}

  static hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async solicitarRecuperacao(
    dados: SolicitarRecuperacaoSenhaDto,
    metadados: { ip?: string; userAgent?: string } = {}
  ): Promise<{ mensagem: string; linkRecuperacao?: string }> {
    const tenant = await this.fonteDados.getRepository(TenantOrm).findOne({
      where: { slug: dados.tenantSlug, status: 'ativo' }
    });
    if (!tenant) return { mensagem: MENSAGEM_GENERICA };

    const emailNormalizado = normalizarEmail(dados.email);
    const emailHash = this.criptografia.gerarHashBusca(emailNormalizado);

    const resultado = await this.executorTenant.executar(tenant.id, async (gerenciador) => {
      const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
        where: { tenantId: tenant.id, emailHash, ativo: true }
      });
      if (!usuario) return undefined;

      const token = `${tenant.id}.${randomBytes(32).toString('base64url')}`;
      const linkRecuperacao = this.montarLinkRecuperacao(token);
      const expiraEm = new Date(Date.now() + 60 * 60 * 1000);

      await gerenciador.getRepository(TokenRedefinicaoSenhaOrm).save(
        gerenciador.getRepository(TokenRedefinicaoSenhaOrm).create({
          tenantId: tenant.id,
          usuarioId: usuario.id,
          emailHash,
          tokenHash: ServicoRecuperacaoSenha.hashToken(token),
          status: 'pendente',
          expiraEm,
          ipSolicitacao: metadados.ip,
          userAgentSolicitacao: metadados.userAgent,
          payload: {
            origem: 'recuperacao_senha',
            solicitadoEm: new Date().toISOString()
          }
        })
      );

      try {
        await this.enviarEmailRecuperacao(emailNormalizado, linkRecuperacao);
      } catch (erro) {
        await gerenciador.getRepository(TokenRedefinicaoSenhaOrm).update(
          { tenantId: tenant.id, tokenHash: ServicoRecuperacaoSenha.hashToken(token) },
          {
            payload: {
              origem: 'recuperacao_senha',
              solicitadoEm: new Date().toISOString(),
              emailErro: erro instanceof Error ? erro.message : 'Falha desconhecida no envio.'
            }
          }
        );
      }
      return { linkRecuperacao };
    });

    return {
      mensagem: MENSAGEM_GENERICA,
      linkRecuperacao: this.deveExporLinkRecuperacao() ? resultado?.linkRecuperacao : undefined
    };
  }

  async validarToken(token: string): Promise<{ email: string; expiraEm: Date }> {
    const tenantId = extrairTenantToken(token);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const registro = await gerenciador.getRepository(TokenRedefinicaoSenhaOrm).findOne({
        where: { tenantId, tokenHash: ServicoRecuperacaoSenha.hashToken(token) }
      });
      this.validarRegistro(registro);

      const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
        where: { id: registro!.usuarioId, tenantId, ativo: true }
      });
      if (!usuario) throw new NotFoundException('Token de redefinicao invalido.');

      return {
        email: this.criptografia.descriptografar(usuario.emailCriptografado),
        expiraEm: registro!.expiraEm
      };
    });
  }

  async redefinirSenha(dados: RedefinirSenhaDto): Promise<{ mensagem: string }> {
    const tenantId = extrairTenantToken(dados.token);

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioTokens = gerenciador.getRepository(TokenRedefinicaoSenhaOrm);
      const registro = await repositorioTokens.findOne({
        where: { tenantId, tokenHash: ServicoRecuperacaoSenha.hashToken(dados.token) }
      });
      this.validarRegistro(registro);

      const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
        where: { id: registro!.usuarioId, tenantId, ativo: true }
      });
      if (!usuario) throw new NotFoundException('Token de redefinicao invalido.');

      usuario.senhaHash = this.senhas.gerarHash(dados.senha);
      await gerenciador.getRepository(UsuarioOrm).save(usuario);

      registro!.status = 'usado';
      registro!.usadoEm = new Date();
      await repositorioTokens.save(registro!);
    });

    return { mensagem: 'Senha redefinida com sucesso.' };
  }

  private validarRegistro(registro?: TokenRedefinicaoSenhaOrm | null): asserts registro is TokenRedefinicaoSenhaOrm {
    if (!registro) throw new NotFoundException('Token de redefinicao invalido.');
    if (registro.status !== 'pendente' || registro.usadoEm || registro.revogadoEm) {
      throw new GoneException('Token de redefinicao indisponivel.');
    }
    if (registro.expiraEm <= new Date()) throw new GoneException('Token de redefinicao expirado.');
  }

  private async enviarEmailRecuperacao(destino: string, linkRecuperacao: string) {
    const texto = montarTextoEmail(linkRecuperacao);
    const contexto: ContextoEnvioEmailRecuperacao = {
      payload: {
        destino,
        assunto: 'Redefinicao de senha - OctaClin',
        texto,
        linkRecuperacao
      }
    };

    await this.email.enviar({
      canal: {
        id: 'recuperacao-senha',
        tenantId: 'sistema',
        tipo: 'email',
        nome: 'Email recuperacao senha',
        ativo: true,
        configuracao: {}
      },
      template: {
        id: 'recuperacao-senha',
        tenantId: 'sistema',
        canal: 'email',
        nome: 'Recuperacao de senha',
        aprovado: true,
        conteudo: {
          assunto: 'Redefinicao de senha - OctaClin',
          texto
        }
      },
      payload: contexto.payload
    });
  }

  private montarLinkRecuperacao(token: string) {
    const baseUrl = (process.env.OCTACLIN_WEB_URL ?? process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const url = new URL('/recuperar-senha', baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private deveExporLinkRecuperacao() {
    return process.env.NODE_ENV !== 'production' || process.env.EXPOR_LINK_RECUPERACAO_SENHA === 'true';
  }
}
