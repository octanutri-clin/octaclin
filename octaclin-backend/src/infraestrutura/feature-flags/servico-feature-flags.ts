import { Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../banco-dados/executor-tenant';
import { TenantConfiguracaoOrm } from '../../modulos/tenancy/infraestrutura/tenant-configuracao.orm';

const CHAVE_CONFIGURACAO = 'feature_flags';
export const FEATURE_FLAGS_CONHECIDAS = ['ia.clinica', 'mobile.sync'] as const;
export type FeatureFlagConhecida = (typeof FEATURE_FLAGS_CONHECIDAS)[number];
export type ValoresFeatureFlags = Partial<Record<FeatureFlagConhecida, boolean>>;
export type OrigemFeatureFlag = 'padrao' | 'ambiente' | 'tenant';

export interface ResultadoFeatureFlags {
  configuracaoValida: boolean;
  flags: Array<{ chave: FeatureFlagConhecida; habilitada: boolean; origem: OrigemFeatureFlag }>;
}

function lerAmbiente(): { valido: boolean; valores: ValoresFeatureFlags } {
  const bruto = process.env.OCTACLIN_FEATURE_FLAGS?.trim();
  if (!bruto) return { valido: true, valores: {} };
  try {
    const parseado = JSON.parse(bruto) as unknown;
    if (!parseado || typeof parseado !== 'object' || Array.isArray(parseado)) return { valido: false, valores: {} };
    const valores: ValoresFeatureFlags = {};
    for (const chave of FEATURE_FLAGS_CONHECIDAS) {
      const valor = (parseado as Record<string, unknown>)[chave];
      if (valor !== undefined && typeof valor !== 'boolean') return { valido: false, valores: {} };
      if (typeof valor === 'boolean') valores[chave] = valor;
    }
    return { valido: true, valores };
  } catch {
    return { valido: false, valores: {} };
  }
}

function filtrarValores(valor: Record<string, unknown> | undefined): ValoresFeatureFlags {
  const filtrados: ValoresFeatureFlags = {};
  for (const chave of FEATURE_FLAGS_CONHECIDAS) {
    if (typeof valor?.[chave] === 'boolean') filtrados[chave] = valor[chave] as boolean;
  }
  return filtrados;
}

@Injectable()
export class ServicoFeatureFlags {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async listar(tenantId: string): Promise<ResultadoFeatureFlags> {
    const ambiente = lerAmbiente();
    const tenant = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const registro = await gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
        where: { tenantId, chave: CHAVE_CONFIGURACAO }
      });
      return filtrarValores(registro?.valor);
    });

    return {
      configuracaoValida: ambiente.valido,
      flags: FEATURE_FLAGS_CONHECIDAS.map((chave) => {
        if (tenant[chave] !== undefined) return { chave, habilitada: tenant[chave] === true, origem: 'tenant' as const };
        if (ambiente.valido && ambiente.valores[chave] !== undefined) {
          return { chave, habilitada: ambiente.valores[chave] === true, origem: 'ambiente' as const };
        }
        return { chave, habilitada: false, origem: 'padrao' as const };
      })
    };
  }

  async habilitada(tenantId: string, chave: FeatureFlagConhecida): Promise<boolean> {
    const resultado = await this.listar(tenantId);
    return resultado.flags.find((flag) => flag.chave === chave)?.habilitada === true;
  }

  async atualizar(tenantId: string, valores: ValoresFeatureFlags): Promise<ResultadoFeatureFlags> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(TenantConfiguracaoOrm);
      const atual = await repositorio.findOne({ where: { tenantId, chave: CHAVE_CONFIGURACAO } });
      const valorAtualizado = {
        ...filtrarValores(atual?.valor),
        ...filtrarValores(valores)
      };
      await repositorio.save(
        repositorio.create({
          id: atual?.id,
          tenantId,
          chave: CHAVE_CONFIGURACAO,
          valor: valorAtualizado,
          criadoEm: atual?.criadoEm
        })
      );
    });
    return this.listar(tenantId);
  }
}
