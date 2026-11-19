/**
 * Textos das telas de equipe de restrições (FOOD06 P3-6): delegação da carteira e representantes no portal.
 * Fonte única; o teste `scripts/restricoes-equipe.spec.ts` barra termos técnicos. Nada clínico aqui.
 */
export const TEXTOS_EQUIPE_RESTRICOES = Object.freeze({
  tituloDelegacao: "Colaboradores na sua carteira",
  avisoDelegacao:
    "Quem você adicionar aqui pode registrar informações de restrição para conferência e cuidar de quem acompanha pelo portal em todos os seus pacientes, inclusive os futuros, até você remover o acesso. Colaboradores nunca confirmam restrições.",
  vazioDelegacao: "Nenhum colaborador tem acesso à sua carteira.",
  rotuloCandidato: "Colaborador da clínica",
  escolherCandidato: "Escolha pelo e-mail",
  semCandidatos: "Não há outros colaboradores ativos na clínica para adicionar.",
  candidatosNoLimite: "Mostrando os primeiros 200 colaboradores da clínica. Se não encontrar a pessoa, fale com a administração da clínica.",
  limiteDelegacoes: "Você chegou ao limite de 100 colaboradores. Remova um acesso para adicionar outro.",
  botaoConceder: "Dar acesso à carteira",
  confirmarConcederTitulo: (email: string) => `Dar acesso a ${email}?`,
  confirmarConcederTexto: (email: string) =>
    `${email} poderá registrar informações de restrição para conferência e cuidar de quem acompanha pelo portal em todos os seus pacientes, inclusive os futuros, até você remover o acesso.`,
  confirmarConcederBotao: "Dar acesso",
  concedido: (email: string) => `${email} agora tem acesso à sua carteira.`,
  botaoRevogarDelegacao: "Remover acesso",
  confirmarRevogarDelegacaoTitulo: (email: string) => `Remover o acesso de ${email}?`,
  confirmarRevogarDelegacaoTexto: "O que já foi registrado continua no histórico.",
  manterAcesso: "Manter acesso",
  revogadoDelegacao: (email: string) => `O acesso de ${email} foi removido.`,
  somenteTitular: "Esta página é do profissional responsável pela carteira.",
  desdeData: (data: string) => `Com acesso desde ${data}`,

  tituloRepresentantes: "Quem acompanha pelo portal",
  avisoRepresentantes:
    "Pessoas com conta no portal que podem ver as restrições deste paciente e pedir correções em nome dele. Registre só depois de conferir a identidade da pessoa e o vínculo com o paciente.",
  vazioRepresentantes: "Ninguém acompanha este paciente pelo portal, além da própria conta dele.",
  rotuloEmail: "E-mail da conta da pessoa",
  ajudaEmail: "Use o e-mail exato com que a pessoa entra no portal.",
  botaoBuscar: "Buscar conta",
  naoEncontrado:
    "Não encontramos uma conta que possa ser adicionada com este e-mail. Confira o endereço ou peça para a pessoa criar o acesso ao portal.",
  encontrado: (identificacao: string) => `Conta encontrada: ${identificacao}`,
  rotuloVerificacao: "Como você conferiu a identidade e o vínculo?",
  botaoRegistrar: "Registrar como responsável",
  registrado: (identificacao: string) => `${identificacao} agora acompanha este paciente pelo portal.`,
  limiteRepresentantes: "Este paciente chegou ao limite de 100 pessoas que acompanham. Remova uma para adicionar outra.",
  muitasBuscas: "Muitas buscas seguidas. Aguarde alguns minutos e tente de novo.",
  botaoRevogarRepresentante: "Remover",
  confirmarRevogarRepresentanteTitulo: (identificacao: string) => `Remover ${identificacao}?`,
  confirmarRevogarRepresentanteTexto:
    "A pessoa deixa de ver as informações deste paciente no portal. Pedidos já feitos continuam no histórico.",
  manterRepresentante: "Manter",
  revogadoRepresentante: (identificacao: string) => `${identificacao} não acompanha mais este paciente pelo portal.`,
  verificadoEm: (texto: string) => texto,
  linkDelegacao: "Dar acesso a toda a sua carteira para um colaborador",
  linkRepresentantesProntuario: "Quem acompanha pelo portal",

  indisponivel: "Esta área ainda não está disponível.",
  semPermissao: "Não foi possível abrir esta informação com esta conta.",
  carregarFalhou: "Não foi possível carregar agora. Tente de novo em instantes.",
  mudou: "Esta informação mudou ou um limite foi atingido. Recarregue para ver a versão atual.",
  incerto: "Não conseguimos confirmar se a ação foi concluída. Recarregue a lista antes de tentar de novo.",
  recarregar: "Recarregar a lista",
  tentarNovamente: "Tentar novamente",
});

const VERIFICACOES: Readonly<Record<string, string>> = Object.freeze({
  documento_apresentado: "Documento apresentado",
  presencial: "Presencial",
  procuracao: "Procuração",
  outro: "Outro",
});

export const OPCOES_VERIFICACAO = Object.freeze(Object.entries(VERIFICACOES).map(([valor, rotulo]) => ({ valor, rotulo })));

export function rotuloVerificacao(tipo: string): string {
  return VERIFICACOES[tipo] ?? "Verificação registrada";
}
