import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { possuiPermissao, type PermissaoOctaClin } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { MaterialEducativoOrm } from '../../materiais/infraestrutura/material-educativo.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { TenantConfiguracaoOrm } from '../infraestrutura/tenant-configuracao.orm';
import { TenantOrm } from '../infraestrutura/tenant.orm';
import {
  CHAVE_KIT_INICIAL_CLINICA,
  CHAVES_KIT_INICIAL_CLINICA,
  ChaveKitInicialClinica,
  interpretarMarcadorKitInicial,
  VERSAO_KIT_INICIAL_CLINICA
} from '../kit-inicial-clinica';
import { instalarKitInicialClinica, MATERIAIS_KIT_INICIAL } from './kit-inicial-clinica';
import { listarEstruturasIniciaisPlano } from '../../planos-alimentares/dominio/estruturas-iniciais-plano';

const CHAVE_PLANO_SAAS = 'plano_saas';
const CICLOS_PERMITIDOS = new Set(['ativo_assistido', 'primeiro_uso_validado', 'acompanhamento_48h', 'ativo']);

export interface InstalarKitInicialClinicaDto {
  confirmacao: true;
  versao: 2;
  itens: ChaveKitInicialClinica[];
}

export interface ItemKitInicialClinica {
  chave: ChaveKitInicialClinica;
  tipo: 'material' | 'estrutura';
  instalado: boolean;
  titulo: string;
  resumo?: string;
  conteudo?: string;
  refeicoes?: Array<{ nome: string; itens: [] }>;
}

export interface EstadoKitInicialClinica {
  tenantId: string;
  tenantNome: string;
  versaoDisponivel: 2;
  versaoInstalada?: number;
  estado: ReturnType<typeof interpretarMarcadorKitInicial>['estado'];
  podeInstalar: boolean;
  motivoBloqueio?: 'tenant_inativo' | 'ciclo_vida_bloqueado' | 'assinatura_bloqueada' | 'marcador_incompativel' | 'marcador_inconsistente';
  itens: ItemKitInicialClinica[];
}

@Injectable()
export class ServicoKitInicialClinica {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async obter(tenantAlvoId: string, usuario: UsuarioAutenticado): Promise<EstadoKitInicialClinica> {
    this.validarEscopoSolicitado(tenantAlvoId, usuario);
    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const ator = await this.validarAtor(gerenciador, usuario);
      const tenant = await this.resolverTenantAlvo(gerenciador, tenantAlvoId, ator, usuario);
      return this.obterEstadoNoContexto(gerenciador, tenant);
    });
  }

  async instalar(tenantAlvoId: string, usuario: UsuarioAutenticado, dados: InstalarKitInicialClinicaDto) {
    this.validarEscopoSolicitado(tenantAlvoId, usuario);
    this.validarDados(dados);
    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const ator = await this.validarAtor(gerenciador, usuario);
      const tenant = await this.resolverTenantAlvo(gerenciador, tenantAlvoId, ator, usuario);
      if (tenant.status !== 'ativo') throw new ConflictException('Este tenant não pode receber o kit inicial.');
      if (!CICLOS_PERMITIDOS.has(tenant.cicloVidaStatus ?? 'ativo')) {
        throw new ConflictException('O ciclo de vida deste tenant bloqueia novas instalações.');
      }
      const configuracoes = gerenciador.getRepository(TenantConfiguracaoOrm);
      const assinatura = await configuracoes.findOne({ where: { tenantId: tenant.id, chave: CHAVE_PLANO_SAAS } });
      if (['suspensa', 'cancelada'].includes(String(assinatura?.valor?.status ?? '').toLowerCase())) {
        throw new ConflictException('A assinatura deste tenant bloqueia novas instalações.');
      }

      const origem = usuario.papel === 'SuperAdmin' ? 'opt_in_superadmin' : 'opt_in_cliente';
      const resultado = await instalarKitInicialClinica(gerenciador, tenant.id, ator.id, dados.itens, origem);
      if (!resultado.reutilizado) {
        await registrarAuditoriaNaTransacao(gerenciador, {
          tenantId: tenant.id,
          usuarioId: ator.id,
          acao: usuario.papel === 'SuperAdmin'
            ? 'operacoes.tenant.kit_inicial.instalar'
            : 'cliente.kit_inicial.instalar',
          recursoTipo: 'tenant',
          recursoId: tenant.id,
          metadados: {
            versao: VERSAO_KIT_INICIAL_CLINICA,
            itens: resultado.itensAdicionados,
            totalItens: resultado.itensAdicionados.length,
            materiaisCriados: resultado.materiaisCriados,
            estruturasHabilitadas: resultado.estruturasHabilitadas.length,
            origem
          }
        });
      }
      return {
        ...await this.obterEstadoNoContexto(gerenciador, tenant),
        instalacao: {
          reutilizado: resultado.reutilizado,
          itensAdicionados: resultado.itensAdicionados,
          materiaisCriados: resultado.materiaisCriados,
          estruturasHabilitadas: resultado.estruturasHabilitadas
        }
      };
    });
  }

  private validarEscopoSolicitado(tenantAlvoId: string, usuario: UsuarioAutenticado): void {
    const permissao: PermissaoOctaClin = usuario.papel === 'SuperAdmin'
      ? 'operacoes.tenants.gerenciar'
      : 'cliente.configuracoes.gerenciar';
    if (!usuario.permissoes.includes(permissao) || !possuiPermissao(usuario.papel, permissao)) {
      throw new ForbiddenException('Sem permissão para gerenciar o kit inicial.');
    }
    if (usuario.papel === 'Client' && usuario.tenantId !== tenantAlvoId) {
      throw new ForbiddenException('O gestor só pode instalar conteúdo na própria clínica.');
    }
    if (usuario.papel !== 'Client' && usuario.papel !== 'SuperAdmin') {
      throw new ForbiddenException('Este papel não pode instalar o kit inicial.');
    }
  }

  private validarDados(dados: InstalarKitInicialClinicaDto): void {
    if (!dados || dados.confirmacao !== true || dados.versao !== VERSAO_KIT_INICIAL_CLINICA ||
      !Array.isArray(dados.itens) || dados.itens.length < 1 || dados.itens.length > CHAVES_KIT_INICIAL_CLINICA.length ||
      dados.itens.some((item) => !CHAVES_KIT_INICIAL_CLINICA.includes(item)) ||
      new Set(dados.itens).size !== dados.itens.length ||
      Object.keys(dados).some((chave) => !['confirmacao', 'versao', 'itens'].includes(chave))) {
      throw new BadRequestException('Confirmação e seleção do kit inicial inválidas.');
    }
  }

  private async validarAtor(gerenciador: import('typeorm').EntityManager, usuario: UsuarioAutenticado): Promise<UsuarioOrm> {
    const ator = await gerenciador.getRepository(UsuarioOrm).findOne({
      where: { id: usuario.usuarioId, tenantId: usuario.tenantId }
    });
    if (!ator || !ator.ativo || ator.role !== usuario.papel) {
      throw new ForbiddenException('A sessão não corresponde a um usuário ativo autorizado.');
    }
    return ator;
  }

  private async resolverTenantAlvo(
    gerenciador: import('typeorm').EntityManager,
    tenantAlvoId: string,
    ator: UsuarioOrm,
    usuario: UsuarioAutenticado
  ): Promise<TenantOrm> {
    if (ator.role === 'Client' && tenantAlvoId !== ator.tenantId) {
      throw new ForbiddenException('O gestor só pode acessar a própria clínica.');
    }
    const tenant = await gerenciador.getRepository(TenantOrm).findOne({ where: { id: tenantAlvoId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');
    if (tenantAlvoId !== usuario.tenantId) {
      await gerenciador.query("select set_config('app.tenant_id', $1, true)", [tenantAlvoId]);
    }
    return tenant;
  }

  private async obterEstadoNoContexto(
    gerenciador: import('typeorm').EntityManager,
    tenant: TenantOrm
  ): Promise<EstadoKitInicialClinica> {
    const configuracoes = gerenciador.getRepository(TenantConfiguracaoOrm);
    const [marcador, assinatura] = await Promise.all([
      configuracoes.findOne({ where: { tenantId: tenant.id, chave: CHAVE_KIT_INICIAL_CLINICA } }),
      configuracoes.findOne({ where: { tenantId: tenant.id, chave: CHAVE_PLANO_SAAS } })
    ]);
    const interpretacao = interpretarMarcadorKitInicial(marcador?.valor);
    const itensInstalados = new Set(interpretacao.itensInstalados);
    const materiais = new Map(MATERIAIS_KIT_INICIAL.map((item) => [item.chave, item]));
    const estruturas = new Map(listarEstruturasIniciaisPlano().map((estrutura) => [
      estrutura.id === 'tres-refeicoes' ? 'estrutura:tres-refeicoes' : 'estrutura:cinco-refeicoes',
      estrutura
    ]));
    const itens: ItemKitInicialClinica[] = CHAVES_KIT_INICIAL_CLINICA.map((chave) => {
      const material = materiais.get(chave as typeof MATERIAIS_KIT_INICIAL[number]['chave']);
      if (material) return {
        chave,
        tipo: 'material',
        instalado: itensInstalados.has(chave),
        titulo: material.titulo,
        resumo: material.resumo,
        conteudo: material.conteudo
      };
      const estrutura = estruturas.get(chave);
      return {
        chave,
        tipo: 'estrutura',
        instalado: itensInstalados.has(chave),
        titulo: estrutura?.nome ?? chave,
        resumo: 'Estrutura vazia para o profissional revisar e completar.',
        refeicoes: estrutura?.refeicoes ?? []
      };
    });

    let motivoBloqueio: EstadoKitInicialClinica['motivoBloqueio'];
    if (tenant.status !== 'ativo') motivoBloqueio = 'tenant_inativo';
    else if (!CICLOS_PERMITIDOS.has(tenant.cicloVidaStatus ?? 'ativo')) motivoBloqueio = 'ciclo_vida_bloqueado';
    else if (['suspensa', 'cancelada'].includes(String(assinatura?.valor?.status ?? '').toLowerCase())) motivoBloqueio = 'assinatura_bloqueada';
    else if (interpretacao.estado === 'incompativel') motivoBloqueio = 'marcador_incompativel';
    else if (interpretacao.estado === 'inconsistente') motivoBloqueio = 'marcador_inconsistente';
    const estado = interpretacao.estado;
    return {
      tenantId: tenant.id,
      tenantNome: tenant.nome,
      versaoDisponivel: VERSAO_KIT_INICIAL_CLINICA,
      versaoInstalada: interpretacao.versao,
      estado,
      podeInstalar: !motivoBloqueio && (estado === 'nao_instalado' || estado === 'parcial'),
      motivoBloqueio,
      itens
    };
  }
}
