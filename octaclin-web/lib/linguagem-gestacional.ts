const motivos: Record<string,string> = {
  condicao_nao_gestante_ou_nao_informada: 'Condição gestacional não confirmada nesta avaliação.',
  gestacao_sem_vinculo: 'Avaliação sem vínculo com uma gestação.',
  idade_nao_informada: 'Data de nascimento não disponível para conferir a idade.',
  referencia_nao_validada_para_adolescente: 'Referência não aplicável a menores de 18 anos.',
  referencia_nao_validada_para_gestacao_multipla: 'Referência não aplicável à gestação múltipla.',
  tipo_gestacao_nao_informado: 'Tipo da gestação não informado.',
  referencia_nao_validada_para_alto_risco: 'Referência não aplicável ao alto risco.',
  risco_nao_informado: 'Risco habitual não confirmado.',
  origem_idade_gestacional_nao_informada: 'Origem da idade gestacional não informada.',
  idade_gestacional_inconsistente: 'Idade gestacional marcada como inconsistente.',
  idade_gestacional_nao_informada_ou_invalida: 'Idade gestacional ausente ou inválida.',
  semana_fora_da_referencia: 'Semana da curva fora do intervalo de 10 a 40 semanas.',
  origem_peso_referencia_nao_informada: 'Origem do peso de referência não informada.',
  peso_habitual_anterior_nao_confirmado: 'Peso habitual anterior à gestação não confirmado.',
  medida_substituta_nao_elegivel_ate_8s0d: 'Medida inicial ausente ou posterior a 8 semanas e 0 dias.',
  referencia_peso_altura_incompleta_ou_invalida: 'Peso ou altura de referência ausente ou inválido.',
  referencia_fora_plausibilidade_tecnica: 'IMC de referência fora da proteção técnica local (8 a 100). Confira as medidas; esse limite não é uma restrição clínica do Ministério da Saúde.',
  peso_avaliacao_ausente_ou_invalido: 'Peso desta avaliação ausente ou inválido.'
};
export const motivoGestacional = (codigo: string) => motivos[codigo] ?? 'Classificação indisponível para este registro. Consulte o profissional.';
export const fonteGestacional = (codigo: string) => codigo === 'ms_ufs_2022_semanal_v1' ? 'Ministério da Saúde / UFS, tabela semanal de 2022 (versão 1)' : 'Referência histórica';
