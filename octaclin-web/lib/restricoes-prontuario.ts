/**
 * Projeções e montadores da aba "Restrições" do prontuário (FOOD06 P3-3). Puras: o BFF projeta a resposta do backend e
 * monta o corpo exato. Não decidem autorização (carteira, concessão `restricoes.confirmar` e autoria são do backend, sob
 * lock); o `escopo` da lista só orienta a tela ("completo" = vê tudo e pode decidir; "autoria" = só os próprios).
 * Qualquer item fora do formato derruba a lista (falha fechado), para nunca esconder uma restrição.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;
const ID_CATALOGO = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
const TEXTO_CURTO = /^[^\p{C}]{1,200}$/u;
const TEXTO_LONGO = /^[^\p{C}]{0,1000}$/u;
const TEXTO_PROTEGIDO = /^(?:[^\p{C}]|[\n\t])+$/u;

// `preferencia` existe no domínio do backend mas não entra neste fluxo (Q8): é aceita na projeção e nunca mostrada.
const NATUREZAS = ["clinica", "escolha", "preferencia"] as const;
const SUBTIPOS = ["alergia_alimentar", "intolerancia_alimentar", "doenca_ou_condicao_com_restricao", "outra_restricao_clinica"] as const;
const ALVOS = ["alergeno", "constituinte", "grupo", "alimento", "categoria_escolha", "nao_catalogado"] as const;
const GRAVIDADES = ["leve", "moderada", "grave", "nao_informada"] as const;
const ORIGENS = ["profissional", "colaborador", "declaracao_paciente", "questionario_legado"] as const;
const ESTADOS = ["ativa", "em_reavaliacao", "inativa"] as const;
const CONFIRMACOES = ["pendente", "confirmada", "rejeitada"] as const;
const SITUACOES = ["nao_informado", "sem_restricoes_confirmadas", "restricoes_registradas"] as const;

export interface ConteudoProntuario {
  natureza: (typeof NATUREZAS)[number];
  subtipoClinico?: (typeof SUBTIPOS)[number];
  alvo: { tipo: (typeof ALVOS)[number]; id?: string };
  alvoDeclarado?: string;
  gravidade?: (typeof GRAVIDADES)[number];
  observacao?: string;
  classificacaoPeloPaciente?: "nao_sabe";
}
export interface RestricaoProntuario {
  id: string;
  revisao: number;
  origem: (typeof ORIGENS)[number];
  estado: (typeof ESTADOS)[number];
  confirmacao: (typeof CONFIRMACOES)[number];
  criadoEm: string;
  conteudo: ConteudoProntuario;
}
export interface ListaProntuario { escopo: "completo" | "autoria"; itens: RestricaoProntuario[] }
export interface AvaliacaoProntuario { id: string; revisao: number; situacao: (typeof SITUACOES)[number]; confirmadoEm: string | null; venceEm: string | null }

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const em = <T extends readonly string[]>(lista: T, v: unknown): v is T[number] => typeof v === "string" && (lista as readonly string[]).includes(v);
const revisao = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1 && (v as number) <= 2147483646;
const chavesExatas = (v: Record<string, unknown>, chaves: string[]) =>
  Object.keys(v).length === chaves.length && chaves.every((c) => Object.prototype.hasOwnProperty.call(v, c));

function projetarConteudo(v: unknown): ConteudoProntuario | null {
  if (!objeto(v) || !em(NATUREZAS, v.natureza) || !objeto(v.alvo) || !em(ALVOS, v.alvo.tipo)) return null;
  const c: ConteudoProntuario = { natureza: v.natureza, alvo: { tipo: v.alvo.tipo } };
  if (v.subtipoClinico !== undefined) { if (!em(SUBTIPOS, v.subtipoClinico)) return null; c.subtipoClinico = v.subtipoClinico; }
  if ((c.natureza === "clinica") !== (c.subtipoClinico !== undefined)) return null;
  if (v.alvo.id !== undefined) { if (typeof v.alvo.id !== "string" || !ID_CATALOGO.test(v.alvo.id)) return null; c.alvo.id = v.alvo.id; }
  if (v.alvoDeclarado !== undefined) { if (typeof v.alvoDeclarado !== "string" || !TEXTO_CURTO.test(v.alvoDeclarado)) return null; c.alvoDeclarado = v.alvoDeclarado; }
  if (v.gravidade !== undefined) { if (!em(GRAVIDADES, v.gravidade)) return null; c.gravidade = v.gravidade; }
  if (v.observacao !== undefined) { if (typeof v.observacao !== "string" || !TEXTO_LONGO.test(v.observacao)) return null; c.observacao = v.observacao; }
  // Mesmas combinações do domínio (`validarConteudoRestricao`): falha fechado em qualquer divergência.
  const naoCatalogado = c.alvo.tipo === "nao_catalogado";
  if (naoCatalogado === (c.alvo.id !== undefined) || naoCatalogado !== (c.alvoDeclarado !== undefined)) return null;
  if (c.natureza !== "clinica" && c.gravidade !== undefined) return null;
  if (c.alvo.tipo === "categoria_escolha" && c.natureza !== "escolha") return null;
  if (v.classificacaoPeloPaciente !== undefined) {
    if (v.classificacaoPeloPaciente !== "nao_sabe" || c.subtipoClinico !== "outra_restricao_clinica") return null;
    c.classificacaoPeloPaciente = "nao_sabe";
  }
  return c;
}

function projetarItem(v: unknown): RestricaoProntuario | null {
  if (!objeto(v) || typeof v.id !== "string" || !UUID.test(v.id) || !revisao(v.revisao) || !em(ORIGENS, v.origem) || !em(ESTADOS, v.estado) ||
    !em(CONFIRMACOES, v.confirmacao) || typeof v.criadoEm !== "string" || !ISO.test(v.criadoEm)) return null;
  const conteudo = projetarConteudo(v.conteudo);
  return conteudo ? { id: v.id, revisao: v.revisao, origem: v.origem, estado: v.estado, confirmacao: v.confirmacao, criadoEm: v.criadoEm, conteudo } : null;
}

export function projetarListaProntuario(v: unknown): ListaProntuario | null {
  if (!objeto(v) || (v.escopo !== "completo" && v.escopo !== "autoria") || !Array.isArray(v.itens)) return null;
  const itens = v.itens.map(projetarItem);
  return itens.every((i): i is RestricaoProntuario => i !== null) ? { escopo: v.escopo, itens } : null;
}

export function separarRestricoesProntuario(itens: RestricaoProntuario[]) {
  const recolhida = (i: RestricaoProntuario) => i.estado === "inativa" || i.confirmacao === "rejeitada";
  itens = itens.filter((i) => i.conteudo.natureza !== "preferencia");
  return {
    pendentes: itens.filter((i) => !recolhida(i) && i.estado === "ativa" && i.confirmacao === "pendente"),
    confirmadas: itens.filter((i) => !recolhida(i) && i.estado === "ativa" && i.confirmacao === "confirmada"),
    emReavaliacao: itens.filter((i) => !recolhida(i) && i.estado === "em_reavaliacao"),
    recolhidas: itens.filter(recolhida),
  };
}

const dataOuNulo = (v: unknown) => v === null || (typeof v === "string" && ISO.test(v));
export function projetarAvaliacaoProntuario(v: unknown): { avaliacao: AvaliacaoProntuario | null } | null {
  if (!objeto(v) || !("avaliacao" in v)) return null;
  if (v.avaliacao === null) return { avaliacao: null };
  const a = v.avaliacao;
  if (!objeto(a) || typeof a.id !== "string" || !UUID.test(a.id) || !revisao(a.revisao) || !em(SITUACOES, a.situacao) ||
    !dataOuNulo(a.confirmadoEm) || !dataOuNulo(a.venceEm)) return null;
  return { avaliacao: { id: a.id, revisao: a.revisao, situacao: a.situacao, confirmadoEm: a.confirmadoEm as string | null, venceEm: a.venceEm as string | null } };
}

export function projetarAvaliacaoInicial(v: unknown): { id: string; revisao: number; situacao: AvaliacaoProntuario["situacao"] } | null {
  if (!objeto(v) || typeof v.id !== "string" || !UUID.test(v.id) || !revisao(v.revisao) || !em(SITUACOES, v.situacao)) return null;
  return { id: v.id, revisao: v.revisao, situacao: v.situacao };
}

export function projetarRegistroProntuario(v: unknown): { id: string; revisao: number; estado: string; confirmacao: string } | null {
  if (!objeto(v) || typeof v.id !== "string" || !UUID.test(v.id) || !revisao(v.revisao) || !em(ESTADOS, v.estado) || !em(CONFIRMACOES, v.confirmacao)) return null;
  return { id: v.id, revisao: v.revisao, estado: v.estado, confirmacao: v.confirmacao };
}

/** Confere que a resposta é da MESMA restrição, na revisão seguinte, com o resultado esperado. */
export function projetarAcaoRestricao(v: unknown, id: string, revisaoEnviada: number, esperado: "confirmada" | "rejeitada") {
  if (!objeto(v) || v.id !== id.toLowerCase() || v.revisao !== revisaoEnviada + 1 || v.confirmacao !== esperado) return null;
  return { id: v.id as string, revisao: v.revisao as number, confirmacao: esperado };
}

const MAPA_TIPO: Readonly<Record<string, { natureza: "clinica" | "escolha"; subtipoClinico?: string }>> = Object.freeze({
  alergia: { natureza: "clinica", subtipoClinico: "alergia_alimentar" },
  intolerancia: { natureza: "clinica", subtipoClinico: "intolerancia_alimentar" },
  condicao: { natureza: "clinica", subtipoClinico: "doenca_ou_condicao_com_restricao" },
  outra: { natureza: "clinica", subtipoClinico: "outra_restricao_clinica" },
  escolha: { natureza: "escolha" },
});

/**
 * Registro pela equipe (profissional ou colaborador). Sem catálogo semeado, o alvo é sempre `nao_catalogado` com o texto
 * do alimento (F10). Gravidade padrão explícita "não informada" em clínica (NUX-11); nunca em escolha. A observação perde
 * quebras de linha (o contrato não as aceita; NUX-12). A marca do paciente nunca vem da equipe.
 */
export function montarRegistroProntuario(v: unknown): { chaveCriacao: string; conteudo: Record<string, unknown> } | null {
  if (!objeto(v) || !chavesExatas(v, ["chaveCriacao", "tipo", "alimento", "gravidade", "observacao"])) return null;
  if (typeof v.chaveCriacao !== "string" || !UUID.test(v.chaveCriacao) || typeof v.tipo !== "string" || !MAPA_TIPO[v.tipo]) return null;
  const alimento = typeof v.alimento === "string" ? v.alimento.trim() : "";
  if (!TEXTO_CURTO.test(alimento)) return null;
  const { natureza, subtipoClinico } = MAPA_TIPO[v.tipo];
  if (typeof v.gravidade !== "string" || typeof v.observacao !== "string") return null;
  if (natureza !== "clinica" && v.gravidade !== "") return null;
  const gravidade = natureza === "clinica" ? (v.gravidade === "" ? "nao_informada" : v.gravidade) : undefined;
  if (gravidade !== undefined && !em(GRAVIDADES, gravidade)) return null;
  const observacao = v.observacao.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  if (!TEXTO_LONGO.test(observacao)) return null;
  return {
    chaveCriacao: v.chaveCriacao,
    conteudo: {
      schemaVersao: 1, natureza, ...(subtipoClinico ? { subtipoClinico } : {}), alvo: { tipo: "nao_catalogado" }, alvoDeclarado: alimento,
      ...(gravidade ? { gravidade } : {}), ...(observacao ? { observacao } : {}),
    },
  };
}

export function montarConfirmacaoRestricao(v: unknown): { revisao: number } | null {
  return objeto(v) && chavesExatas(v, ["revisao"]) && revisao(v.revisao) ? { revisao: v.revisao } : null;
}

export function montarRejeicaoRestricao(v: unknown): { revisao: number; justificativa: string } | null {
  if (!objeto(v) || !chavesExatas(v, ["revisao", "justificativa"]) || !revisao(v.revisao) || typeof v.justificativa !== "string") return null;
  const justificativa = v.justificativa.trim();
  return justificativa && justificativa.length <= 4000 && TEXTO_PROTEGIDO.test(justificativa) ? { revisao: v.revisao, justificativa } : null;
}

export const descricaoRestricao = (i: RestricaoProntuario, rotuloTipo: string) =>
  `${rotuloTipo.toLocaleLowerCase("pt-BR")}: ${i.conteudo.alvoDeclarado ?? "item de catálogo"}`;

// ---------------------------------------------------------------- P3-4a: ações protegidas sobre restrição confirmada
const MOTIVOS_INATIVACAO = ["registro_incorreto", "informacao_clinica_revisada", "solicitacao_fundamentada", "outro"] as const;
const DESTINOS_REAVALIACAO = ["ativa", "em_reavaliacao"] as const;
// O domínio do backend aceita até 1000 caracteres sem nenhum caractere de controle (nem quebra de linha) na inativação.
const JUSTIFICATIVA_INATIVACAO = /^[^\p{C}]{1,1000}$/u;

/**
 * Inativação em dois passos (Q3). A tela só envia depois do segundo passo; `confirmacaoEmDoisPassos` vem dela, explícito,
 * e o BFF exige `true`. Quebras de linha viram espaço (NUX-12). Proteção da alergia, carteira e concessão são do backend.
 */
export function montarInativacaoRestricao(v: unknown): { revisao: number; motivo: string; justificativa: string; confirmacaoEmDoisPassos: true } | null {
  if (!objeto(v) || !chavesExatas(v, ["revisao", "motivo", "justificativa", "confirmacaoEmDoisPassos"]) || !revisao(v.revisao) ||
    !em(MOTIVOS_INATIVACAO, v.motivo) || v.confirmacaoEmDoisPassos !== true || typeof v.justificativa !== "string") return null;
  const justificativa = v.justificativa.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  return JUSTIFICATIVA_INATIVACAO.test(justificativa) ? { revisao: v.revisao, motivo: v.motivo, justificativa, confirmacaoEmDoisPassos: true } : null;
}

export function montarReavaliacaoRestricao(v: unknown): { revisao: number; destino: (typeof DESTINOS_REAVALIACAO)[number] } | null {
  return objeto(v) && chavesExatas(v, ["revisao", "destino"]) && revisao(v.revisao) && em(DESTINOS_REAVALIACAO, v.destino)
    ? { revisao: v.revisao, destino: v.destino } : null;
}

/** Confere que a resposta é da MESMA restrição, na revisão seguinte, no estado pedido. */
export function projetarEstadoRestricao(v: unknown, id: string, revisaoEnviada: number, esperado: "inativa" | "ativa" | "em_reavaliacao") {
  if (!objeto(v) || v.id !== id.toLowerCase() || v.revisao !== revisaoEnviada + 1 || v.estado !== esperado) return null;
  return { id: v.id as string, revisao: v.revisao as number, estado: esperado };
}

const TIPO_DO_SUBTIPO: Readonly<Record<string, string>> = Object.freeze({
  alergia_alimentar: "alergia", intolerancia_alimentar: "intolerancia", doenca_ou_condicao_com_restricao: "condicao", outra_restricao_clinica: "outra",
});

/**
 * "Corrigir registro" (NUX-01): o formulário da nova restrição parte da antiga. Com "não sei dizer", o tipo fica em branco
 * para a equipe escolher (nunca afirma "outra restrição clínica" como fato).
 */
export function formularioCorrecao(i: RestricaoProntuario): { tipo: string; alimento: string; gravidade: string; observacao: string } {
  const c = i.conteudo;
  const tipo = c.classificacaoPeloPaciente === "nao_sabe" ? "" : c.natureza === "escolha" ? "escolha" : TIPO_DO_SUBTIPO[c.subtipoClinico ?? ""] ?? "";
  return { tipo, alimento: c.alvoDeclarado ?? "", gravidade: c.gravidade ?? "nao_informada", observacao: c.observacao ?? "" };
}
