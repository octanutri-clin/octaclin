/**
 * Textos da aba "Restrições" do prontuário (FOOD06 P3-3), para a equipe. Fonte única; o teste
 * `scripts/restricoes-prontuario.spec.ts` barra termos técnicos. Os rótulos vêm do plano §5.
 */
export const TEXTOS_RESTRICOES_PRONTUARIO = Object.freeze({
  titulo: "Restrições alimentares",
  avisoSemAlerta: "Estes registros ainda não geram alerta automático no plano alimentar. Confira antes de prescrever.",
  vazioCompleto: "Nenhuma restrição registrada. Ausência de registro não significa ausência de restrição.",
  vazioAutoria: "Você vê apenas os registros que fez. Outros registros podem existir.",
  avisoAutoria: "Você vê só os registros que fez. Confirmar ou rejeitar restrições exige profissional com permissão clínica.",
  grupoPendentes: "Para conferir",
  grupoConfirmadas: "Confirmadas",
  grupoReavaliacao: "Em reavaliação",
  grupoRecolhidas: "Inativas e rejeitadas",
  tipoNaoInformado: "Tipo não informado pelo paciente",
  semNomeCatalogo: "Item de catálogo (nome indisponível nesta tela)",
  observacao: "Observação da equipe",
  registradaEm: (data: string) => `Registrada em ${data}`,
  // Registro
  tituloRegistrar: "Registrar restrição",
  ajudaRegistrar: "O registro fica para conferência; confirmar é um passo separado.",
  rotuloTipo: "Tipo",
  rotuloAlimento: "Alimento ou item",
  ajudaAlimento: "Até 200 caracteres.",
  rotuloGravidade: "Gravidade",
  rotuloObservacao: "Observação (opcional, só a equipe vê)",
  ajudaObservacao: "Até 1000 caracteres. Quebras de linha viram espaço.",
  avisoQuebraLinha: "As quebras de linha foram trocadas por espaços.",
  botaoRegistrar: "Registrar para conferência",
  registrado: (alimento: string) => `${alimento} foi registrado para conferência.`,
  erroAlimento: "Informe o alimento ou item.",
  erroTipo: "Escolha o tipo.",
  // Confirmar e rejeitar
  botaoConfirmar: "Confirmar",
  botaoRejeitar: "Rejeitar",
  confirmarTitulo: (descricao: string) => `Confirmar ${descricao}?`,
  confirmarTexto: "A restrição passa a valer como confirmada no acompanhamento deste paciente.",
  confirmado: (descricao: string) => `${descricao} foi confirmada.`,
  rejeitarTitulo: (descricao: string) => `Rejeitar ${descricao}?`,
  rotuloJustificativa: "Justificativa (só a equipe vê)",
  ajudaJustificativa: "Obrigatória. Até 4000 caracteres.",
  erroJustificativa: "Escreva a justificativa.",
  botaoConfirmarRejeicao: "Rejeitar registro",
  rejeitado: (descricao: string) => `${descricao} foi rejeitada.`,
  manter: "Voltar",
  // Avaliação
  tituloAvaliacao: "Conferência geral das restrições",
  avaliacaoAusente: "A conferência geral das restrições deste paciente ainda não foi iniciada.",
  ajudaIniciarAvaliacao: "Iniciar cria o registro que permite reconfirmar as restrições com o paciente depois.",
  botaoIniciarAvaliacao: "Iniciar conferência",
  avaliacaoIniciada: "Conferência iniciada.",
  // Estados
  indisponivel: "Esta área ainda não está disponível.",
  semPermissao: "Não foi possível abrir esta informação com esta conta.",
  carregarFalhou: "Não foi possível carregar agora. Tente de novo em instantes.",
  mudou: "Esta informação mudou ou um limite foi atingido. A lista foi recarregada; confira antes de tentar de novo.",
  incerto: "Não conseguimos confirmar se a ação foi concluída. Confira a lista antes de tentar de novo.",
  invalida: "Revise os campos destacados.",
  sessao: "Sua sessão terminou. Entre novamente.",
  tentarNovamente: "Tentar novamente",
});

const TIPOS: Readonly<Record<string, string>> = Object.freeze({
  alergia_alimentar: "Alergia alimentar",
  intolerancia_alimentar: "Intolerância alimentar",
  doenca_ou_condicao_com_restricao: "Doença ou condição com restrição",
  outra_restricao_clinica: "Outra restrição clínica",
});

/** Opções do formulário de registro (valor simples → rótulo). Preferência não entra neste fluxo (Q8). */
export const OPCOES_TIPO_REGISTRO = Object.freeze([
  { valor: "alergia", rotulo: "Alergia alimentar" },
  { valor: "intolerancia", rotulo: "Intolerância alimentar" },
  { valor: "condicao", rotulo: "Doença ou condição com restrição (ex.: doença celíaca)" },
  { valor: "outra", rotulo: "Outra restrição clínica" },
  { valor: "escolha", rotulo: "Escolha alimentar" },
] as const);

export const OPCOES_GRAVIDADE = Object.freeze([
  { valor: "nao_informada", rotulo: "Não informada" },
  { valor: "leve", rotulo: "Leve" },
  { valor: "moderada", rotulo: "Moderada" },
  { valor: "grave", rotulo: "Grave" },
] as const);

export function rotuloTipoRestricao(natureza: string, subtipo?: string): string {
  if (natureza === "escolha") return "Escolha alimentar";
  if (natureza === "clinica" && subtipo && TIPOS[subtipo]) return TIPOS[subtipo];
  return "Tipo não reconhecido";
}

export function rotuloGravidade(g?: string): string {
  return OPCOES_GRAVIDADE.find((o) => o.valor === g)?.rotulo ?? "Não informada";
}

const ORIGENS: Readonly<Record<string, string>> = Object.freeze({
  profissional: "Registrada por profissional",
  colaborador: "Registrada por colaborador",
  declaracao_paciente: "Informada pelo paciente ou responsável",
  questionario_legado: "Questionário antigo",
});
export const rotuloOrigem = (o: string) => ORIGENS[o] ?? "Origem não reconhecida";

export function rotuloEstadoRestricao(estado: string, confirmacao: string): string {
  if (estado === "inativa") return "Inativa";
  if (confirmacao === "rejeitada") return "Rejeitada";
  if (estado === "em_reavaliacao") return "Em reavaliação";
  if (confirmacao === "confirmada") return "Confirmada";
  if (confirmacao === "pendente") return "Pendente de conferência";
  return "Situação não reconhecida";
}

function data(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);
}
export const formatarDataProntuario = (iso: string) => data(iso);

export function textoSituacaoAvaliacao(a: { situacao: string; confirmadoEm: string | null; venceEm: string | null }): string {
  if (a.situacao === "restricoes_registradas") return `Restrições conferidas em ${data(a.confirmadoEm)}. Reconferir até ${data(a.venceEm)}.`;
  if (a.situacao === "sem_restricoes_confirmadas") return `Paciente sem restrições declaradas, conferido em ${data(a.confirmadoEm)}. Reconferir até ${data(a.venceEm)}.`;
  return "Restrições ainda não conferidas com o paciente.";
}
