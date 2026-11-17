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
  tipo: TipoPedidoPortal;
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
    if (!objeto(item) || typeof item.id !== "string" || !UUID.test(item.id)) continue;
    if (item.tipo !== "correcao" && item.tipo !== "remocao") continue;
    const criadoEm = data(item.criadoEm);
    if (!criadoEm) continue;
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
    itens.push(pedido);
  }
  return { itens, maisAntigos: v.maisAntigos === true };
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
