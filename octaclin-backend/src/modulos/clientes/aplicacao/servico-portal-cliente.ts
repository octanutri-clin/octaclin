import { NotFoundException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { contextoAcessoPorPapel } from '../../auth/dominio/permissoes';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { LimitesPlanoSaas, PlanoSaasId, RecursoLimitavelSaas, resolverPlanoSaas } from '../dominio/planos-saas';
import { AtualizarConfiguracoesClienteDto, AtualizarPerfilEmpresaClienteDto, SolicitarAjusteAssinaturaClienteDto } from './dtos';

const CHAVE_CONFIGURACOES_CONTA = 'conta_cliente';
const CHAVE_PERFIL_EMPRESA = 'perfil_empresa';
const CHAVE_PLANO_SAAS = 'plano_saas';
const CHAVE_INTERESSE_ASSINATURA = 'assinatura_interesse';

type UsoPlanoSaas = Record<RecursoLimitavelSaas, number>;

interface AlertaPlanoSaas {
  recurso: RecursoLimitavelSaas;
  uso: number;
  limite: number;
  percentual: number;
  status: 'atencao' | 'excedido';
}

export interface ChecagemLimiteSaas {
  permitido: boolean;
  recurso: RecursoLimitavelSaas;
  planoId: PlanoSaasId;
  plano: string;
  uso: number;
  limite: number | null;
  restante: number | null;
  statusAssinatura?: string;
  motivo?: 'limite_excedido' | 'assinatura_bloqueada';
  mensagem?: string;
}

export interface SolicitacaoAjusteAssinaturaCliente {
  tenantId: string;
  acao: 'upgrade' | 'downgrade' | 'revisao_limite';
  status: 'pendente';
  planoAtualId: PlanoSaasId;
  planoAtual: string;
  planoDesejado?: PlanoSaasId;
  observacao?: string;
  solicitadoPorUsuarioId: string;
  solicitadoEm: string;
}

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
    planoId: PlanoSaasId;
    status: string;
    origem: string;
    renovacaoEm?: string;
    limites: LimitesPlanoSaas;
    uso: UsoPlanoSaas;
    alertas: AlertaPlanoSaas[];
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

export interface PerfilEmpresaCliente {
  tenantId: string;
  tipoPessoa: 'pf' | 'pj';
  documento: string;
  nomeLegal: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  responsavel: {
    nome: string;
    email: string;
    telefone: string;
    cargo: string;
  };
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    pais: string;
  };
  contatos: {
    emailFinanceiro: string;
    telefoneFinanceiro: string;
    whatsappAtendimento: string;
    emailAtendimento: string;
  };
  fiscal: {
    prepararRecibos: boolean;
    observacoes: string;
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

    const [usuarios, assinatura] = await Promise.all([
      this.executorTenant.executar(tenantId, (gerenciador) =>
        gerenciador.getRepository(UsuarioOrm).find({ where: { tenantId, ativo: true } })
      ),
      this.obterAssinatura(tenantId)
    ]);
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
        plano: assinatura.plano.nome,
        planoId: assinatura.plano.id,
        status: assinatura.status,
        origem: assinatura.origem,
        ...(assinatura.renovacaoEm ? { renovacaoEm: assinatura.renovacaoEm } : {}),
        limites: assinatura.plano.limites,
        uso: assinatura.uso,
        alertas: assinatura.alertas
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

  async checarLimite(tenantId: string, recurso: RecursoLimitavelSaas): Promise<ChecagemLimiteSaas> {
    const assinatura = await this.obterAssinatura(tenantId);
    const limite = assinatura.plano.limites[recurso];
    const uso = assinatura.uso[recurso];
    const bloqueadaPorAssinatura = assinatura.status === 'suspensa' || assinatura.status === 'cancelada';

    if (limite === null) {
      return {
        permitido: !bloqueadaPorAssinatura,
        recurso,
        planoId: assinatura.plano.id,
        plano: assinatura.plano.nome,
        uso,
        limite,
        restante: null,
        ...(bloqueadaPorAssinatura
          ? {
              statusAssinatura: assinatura.status,
              motivo: 'assinatura_bloqueada' as const,
              mensagem: this.mensagemAssinaturaBloqueada(assinatura.status)
            }
          : {})
      };
    }

    const restante = Math.max(limite - uso, 0);
    const permitido = uso < limite;
    if (bloqueadaPorAssinatura) {
      return {
        permitido: false,
        recurso,
        planoId: assinatura.plano.id,
        plano: assinatura.plano.nome,
        uso,
        limite,
        restante,
        statusAssinatura: assinatura.status,
        motivo: 'assinatura_bloqueada',
        mensagem: this.mensagemAssinaturaBloqueada(assinatura.status)
      };
    }

    return {
      permitido,
      recurso,
      planoId: assinatura.plano.id,
      plano: assinatura.plano.nome,
      uso,
      limite,
      restante,
      mensagem: permitido ? undefined : `Limite de ${this.rotuloRecurso(recurso)} atingido para o ${assinatura.plano.nome}.`,
      ...(!permitido ? { motivo: 'limite_excedido' as const } : {})
    };
  }

  async solicitarAjusteAssinatura(
    tenantId: string,
    usuarioId: string,
    dados: SolicitarAjusteAssinaturaClienteDto
  ): Promise<SolicitacaoAjusteAssinaturaCliente> {
    const assinatura = await this.obterAssinatura(tenantId);
    const observacao = this.aparar(dados.observacao);
    const solicitacao: SolicitacaoAjusteAssinaturaCliente = {
      tenantId,
      acao: dados.acao,
      status: 'pendente',
      planoAtualId: assinatura.plano.id,
      planoAtual: assinatura.plano.nome,
      ...(dados.planoDesejado ? { planoDesejado: dados.planoDesejado } : {}),
      ...(observacao ? { observacao } : {}),
      solicitadoPorUsuarioId: usuarioId,
      solicitadoEm: new Date().toISOString()
    };
    const valorPersistido: Record<string, unknown> = { ...solicitacao };

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(TenantConfiguracaoOrm);
      const atual = await repositorio.findOne({
        where: { tenantId, chave: CHAVE_INTERESSE_ASSINATURA }
      });
      await repositorio.save(
        repositorio.create({
          id: atual?.id,
          tenantId,
          chave: CHAVE_INTERESSE_ASSINATURA,
          valor: valorPersistido,
          criadoEm: atual?.criadoEm
        })
      );
    });

    return solicitacao;
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

  async obterPerfilEmpresa(tenantId: string): Promise<PerfilEmpresaCliente> {
    const tenant = await this.obterTenantAtivo(tenantId);
    const configuracao = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
        where: { tenantId, chave: CHAVE_PERFIL_EMPRESA }
      })
    );

    return this.mapearPerfilEmpresa(tenant, configuracao?.valor);
  }

  async atualizarPerfilEmpresa(tenantId: string, dados: AtualizarPerfilEmpresaClienteDto): Promise<PerfilEmpresaCliente> {
    const tenant = await this.obterTenantAtivo(tenantId);
    const dadosNormalizados = this.normalizarPerfilEmpresa(dados);

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(TenantConfiguracaoOrm);
      const atual = await repositorio.findOne({
        where: { tenantId, chave: CHAVE_PERFIL_EMPRESA }
      });
      await repositorio.save(
        repositorio.create({
          id: atual?.id,
          tenantId,
          chave: CHAVE_PERFIL_EMPRESA,
          valor: dadosNormalizados,
          criadoEm: atual?.criadoEm
        })
      );
    });

    return this.obterPerfilEmpresa(tenantId);
  }

  private async obterTenantAtivo(tenantId: string): Promise<TenantOrm> {
    const tenant = await this.fonteDados.getRepository(TenantOrm).findOne({
      where: { id: tenantId, status: 'ativo' }
    });
    if (!tenant) throw new NotFoundException('Conta cliente nao encontrada.');
    return tenant;
  }

  private async obterAssinatura(tenantId: string) {
    const configuracao = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
        where: { tenantId, chave: CHAVE_PLANO_SAAS }
      })
    );
    const valor = configuracao?.valor ?? {};
    const plano = resolverPlanoSaas(valor.planoId);
    const uso = await this.calcularUsoPlano(tenantId);

    return {
      plano,
      status: this.texto(valor.status, 'ativa'),
      origem: this.texto(valor.origem, 'base_inicial'),
      renovacaoEm: this.textoOpcional(valor.renovacaoEm),
      uso,
      alertas: this.montarAlertasPlano(plano.limites, uso)
    };
  }

  private async calcularUsoPlano(tenantId: string): Promise<UsoPlanoSaas> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const usuarios = await gerenciador.getRepository(UsuarioOrm).find({ where: { tenantId, ativo: true } });
      const pacientes = await gerenciador.getRepository(PacienteOrm).find({ where: { tenantId } });
      const mensagens = await gerenciador.getRepository(MensagemNotificacaoOrm).find({ where: { tenantId } });
      const questionarios = await gerenciador.getRepository(QuestionarioOrm).find({ where: { tenantId } });
      const arquivos = await gerenciador.getRepository(ArquivoMidiaOrm).find({ where: { tenantId, status: 'confirmado' } });
      const inicioMes = new Date();
      inicioMes.setUTCDate(1);
      inicioMes.setUTCHours(0, 0, 0, 0);

      return {
        usuariosAdministrativos: usuarios.filter((usuario) =>
          ['Client', 'Professional', 'Collaborator'].includes(usuario.role)
        ).length,
        pacientes: pacientes.filter((paciente) => !paciente.arquivadoEm).length,
        mensagensMes: mensagens.filter((mensagem) => mensagem.criadoEm >= inicioMes).length,
        formulariosAtivos: questionarios.filter((questionario) => questionario.status !== 'arquivado').length,
        armazenamentoMb: Math.ceil(
          arquivos.reduce((total, arquivo) => total + Number(arquivo.tamanhoBytes || 0), 0) / (1024 * 1024)
        )
      };
    });
  }

  private montarAlertasPlano(limites: LimitesPlanoSaas, uso: UsoPlanoSaas): AlertaPlanoSaas[] {
    return (Object.keys(limites) as RecursoLimitavelSaas[]).flatMap((recurso) => {
      const limite = limites[recurso];
      if (limite === null || limite <= 0) return [];
      const percentual = Math.round((uso[recurso] / limite) * 100);
      if (percentual < 80) return [];

      return [
        {
          recurso,
          uso: uso[recurso],
          limite,
          percentual,
          status: uso[recurso] >= limite ? 'excedido' : 'atencao'
        }
      ];
    });
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

  private normalizarPerfilEmpresa(dados: AtualizarPerfilEmpresaClienteDto): Omit<PerfilEmpresaCliente, 'tenantId' | 'atualizadoEm'> {
    return {
      tipoPessoa: dados.tipoPessoa,
      documento: this.aparar(dados.documento),
      nomeLegal: this.aparar(dados.nomeLegal),
      nomeFantasia: this.aparar(dados.nomeFantasia),
      inscricaoEstadual: this.aparar(dados.inscricaoEstadual),
      inscricaoMunicipal: this.aparar(dados.inscricaoMunicipal),
      responsavel: {
        nome: this.aparar(dados.responsavel.nome),
        email: this.aparar(dados.responsavel.email),
        telefone: this.aparar(dados.responsavel.telefone),
        cargo: this.aparar(dados.responsavel.cargo)
      },
      endereco: {
        cep: this.aparar(dados.endereco.cep),
        logradouro: this.aparar(dados.endereco.logradouro),
        numero: this.aparar(dados.endereco.numero),
        complemento: this.aparar(dados.endereco.complemento),
        bairro: this.aparar(dados.endereco.bairro),
        cidade: this.aparar(dados.endereco.cidade),
        uf: this.aparar(dados.endereco.uf).toUpperCase(),
        pais: this.aparar(dados.endereco.pais).toUpperCase() || 'BR'
      },
      contatos: {
        emailFinanceiro: this.aparar(dados.contatos.emailFinanceiro),
        telefoneFinanceiro: this.aparar(dados.contatos.telefoneFinanceiro),
        whatsappAtendimento: this.aparar(dados.contatos.whatsappAtendimento),
        emailAtendimento: this.aparar(dados.contatos.emailAtendimento)
      },
      fiscal: {
        prepararRecibos: Boolean(dados.fiscal.prepararRecibos),
        observacoes: this.aparar(dados.fiscal.observacoes)
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

  private mapearPerfilEmpresa(tenant: TenantOrm, valor?: Record<string, unknown>): PerfilEmpresaCliente {
    const perfil = valor ?? {};
    const responsavel = this.objeto(perfil.responsavel);
    const endereco = this.objeto(perfil.endereco);
    const contatos = this.objeto(perfil.contatos);
    const fiscal = this.objeto(perfil.fiscal);

    return {
      tenantId: tenant.id,
      tipoPessoa: perfil.tipoPessoa === 'pf' ? 'pf' : 'pj',
      documento: this.texto(perfil.documento, ''),
      nomeLegal: this.texto(perfil.nomeLegal, tenant.nome),
      nomeFantasia: this.texto(perfil.nomeFantasia, tenant.nome),
      inscricaoEstadual: this.texto(perfil.inscricaoEstadual, ''),
      inscricaoMunicipal: this.texto(perfil.inscricaoMunicipal, ''),
      responsavel: {
        nome: this.texto(responsavel.nome, ''),
        email: this.texto(responsavel.email, ''),
        telefone: this.texto(responsavel.telefone, ''),
        cargo: this.texto(responsavel.cargo, '')
      },
      endereco: {
        cep: this.texto(endereco.cep, ''),
        logradouro: this.texto(endereco.logradouro, ''),
        numero: this.texto(endereco.numero, ''),
        complemento: this.texto(endereco.complemento, ''),
        bairro: this.texto(endereco.bairro, ''),
        cidade: this.texto(endereco.cidade, ''),
        uf: this.texto(endereco.uf, ''),
        pais: this.texto(endereco.pais, 'BR')
      },
      contatos: {
        emailFinanceiro: this.texto(contatos.emailFinanceiro, ''),
        telefoneFinanceiro: this.texto(contatos.telefoneFinanceiro, ''),
        whatsappAtendimento: this.texto(contatos.whatsappAtendimento, ''),
        emailAtendimento: this.texto(contatos.emailAtendimento, '')
      },
      fiscal: {
        prepararRecibos: this.booleano(fiscal.prepararRecibos, true),
        observacoes: this.texto(fiscal.observacoes, '')
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

  private textoOpcional(valor: unknown): string | undefined {
    return typeof valor === 'string' && valor.trim() ? valor : undefined;
  }

  private aparar(valor: unknown): string {
    return typeof valor === 'string' ? valor.trim() : '';
  }

  private booleano(valor: unknown, fallback: boolean): boolean {
    return typeof valor === 'boolean' ? valor : fallback;
  }

  private idioma(valor: unknown): 'pt-BR' | 'en-US' | 'es' {
    return valor === 'en-US' || valor === 'es' || valor === 'pt-BR' ? valor : 'pt-BR';
  }

  private rotuloRecurso(recurso: RecursoLimitavelSaas): string {
    const rotulos: Record<RecursoLimitavelSaas, string> = {
      usuariosAdministrativos: 'usuarios administrativos',
      pacientes: 'pacientes',
      mensagensMes: 'mensagens mensais',
      formulariosAtivos: 'formularios ativos',
      armazenamentoMb: 'armazenamento'
    };
    return rotulos[recurso];
  }

  private mensagemAssinaturaBloqueada(status: string): string {
    return `Assinatura ${status}. Novas acoes estao bloqueadas, mas os dados existentes continuam disponiveis.`;
  }
}
