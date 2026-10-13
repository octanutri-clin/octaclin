import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function preparar(page) {
  await page.context().addCookies([
    {
      name: "octaclin_access_token",
      value: "sintetico",
      domain: "localhost",
      path: "/",
    },
    {
      name: "octaclin_refresh_token",
      value: "sintetico",
      domain: "localhost",
      path: "/",
    },
    {
      name: "octaclin_papel",
      value: "Professional",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.route("**/api/**", (r) =>
    r.fulfill({
      status: 599,
      contentType: "application/json",
      body: JSON.stringify({ mensagem: "Endpoint sintético não configurado." }),
    }),
  );
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        autenticado: true,
        tenantSlug: "clinica-sintetica",
        email: "sintetico@example.test",
        apiUrl: "http://localhost:3001",
        papel: "Professional",
        permissoes: [
          "console.acessar",
          "integracoes.acessar",
          "ia.executar",
          "pacientes.gerenciar",
          "pacientes.ler",
          "pacientes.listar",
        ],
        destinoInicial: "/integracoes",
      }),
    }),
  );
  await page.route("**/api/profissional/integracoes/acesso", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ escoposApi: [], eventosWebhook: [] }),
    }),
  );
  await page.route("**/api/notificacoes**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ itens: [], naoLidas: 0 }),
    }),
  );
}
test("318 chave em memoria, limpa apos envio, erro sem segredo e acessibilidade", async ({
  page,
}) => {
  await preparar(page);
  let recebida = "";
  await page.route("**/api/ia/rascunhos", async (r) => {
    const d = r.request().postDataJSON();
    if (d.acao === "definir-credencial") {
      recebida = d.chave;
      await r.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          mensagem: "Cadastro aguarda revisão contratual.",
        }),
      });
    } else
      await r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          estado: "ausente",
          cadastroCredencialPermitido: true,
          versao: 0,
          contextoSessao: "a".repeat(64),
        }),
      });
  });
  await page.goto("/integracoes");
  const campo = page.getByLabel("Chave API individual");
  await expect(campo).toHaveAttribute("type", "password");
  await campo.fill("chave-sintetica-nao-valida");
  await page
    .getByRole("button", { name: "Cadastrar ou substituir chave" })
    .click();
  await expect(campo).toHaveValue("");
  await expect.poll(() => recebida).toBe("chave-sintetica-nao-valida");
  await expect(
    page.getByText("Cadastro aguarda revisão contratual."),
  ).toBeVisible();
  const persistencia = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(persistencia).not.toContain("chave-sintetica");
  expect(page.url()).not.toContain("chave-sintetica");
  const a = await new AxeBuilder({ page })
    .include('section[aria-labelledby="credencial-ia318"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(a.violations).toEqual([]);
});
async function prontuario(page) {
  await preparar(page);
  await page.route("**/api/pacientes/*/prontuario", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        paciente: {
          id: "10000000-0000-4000-8000-000000000001",
          nome: "Paciente Sintético",
          dataNascimento: "1990-01-01",
          statusAdesao: "ativo",
        },
        resumo: {
          consultas: 0,
          formulariosPendentes: 0,
          respostas: 0,
          mensagens: 0,
          leituraClinica: {
            deltaUltimaAvaliacao: [],
            deltaDesdeInicio: [],
            condutasVencendo: [],
          },
        },
        linhaDoTempo: [],
      }),
    }),
  );
  await page.route("**/api/pacientes/*/evolucoes", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}
const modelos = {
  contextoSessao: "a".repeat(64),
  modelos: [
    {
      id: "fixture",
      nome: "Modelo sintético",
      versao: "fixture-v1",
      padrao: true,
      maxOutputTokens: 512,
      precoEntradaMilhaoUsd: 0,
      precoSaidaMilhaoUsd: 0,
      precoEm: "2026-10-13",
    },
  ],
  configuracao: {
    habilitada: true,
    versao: 1,
    operacaoAprovada: true,
    maxChamadas15min: 5,
    maxTokensSaida: 512,
  },
};
const preview = {
  modalidade: "evolucao",
  texto: "<script>window.xss=true</script> Não refere náuseas.",
  provaRevisao: "prova-sintetica",
  expiraEm: "2099-01-01T00:00:00Z",
  itens: [
    {
      texto: "<script>window.xss=true</script> Não refere náuseas.",
      refs: ["F1"],
    },
  ],
  limitacoes: ["Revisão humana obrigatória."],
  referencias: [{ ref: "F1", tipo: "nota_profissional", data: "2026-01-01" }],
  modeloId: "fixture",
  versaoModelo: "fixture-v1",
};
test("318 previa selecionada nao executa HTML e confirma somente apos revisao", async ({
  page,
}) => {
  await prontuario(page);
  let confirmacoes = 0;
  await page.route("**/api/ia/rascunhos", async (r) => {
    const b = r.request().postDataJSON();
    let result = modelos;
    if (b.acao === "fontes") result = { fontes: [] };
    if (b.acao === "evolucao") {
      expect(b.textoProfissional).toBe("Não refere náuseas.");
      result = preview;
    }
    if (b.acao === "confirmar") {
      confirmacoes++;
      expect(b.confirmado).toBe(true);
      expect(b.titulo).toBe("Consulta sintética");
      result = { id: "sintetico" };
    }
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto("/pacientes/10000000-0000-4000-8000-000000000001");
  await page.getByRole("tab", { name: "Atendimentos", exact: true }).click();
  await page.getByRole("tab", { name: "Evoluções", exact: true }).click();
  await page.getByLabel("Finalidade").selectOption("evolucao");
  await page.getByLabel("Notas desta consulta").fill("Não refere náuseas.");
  await page
    .getByRole("button", { name: "Gerar rascunho com as fontes selecionadas" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Prévia para revisão" }),
  ).toBeVisible();
  expect(confirmacoes).toBe(0);
  expect(await page.evaluate(() => window.xss)).toBeUndefined();
  const save = page.getByRole("button", { name: "Confirmar evolução privada" });
  await expect(save).toBeDisabled();
  await page
    .getByLabel("Título para registrar o rascunho", { exact: true })
    .fill("Consulta sintética");
  await page.getByLabel("Conferi e assumo").check();
  await save.click();
  await expect(
    page.getByText("Evolução privada registrada após sua revisão."),
  ).toBeVisible();
  expect(confirmacoes).toBe(1);
  const a = await new AxeBuilder({ page })
    .include('section[aria-labelledby="ia318-heading"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(a.violations).toEqual([]);
});
test("318 sair da aba descarta resposta tardia e rascunho nao persiste", async ({
  page,
}) => {
  await prontuario(page);
  let liberar;
  const espera = new Promise((resolve) => {
    liberar = resolve;
  });
  let chegou = false;
  await page.route("**/api/ia/rascunhos", async (r) => {
    const b = r.request().postDataJSON();
    if (b.acao === "evolucao") {
      chegou = true;
      await espera;
      await r
        .fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(preview),
        })
        .catch(() => {});
    } else
      await r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(b.acao === "fontes" ? { fontes: [] } : modelos),
      });
  });
  await page.goto("/pacientes/10000000-0000-4000-8000-000000000001");
  await page.getByRole("tab", { name: "Atendimentos", exact: true }).click();
  await page.getByRole("tab", { name: "Evoluções", exact: true }).click();
  await page.getByLabel("Finalidade").selectOption("evolucao");
  await page.getByLabel("Notas desta consulta").fill("Não refere náuseas.");
  await page
    .getByRole("button", { name: "Gerar rascunho com as fontes selecionadas" })
    .click();
  await expect.poll(() => chegou).toBe(true);
  await page.getByRole("tab", { name: "Resumo", exact: true }).click();
  liberar();
  await page.getByRole("tab", { name: "Atendimentos", exact: true }).click();
  await page.getByRole("tab", { name: "Evoluções", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Prévia para revisão" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("Não refere náuseas");
});

test("318 troca de identidade durante geracao descarta previa e nota", async ({
  page,
}) => {
  await prontuario(page);
  let email = "a@example.test";
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        autenticado: true,
        tenantSlug: "clinica-sintetica",
        email,
        apiUrl: "http://localhost:3001",
        papel: "Professional",
        permissoes: [
          "console.acessar",
          "ia.executar",
          "pacientes.gerenciar",
          "pacientes.ler",
          "pacientes.listar",
        ],
        destinoInicial: "/pacientes",
      }),
    }),
  );
  await page.route("**/api/ia/rascunhos", async (r) => {
    const b = r.request().postDataJSON();
    if (b.acao === "evolucao") email = "b@example.test";
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        b.acao === "modelos"
          ? {
              ...modelos,
              contextoSessao: (email === "a@example.test" ? "a" : "b").repeat(
                64,
              ),
            }
          : b.acao === "fontes"
            ? { fontes: [] }
            : preview,
      ),
    });
  });
  await page.goto("/pacientes/10000000-0000-4000-8000-000000000001");
  await page.getByRole("tab", { name: "Atendimentos", exact: true }).click();
  await page.getByRole("tab", { name: "Evoluções", exact: true }).click();
  await page.getByLabel("Finalidade").selectOption("evolucao");
  await page.getByLabel("Notas desta consulta").fill("Não refere náuseas.");
  await page
    .getByRole("button", { name: "Gerar rascunho com as fontes selecionadas" })
    .click();
  await expect(
    page.getByText("Contexto da sessão mudou. Reabra o prontuário."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Prévia para revisão" }),
  ).toHaveCount(0);
});

test("318 cadastro bloqueado fica explicito e nao envia chave", async ({
  page,
}) => {
  await preparar(page);
  let mutacoes = 0;
  await page.route("**/api/ia/rascunhos", async (r) => {
    const d = r.request().postDataJSON();
    if (d.acao === "definir-credencial") mutacoes++;
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cadastroCredencialPermitido: false,
        contextoSessao: "a".repeat(64),
        estado: "ausente",
        versao: 0,
      }),
    });
  });
  await page.goto("/integracoes");
  await expect(
    page.getByText("Estado: ausente", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Chave API individual").fill("fixture-nao-valida");
  await expect(
    page.getByRole("button", { name: "Cadastrar ou substituir chave" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Cadastro bloqueado: aprovação contratual pendente."),
  ).toBeVisible();
  expect(mutacoes).toBe(0);
});

test("318 diretorio mostra identificadores autorizados para suporte", async ({
  page,
}) => {
  await preparar(page);
  const id = "11111111-1111-4111-8111-111111111111";
  const tenantId = "22222222-2222-4222-8222-222222222222";
  const usuarioId = "33333333-3333-4333-8333-333333333333";
  await page.route("**/api/profissionais**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        itens: [
          {
            id,
            tenantId,
            usuarioId,
            nome: "Profissional sintético",
            criadoEm: "2026-01-01T09:00:00Z",
          },
        ],
        total: 1,
      }),
    }),
  );
  await page.goto("/profissionais");
  await page.getByText("Identificadores para suporte", { exact: true }).click();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
  await expect(page.getByText(tenantId, { exact: true })).toBeVisible();
  await expect(page.getByText(usuarioId, { exact: true })).toBeVisible();
});

test("318 metas e adesao mostra erro operacional sem JSON bruto", async ({
  page,
}) => {
  await preparar(page);
  await page.route("**/api/gamificacao/configuracao", (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        statusCode: 500,
        message: "Internal server error",
      }),
    }),
  );
  await page.goto("/gamificacao");
  await expect(
    page.getByText(
      "Não foi possível carregar metas e adesão. Tente novamente em alguns instantes.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText('{"statusCode":500,"message":"Internal server error"}', {
      exact: true,
    }),
  ).toHaveCount(0);
});
