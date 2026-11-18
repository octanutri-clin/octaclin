/**
 * Único lugar dos textos de restrições alimentares mostrados ao paciente e ao representante (FOOD06 P3).
 *
 * Regras (contrato v3: D7-a, Q11, critérios 24 e 28; decisões do proprietário de 2026-11-17):
 * - nenhum texto expõe estado interno, chave técnica, código de erro ou motivação religiosa;
 * - nada sugere que um alimento é "seguro" ou "liberado", nem que um pedido removeu uma restrição;
 * - o selo de declaração é neutro ("enviada pelo portal"), porque o sistema não sabe qual pessoa enviou;
 * - "quem faz seu acompanhamento" substitui "equipe de atendimento" (serve ao autônomo e à clínica);
 * - para quem acompanha como responsável, o nome da pessoa substitui "você/seu";
 * - chave desconhecida falha fechado em texto neutro, sem ecoar a chave.
 */

export interface ContextoPessoaPortal {
  /** A conta acessa a ficha como representante, e não como a própria pessoa. */
  representante: boolean;
  /** Nome da pessoa selecionada, como o backend devolveu no seletor. */
  nome: string;
}

export type GrupoRestricaoPortal = "alergias" | "intolerancias" | "outras" | "escolhas";
export type TipoPedidoPortal = "correcao" | "remocao";

export const QUEM_ACOMPANHA = "quem faz seu acompanhamento";

const deQuem = (ctx: ContextoPessoaPortal) => (ctx.representante ? `no acompanhamento de ${ctx.nome}` : "no seu acompanhamento");

const SELOS: Readonly<Record<string, (ctx: ContextoPessoaPortal) => string>> = Object.freeze({
  "restricoes.portal.registrada": (ctx) => `Restrição registrada ${deQuem(ctx)}`,
  "restricoes.portal.informada_por_voce": () => "Informação enviada pelo portal; ainda será conferida",
  "restricoes.portal.anotada_pela_equipe": () => `Anotado por ${QUEM_ACOMPANHA}; ainda será conferido`,
});

const SELO_NEUTRO = "Informação em conferência";

export function textoSeloPortal(chave: string, ctx: ContextoPessoaPortal): string {
  const texto = Object.prototype.hasOwnProperty.call(SELOS, chave) ? SELOS[chave] : undefined;
  return texto ? texto(ctx) : SELO_NEUTRO;
}

const NOME_PEDIDO: Readonly<Record<string, string>> = Object.freeze({
  correcao: "correção",
  remocao: "remoção",
  inclusao: "inclusão",
});

const VALE_ATE_CONFERIR = `A informação atual continua valendo até ${QUEM_ACOMPANHA} conferir.`;

export interface TextoPedidoPortal {
  titulo: string;
  apoio?: string;
}

/**
 * Texto de um pedido do paciente. `podeCancelar` só é verdadeiro para o autor enquanto o pedido está aberto;
 * é o único caso em que a tela pode dizer "Você pediu" (depois da decisão a API não informa o autor).
 */
export function textoPedidoPortal(
  pedido: { chaveTexto: string; tipo: TipoPedidoPortal | "inclusao"; podeCancelar: boolean },
  ctx: ContextoPessoaPortal,
): TextoPedidoPortal {
  const nome = NOME_PEDIDO[pedido.tipo] ?? "alteração";
  const pedidoDeOutraPessoa = `Pedido de ${nome} feito por outra pessoa que acompanha ${ctx.nome}`;
  switch (pedido.chaveTexto) {
    case "restricoes.solicitacao.enviada":
      return {
        titulo: pedido.podeCancelar ? `Você pediu uma ${nome}` : ctx.representante ? pedidoDeOutraPessoa : `Pedido de ${nome} enviado`,
        apoio: VALE_ATE_CONFERIR,
      };
    case "restricoes.solicitacao.analisando":
      return { titulo: "Sua solicitação está sendo analisada", apoio: VALE_ATE_CONFERIR };
    case "restricoes.solicitacao.atendida":
      return { titulo: "Sua informação foi atualizada" };
    case "restricoes.solicitacao.parcial":
      return { titulo: "Sua informação foi atualizada parcialmente" };
    case "restricoes.solicitacao.recusada":
      return { titulo: "Sua solicitação foi analisada e não houve alteração" };
    case "restricoes.solicitacao.cancelada":
      return { titulo: `Pedido de ${nome} cancelado` };
    default:
      return { titulo: `Pedido de ${nome}` };
  }
}

export function tituloGrupoPortal(grupo: GrupoRestricaoPortal, ctx: ContextoPessoaPortal): string {
  switch (grupo) {
    case "alergias":
      return "Alergias";
    case "intolerancias":
      return "Intolerâncias";
    case "outras":
      return "Outras condições";
    case "escolhas":
      return ctx.representante ? `Alimentos que ${ctx.nome} evita por escolha` : "Alimentos que você evita por escolha";
  }
}

export const TEXTOS_PORTAL_RESTRICOES = Object.freeze({
  titulo: "Restrições alimentares",
  abertura: (ctx: ContextoPessoaPortal) =>
    // P3-2: o pedido de correção existe na tela, então volta o texto aprovado (Q11).
    `Estas são as restrições alimentares registradas ${deQuem(ctx)}. Solicite uma correção se alguma informação estiver desatualizada.`,
  vazio: (ctx: ContextoPessoaPortal) =>
    ctx.representante
      ? `Nenhuma restrição registrada até agora para ${ctx.nome}. Isso não quer dizer que não existam restrições. Se houver alguma alergia ou restrição, fale com ${QUEM_ACOMPANHA}.`
      : `Nenhuma restrição registrada até agora. Isso não quer dizer que você não tenha restrições. Se tiver alguma alergia ou restrição, fale com ${QUEM_ACOMPANHA}.`,
  conviteQuestionario: `Respondeu um questionário há algum tempo? Se algo mudou, conte para ${QUEM_ACOMPANHA}. As respostas antigas não viram restrição automaticamente.`,
  // NUX-15: a data é da conferência geral; não pode sugerir que itens pendentes já foram confirmados.
  ultimaConfirmacao: (_ctx: ContextoPessoaPortal, data: string) =>
    `Última conferência geral por ${QUEM_ACOMPANHA}: ${data}. Itens marcados como "ainda será conferido" ainda não foram confirmados.`,
  seletorPergunta: "De quem você quer ver as informações?",
  seletorVoce: "Você",
  seletorResponsavel: "Você acompanha como responsável",
  seletorNoLimite: "Mostrando as primeiras pessoas da lista. Se faltar alguém, fale com quem faz o acompanhamento.",
  pedidosTitulo: (ctx: ContextoPessoaPortal) => (ctx.representante ? `Pedidos sobre ${ctx.nome}` : "Seus pedidos"),
  pedidosVazio: "Nenhum pedido de correção ou remoção.",
  pedidosMaisAntigos: "Mostrando os 100 pedidos mais recentes.",
  respostaEquipe: "Resposta de quem faz seu acompanhamento",
  alimentoSemTexto: `Item que ainda não aparece com nome aqui. Pergunte a ${QUEM_ACOMPANHA}.`,
  excesso: `Há muitas informações para mostrar aqui. Fale com ${QUEM_ACOMPANHA}.`,
  indisponivel: "Esta área ainda não está disponível.",
  // P3-2: escrita. NUX-20 (a): caminho real para falar com quem acompanha.
  linkMensagens: `Escrever para ${QUEM_ACOMPANHA}`,
  informarAbrir: (ctx: ContextoPessoaPortal) => (ctx.representante ? `Informar uma restrição de ${ctx.nome}` : "Informar uma restrição"),
  informarTipoPergunta: "Que tipo de restrição é?",
  informarAlimento: "Qual alimento?",
  informarAlimentoAjuda: "Exemplo: amendoim, leite, camarão.",
  informarEnviar: "Enviar informação",
  // PUX-01: texto de espera ainda depende de validação clínica (ATV-1, ATV-7) antes da ativação.
  informarSucesso: (ctx: ContextoPessoaPortal) =>
    `Enviamos a informação${ctx.representante ? ` sobre ${ctx.nome}` : ""}. Quem faz seu acompanhamento vai conferir. Em caso de dúvida ou sintomas, fale com ${QUEM_ACOMPANHA}.`,
  pedirAbrir: "Pedir correção ou remoção",
  pedirAbrirDe: (_ctx: ContextoPessoaPortal, alimento: string) => `Pedir correção ou remoção de ${alimento}`,
  pedirTipoPergunta: "O que você quer pedir?",
  pedirCorrecao: "Corrigir esta informação",
  pedirRemocao: "Remover esta informação",
  pedirTexto: "O que está errado?",
  pedirEnviar: "Enviar pedido",
  pedirSucesso: `Pedido enviado. A informação atual continua valendo até ${QUEM_ACOMPANHA} conferir.`,
  fecharFormulario: "Fechar",
  cancelarAbrir: "Cancelar pedido",
  cancelarTitulo: "Cancelar este pedido?",
  cancelarMensagem: "O pedido deixa de ser analisado. A informação atual não muda.",
  cancelarSim: "Sim, cancelar pedido",
  cancelarNao: "Não, manter pedido",
  cancelarSucesso: "Pedido cancelado.",
  limiteDeclaracoes: `Já há muitas informações aguardando conferência. Aguarde ${QUEM_ACOMPANHA} conferir as atuais.`,
  limitePedidos: "Já há muitos pedidos aguardando análise. Aguarde a análise ou cancele um pedido seu.",
  incertoEnvio: "Não conseguimos confirmar se o envio foi concluído. Confira a lista antes de enviar de novo.",
  tentarDeNovo: "Tentar de novo",
  faltaTipo: "Escolha o tipo de restrição.",
  faltaAlimento: "Escreva o alimento.",
  faltaTexto: "Escreva o que está errado.",
  trocaPessoa: (ctx: ContextoPessoaPortal) => `Mostrando as informações de ${ctx.nome}.`,
  semAcessoCaminho: `Se achar que isso está errado, fale com ${QUEM_ACOMPANHA}.`,
});

export const TIPOS_DECLARACAO_PORTAL = Object.freeze([
  { valor: "alergia", rotulo: "Alergia", ajuda: "O corpo reage ao alimento, mesmo em pouca quantidade." },
  { valor: "intolerancia", rotulo: "Intolerância", ajuda: "O alimento faz mal na digestão, como acontece com a lactose." },
  { valor: "outra", rotulo: "Outra condição de saúde", ajuda: "Uma doença ou condição que pede evitar o alimento." },
  { valor: "nao_sei", rotulo: "Não sei dizer", ajuda: "Quem faz seu acompanhamento vai entender e classificar." },
  { valor: "escolha", rotulo: "Evito por escolha", ajuda: "Você não come o alimento por decisão própria." },
] as const);

export const ERROS_RESTRICOES: Readonly<Record<string, string>> = Object.freeze({
  invalida: "Revise os campos destacados.",
  sessao: "Sua sessão terminou. Entre novamente.",
  semAcesso: "Não foi possível abrir esta informação com esta conta.",
  mudou: "Esta informação mudou ou um limite foi atingido. Recarregue para ver a versão atual.",
  grandeDemais: "O texto ficou grande demais.",
  leitura: "Não foi possível carregar agora. Tente de novo em instantes.",
  incerto: "Não conseguimos confirmar se a ação foi concluída. Recarregue antes de tentar de novo.",
});
