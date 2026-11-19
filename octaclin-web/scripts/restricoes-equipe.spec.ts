import assert from "node:assert/strict";
import test from "node:test";
import {
  LIMITE_DELEGACOES,
  montarBuscaRepresentante,
  montarConcessaoDelegacao,
  montarRegistroRepresentante,
  projetarCandidatoRepresentante,
  projetarCandidatosDelegacao,
  projetarDelegacaoUnica,
  projetarDelegacoes,
  projetarRepresentanteUnico,
  projetarRepresentantes,
  textoIdentificacao,
} from "../lib/restricoes-equipe";
import { TEXTOS_EQUIPE_RESTRICOES, rotuloVerificacao } from "../lib/textos-equipe-restricoes";

/** FOOD06 P3-6: projeções e entradas das telas de equipe. Dados sintéticos; canários provam o que nunca passa. */
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ISO = "2026-11-10T10:00:00.000Z";

test("delegações: allowlist com e-mail completo; item ou formato inesperado falha fechado", () => {
  const r = projetarDelegacoes({
    itens: [
      { id: A, colaboradorUsuarioId: B, colaboradorEmail: "carla@example.test", concedidaEm: ISO, interno: "CANARIO" },
    ],
  });
  assert.deepEqual(r, { itens: [{ id: A, colaboradorUsuarioId: B, email: "carla@example.test", concedidaEm: ISO }] });
  assert.equal(projetarDelegacoes({ itens: [{ id: B, colaboradorUsuarioId: A, colaboradorEmail: "sem-arroba", concedidaEm: ISO }] }), null);
  assert.equal(projetarDelegacoes({ itens: {} }), null);
  assert.equal(projetarDelegacoes(null), null);
  assert.deepEqual(projetarDelegacaoUnica({ id: A, colaboradorUsuarioId: B, colaboradorEmail: "carla@example.test", concedidaEm: ISO, x: "CANARIO" }),
    { id: A, colaboradorUsuarioId: B, email: "carla@example.test", concedidaEm: ISO });
  assert.equal(projetarDelegacaoUnica({ id: A }), null);
  assert.equal(LIMITE_DELEGACOES, 100);
});

test("candidatos a colaborador: só usuarioId e e-mail; noLimite precisa ser booleano", () => {
  assert.deepEqual(projetarCandidatosDelegacao({ itens: [{ usuarioId: A, email: "bia@example.test", role: "CANARIO" }], noLimite: true }),
    { itens: [{ usuarioId: A, email: "bia@example.test" }], noLimite: true });
  assert.equal(projetarCandidatosDelegacao({ itens: [] }), null);
});

test("concessão: exatamente { colaboradorUsuarioId } com UUID", () => {
  assert.deepEqual(montarConcessaoDelegacao({ colaboradorUsuarioId: A }), { colaboradorUsuarioId: A });
  for (const ruim of [{}, { colaboradorUsuarioId: "x" }, { colaboradorUsuarioId: A, tenantId: B }, { colaboradorUsuarioId: A, profissionalId: B }, null, []])
    assert.equal(montarConcessaoDelegacao(ruim), null, JSON.stringify(ruim));
});

const nome = { tipo: "nome_ficha", nome: "Helena Sintética" };
const mascarado = { tipo: "email_mascarado", email: "h***@e***.test" };

test("representantes: allowlist com identificação fechada; identificação desconhecida derruba a lista", () => {
  const r = projetarRepresentantes({
    itens: [
      { id: A, representanteUsuarioId: B, tipoVerificacao: "presencial", verificadoEm: ISO, identificacao: { ...nome, interno: "CANARIO" }, revogadoPor: "CANARIO" },
      { id: B, representanteUsuarioId: A, tipoVerificacao: "procuracao", verificadoEm: ISO, identificacao: mascarado },
    ],
  });
  assert.deepEqual(r, { itens: [
    { id: A, representanteUsuarioId: B, tipoVerificacao: "presencial", verificadoEm: ISO, identificacao: nome },
    { id: B, representanteUsuarioId: A, tipoVerificacao: "procuracao", verificadoEm: ISO, identificacao: mascarado },
  ] });
  assert.ok(!JSON.stringify(r).includes("CANARIO"));
  assert.equal(projetarRepresentantes({ itens: [{ id: B, representanteUsuarioId: A, tipoVerificacao: "procuracao", verificadoEm: ISO,
    identificacao: { tipo: "email", email: "CANARIO@example.test" } }] }), null);
  assert.equal(projetarRepresentantes({}), null);
  assert.deepEqual(projetarRepresentanteUnico({ id: A, representanteUsuarioId: B, tipoVerificacao: "outro", verificadoEm: ISO, identificacao: mascarado }),
    { id: A, representanteUsuarioId: B, tipoVerificacao: "outro", verificadoEm: ISO, identificacao: mascarado });
});

test("candidato a representante: null é resposta válida; identificação fora do formato falha fechado", () => {
  assert.deepEqual(projetarCandidatoRepresentante({ candidato: null }), { candidato: null });
  assert.deepEqual(projetarCandidatoRepresentante({ candidato: { usuarioId: A, identificacao: nome, role: "CANARIO" } }), { candidato: { usuarioId: A, identificacao: nome } });
  assert.equal(projetarCandidatoRepresentante({ candidato: { usuarioId: A, identificacao: { tipo: "x" } } }), null);
  assert.equal(projetarCandidatoRepresentante({}), null);
});

test("busca: exatamente { email } normalizado; formato inválido ou campo extra recusado", () => {
  assert.deepEqual(montarBuscaRepresentante({ email: "  Helena@Example.TEST " }), { email: "helena@example.test" });
  for (const ruim of [{}, { email: "" }, { email: "sem-arroba" }, { email: "a b@example.test" }, { email: `${"a".repeat(250)}@example.test` },
    { email: "a@example.test", pacienteId: A }, { email: 42 }])
    assert.equal(montarBuscaRepresentante(ruim), null, JSON.stringify(ruim));
});

test("registro: exatamente { representanteUsuarioId, tipoVerificacao } da lista fechada", () => {
  assert.deepEqual(montarRegistroRepresentante({ representanteUsuarioId: A, tipoVerificacao: "documento_apresentado" }),
    { representanteUsuarioId: A, tipoVerificacao: "documento_apresentado" });
  for (const ruim of [{ representanteUsuarioId: A, tipoVerificacao: "CANARIO" }, { representanteUsuarioId: "x", tipoVerificacao: "outro" },
    { representanteUsuarioId: A, tipoVerificacao: "outro", tenantId: B }])
    assert.equal(montarRegistroRepresentante(ruim), null, JSON.stringify(ruim));
});

test("textos: identificação legível, verificação traduzida, nenhum termo técnico", () => {
  assert.equal(textoIdentificacao(nome as never), "Helena Sintética");
  assert.equal(textoIdentificacao(mascarado as never), "Conta h***@e***.test");
  for (const tipo of ["documento_apresentado", "presencial", "procuracao", "outro"]) assert.doesNotMatch(rotuloVerificacao(tipo), /_/);
  assert.equal(rotuloVerificacao("CANARIO"), "Verificação registrada");
  const todos = Object.values(TEXTOS_EQUIPE_RESTRICOES).map((v) => (typeof v === "function" ? (v as (x: string) => string)("x@example.test") : v));
  for (const t of todos) for (const proibido of [/uuid|tenant|revis[aã]o|409|403|429|nome_ficha|email_mascarado|Collaborator|Professional/i])
    assert.doesNotMatch(t, proibido, t);
  // A delegação vale para todos os pacientes, inclusive futuros (decisão do plano §5).
  assert.match(TEXTOS_EQUIPE_RESTRICOES.avisoDelegacao, /inclusive os futuros/);
});

test("R4 (MÉDIA): e-mail com a mesma regra do backend; item inválido derruba a lista inteira (falha fechado)", () => {
  // O backend aceita 3..254 com "@" (sem exigir ponto no domínio); a web não pode esconder uma delegação vigente.
  assert.deepEqual(projetarDelegacoes({ itens: [{ id: A, colaboradorUsuarioId: B, colaboradorEmail: "x@localhost", concedidaEm: ISO }] }),
    { itens: [{ id: A, colaboradorUsuarioId: B, email: "x@localhost", concedidaEm: ISO }] });
  assert.equal(projetarDelegacoes({ itens: [{ id: A, colaboradorUsuarioId: B, colaboradorEmail: "x@localhost", concedidaEm: ISO }, { id: "x" }] }), null);
  assert.equal(projetarCandidatosDelegacao({ itens: [{ usuarioId: "x", email: "a@b" }], noLimite: false }), null);
  assert.deepEqual(projetarCandidatosDelegacao({ itens: [{ usuarioId: A, email: "a@b" }], noLimite: false }), { itens: [{ usuarioId: A, email: "a@b" }], noLimite: false });
  assert.equal(projetarRepresentantes({ itens: [{ id: A }] }), null);
});
