import assert from "node:assert/strict";
import test from "node:test";
import {
  ERROS_RESTRICOES,
  TEXTOS_PORTAL_RESTRICOES,
  textoPedidoPortal,
  textoSeloPortal,
  tituloGrupoPortal,
  type ContextoPessoaPortal,
} from "../lib/textos-restricoes";
import {
  CHAVES_SELO_PORTAL,
  CHAVES_SOLICITACAO_PORTAL,
  projetarPedidosPortal,
  projetarResumoPortal,
  projetarSeletorPortal,
} from "../lib/restricoes-portal";

const propria: ContextoPessoaPortal = { representante: false, nome: "Júlia Sintética" };
const representada: ContextoPessoaPortal = { representante: true, nome: "Ana Sintética" };
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

// Termos que nunca podem chegar ao paciente (critérios 24 e 28 do contrato v3; Q11).
const PROIBIDOS = [
  /criada|em_analise|cancelada_pelo_paciente|nao_catalogado|declaracao_paciente|pendente|confirmada\b/i,
  // "escolha" também é palavra do texto aprovado ("evita por escolha"); barra-se só a forma técnica.
  /\b(clinica|preferencia|categoria_escolha|alergia_alimentar|intolerancia_alimentar|outra_restricao_clinica)\b/,
  /restricoes\.(portal|solicitacao)\./,
  /seguro|liberad|permitid/i,
  /religi/i,
  /revis[aã]o \d|revisao|tenant|uuid|409|403/i,
];

function todosOsTextos(ctx: ContextoPessoaPortal): string[] {
  const textos: string[] = [];
  for (const chave of CHAVES_SELO_PORTAL) textos.push(textoSeloPortal(chave, ctx));
  for (const chaveTexto of CHAVES_SOLICITACAO_PORTAL)
    for (const tipo of ["correcao", "remocao"] as const)
      for (const podeCancelar of [true, false]) {
        const t = textoPedidoPortal({ chaveTexto, tipo, podeCancelar }, ctx);
        textos.push(t.titulo, t.apoio ?? "");
      }
  for (const grupo of ["alergias", "intolerancias", "outras", "escolhas"] as const)
    textos.push(tituloGrupoPortal(grupo, ctx));
  for (const valor of Object.values(TEXTOS_PORTAL_RESTRICOES))
    textos.push(typeof valor === "function" ? (valor as (c: ContextoPessoaPortal, d: string) => string)(ctx, "12/09/2026") : valor);
  textos.push(...Object.values(ERROS_RESTRICOES));
  return textos;
}

test("toda chave do backend tem texto próprio e nenhum texto expõe estado interno ou código", () => {
  for (const ctx of [propria, representada]) {
    const textos = todosOsTextos(ctx);
    for (const texto of textos)
      for (const proibido of PROIBIDOS)
        assert.doesNotMatch(texto, proibido, `texto proibido: ${texto}`);
  }
  const estados = new Set(
    CHAVES_SOLICITACAO_PORTAL.map(
      (chaveTexto) => textoPedidoPortal({ chaveTexto, tipo: "correcao", podeCancelar: false }, propria).titulo,
    ),
  );
  assert.equal(estados.size, CHAVES_SOLICITACAO_PORTAL.length, "cada estado tem texto distinto");
});

test("textos decididos pelo proprietário (D7-a, Q11, Q-D1, Q-D2)", () => {
  assert.equal(textoSeloPortal("restricoes.portal.registrada", propria), "Restrição registrada no seu acompanhamento");
  assert.equal(
    textoSeloPortal("restricoes.portal.registrada", representada),
    "Restrição registrada no acompanhamento de Ana Sintética",
  );
  assert.equal(
    textoSeloPortal("restricoes.portal.informada_por_voce", propria),
    "Informação enviada pelo portal; ainda será conferida",
  );
  assert.equal(
    textoSeloPortal("restricoes.portal.anotada_pela_equipe", propria),
    "Anotado por quem faz seu acompanhamento; ainda será conferido",
  );
  const p = (chaveTexto: string, podeCancelar = false) =>
    textoPedidoPortal({ chaveTexto, tipo: "correcao", podeCancelar }, propria).titulo;
  assert.equal(p("restricoes.solicitacao.enviada", true), "Você pediu uma correção");
  assert.equal(p("restricoes.solicitacao.analisando", true), "Sua solicitação está sendo analisada");
  assert.equal(p("restricoes.solicitacao.atendida"), "Sua informação foi atualizada");
  assert.equal(p("restricoes.solicitacao.parcial"), "Sua informação foi atualizada parcialmente");
  assert.equal(p("restricoes.solicitacao.recusada"), "Sua solicitação foi analisada e não houve alteração");
  // P3-1: sem o botão de pedir correção, a abertura não pede essa ação (PUX-10); a P3-2 devolve o texto aprovado.
  assert.doesNotMatch(TEXTOS_PORTAL_RESTRICOES.abertura(propria), /Solicite/);
  assert.match(TEXTOS_PORTAL_RESTRICOES.ultimaConfirmacao(propria, "12/09/2026"), /ainda não foram confirmados/);
});

test("'Você pediu' só para o autor com o pedido aberto; pedido alheio não é atribuído", () => {
  const alheio = textoPedidoPortal(
    { chaveTexto: "restricoes.solicitacao.enviada", tipo: "remocao", podeCancelar: false },
    representada,
  );
  assert.doesNotMatch(alheio.titulo, /Você/);
  assert.match(alheio.titulo, /outra pessoa que acompanha Ana Sintética/);
  const decidido = textoPedidoPortal(
    { chaveTexto: "restricoes.solicitacao.cancelada", tipo: "correcao", podeCancelar: false },
    propria,
  );
  assert.doesNotMatch(decidido.titulo, /Você/);
});

test("chave desconhecida falha fechado com texto neutro, sem eco da chave", () => {
  const selo = textoSeloPortal("restricoes.portal.inexistente_CANARIO", propria);
  assert.doesNotMatch(selo, /CANARIO|restricoes\./);
  const pedido = textoPedidoPortal({ chaveTexto: "x.CANARIO", tipo: "correcao", podeCancelar: true }, propria);
  assert.doesNotMatch(pedido.titulo, /CANARIO|Você/);
});

test("representante lê o nome da pessoa no lugar de 'você'", () => {
  assert.equal(tituloGrupoPortal("escolhas", propria), "Alimentos que você evita por escolha");
  assert.equal(tituloGrupoPortal("escolhas", representada), "Alimentos que Ana Sintética evita por escolha");
});

const itemBackend = (sobrescrever: Record<string, unknown> = {}) => ({
  id: UUID_A,
  selo: "restricoes.portal.registrada",
  natureza: "clinica",
  subtipoClinico: "alergia_alimentar",
  alvo: { tipo: "nao_catalogado" },
  alvoDeclarado: "Amendoim",
  gravidade: "leve",
  observacao: "CANARIO_OBSERVACAO",
  justificativa: "CANARIO_JUSTIFICATIVA",
  revisao: 7,
  origem: "profissional",
  autor: "CANARIO_AUTOR",
  ...sobrescrever,
});

test("resumo do portal: só id, grupo, alimento e selo; nunca gravidade, observação, autor, revisão ou origem", () => {
  const r = projetarResumoPortal({
    restricoes: [
      itemBackend(),
      itemBackend({ id: UUID_B, natureza: "escolha", subtipoClinico: undefined, alvo: { tipo: "categoria_escolha", id: "carne.vermelha" }, alvoDeclarado: undefined, selo: "restricoes.portal.informada_por_voce" }),
    ],
    ultimaConfirmacaoEm: "2026-09-12T10:00:00.000Z",
    tenantId: "CANARIO_TENANT",
  });
  assert.ok(r);
  assert.deepEqual(Object.keys(r!).sort(), ["itens", "ultimaConfirmacaoEm"]);
  assert.deepEqual(r!.itens[0], { id: UUID_A, grupo: "alergias", alimento: "Amendoim", chaveSelo: "restricoes.portal.registrada" });
  assert.equal(r!.itens[1].grupo, "escolhas");
  assert.doesNotMatch(r!.itens[1].alimento, /carne\.vermelha/);
  const serializado = JSON.stringify(r);
  for (const proibido of ["CANARIO", "leve", "gravidade", "revisao", "origem", "clinica", "alergia_alimentar", "carne.vermelha"])
    assert.ok(!serializado.includes(proibido), `vazou ${proibido}`);
});

test("resumo do portal: formato inválido falha fechado (null), item inválido é descartado só se o id for inválido", () => {
  assert.equal(projetarResumoPortal(null), null);
  assert.equal(projetarResumoPortal({ restricoes: "x" }), null);
  const r = projetarResumoPortal({ restricoes: [itemBackend({ id: "../x" }), itemBackend({ selo: "restricoes.portal.CANARIO" })] });
  assert.ok(r);
  assert.equal(r!.itens.length, 1);
  assert.equal(r!.itens[0].chaveSelo, "desconhecido");
  assert.equal(r!.ultimaConfirmacaoEm, undefined);
});

test("pedidos do portal: allowlist, explicação só quando decidido, chave desconhecida neutra", () => {
  const r = projetarPedidosPortal({
    itens: [
      { id: UUID_A, tipo: "correcao", chaveTexto: "restricoes.solicitacao.atendida", criadoEm: "2026-11-01T10:00:00.000Z", decididoEm: "2026-11-02T10:00:00.000Z", explicacao: "Atualizamos o registro.", podeCancelar: false, justificativaInterna: "CANARIO_INTERNA", estado: "atendida", desfecho: { alterados: [] } },
      { id: UUID_B, tipo: "remocao", chaveTexto: "restricoes.solicitacao.enviada", criadoEm: "2026-11-03T10:00:00.000Z", explicacao: "CANARIO_SEM_DECISAO", podeCancelar: true },
    ],
    maisAntigos: true,
  });
  assert.ok(r);
  assert.equal(r!.maisAntigos, true);
  assert.deepEqual(Object.keys(r!.itens[0]).sort(), ["chaveTexto", "criadoEm", "decididoEm", "explicacao", "id", "podeCancelar", "tipo"]);
  assert.equal(r!.itens[1].explicacao, undefined);
  assert.ok(!JSON.stringify(r).includes("CANARIO"));
  assert.equal(projetarPedidosPortal({ itens: {} }), null);
});

test("seletor do portal: só pacienteId, via e nome; corta e avisa acima de 101", () => {
  const itens = Array.from({ length: 101 }, (_, i) => ({
    pacienteId: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
    via: i === 0 ? "propria" : "representante",
    nome: `Pessoa ${i}`,
    cpf: "CANARIO_CPF",
  }));
  const r = projetarSeletorPortal({ itens });
  assert.ok(r);
  assert.equal(r!.itens.length, 101);
  assert.equal(r!.noLimite, true);
  assert.deepEqual(Object.keys(r!.itens[0]).sort(), ["nome", "pacienteId", "via"]);
  assert.ok(!JSON.stringify(r).includes("CANARIO"));
  assert.equal(projetarSeletorPortal({ itens: [{ pacienteId: UUID_A, via: "outra", nome: "x" }] })!.itens.length, 0);
});
