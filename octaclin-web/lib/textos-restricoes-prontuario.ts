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
  confirmarNaoSabe: "O tipo e a gravidade continuam não informados. Depois de confirmar, use \"Corrigir registro\" para informá-los.",
  descricaoNaoSabe: "restrição de tipo não informado",
  linkRegistrar: "Ir para registrar restrição",
  avisoRejeicaoPaciente: "O paciente não é avisado automaticamente, e a informação deixa de aparecer no portal dele. Combine como avisá-lo.",
  confirmado: (descricao: string) => `${descricao} foi confirmada.`,
  rejeitarTitulo: (descricao: string) => `Rejeitar ${descricao}?`,
  rotuloJustificativa: "Justificativa (só a equipe vê)",
  ajudaJustificativa: "Obrigatória. Até 4000 caracteres.",
  erroJustificativa: "Escreva a justificativa.",
  botaoConfirmarRejeicao: "Rejeitar registro",
  rejeitado: (descricao: string) => `${descricao} foi rejeitada.`,
  manter: "Voltar",
  // P3-4a: ações protegidas sobre restrição confirmada
  botaoReavaliar: "Marcar para reavaliação",
  ajudaReavaliar: "A restrição continua valendo enquanto é reavaliada.",
  reavaliarTitulo: (descricao: string) => `Marcar ${descricao} para reavaliação?`,
  reavaliado: (descricao: string) => `${descricao} foi marcada para reavaliação e continua valendo.`,
  botaoManterConfirmada: "Manter como confirmada",
  ajudaManterConfirmada: "Encerra a reavaliação sem mudar a restrição.",
  manterTitulo: (descricao: string) => `Encerrar a reavaliação de ${descricao}?`,
  mantida: (descricao: string) => `${descricao} continua confirmada.`,
  botaoInativar: "Inativar",
  inativarTitulo: (descricao: string) => `Inativar ${descricao}?`,
  ajudaInativar: "Use quando a restrição deixou de valer. Para trocar tipo, alimento ou gravidade, prefira \"Corrigir registro\".",
  rotuloMotivo: "Motivo",
  escolhaMotivo: "Escolha o motivo",
  erroMotivo: "Escolha o motivo.",
  rotuloJustificativaInativar: "Justificativa (só a equipe vê)",
  ajudaJustificativaInativar: "Obrigatória. Até 1000 caracteres. Quebras de linha viram espaço.",
  botaoContinuar: "Continuar",
  inativarConfirmacao: (tipo: string, alimento: string) => `Você está inativando ${tipo} confirmada: ${alimento}. O histórico é preservado.`,
  botaoInativarTipo: (tipo: string) => `Inativar ${tipo}`,
  inativado: (descricao: string) => `${descricao} foi inativada. O histórico foi preservado.`,
  // "Corrigir registro" (NUX-01): a nova é registrada e confirmada antes de a antiga ser inativada.
  botaoCorrigir: "Corrigir registro",
  ajudaCorrigir: "A restrição atual continua valendo até a nova estar confirmada. São três passos: registrar a nova, confirmá-la e inativar a atual.",
  corrigirTitulo: (descricao: string) => `Corrigir ${descricao}`,
  passoCorrecao: (n: number) => `Passo ${n} de 3`,
  passoRegistrarNova: "Registrar a restrição corrigida",
  passoConfirmarNova: "Confirmar a restrição corrigida",
  passoInativarAntiga: "Inativar a restrição anterior",
  botaoRegistrarNova: "Registrar a corrigida",
  botaoConfirmarNova: "Confirmar a corrigida",
  novaRegistrada: "A restrição corrigida foi registrada. Confirme-a para seguir.",
  novaConfirmada: "A restrição corrigida foi confirmada. Agora inative a anterior.",
  correcaoConcluida: (descricao: string) => `Correção concluída: a restrição anterior (${descricao}) foi inativada e a corrigida está confirmada.`,
  correcaoParouRegistro: "A correção parou no passo 1. Se a corrigida chegou a ser registrada, ela aparece em \"Para conferir\"; a restrição antiga continua valendo.",
  correcaoNovaIndisponivel: "A correção parou no passo 3: a restrição corrigida não está mais confirmada. A anterior continua ativa; confira a lista.",
  correcaoSemNova: "A anterior foi inativada, mas a restrição corrigida não está mais confirmada. Confira a lista e registre de novo se for preciso.",
  avisoConferenciaGeral: "A conferência geral das restrições volta para \"não conferida\" e precisa ser refeita com o paciente.",
  erroCaracteres: "Remova caracteres invisíveis ou especiais da justificativa.",
  correcaoParouConfirmacao: "A correção parou no passo 2. A corrigida está em \"Para conferir\" e a restrição antiga continua valendo. Para concluir, confirme a corrigida e depois inative a anterior.",
  correcaoParouInativacao: "A correção parou no passo 3. A nova já está confirmada e a anterior continua ativa. Para concluir, inative a anterior.",
  detalheAnterior: (gravidade: string | null, data: string) => `Anterior: ${gravidade ? `gravidade ${gravidade.toLocaleLowerCase("pt-BR")}, ` : ""}registrada em ${data}.`,
  motivoEscolhido: (motivo: string) => `Motivo: ${motivo}.`,
  avisoPortalInativar: "O paciente deixa de ver esta restrição no portal e não recebe aviso automático. Combine como avisá-lo.",
  avisoPortalCorrecao: "No portal, o paciente deixa de ver a anterior e passa a ver a corrigida, sem aviso automático. Combine como avisá-lo.",
  justificativaCorrecao: (descricao: string) => `Substituída por registro corrigido de ${descricao}.`,
  fecharCorrecao: "Parar a correção aqui",
  // Avaliação
  tituloAvaliacao: "Conferência geral das restrições",
  avaliacaoAusente: "A conferência geral das restrições deste paciente ainda não foi iniciada.",
  ajudaIniciarAvaliacao: "Iniciar não confere nenhuma restrição: só abre o registro usado para reconfirmar as restrições com o paciente.",
  pendentesNaConferencia: (n: number) => (n === 1 ? "1 registro ainda aguarda conferência." : `${n} registros ainda aguardam conferência.`),
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

export const OPCOES_MOTIVO_INATIVACAO = Object.freeze([
  { valor: "registro_incorreto", rotulo: "Registro incorreto" },
  { valor: "informacao_clinica_revisada", rotulo: "Informação clínica revisada" },
  { valor: "solicitacao_fundamentada", rotulo: "Solicitação fundamentada do paciente" },
  { valor: "outro", rotulo: "Outro" },
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
