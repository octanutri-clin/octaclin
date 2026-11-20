/**
 * Projeções e entradas das telas de equipe (FOOD06 P3-6). Puras: o BFF projeta a resposta do backend antes do navegador
 * e monta o corpo exato que vai ao backend. O BFF não decide autorização (titular, carteira, delegação e vínculo são do
 * backend, sob lock); aqui só se fecha a forma.
 *
 * Allowlist (decisões de 2026-11-18): colaborador pelo e-mail completo; representante pelo nome da ficha (só na carteira
 * de quem busca) ou pelo e-mail mascarado. Nunca tenant, papel, hash, auditoria ou campo interno.
 */
export const LIMITE_DELEGACOES = 100;
export const LIMITE_REPRESENTANTES = 100;
export const TIPOS_VERIFICACAO = Object.freeze(["documento_apresentado", "presencial", "procuracao", "outro"] as const);
export type TipoVerificacao = (typeof TIPOS_VERIFICACAO)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;
const EMAIL_BUSCA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const data = (v: unknown): v is string => typeof v === "string" && ISO.test(v);
/** E-mail VINDO do backend: mesma regra do controlador (3..254 com "@"), para nunca esconder uma conta que ele aceitou (R4). */
const emailCompleto = (v: unknown): v is string => typeof v === "string" && v.length >= 3 && v.length <= 254 && v.includes("@");
const chavesExatas = (v: Record<string, unknown>, chaves: string[]) =>
  Object.keys(v).length === chaves.length && chaves.every((c) => Object.prototype.hasOwnProperty.call(v, c));

export interface DelegacaoTela { id: string; colaboradorUsuarioId: string; email: string; concedidaEm: string }
export interface CandidatoDelegacaoTela { usuarioId: string; email: string }
export type IdentificacaoTela = { tipo: "nome_ficha"; nome: string } | { tipo: "email_mascarado"; email: string };
export interface RepresentanteTela {
  id: string;
  representanteUsuarioId: string;
  tipoVerificacao: TipoVerificacao;
  verificadoEm: string;
  identificacao: IdentificacaoTela;
}

export function projetarDelegacaoUnica(v: unknown): DelegacaoTela | null {
  if (!objeto(v) || !uuid(v.id) || !uuid(v.colaboradorUsuarioId) || !emailCompleto(v.colaboradorEmail) || !data(v.concedidaEm)) return null;
  return { id: v.id, colaboradorUsuarioId: v.colaboradorUsuarioId, email: v.colaboradorEmail, concedidaEm: v.concedidaEm };
}

export function projetarDelegacoes(v: unknown): { itens: DelegacaoTela[] } | null {
  if (!objeto(v) || !Array.isArray(v.itens)) return null;
  // Falha fechado: um item fora do formato derruba a lista (503), em vez de sumir uma delegação vigente da tela (R4).
  const itens = v.itens.map(projetarDelegacaoUnica);
  return itens.every((d): d is DelegacaoTela => d !== null) ? { itens } : null;
}

export function projetarCandidatosDelegacao(v: unknown): { itens: CandidatoDelegacaoTela[]; noLimite: boolean } | null {
  if (!objeto(v) || !Array.isArray(v.itens) || typeof v.noLimite !== "boolean") return null;
  const itens: CandidatoDelegacaoTela[] = [];
  for (const c of v.itens) {
    if (!objeto(c) || !uuid(c.usuarioId) || !emailCompleto(c.email)) return null;
    itens.push({ usuarioId: c.usuarioId, email: c.email });
  }
  return { itens, noLimite: v.noLimite };
}

export function montarConcessaoDelegacao(v: unknown): { colaboradorUsuarioId: string } | null {
  if (!objeto(v) || !chavesExatas(v, ["colaboradorUsuarioId"]) || !uuid(v.colaboradorUsuarioId)) return null;
  return { colaboradorUsuarioId: v.colaboradorUsuarioId };
}

function projetarIdentificacao(v: unknown): IdentificacaoTela | null {
  if (!objeto(v)) return null;
  if (v.tipo === "nome_ficha" && typeof v.nome === "string" && v.nome.trim() && v.nome.length <= 300) return { tipo: "nome_ficha", nome: v.nome };
  if (v.tipo === "email_mascarado" && typeof v.email === "string" && v.email.includes("***") && v.email.length <= 260)
    return { tipo: "email_mascarado", email: v.email };
  return null;
}

export function projetarRepresentanteUnico(v: unknown): RepresentanteTela | null {
  if (!objeto(v) || !uuid(v.id) || !uuid(v.representanteUsuarioId) || !data(v.verificadoEm)) return null;
  if (!(TIPOS_VERIFICACAO as readonly unknown[]).includes(v.tipoVerificacao)) return null;
  const identificacao = projetarIdentificacao(v.identificacao);
  if (!identificacao) return null;
  return { id: v.id, representanteUsuarioId: v.representanteUsuarioId, tipoVerificacao: v.tipoVerificacao as TipoVerificacao,
    verificadoEm: v.verificadoEm, identificacao };
}

export function projetarRepresentantes(v: unknown): { itens: RepresentanteTela[] } | null {
  if (!objeto(v) || !Array.isArray(v.itens)) return null;
  const itens = v.itens.map(projetarRepresentanteUnico);
  return itens.every((r): r is RepresentanteTela => r !== null) ? { itens } : null;
}

export function projetarCandidatoRepresentante(v: unknown): { candidato: { usuarioId: string; identificacao: IdentificacaoTela } | null } | null {
  if (!objeto(v) || !("candidato" in v)) return null;
  if (v.candidato === null) return { candidato: null };
  const c = v.candidato;
  if (!objeto(c) || !uuid(c.usuarioId)) return null;
  const identificacao = projetarIdentificacao(c.identificacao);
  return identificacao ? { candidato: { usuarioId: c.usuarioId, identificacao } } : null;
}

/** O e-mail vai só no corpo; normalizado aqui do mesmo jeito que o backend (trim + minúsculas). */
export function montarBuscaRepresentante(v: unknown): { email: string } | null {
  if (!objeto(v) || !chavesExatas(v, ["email"]) || typeof v.email !== "string") return null;
  const email = v.email.trim().toLowerCase();
  // Entrada da busca: formato de e-mail usual (com ponto no domínio), como o backend valida a busca.
  return email.length >= 3 && email.length <= 254 && EMAIL_BUSCA.test(email) ? { email } : null;
}

export function montarRegistroRepresentante(v: unknown): { representanteUsuarioId: string; tipoVerificacao: TipoVerificacao } | null {
  if (!objeto(v) || !chavesExatas(v, ["representanteUsuarioId", "tipoVerificacao"]) || !uuid(v.representanteUsuarioId)) return null;
  if (!(TIPOS_VERIFICACAO as readonly unknown[]).includes(v.tipoVerificacao)) return null;
  return { representanteUsuarioId: v.representanteUsuarioId, tipoVerificacao: v.tipoVerificacao as TipoVerificacao };
}

export function textoIdentificacao(i: IdentificacaoTela): string {
  return i.tipo === "nome_ficha" ? i.nome : `Conta ${i.email}`;
}
