export type AbaProntuario =
  | 'resumo'
  | 'evolucoes'
  | 'acompanhamento'
  | 'plano_alimentar'
  | 'condutas_terapeuticas'
  | 'antropometria'
  | 'exames_laboratoriais'
  | 'evolucao_fotografica'
  | 'formularios'
  | 'documentos'
  | 'mensagens'
  | 'materiais'
  | 'anexos'
  | 'historico'
  | 'financeiro';

export type AreaProntuario = 'resumo' | 'atendimentos' | 'avaliacoes' | 'plano' | 'documentos' | 'financeiro';

export const abasProntuario: Array<{ id: AbaProntuario; rotulo: string; permissao?: string }> = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'evolucoes', rotulo: 'Evoluções' },
  { id: 'acompanhamento', rotulo: 'Acompanhamento' },
  { id: 'plano_alimentar', rotulo: 'Plano alimentar', permissao: 'planos_alimentares.ler' },
  { id: 'condutas_terapeuticas', rotulo: 'Condutas terapêuticas' },
  { id: 'antropometria', rotulo: 'Antropometria' },
  { id: 'exames_laboratoriais', rotulo: 'Exames laboratoriais' },
  { id: 'evolucao_fotografica', rotulo: 'Evolução fotográfica' },
  { id: 'formularios', rotulo: 'Formulários' },
  { id: 'documentos', rotulo: 'Documentos' },
  { id: 'mensagens', rotulo: 'Mensagens' },
  { id: 'materiais', rotulo: 'Materiais', permissao: 'materiais.ler' },
  { id: 'anexos', rotulo: 'Anexos' },
  { id: 'historico', rotulo: 'Histórico' }
];

export const areasProntuario: Array<{
  id: AreaProntuario;
  rotulo: string;
  abaInicial: AbaProntuario;
  permissao?: string;
}> = [
  { id: 'resumo', rotulo: 'Resumo', abaInicial: 'resumo' },
  { id: 'atendimentos', rotulo: 'Atendimentos', abaInicial: 'evolucoes' },
  { id: 'avaliacoes', rotulo: 'Avaliações', abaInicial: 'antropometria' },
  { id: 'plano', rotulo: 'Plano', abaInicial: 'acompanhamento' },
  { id: 'documentos', rotulo: 'Documentos', abaInicial: 'documentos' },
  { id: 'financeiro', rotulo: 'Financeiro', abaInicial: 'financeiro', permissao: 'agenda.financeiro.ler' }
];

export const areaPorAba: Record<AbaProntuario, AreaProntuario> = {
  resumo: 'resumo',
  evolucoes: 'atendimentos',
  historico: 'atendimentos',
  mensagens: 'atendimentos',
  antropometria: 'avaliacoes',
  exames_laboratoriais: 'avaliacoes',
  evolucao_fotografica: 'avaliacoes',
  formularios: 'avaliacoes',
  acompanhamento: 'plano',
  plano_alimentar: 'plano',
  condutas_terapeuticas: 'plano',
  materiais: 'plano',
  documentos: 'documentos',
  anexos: 'documentos',
  financeiro: 'financeiro'
};
