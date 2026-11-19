/**
 * Projeções do portal de restrições (FOOD06 P3). Puras e sem dependência de servidor: o BFF projeta a resposta do
 * backend com estas funções antes de devolvê-la ao navegador, e a tela consome só o resultado.
 *
 * Allowlist (Q11 e decisões de 2026-11-17): o navegador recebe id, grupo, alimento e a chave do selo. Nunca recebe
 * gravidade (Q-E), observação, justificativa, autor, origem crua, revisão, natureza ou subtipo crus, id de catálogo.
 * Formato inesperado no topo falha fechado (`null`); item com id inválido é descartado.
 */
import type { GrupoRestricaoPortal, TipoPedidoPortal } from "./textos-restricoes";

export const CHAVES_SELO_PORTAL = Object.freeze([
  "restricoes.portal.registrada",
  "restricoes.portal.informada_por_voce",
  "restricoes.portal.anotada_pela_equipe",
] as const);

export const CHAVES_SOLICITACAO_PORTAL = Object.freeze([
  "restricoes.solicitacao.enviada",
  "restricoes.solicitacao.analisando",
  "restricoes.solicitacao.atendida",
  "restricoes.solicitacao.parcial",
  "restricoes.solicitacao.recusada",
  "restricoes.solicitacao.cancelada",
] as const);

const CHAVES_DECIDIDAS = new Set<string>([
  "restricoes.solicitacao.atendida",
  "restricoes.solicitacao.parcial",
  "restricoes.solicitacao.recusada",
]);

export const LIMITE_SELETOR_PORTAL = 101;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

export interface ItemResumoPortal {
  id: string;
  grupo: GrupoRestricaoPortal;
  /** Texto declarado; vazio quando o alvo é de catálogo (a tela mostra um texto fixo). */
  alimento: string;
  /** Chave conhecida ou `desconhecido`; nunca é exibida. */
  chaveSelo: string;
}

export interface ResumoPortalTela {
  itens: ItemResumoPortal[];
  ultimaConfirmacaoEm?: string;
}

export interface PedidoPortalTela {
  id: string;
  tipo: TipoPedidoPortal | "inclusao";
  chaveTexto: string;
  criadoEm: string;
  decididoEm?: string;
  explicacao?: string;
  podeCancelar: boolean;
}

export interface PedidosPortalTela {
  itens: PedidoPortalTela[];
  maisAntigos: boolean;
}

export interface PessoaSeletorPortal {
  pacienteId: string;
  via: "propria" | "representante";
  nome: string;
}

export interface SeletorPortalTela {
  itens: PessoaSeletorPortal[];
  noLimite: boolean;
}

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v : undefined);
const data = (v: unknown) => (typeof v === "string" && ISO.test(v) ? v : undefined);

function grupoDe(natureza: unknown, subtipo: unknown): GrupoRestricaoPortal {
  if (natureza === "escolha") return "escolhas";
  if (subtipo === "alergia_alimentar") return "alergias";
  if (subtipo === "intolerancia_alimentar") return "intolerancias";
  return "outras";
}

export function projetarResumoPortal(v: unknown): ResumoPortalTela | null {
  if (!objeto(v) || !Array.isArray(v.restricoes)) return null;
  const itens: ItemResumoPortal[] = [];
  for (const item of v.restricoes) {
    if (!objeto(item) || typeof item.id !== "string" || !UUID.test(item.id)) continue;
    const alvo = objeto(item.alvo) ? item.alvo : {};
    const chaveSelo = (CHAVES_SELO_PORTAL as readonly string[]).includes(item.selo as string) ? (item.selo as string) : "desconhecido";
    itens.push({
      id: item.id,
      grupo: grupoDe(item.natureza, item.subtipoClinico),
      alimento: alvo.tipo === "nao_catalogado" ? (texto(item.alvoDeclarado, 200) ?? "") : "",
      chaveSelo,
    });
  }
  const ultimaConfirmacaoEm = data(v.ultimaConfirmacaoEm);
  return ultimaConfirmacaoEm ? { itens, ultimaConfirmacaoEm } : { itens };
}

export function projetarPedidosPortal(v: unknown): PedidosPortalTela | null {
  if (!objeto(v) || !Array.isArray(v.itens)) return null;
  const itens: PedidoPortalTela[] = [];
  for (const item of v.itens) {
    const pedido = projetarPedidoUnicoPortal(item);
    if (pedido) itens.push(pedido);
  }
  return { itens, maisAntigos: v.maisAntigos === true };
}

/** Um pedido (resposta de criar ou cancelar, ou item da lista) pela mesma allowlist. */
export function projetarPedidoUnicoPortal(item: unknown): PedidoPortalTela | null {
  if (!objeto(item) || typeof item.id !== "string" || !UUID.test(item.id)) return null;
  if (item.tipo !== "correcao" && item.tipo !== "remocao" && item.tipo !== "inclusao") return null;
  const criadoEm = data(item.criadoEm);
  if (!criadoEm) return null;
  const chaveTexto = (CHAVES_SOLICITACAO_PORTAL as readonly string[]).includes(item.chaveTexto as string)
    ? (item.chaveTexto as string)
    : "desconhecido";
  const pedido: PedidoPortalTela = {
    id: item.id,
    tipo: item.tipo,
    chaveTexto,
    criadoEm,
    podeCancelar: item.podeCancelar === true,
  };
  const decididoEm = data(item.decididoEm);
  if (decididoEm) pedido.decididoEm = decididoEm;
  // A explicação só existe para o paciente depois da decisão.
  const explicacao = CHAVES_DECIDIDAS.has(chaveTexto) ? texto(item.explicacao, 4000) : undefined;
  if (explicacao) pedido.explicacao = explicacao;
  return pedido;
}

export function projetarSeletorPortal(v: unknown): SeletorPortalTela | null {
  if (!objeto(v) || !Array.isArray(v.itens)) return null;
  const itens: PessoaSeletorPortal[] = [];
  for (const item of v.itens) {
    if (!objeto(item) || typeof item.pacienteId !== "string" || !UUID.test(item.pacienteId)) continue;
    if (item.via !== "propria" && item.via !== "representante") continue;
    const nome = texto(item.nome, 200);
    if (!nome) continue;
    itens.push({ pacienteId: item.pacienteId, via: item.via, nome });
  }
  return { itens, noLimite: v.itens.length >= LIMITE_SELETOR_PORTAL };
}

// ---------------------------------------------------------------------------------------------------------------
// Escrita (P3-2). O navegador manda só a escolha simples; o BFF monta o conteúdo do contrato (`conteudo-restricao`
// do backend). Nada de gravidade, observação ou alvo de catálogo pelo portal; preferência não entra (Q8).

export type TipoDeclaracaoPortal = "alergia" | "intolerancia" | "outra" | "nao_sei" | "escolha";

const NATUREZA_DECLARACAO: Readonly<Record<TipoDeclaracaoPortal, Record<string, string>>> = Object.freeze({
  alergia: { natureza: "clinica", subtipoClinico: "alergia_alimentar" },
  intolerancia: { natureza: "clinica", subtipoClinico: "intolerancia_alimentar" },
  outra: { natureza: "clinica", subtipoClinico: "doenca_ou_condicao_com_restricao" },
  // "Não sei dizer" (Q-G): a equipe classifica ao conferir. A marca fechada (NUX-24, backend #559) deixa a equipe ver
  // "Tipo não informado pelo paciente"; o backend só a aceita em declaração do paciente.
  nao_sei: { natureza: "clinica", subtipoClinico: "outra_restricao_clinica", classificacaoPeloPaciente: "nao_sabe" },
  escolha: { natureza: "escolha" },
});

const SEM_CONTROLE_200 = /^[^\p{C}]{1,200}$/u;
const chavesExatas = (v: Record<string, unknown>, chaves: string[]) =>
  Object.keys(v).length === chaves.length && chaves.every((c) => Object.prototype.hasOwnProperty.call(v, c));

export interface DeclaracaoMontada {
  chaveCriacao: string;
  conteudo: Record<string, unknown>;
}

export function montarDeclaracaoPortal(v: unknown): DeclaracaoMontada | null {
  if (!objeto(v) || !chavesExatas(v, ["chaveCriacao", "tipo", "alimento"])) return null;
  if (typeof v.chaveCriacao !== "string" || !UUID.test(v.chaveCriacao)) return null;
  if (typeof v.tipo !== "string" || !Object.prototype.hasOwnProperty.call(NATUREZA_DECLARACAO, v.tipo)) return null;
  const alimento = typeof v.alimento === "string" ? v.alimento.trim() : "";
  if (!SEM_CONTROLE_200.test(alimento)) return null;
  return {
    chaveCriacao: v.chaveCriacao,
    conteudo: {
      schemaVersao: 1,
      ...NATUREZA_DECLARACAO[v.tipo as TipoDeclaracaoPortal],
      alvo: { tipo: "nao_catalogado" },
      alvoDeclarado: alimento,
    },
  };
}

export interface PedidoMontado {
  chaveCriacao: string;
  tipo: TipoPedidoPortal;
  restricaoId: string;
  itens: { item: string; texto: string }[];
}

export function montarPedidoPortal(v: unknown): PedidoMontado | null {
  if (!objeto(v) || !chavesExatas(v, ["chaveCriacao", "tipo", "restricaoId", "texto"])) return null;
  if (typeof v.chaveCriacao !== "string" || !UUID.test(v.chaveCriacao)) return null;
  if (v.tipo !== "correcao" && v.tipo !== "remocao") return null;
  if (typeof v.restricaoId !== "string" || !UUID.test(v.restricaoId)) return null;
  const texto = typeof v.texto === "string" ? v.texto.trim() : "";
  if (texto.length < 1 || texto.length > 1000) return null;
  return { chaveCriacao: v.chaveCriacao, tipo: v.tipo, restricaoId: v.restricaoId, itens: [{ item: "descricao", texto }] };
}

export function projetarDeclaracaoPortal(v: unknown): { id: string; chaveSelo: string } | null {
  if (!objeto(v) || typeof v.id !== "string" || !UUID.test(v.id)) return null;
  const chaveSelo = (CHAVES_SELO_PORTAL as readonly string[]).includes(v.selo as string) ? (v.selo as string) : "desconhecido";
  return { id: v.id, chaveSelo };
}
