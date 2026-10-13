import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function setup(page) {
  await page
    .context()
    .addCookies(
      ["octaclin_access_token", "octaclin_refresh_token"]
        .map((name) => ({
          name,
          value: "sintetico",
          domain: "localhost",
          path: "/",
        }))
        .concat([
          {
            name: "octaclin_papel",
            value: "Professional",
            domain: "localhost",
            path: "/",
          },
        ]),
    );
  await page.route("**/api/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        autenticado: true,
        tenantSlug: "clinica-sintetica",
        email: "sintetico@example.test",
        apiUrl: "http://localhost:3001",
        destinoInicial: "/integracoes",
        papel: "Professional",
        permissoes: [
          "console.acessar",
          "integracoes.acessar",
          "ia.executar",
          "pacientes.gerenciar",
        ],
        itens: [],
        escoposApi: [],
        eventosWebhook: [],
        estado: "ausente",
        versao: 0,
        contextoSessao: "a".repeat(64),
        cadastroCredencialPermitido: false,
      }),
    }),
  );
}
test("318 piloto compara somente corpus do servidor, sem gravação e com acessibilidade", async ({
  page,
}) => {
  await setup(page);
  const bodies = [];
  await page.route("**/api/ia/rascunhos", async (r) => {
    const d = r.request().postDataJSON();
    bodies.push(d);
    let v = {
      estado: "ausente",
      versao: 0,
      contextoSessao: "a".repeat(64),
      cadastroCredencialPermitido: false,
    };
    if (d.acao === "piloto-catalogo")
      v = {
        ...v,
        chamadaPermitida: false,
        modelos: [],
        corpus: "318-sintetico-v1",
        casos: [
          {
            id: "C06",
            titulo: "Medida isolada",
            geravel: true,
            criterios: ["Não calcular IMC."],
          },
          {
            id: "C27",
            titulo: "Transferência",
            geravel: false,
            criterios: ["Descartar resultado antigo."],
          },
        ],
      };
    if (d.acao === "piloto-previa")
      v = {
        casoId: "C06",
        corpus: "318-sintetico-v1",
        chamadaPermitida: false,
        prova: "sintetica",
        fontes: [
          {
            ref: "F1",
            tipo: "medida",
            data: "2026-01-10",
            texto: "Peso 70,4 kg; altura não informada.",
          },
        ],
        criterios: ["Não calcular IMC."],
        baseline: {
          itens: [
            { texto: "Peso 70,4 kg; altura não informada.", refs: ["F1"] },
          ],
          limitacoes: ["Composição factual local."],
        },
      };
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(v),
    });
  });
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Abrir revisão sintética" }).click();
  await page.getByLabel("Caso sintético").selectOption("C06");
  await page
    .getByRole("button", { name: "Conferir fontes e composição local" })
    .click();
  const area = page.getByRole("region", {
    name: "Revisão sintética da assistência",
  });
  await expect(
    area.getByRole("heading", { name: "Fontes sintéticas" }),
  ).toBeVisible();
  await expect(
    area.getByRole("heading", { name: "Composição factual local" }),
  ).toBeVisible();
  await expect(
    area.getByRole("button", { name: "Gerar comparação OpenAI" }),
  ).toBeDisabled();
  await expect(
    area.getByText("OpenAI aguarda revisão contratual e catálogo aprovado."),
  ).toBeVisible();
  expect(bodies.filter((b) => b.acao === "piloto-previa")).toEqual([
    { acao: "piloto-previa", casoId: "C06", contextoSessao: "a".repeat(64) },
  ]);
  expect(bodies.some((b) => JSON.stringify(b).includes("pacienteId"))).toBe(
    false,
  );
  expect(
    await area.getByRole("button", { name: /salvar|confirmar/i }).count(),
  ).toBe(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('section[aria-labelledby="piloto-sintetico318"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await area
    .getByLabel("Notas da revisão sintética")
    .fill("Conferência sintética local.");
  await area.getByRole("button", { name: "Fechar e limpar revisão" }).click();
  await expect(area.getByLabel("Notas da revisão sintética")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("Conferência sintética");
});
test("318 piloto indisponível exibe erro sem fontes nem credencial de outros usuários", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/ia/rascunhos", (r) =>
    r.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        mensagem: "Função indisponível: confira vínculo e liberações.",
      }),
    }),
  );
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Abrir revisão sintética" }).click();
  const area = page.getByRole("region", {
    name: "Revisão sintética da assistência",
  });
  await expect(area.getByRole("alert")).toHaveText(
    "Função indisponível: confira vínculo e liberações.",
  );
  await expect(area.getByLabel("Caso sintético")).toHaveCount(0);
});
test("318 piloto limpa revisão e chave transitória quando sessão muda no foco", async ({
  page,
}) => {
  await setup(page);
  let marcador = "a".repeat(64);
  await page.route("**/api/ia/rascunhos", (r) => {
    const d = r.request().postDataJSON();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        d.acao === "piloto-catalogo"
          ? {
              contextoSessao: marcador,
              corpus: "318-sintetico-v1",
              casos: [
                { id: "C06", titulo: "Medida", geravel: true, criterios: [] },
              ],
              modelos: [],
              chamadaPermitida: false,
            }
          : { estado: "ausente", versao: 0, contextoSessao: marcador },
      ),
    });
  });
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Abrir revisão sintética" }).click();
  const area = page.getByRole("region", {
    name: "Revisão sintética da assistência",
  });
  await expect(area.getByLabel("Caso sintético")).toBeVisible();
  await area
    .getByLabel("Chave API individual")
    .fill("chave-sintetica-transitoria");
  marcador = "b".repeat(64);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(area.getByLabel("Caso sintético")).toHaveCount(0);
  await expect(area.getByLabel("Chave API individual")).toHaveCount(0);
  await expect(area.getByRole("alert")).toContainText("Sessão mudou");
});
test("318 piloto descarta prévia recebida após mudança de sessão", async ({
  page,
}) => {
  await setup(page);
  let marcador = "a".repeat(64);
  await page.route("**/api/ia/rascunhos", (r) => {
    const d = r.request().postDataJSON();
    if (d.acao === "piloto-previa") {
      marcador = "b".repeat(64);
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          casoId: "C06",
          fontes: [],
          criterios: [],
          baseline: {
            itens: [{ texto: "Resposta antiga sintética", refs: ["F1"] }],
            limitacoes: [],
          },
          prova: "fixture",
        }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        d.acao === "piloto-catalogo"
          ? {
              contextoSessao: marcador,
              corpus: "318-sintetico-v1",
              casos: [
                { id: "C06", titulo: "Medida", geravel: true, criterios: [] },
              ],
              modelos: [],
              chamadaPermitida: false,
            }
          : { estado: "ausente", versao: 0 },
      ),
    });
  });
  await page.goto("/integracoes");
  await page.getByRole("button", { name: "Abrir revisão sintética" }).click();
  await page.getByLabel("Caso sintético").selectOption("C06");
  await page
    .getByRole("button", { name: "Conferir fontes e composição local" })
    .click();
  const area = page.getByRole("region", {
    name: "Revisão sintética da assistência",
  });
  await expect(area.getByRole("alert")).toContainText("Sessão mudou");
  await expect(area.getByText("Resposta antiga sintética")).toHaveCount(0);
});
