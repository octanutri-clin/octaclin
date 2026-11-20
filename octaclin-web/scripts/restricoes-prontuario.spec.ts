import assert from "node:assert/strict";
import test from "node:test";
import {
  montarConfirmacaoRestricao,
  montarRegistroProntuario,
  montarRejeicaoRestricao,
  projetarAcaoRestricao,
  projetarAvaliacaoInicial,
  projetarAvaliacaoProntuario,
  projetarListaProntuario,
  projetarRegistroProntuario,
  separarRestricoesProntuario,
} from "../lib/restricoes-prontuario";
import {
  TEXTOS_RESTRICOES_PRONTUARIO as T,
  rotuloEstadoRestricao,
  rotuloGravidade,
  rotuloOrigem,
  rotuloTipoRestricao,
  textoSituacaoAvaliacao,
} from "../lib/textos-restricoes-prontuario";

/** FOOD06 P3-3: aba "Restrições" do prontuário. Dados sintéticos; canários provam o que nunca passa. */
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const CHAVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ISO = "2026-11-10T10:00:00.000Z";

const item = (sobre: Record<string, unknown> = {}) => ({
  id: A, revisao: 2, origem: "profissional", estado: "ativa", confirmacao: "pendente", criadoEm: ISO,
  conteudo: { schemaVersao: 1, natureza: "clinica", subtipoClinico: "alergia_alimentar", alvo: { tipo: "nao_catalogado" },
    alvoDeclarado: "Amendoim", gravidade: "grave", observacao: "Observação sintética" },
  ...sobre,
});

test("lista: allowlist do item e do conteúdo; escopo obrigatório; item inválido derruba a lista (falha fechado)", () => {
  const r = projetarListaProntuario({ escopo: "completo", itens: [item({ autor: "CANARIO", conteudo: { ...item().conteudo, extra: "CANARIO" } })], tenantId: "CANARIO" });
  assert.ok(r);
  assert.deepEqual(Object.keys(r!).sort(), ["escopo", "itens"]);
  assert.deepEqual(Object.keys(r!.itens[0]).sort(), ["confirmacao", "conteudo", "criadoEm", "estado", "id", "origem", "revisao"]);
  assert.deepEqual(Object.keys(r!.itens[0].conteudo).sort(), ["alvo", "alvoDeclarado", "gravidade", "natureza", "observacao", "subtipoClinico"]);
  assert.ok(!JSON.stringify(r).includes("CANARIO"));
  assert.equal(projetarListaProntuario({ escopo: "outro", itens: [] }), null);
  assert.equal(projetarListaProntuario({ escopo: "autoria", itens: [item({ id: "x" })] }), null);
  assert.equal(projetarListaProntuario({ escopo: "autoria", itens: [item({ estado: "CANARIO" })] }), null);
  assert.equal(projetarListaProntuario({ escopo: "autoria", itens: [item({ revisao: 0 })] }), null);
  assert.deepEqual(projetarListaProntuario({ escopo: "autoria", itens: [] }), { escopo: "autoria", itens: [] });
  // NUX-24: a marca do paciente passa só com o valor fechado.
  const marcado = projetarListaProntuario({ escopo: "completo", itens: [item({ origem: "declaracao_paciente", conteudo: {
    schemaVersao: 1, natureza: "clinica", subtipoClinico: "outra_restricao_clinica", alvo: { tipo: "nao_catalogado" }, alvoDeclarado: "Leite",
    classificacaoPeloPaciente: "nao_sabe" } })] });
  assert.equal(marcado!.itens[0].conteudo.classificacaoPeloPaciente, "nao_sabe");
  assert.equal(projetarListaProntuario({ escopo: "completo", itens: [item({ conteudo: { ...item().conteudo, classificacaoPeloPaciente: "CANARIO" } })] }), null);
});

test("separação: pendentes primeiro, depois confirmadas, em reavaliação, e recolhidas (inativas e rejeitadas)", () => {
  const lista = [
    item({ id: "a", estado: "ativa", confirmacao: "confirmada" }),
    item({ id: "b", estado: "inativa", confirmacao: "confirmada" }),
    item({ id: "c", estado: "ativa", confirmacao: "pendente" }),
    item({ id: "d", estado: "em_reavaliacao", confirmacao: "confirmada" }),
    item({ id: "e", estado: "ativa", confirmacao: "rejeitada" }),
  ] as never;
  const s = separarRestricoesProntuario(lista);
  assert.deepEqual(s.pendentes.map((i) => i.id), ["c"]);
  assert.deepEqual(s.confirmadas.map((i) => i.id), ["a"]);
  assert.deepEqual(s.emReavaliacao.map((i) => i.id), ["d"]);
  assert.deepEqual(s.recolhidas.map((i) => i.id).sort(), ["b", "e"]);
});

test("avaliação: null é válida; vencimento coerente com a situação; quem confirmou nunca passa", () => {
  assert.deepEqual(projetarAvaliacaoProntuario({ avaliacao: null }), { avaliacao: null });
  const a = { id: A, revisao: 3, situacao: "restricoes_registradas", confirmadoEm: ISO, venceEm: "2027-05-09T10:00:00.000Z", confirmadoPor: "CANARIO" };
  assert.deepEqual(projetarAvaliacaoProntuario({ avaliacao: a }), { avaliacao: { id: A, revisao: 3, situacao: "restricoes_registradas", confirmadoEm: ISO, venceEm: "2027-05-09T10:00:00.000Z" } });
  assert.equal(projetarAvaliacaoProntuario({ avaliacao: { ...a, situacao: "CANARIO" } }), null);
  assert.equal(projetarAvaliacaoProntuario({}), null);
  assert.deepEqual(projetarAvaliacaoInicial({ id: A, revisao: 1, situacao: "nao_informado", x: "CANARIO" }), { id: A, revisao: 1, situacao: "nao_informado" });
  assert.equal(projetarAvaliacaoInicial({ id: A, revisao: 0, situacao: "nao_informado" }), null);
});

test("registro: tipo simples vira o conteúdo do contrato; gravidade padrão explícita em clínica; nunca em escolha", () => {
  const base = { chaveCriacao: CHAVE, tipo: "alergia", alimento: "  Amendoim ", gravidade: "", observacao: "" };
  assert.deepEqual(montarRegistroProntuario(base), { chaveCriacao: CHAVE, conteudo: { schemaVersao: 1, natureza: "clinica",
    subtipoClinico: "alergia_alimentar", alvo: { tipo: "nao_catalogado" }, alvoDeclarado: "Amendoim", gravidade: "nao_informada" } });
  assert.deepEqual(montarRegistroProntuario({ ...base, tipo: "condicao", gravidade: "grave", observacao: "linha 1\nlinha 2" })!.conteudo,
    { schemaVersao: 1, natureza: "clinica", subtipoClinico: "doenca_ou_condicao_com_restricao", alvo: { tipo: "nao_catalogado" },
      alvoDeclarado: "Amendoim", gravidade: "grave", observacao: "linha 1 linha 2" });
  assert.deepEqual(montarRegistroProntuario({ ...base, tipo: "escolha", gravidade: "" })!.conteudo,
    { schemaVersao: 1, natureza: "escolha", alvo: { tipo: "nao_catalogado" }, alvoDeclarado: "Amendoim" });
  for (const ruim of [
    { ...base, tipo: "preferencia" }, { ...base, chaveCriacao: "x" }, { ...base, alimento: " " }, { ...base, alimento: "a".repeat(201) },
    { ...base, gravidade: "CANARIO" }, { ...base, tipo: "escolha", gravidade: "grave" }, { ...base, observacao: "a".repeat(1001) },
    { ...base, tenantId: B }, { ...base, classificacaoPeloPaciente: "nao_sabe" },
  ]) assert.equal(montarRegistroProntuario(ruim), null, JSON.stringify(ruim).slice(0, 80));
});

test("confirmar e rejeitar: corpo exato com revisão; justificativa obrigatória e limitada", () => {
  assert.deepEqual(montarConfirmacaoRestricao({ revisao: 2 }), { revisao: 2 });
  for (const ruim of [{}, { revisao: 0 }, { revisao: 1.5 }, { revisao: "2" }, { revisao: 2, x: 1 }]) assert.equal(montarConfirmacaoRestricao(ruim), null);
  assert.deepEqual(montarRejeicaoRestricao({ revisao: 2, justificativa: " Registro feito no paciente errado.\nConferido. " }),
    { revisao: 2, justificativa: "Registro feito no paciente errado.\nConferido." });
  for (const ruim of [{ revisao: 2, justificativa: " " }, { revisao: 2, justificativa: "a".repeat(4001) }, { revisao: 2 }, { revisao: 2, justificativa: "ok", motivo: "x" }])
    assert.equal(montarRejeicaoRestricao(ruim), null);
});

test("respostas de ação: id e revisão conferidos; registro com allowlist", () => {
  assert.deepEqual(projetarAcaoRestricao({ id: A, revisao: 3, confirmacao: "confirmada", x: "CANARIO" }, A, 2, "confirmada"), { id: A, revisao: 3, confirmacao: "confirmada" });
  assert.equal(projetarAcaoRestricao({ id: B, revisao: 3, confirmacao: "confirmada" }, A, 2, "confirmada"), null);
  assert.equal(projetarAcaoRestricao({ id: A, revisao: 5, confirmacao: "confirmada" }, A, 2, "confirmada"), null);
  assert.deepEqual(projetarRegistroProntuario({ id: A, revisao: 1, estado: "ativa", confirmacao: "pendente", chaveCriacao: "CANARIO" }),
    { id: A, revisao: 1, estado: "ativa", confirmacao: "pendente" });
  assert.equal(projetarRegistroProntuario({ id: A, revisao: 1, estado: "x", confirmacao: "pendente" }), null);
});

test("textos: rótulos humanos para cada valor, sem termo técnico; desconhecido neutro; aviso de que não há alerta automático", () => {
  for (const [natureza, subtipo] of [["clinica", "alergia_alimentar"], ["clinica", "intolerancia_alimentar"], ["clinica", "doenca_ou_condicao_com_restricao"],
    ["clinica", "outra_restricao_clinica"], ["escolha", undefined]] as const) assert.doesNotMatch(rotuloTipoRestricao(natureza, subtipo), /_/);
  for (const g of ["leve", "moderada", "grave", "nao_informada", undefined]) assert.doesNotMatch(rotuloGravidade(g), /_/);
  for (const o of ["profissional", "colaborador", "declaracao_paciente", "questionario_legado", "CANARIO"]) assert.doesNotMatch(rotuloOrigem(o), /_|CANARIO/);
  for (const [e, c] of [["ativa", "pendente"], ["ativa", "confirmada"], ["em_reavaliacao", "confirmada"], ["inativa", "confirmada"], ["ativa", "rejeitada"]])
    assert.doesNotMatch(rotuloEstadoRestricao(e, c), /_/);
  assert.equal(rotuloTipoRestricao("CANARIO" as never, undefined), "Tipo não reconhecido");
  assert.match(T.avisoSemAlerta, /não geram alerta automático/);
  assert.match(T.vazioAutoria, /Outros registros podem existir/);
  assert.match(textoSituacaoAvaliacao({ situacao: "restricoes_registradas", confirmadoEm: ISO, venceEm: "2027-05-09T10:00:00.000Z" }), /09\/05\/2027/);
  assert.doesNotMatch(textoSituacaoAvaliacao({ situacao: "nao_informado", confirmadoEm: null, venceEm: null }), /_/);
  const todos = Object.values(T).map((v) => (typeof v === "function" ? (v as (a: string, b?: string) => string)("x", "y") : v));
  for (const t of todos) assert.doesNotMatch(t, /uuid|tenant|revis[aã]o \d|409|403|nao_catalogado|declaracao_paciente|seguro|liberad/i, t);
});
