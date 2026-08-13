import { createHash, randomBytes } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { RefreshTokenOrm } from '../../auth/infraestrutura/refresh-token.orm';
import {
  StatusTokenRedefinicaoSenha,
  TokenRedefinicaoSenhaOrm
} from '../../auth/infraestrutura/token-redefinicao-senha.orm';
import { resolverPlanoSaas } from '../../clientes/dominio/planos-saas';
import { AdaptadorEmailSmtp } from '../../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { AtualizarCicloVidaTenantDto, ProvisionarTenantDto } from './dtos-ciclo-vida-tenant';

const CHAVE_CONTA_CLIENTE = 'conta_cliente';
const CHAVE_PLANO_SAAS = 'plano_saas';

export type StatusCicloVidaTenant = TenantOrm['cicloVidaStatus'];
type StatusConviteProprietario = StatusTokenRedefinicaoSenha | 'enviado' | 'falhou';

export function resolverTransicaoCicloVidaTenant(
  atual: StatusCicloVidaTenant,
  dados: AtualizarCicloVidaTenantDto
): StatusCicloVidaTenant {
  const destinoPorAcao: Record<AtualizarCicloVidaTenantDto['acao'], StatusCicloVidaTenant> = {
    marcar_primeiro_uso: 'primeiro_uso_validado',
    iniciar_acompanhamento: 'acompanhamento_48h',
    concluir_acompanhamento: 'ativo',
    suspender: 'suspenso',
    reativar: 'ativo',
    iniciar_encerramento: 'encerramento_pendente',
    encerrar: 'encerrado'
  };
  const destino = destinoPorAcao[dados.acao];
  if (atual === destino) return atual;
  if (atual === 'encerrado') throw new ConflictException('Tenant encerrado nao pode mudar de estado.');
  if (dados.acao === 'encerrar' && !dados.exportacaoConfirmada) {
    throw new BadRequestException('Confirme a exportacao antes de encerrar o tenant.');
  }
  if (dados.acao === 'encerrar' && !dados.protocoloExportacao?.trim()) {
    throw new BadRequestException('Informe o protocolo da exportacao antes de encerrar o tenant.');
  }

  const permitidas: Record<AtualizarCicloVidaTenantDto['acao'], StatusCicloVidaTenant[]> = {
    marcar_primeiro_uso: ['ativo_assistido'],
    iniciar_acompanhamento: ['primeiro_uso_validado'],
    concluir_acompanhamento: ['acompanhamento_48h'],
    suspender: ['ativo_assistido', 'primeiro_uso_validado', 'acompanhamento_48h', 'ativo'],
    reativar: ['suspenso'],
    iniciar_encerramento: ['ativo_assistido', 'primeiro_uso_validado', 'acompanhamento_48h', 'ativo', 'suspenso'],
    encerrar: ['encerramento_pendente']
  };
  if (!permitidas[dados.acao].includes(atual)) {
    throw new ConflictException(`Transicao ${dados.acao} indisponivel a partir de ${atual}.`);
  }
  return destino;
}

export function ehViolacaoUnicidadePostgres(erro: unknown): boolean {
  if (!(erro instanceof QueryFailedError)) return false;
  return (erro.driverError as { code?: string } | undefined)?.code === '23505';
}

export interface TenantOperacionalResumo {
  id: string;
  nome: string;
  slug: string;
  status: string;
  cicloVidaStatus: StatusCicloVidaTenant;
  provisionamentoReferencia?: string;
  planoId: string;
  assinaturaStatus: string;
  proprietarioEmailMascarado?: string;
  conviteStatus?: string;
  criadoEm: Date;
  atualizadoEm: Date;
  encerradoEm?: Date;
}

export interface ResultadoProvisionamentoTenant extends TenantOperacionalResumo {
  reutilizado: boolean;
  convite?: {
    status: StatusConviteProprietario;
    expiraEm: Date;
    linkPrimeiroAcesso?: string;
  };
}

interface ContextoProvisionamento {
  tenant: TenantOrm;
  usuario: UsuarioOrm;
  token: TokenRedefinicaoSenhaOrm;
  tokenBruto?: string;
  emailProprietario: string;
  reutilizado: boolean;
}

@Injectable()
export class ServicoCicloVidaTenant {
  constructor(
    private readonly fonteDados: DataSource,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly senhas: ServicoSenhas,
    private readonly email: AdaptadorEmailSmtp
  ) {}

  async listar(): Promise<{ itens: TenantOperacionalResumo[]; total: number }> {
    const tenants = await this.fonteDados.getRepository(TenantOrm).find({ order: { criadoEm: 'DESC' } });
    const itens: TenantOperacionalResumo[] = [];
    for (const tenant of tenants) itens.push(await this.obterResumo(tenant));
    return { itens, total: itens.length };
  }

  async provisionar(dados: ProvisionarTenantDto, usuarioExecutorId: string): Promise<ResultadoProvisionamentoTenant> {
    const normalizados = {
      referencia: dados.referencia.trim().toLowerCase(),
      nome: dados.nome.trim(),
      slug: dados.slug.trim().toLowerCase(),
      email: dados.emailProprietario.trim().toLowerCase(),
      timezone: dados.timezone?.trim() || 'America/Sao_Paulo'
    };

    let contexto: ContextoProvisionamento;
    try {
      contexto = await this.fonteDados.transaction(async (gerenciador) => {
        const repositorioTenants = gerenciador.getRepository(TenantOrm);
        const existente = await repositorioTenants.findOne({
          where: { provisionamentoReferencia: normalizados.referencia }
        });
        if (existente) {
          if (existente.slug !== normalizados.slug) {
            throw new ConflictException('A referencia de provisionamento ja pertence a outro tenant.');
          }
          return this.carregarContextoExistente(gerenciador, existente, normalizados.email);
        }

        if (await repositorioTenants.findOne({ where: { slug: normalizados.slug } })) {
          throw new ConflictException('Ja existe tenant com este slug.');
        }

        const tenant = await repositorioTenants.save(
        repositorioTenants.create({
          nome: normalizados.nome,
          slug: normalizados.slug,
          status: 'ativo',
          cicloVidaStatus: 'ativo_assistido',
          provisionamentoReferencia: normalizados.referencia
        })
      );
        await this.aplicarContextoTenant(gerenciador, tenant.id);

        const plano = resolverPlanoSaas(dados.planoId);
        const agora = new Date().toISOString();
        const configuracoes = gerenciador.getRepository(TenantConfiguracaoOrm);
        await configuracoes.save([
        configuracoes.create({
          tenantId: tenant.id,
          chave: CHAVE_CONTA_CLIENTE,
          valor: {
            timezone: normalizados.timezone,
            idioma: 'pt-BR',
            canaisPadrao: { email: true, whatsapp: false, googleCalendar: false },
            marca: { nomeExibido: normalizados.nome, emailRemetente: '', corPrimaria: '#167D7F' }
          }
        }),
        configuracoes.create({
          tenantId: tenant.id,
          chave: CHAVE_PLANO_SAAS,
          valor: {
            tenantId: tenant.id,
            planoId: plano.id,
            plano: plano.nome,
            status: 'ativa',
            origem: 'provisionamento_assistido',
            atualizadoPorUsuarioId: usuarioExecutorId,
            atualizadoEm: agora
          }
        })
        ]);

        const emailHash = this.criptografia.gerarHashBusca(normalizados.email);
        const repositorioUsuarios = gerenciador.getRepository(UsuarioOrm);
        const usuario = await repositorioUsuarios.save(
        repositorioUsuarios.create({
          tenantId: tenant.id,
          emailHash,
          emailCriptografado: this.criptografia.criptografar(normalizados.email),
          senhaHash: this.senhas.gerarHash(`convite.${randomBytes(32).toString('base64url')}`),
          role: 'Client',
          ativo: true
        })
        );

        const tokenBruto = `${tenant.id}.${randomBytes(32).toString('base64url')}`;
        const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const repositorioTokens = gerenciador.getRepository(TokenRedefinicaoSenhaOrm);
        const token = await repositorioTokens.save(
        repositorioTokens.create({
          tenantId: tenant.id,
          usuarioId: usuario.id,
          emailHash,
          tokenHash: this.hashToken(tokenBruto),
          status: 'pendente',
          expiraEm,
          payload: {
            origem: 'convite_proprietario_tenant',
            role: 'Client',
            criadoPorUsuarioId: usuarioExecutorId,
            convidadoEm: agora
          }
        })
        );

        return { tenant, usuario, token, tokenBruto, emailProprietario: normalizados.email, reutilizado: false };
      });
    } catch (erro) {
      if (!ehViolacaoUnicidadePostgres(erro)) throw erro;
      contexto = await this.carregarProvisionamentoConcorrente(
        normalizados.referencia,
        normalizados.slug,
        normalizados.email
      );
    }

    let statusConvite: StatusConviteProprietario = contexto.reutilizado
      ? this.obterStatusConviteExistente(contexto.token)
      : 'enviado';
    if (contexto.tokenBruto) {
      try {
        await this.enviarConviteProprietario(contexto.emailProprietario, contexto.tenant.nome, contexto.tokenBruto);
      } catch (erro) {
        statusConvite = 'falhou';
        await this.registrarFalhaEmail(contexto, erro);
      }
    }

    const resumo = await this.obterResumo(contexto.tenant);
    return {
      ...resumo,
      reutilizado: contexto.reutilizado,
      convite: {
        status: statusConvite,
        expiraEm: contexto.token.expiraEm,
        ...(contexto.tokenBruto && this.deveExporLinkPrimeiroAcesso()
          ? { linkPrimeiroAcesso: this.montarLinkPrimeiroAcesso(contexto.tokenBruto) }
          : {})
      }
    };
  }

  async atualizarCicloVida(
    tenantId: string,
    usuarioExecutorId: string,
    dados: AtualizarCicloVidaTenantDto
  ): Promise<TenantOperacionalResumo> {
    const tenant = await this.fonteDados.getRepository(TenantOrm).findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant nao encontrado.');

    await this.fonteDados.transaction(async (gerenciador) => {
      const atual = await gerenciador.getRepository(TenantOrm).findOne({ where: { id: tenantId } });
      if (!atual) throw new NotFoundException('Tenant nao encontrado.');
      await this.aplicarContextoTenant(gerenciador, tenantId);

      const destino = resolverTransicaoCicloVidaTenant(atual.cicloVidaStatus, dados);
      if (destino === atual.cicloVidaStatus) return;

      const configuracoes = gerenciador.getRepository(TenantConfiguracaoOrm);
      const assinaturaAtual = await configuracoes.findOne({ where: { tenantId, chave: CHAVE_PLANO_SAAS } });
      const plano = resolverPlanoSaas(assinaturaAtual?.valor?.planoId);
      const assinatura: Record<string, unknown> = {
        tenantId,
        planoId: plano.id,
        plano: plano.nome,
        origem: 'operacao_ciclo_vida',
        ...(assinaturaAtual?.valor ?? {})
      };
      const agora = new Date().toISOString();

      if (destino === 'suspenso') assinatura.status = 'suspensa';
      if (destino === 'ativo' && atual.cicloVidaStatus === 'suspenso') assinatura.status = 'ativa';
      if (destino === 'encerrado') assinatura.status = 'cancelada';
      assinatura.atualizadoPorUsuarioId = usuarioExecutorId;
      assinatura.atualizadoEm = agora;

      await configuracoes.save(
        configuracoes.create({
          id: assinaturaAtual?.id,
          tenantId,
          chave: CHAVE_PLANO_SAAS,
          valor: assinatura,
          criadoEm: assinaturaAtual?.criadoEm
        })
      );

      atual.cicloVidaStatus = destino;
      if (destino === 'encerrado') {
        atual.status = 'encerrado';
        atual.encerradoEm = new Date();
        await gerenciador.getRepository(UsuarioOrm).update({ tenantId }, { ativo: false });
        await gerenciador.getRepository(RefreshTokenOrm).update({ tenantId }, { revogadoEm: new Date() });
        await gerenciador.getRepository(TokenRedefinicaoSenhaOrm).update(
          { tenantId, status: 'pendente' },
          { status: 'revogado', revogadoEm: new Date() }
        );
      }
      await gerenciador.getRepository(TenantOrm).save(atual);
    });

    const atualizado = await this.fonteDados.getRepository(TenantOrm).findOneOrFail({ where: { id: tenantId } });
    return this.obterResumo(atualizado);
  }

  private async carregarContextoExistente(
    gerenciador: EntityManager,
    tenant: TenantOrm,
    email: string
  ): Promise<ContextoProvisionamento> {
    await this.aplicarContextoTenant(gerenciador, tenant.id);
    const emailHash = this.criptografia.gerarHashBusca(email);
    const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
      where: { tenantId: tenant.id, emailHash, role: 'Client' }
    });
    if (!usuario) throw new ConflictException('A referencia existente possui outro proprietario.');
    const tokens = await gerenciador.getRepository(TokenRedefinicaoSenhaOrm).find({
      where: { tenantId: tenant.id, usuarioId: usuario.id },
      order: { criadoEm: 'DESC' },
      take: 1
    });
    if (!tokens[0]) throw new ConflictException('O provisionamento existente nao possui convite rastreavel.');
    return { tenant, usuario, token: tokens[0], emailProprietario: email, reutilizado: true };
  }

  private carregarProvisionamentoConcorrente(referencia: string, slug: string, email: string) {
    return this.fonteDados.transaction(async (gerenciador) => {
      const tenant = await gerenciador.getRepository(TenantOrm).findOne({
        where: { provisionamentoReferencia: referencia }
      });
      if (!tenant || tenant.slug !== slug) throw new ConflictException('Ja existe tenant com este slug ou referencia.');
      return this.carregarContextoExistente(gerenciador, tenant, email);
    });
  }

  private async obterResumo(tenant: TenantOrm): Promise<TenantOperacionalResumo> {
    return this.fonteDados.transaction(async (gerenciador) => {
      await this.aplicarContextoTenant(gerenciador, tenant.id);
      const [assinatura, proprietario, convite] = await Promise.all([
        gerenciador.getRepository(TenantConfiguracaoOrm).findOne({ where: { tenantId: tenant.id, chave: CHAVE_PLANO_SAAS } }),
        gerenciador.getRepository(UsuarioOrm).findOne({ where: { tenantId: tenant.id, role: 'Client' }, order: { criadoEm: 'ASC' } }),
        gerenciador.getRepository(TokenRedefinicaoSenhaOrm).findOne({ where: { tenantId: tenant.id }, order: { criadoEm: 'DESC' } })
      ]);
      const plano = resolverPlanoSaas(assinatura?.valor?.planoId);
      return {
        id: tenant.id,
        nome: tenant.nome,
        slug: tenant.slug,
        status: tenant.status,
        cicloVidaStatus: tenant.cicloVidaStatus ?? 'ativo',
        provisionamentoReferencia: tenant.provisionamentoReferencia,
        planoId: plano.id,
        assinaturaStatus: typeof assinatura?.valor?.status === 'string' ? assinatura.valor.status : 'ativa',
        proprietarioEmailMascarado: proprietario
          ? this.mascararEmail(this.criptografia.descriptografar(proprietario.emailCriptografado))
          : undefined,
        conviteStatus: convite?.status,
        criadoEm: tenant.criadoEm,
        atualizadoEm: tenant.atualizadoEm,
        encerradoEm: tenant.encerradoEm
      };
    });
  }

  private async enviarConviteProprietario(destino: string, tenantNome: string, token: string) {
    const linkPrimeiroAcesso = this.montarLinkPrimeiroAcesso(token);
    const texto = [
      `Voce foi convidado para administrar ${tenantNome} no OctaClin.`,
      '',
      'Crie sua propria senha pelo link abaixo. A equipe OctaClin nao conhece sua senha.',
      '',
      linkPrimeiroAcesso,
      '',
      'Se voce nao reconhece este convite, ignore este email.'
    ].join('\n');
    await this.email.enviar({
      canal: { id: 'onboarding-tenant', tenantId: 'sistema', tipo: 'email', nome: 'Onboarding tenant', ativo: true, configuracao: {} },
      template: {
        id: 'onboarding-tenant',
        tenantId: 'sistema',
        canal: 'email',
        nome: 'Convite proprietario OctaClin',
        aprovado: true,
        conteudo: { assunto: 'Ative sua conta OctaClin', texto }
      },
      payload: { destino, assunto: 'Ative sua conta OctaClin', texto, linkPrimeiroAcesso }
    });
  }

  private async registrarFalhaEmail(contexto: ContextoProvisionamento, erro: unknown) {
    await this.fonteDados.transaction(async (gerenciador) => {
      await this.aplicarContextoTenant(gerenciador, contexto.tenant.id);
      contexto.token.payload = {
        ...contexto.token.payload,
        emailErro: erro instanceof Error ? erro.message : 'Falha desconhecida no envio.'
      };
      await gerenciador.getRepository(TokenRedefinicaoSenhaOrm).save(contexto.token);
    });
  }

  private aplicarContextoTenant(gerenciador: EntityManager, tenantId: string) {
    return gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
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

  private obterStatusConviteExistente(token: TokenRedefinicaoSenhaOrm): StatusConviteProprietario {
    return token.payload?.emailErro ? 'falhou' : token.status;
  }

  private mascararEmail(email: string) {
    const [usuario, dominio] = email.split('@');
    if (!dominio) return '***';
    return `${usuario.slice(0, 2)}***@${dominio}`;
  }
}
