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

const NOME_PEDIDO: Readonly<Record<TipoPedidoPortal, string>> = Object.freeze({
  correcao: "correção",
  remocao: "remoção",
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
  pedido: { chaveTexto: string; tipo: TipoPedidoPortal; podeCancelar: boolean },
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
    `Estas são as restrições alimentares registradas ${deQuem(ctx)}. Solicite uma correção se alguma informação estiver desatualizada.`,
  vazio: (ctx: ContextoPessoaPortal) =>
    ctx.representante
      ? `Nenhuma restrição registrada até agora para ${ctx.nome}. Isso não quer dizer que não existam restrições. Se houver alguma alergia ou restrição, fale com ${QUEM_ACOMPANHA}.`
      : `Nenhuma restrição registrada até agora. Isso não quer dizer que você não tenha restrições. Se tiver alguma alergia ou restrição, fale com ${QUEM_ACOMPANHA}.`,
  conviteQuestionario: `Respondeu um questionário há algum tempo? Se algo mudou, conte para ${QUEM_ACOMPANHA}. As respostas antigas não viram restrição automaticamente.`,
  ultimaConfirmacao: (_ctx: ContextoPessoaPortal, data: string) => `Última confirmação por ${QUEM_ACOMPANHA}: ${data}`,
  seletorPergunta: "De quem você quer ver as informações?",
  seletorVoce: "Você",
  seletorResponsavel: "Você acompanha como responsável",
  seletorNoLimite: "Mostrando as primeiras pessoas da lista. Se faltar alguém, fale com quem faz o acompanhamento.",
  pedidosTitulo: (ctx: ContextoPessoaPortal) => (ctx.representante ? `Pedidos sobre ${ctx.nome}` : "Seus pedidos"),
  pedidosVazio: "Nenhum pedido de correção ou remoção.",
  pedidosMaisAntigos: "Mostrando os 100 pedidos mais recentes.",
  respostaEquipe: "Resposta de quem faz seu acompanhamento",
  alimentoSemTexto: "Item registrado por quem faz seu acompanhamento",
  excesso: `Há muitas informações para mostrar aqui. Fale com ${QUEM_ACOMPANHA}.`,
  indisponivel: "Esta área ainda não está disponível.",
});

export const ERROS_RESTRICOES: Readonly<Record<string, string>> = Object.freeze({
  invalida: "Revise os campos destacados.",
  sessao: "Sua sessão terminou. Entre novamente.",
  semAcesso: "Não foi possível abrir esta informação com esta conta.",
  mudou: "Esta informação mudou ou um limite foi atingido. Recarregue para ver a versão atual.",
  grandeDemais: "O texto ficou grande demais.",
  leitura: "Não foi possível carregar agora. Tente de novo em instantes.",
  incerto: "Não conseguimos confirmar se a ação foi concluída. Recarregue antes de tentar de novo.",
});
