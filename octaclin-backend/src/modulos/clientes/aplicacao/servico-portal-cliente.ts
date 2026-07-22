import { NotFoundException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { contextoAcessoPorPapel } from '../../auth/dominio/permissoes';
import { AtualizarConfiguracoesClienteDto } from './dtos';

const CHAVE_CONFIGURACOES_CONTA = 'conta_cliente';

export interface ResumoPortalCliente {
  conta: {
    tenantId: string;
    nome: string;
    slug: string;
    status: string;
    criadoEm: Date;
    atualizadoEm: Date;
  };
  assinatura: {
    plano: string;
    status: string;
    origem: string;
  };
  usuarios: {
    totalAtivos: number;
    clientes: number;
    profissionais: number;
    pacientes: number;
  };
  acesso: {
    usuarioId: string;
    papel: 'Client';
    escopoDados: string;
    destinoInicial: string;
  };
}

export interface ConfiguracoesPortalCliente {
  tenantId: string;
  nome: string;
  slug: string;
  status: string;
  timezone: string;
  idioma: 'pt-BR' | 'en-US' | 'es';
  canaisPadrao: {
    email: boolean;
    whatsapp: boolean;
    googleCalendar: boolean;
  };
  marca: {
    nomeExibido: string;
    emailRemetente: string;
    corPrimaria: string;
  };
  atualizadoEm: Date;
}

@Injectable()
export class ServicoPortalCliente {
  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant
  ) {}

  async obterResumo(tenantId: string, usuarioId: string): Promise<ResumoPortalCliente> {
    const tenant = await this.fonteDados.getRepository(TenantOrm).findOne({
      where: { id: tenantId, status: 'ativo' }
    });
    if (!tenant) throw new NotFoundException('Conta cliente nao encontrada.');

    const usuarios = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(UsuarioOrm).find({ where: { tenantId, ativo: true } })
    );
    const contexto = contextoAcessoPorPapel('Client');

    return {
      conta: {
        tenantId: tenant.id,
        nome: tenant.nome,
        slug: tenant.slug,
        status: tenant.status,
        criadoEm: tenant.criadoEm,
        atualizadoEm: tenant.atualizadoEm
      },
      assinatura: {
        plano: 'Plano gratuito',
        status: 'ativa',
        origem: 'base_inicial'
      },
      usuarios: {
        totalAtivos: usuarios.length,
        clientes: usuarios.filter((usuario) => usuario.role === 'Client').length,
        profissionais: usuarios.filter((usuario) => ['SuperAdmin', 'Professional', 'Collaborator'].includes(usuario.role)).length,
        pacientes: usuarios.filter((usuario) => usuario.role === 'Patient').length
      },
      acesso: {
        usuarioId,
        papel: 'Client',
        escopoDados: contexto.escopoDados,
        destinoInicial: contexto.destinoInicial
      }
    };
  }

  async obterConfiguracoes(tenantId: string): Promise<ConfiguracoesPortalCliente> {
    const tenant = await this.obterTenantAtivo(tenantId);
    const configuracao = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
        where: { tenantId, chave: CHAVE_CONFIGURACOES_CONTA }
      })
    );

    return this.mapearConfiguracoes(tenant, configuracao?.valor);
  }

  async atualizarConfiguracoes(tenantId: string, dados: AtualizarConfiguracoesClienteDto): Promise<ConfiguracoesPortalCliente> {
    const tenant = await this.obterTenantAtivo(tenantId);
    const dadosNormalizados = this.normalizarConfiguracoes(dados);
    tenant.nome = dadosNormalizados.nome;
    tenant.atualizadoEm = new Date();
    await this.fonteDados.getRepository(TenantOrm).save(tenant);

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(TenantConfiguracaoOrm);
      const atual = await repositorio.findOne({
        where: { tenantId, chave: CHAVE_CONFIGURACOES_CONTA }
      });
      await repositorio.save(
        repositorio.create({
          id: atual?.id,
          tenantId,
          chave: CHAVE_CONFIGURACOES_CONTA,
          valor: {
            timezone: dadosNormalizados.timezone,
            idioma: dadosNormalizados.idioma,
            canaisPadrao: dadosNormalizados.canaisPadrao,
            marca: dadosNormalizados.marca
          },
          criadoEm: atual?.criadoEm
        })
      );
    });

    return this.obterConfiguracoes(tenantId);
  }

  private async obterTenantAtivo(tenantId: string): Promise<TenantOrm> {
    const tenant = await this.fonteDados.getRepository(TenantOrm).findOne({
      where: { id: tenantId, status: 'ativo' }
    });
    if (!tenant) throw new NotFoundException('Conta cliente nao encontrada.');
    return tenant;
  }

  private normalizarConfiguracoes(dados: AtualizarConfiguracoesClienteDto): AtualizarConfiguracoesClienteDto {
    return {
      nome: dados.nome.trim(),
      timezone: dados.timezone.trim(),
      idioma: dados.idioma,
      canaisPadrao: {
        email: Boolean(dados.canaisPadrao.email),
        whatsapp: Boolean(dados.canaisPadrao.whatsapp),
        googleCalendar: Boolean(dados.canaisPadrao.googleCalendar)
      },
      marca: {
        nomeExibido: dados.marca.nomeExibido.trim(),
        emailRemetente: dados.marca.emailRemetente?.trim() ?? '',
        corPrimaria: dados.marca.corPrimaria?.trim() || '#197d8f'
      }
    };
  }

  private mapearConfiguracoes(tenant: TenantOrm, valor?: Record<string, unknown>): ConfiguracoesPortalCliente {
    const configuracoes = valor ?? {};
    const canais = this.objeto(configuracoes.canaisPadrao);
    const marca = this.objeto(configuracoes.marca);

    return {
      tenantId: tenant.id,
      nome: tenant.nome,
      slug: tenant.slug,
      status: tenant.status,
      timezone: this.texto(configuracoes.timezone, 'America/Sao_Paulo'),
      idioma: this.idioma(configuracoes.idioma),
      canaisPadrao: {
        email: this.booleano(canais.email, true),
        whatsapp: this.booleano(canais.whatsapp, true),
        googleCalendar: this.booleano(canais.googleCalendar, true)
      },
      marca: {
        nomeExibido: this.texto(marca.nomeExibido, tenant.nome),
        emailRemetente: this.texto(marca.emailRemetente, ''),
        corPrimaria: this.texto(marca.corPrimaria, '#197d8f')
      },
      atualizadoEm: tenant.atualizadoEm
    };
  }

  private objeto(valor: unknown): Record<string, unknown> {
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
  }

  private texto(valor: unknown, fallback: string): string {
    return typeof valor === 'string' && valor.trim() ? valor : fallback;
  }

  private booleano(valor: unknown, fallback: boolean): boolean {
    return typeof valor === 'boolean' ? valor : fallback;
  }

  private idioma(valor: unknown): 'pt-BR' | 'en-US' | 'es' {
    return valor === 'en-US' || valor === 'es' || valor === 'pt-BR' ? valor : 'pt-BR';
  }
}
