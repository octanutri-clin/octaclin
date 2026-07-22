export type PlanoSaasId = 'gratuito' | 'profissional' | 'clinica' | 'enterprise';

export type RecursoLimitavelSaas =
  | 'usuariosAdministrativos'
  | 'pacientes'
  | 'mensagensMes'
  | 'formulariosAtivos'
  | 'armazenamentoMb';

export type LimitesPlanoSaas = Record<RecursoLimitavelSaas, number | null>;

export interface PlanoSaas {
  id: PlanoSaasId;
  nome: string;
  limites: LimitesPlanoSaas;
}

export const planosSaas: Record<PlanoSaasId, PlanoSaas> = {
  gratuito: {
    id: 'gratuito',
    nome: 'Plano gratuito',
    limites: {
      usuariosAdministrativos: 2,
      pacientes: 25,
      mensagensMes: 200,
      formulariosAtivos: 5,
      armazenamentoMb: 500
    }
  },
  profissional: {
    id: 'profissional',
    nome: 'Profissional',
    limites: {
      usuariosAdministrativos: 3,
      pacientes: 100,
      mensagensMes: 1000,
      formulariosAtivos: 20,
      armazenamentoMb: 2048
    }
  },
  clinica: {
    id: 'clinica',
    nome: 'Clinica',
    limites: {
      usuariosAdministrativos: 12,
      pacientes: 500,
      mensagensMes: 5000,
      formulariosAtivos: 80,
      armazenamentoMb: 10240
    }
  },
  enterprise: {
    id: 'enterprise',
    nome: 'Enterprise',
    limites: {
      usuariosAdministrativos: null,
      pacientes: null,
      mensagensMes: null,
      formulariosAtivos: null,
      armazenamentoMb: null
    }
  }
};

export function resolverPlanoSaas(valor: unknown): PlanoSaas {
  return valor === 'profissional' || valor === 'clinica' || valor === 'enterprise'
    ? planosSaas[valor]
    : planosSaas.gratuito;
}
