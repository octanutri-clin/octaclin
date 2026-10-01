import { BadRequestException, Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';

const CHAVE = 'lembretes_acompanhamento';

export interface ConfiguracaoLembretesAcompanhamento {
  plano: { ativo: boolean; intervaloDias: number; ativadoEm?: Date };
  tarefas: { ativo: boolean; antecedenciaHoras: number; ativadoEm?: Date };
}

export interface EntradaLembretesAcompanhamento {
  plano: { ativo: boolean; intervaloDias: number };
  tarefas: { ativo: boolean; antecedenciaHoras: number };
}

function dataValida(valor: unknown): Date | undefined {
  if (typeof valor !== 'string') return undefined;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? undefined : data;
}

export function interpretarConfiguracaoLembretes(valor?: Record<string, unknown>): ConfiguracaoLembretesAcompanhamento {
  const plano = valor?.plano && typeof valor.plano === 'object' ? valor.plano as Record<string, unknown> : {};
  const tarefas = valor?.tarefas && typeof valor.tarefas === 'object' ? valor.tarefas as Record<string, unknown> : {};
  const planoAtivado = dataValida(plano.ativadoEm);
  const tarefasAtivado = dataValida(tarefas.ativadoEm);
  return {
    plano: {
      ativo: plano.ativo === true && !!planoAtivado,
      intervaloDias: Number.isInteger(plano.intervaloDias) && Number(plano.intervaloDias) >= 1 && Number(plano.intervaloDias) <= 30 ? Number(plano.intervaloDias) : 7,
      ...(planoAtivado ? { ativadoEm: planoAtivado } : {})
    },
    tarefas: {
      ativo: tarefas.ativo === true && !!tarefasAtivado,
      antecedenciaHoras: Number.isInteger(tarefas.antecedenciaHoras) && Number(tarefas.antecedenciaHoras) >= 0 && Number(tarefas.antecedenciaHoras) <= 168 ? Number(tarefas.antecedenciaHoras) : 24,
      ...(tarefasAtivado ? { ativadoEm: tarefasAtivado } : {})
    }
  };
}

@Injectable()
export class ServicoLembretesAcompanhamento {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async obter(tenantId: string): Promise<ConfiguracaoLembretesAcompanhamento> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const atual = await gerenciador.getRepository(TenantConfiguracaoOrm).findOne({ where: { tenantId, chave: CHAVE } });
      return interpretarConfiguracaoLembretes(atual?.valor);
    });
  }

  async atualizar(tenantId: string, entrada: EntradaLembretesAcompanhamento, agora = new Date()): Promise<ConfiguracaoLembretesAcompanhamento> {
    if (!entrada?.plano || !entrada.tarefas ||
        typeof entrada.plano.ativo !== 'boolean' || !Number.isInteger(entrada.plano.intervaloDias) ||
        entrada.plano.intervaloDias < 1 || entrada.plano.intervaloDias > 30 ||
        typeof entrada.tarefas.ativo !== 'boolean' || !Number.isInteger(entrada.tarefas.antecedenciaHoras) ||
        entrada.tarefas.antecedenciaHoras < 0 || entrada.tarefas.antecedenciaHoras > 168) {
      throw new BadRequestException('Configuração de lembretes inválida.');
    }
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await gerenciador.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`lembretes-acompanhamento:${tenantId}`]);
      const repo = gerenciador.getRepository(TenantConfiguracaoOrm);
      const atual = await repo.findOne({ where: { tenantId, chave: CHAVE } });
      const anterior = interpretarConfiguracaoLembretes(atual?.valor);
      const planoAtivado = entrada.plano.ativo
        ? anterior.plano.ativo && anterior.plano.intervaloDias === entrada.plano.intervaloDias ? anterior.plano.ativadoEm : agora
        : undefined;
      const tarefasAtivado = entrada.tarefas.ativo
        ? anterior.tarefas.ativo && anterior.tarefas.antecedenciaHoras === entrada.tarefas.antecedenciaHoras ? anterior.tarefas.ativadoEm : agora
        : undefined;
      const configuracao: ConfiguracaoLembretesAcompanhamento = {
        plano: { ...entrada.plano, ...(planoAtivado ? { ativadoEm: planoAtivado } : {}) },
        tarefas: { ...entrada.tarefas, ...(tarefasAtivado ? { ativadoEm: tarefasAtivado } : {}) }
      };
      await repo.save(repo.create({
        id: atual?.id, tenantId, chave: CHAVE,
        valor: {
          plano: { ...entrada.plano, ...(planoAtivado ? { ativadoEm: planoAtivado.toISOString() } : {}) },
          tarefas: { ...entrada.tarefas, ...(tarefasAtivado ? { ativadoEm: tarefasAtivado.toISOString() } : {}) }
        },
        criadoEm: atual?.criadoEm
      }));
      return configuracao;
    });
  }
}
