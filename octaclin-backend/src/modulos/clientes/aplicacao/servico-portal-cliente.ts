import { NotFoundException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { contextoAcessoPorPapel } from '../../auth/dominio/permissoes';

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
}
