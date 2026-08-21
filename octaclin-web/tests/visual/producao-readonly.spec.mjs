import { expect, test } from "@playwright/test";

const habilitado = process.env.E2E_PRODUCAO_READONLY === "true";
const webUrl = process.env.E2E_WEB_URL?.trim();
const email = process.env.E2E_EMAIL?.trim();
const senha = process.env.E2E_SENHA;
const papel = process.env.E2E_PAPEL?.trim();

const modulosConsole = [
  { caminho: "/dashboard", titulo: "Hoje", rotulo: "Hoje" },
  { caminho: "/agenda", titulo: "Agenda", rotulo: "Agenda" },
  { caminho: "/pacientes", titulo: "Pacientes", rotulo: "Pacientes" },
  {
    caminho: "/questionarios",
    titulo: "Editor de Questionários",
    rotulo: "Formulários",
  },
  {
    caminho: "/comunicacoes",
    titulo: "Comunicações",
    rotulo: "Comunicações",
  },
  { caminho: "/automacoes", titulo: "Automações", rotulo: "Automações" },
  { caminho: "/ia", titulo: "Sugestões assistidas", rotulo: "IA assistida" },
  {
    caminho: "/gamificacao",
    titulo: "Metas e adesão",
    rotulo: "Metas e adesão",
  },
  {
    caminho: "/profissionais",
    titulo: "Profissionais",
    rotulo: "Profissionais",
  },
];

const perfis = {
  Professional: {
    modulos: modulosConsole,
    rotaNegada: "/operacoes",
    redirecionamento: "/dashboard",
    rotuloProibido: "Operações",
  },
  SuperAdmin: {
    modulos: [
      ...modulosConsole,
      {
        caminho: "/operacoes",
        titulo: "Confiabilidade OctaClin",
        rotulo: "Operações",
      },
    ],
    rotaNegada: "/cliente",
    redirecionamento: "/dashboard",
  },
  Client: {
    modulos: [{ caminho: "/cliente", titulo: "Portal do cliente" }],
    rotaNegada: "/dashboard",
    redirecionamento: "/cliente",
  },
  Patient: {
    modulos: [
      { caminho: "/portal", titulo: "Portal do paciente", rotulo: "Início" },
      {
        caminho: "/portal/agenda",
        titulo: "Portal do paciente",
        rotulo: "Agenda",
      },
      {
        caminho: "/portal/checkins",
        titulo: "Portal do paciente",
        rotulo: "Check-ins",
      },
      {
        caminho: "/portal/plano",
        titulo: "Portal do paciente",
        rotulo: "Plano",
      },
      {
        caminho: "/portal/formularios",
        titulo: "Portal do paciente",
        rotulo: "Formulários",
      },
      {
        caminho: "/portal/mensagens",
        titulo: "Portal do paciente",
        rotulo: "Mensagens",
      },
      {
        caminho: "/portal/perfil",
        titulo: "Portal do paciente",
        rotulo: "Perfil",
      },
      {
        caminho: "/portal/privacidade",
        titulo: "Portal do paciente",
        rotulo: "Privacidade",
      },
      { caminho: "/portal/mais", titulo: "Portal do paciente", rotulo: "Mais" },
    ],
    rotaNegada: "/dashboard",
    redirecionamento: "/portal",
  },
};

function validarConfiguracao() {
  if (!webUrl || !email || !senha || !papel) {
    throw new Error(
      "E2E_WEB_URL, E2E_EMAIL, E2E_SENHA e E2E_PAPEL sao obrigatorias para o smoke de producao.",
    );
  }

  if (!Object.hasOwn(perfis, papel)) {
    throw new Error(
      "E2E_PAPEL deve ser Professional, SuperAdmin, Client ou Patient.",
    );
  }

  const url = new URL(webUrl);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".onrender.com") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error(
      "E2E_WEB_URL deve ser a URL base HTTPS oficial do Render, sem credenciais ou caminho.",
    );
  }
}

test.describe("Fase 221 - producao autenticada somente leitura", () => {
  test.skip(
    !habilitado,
    "Execucao exclusiva e explicita contra producao isolada.",
  );

  test("papel acessa todos os modulos autorizados sem falha critica", async ({
    page,
  }) => {
    validarConfiguracao();
    const perfil = perfis[papel];

    const falhasHttp = [];
    const falhasRede = [];
    const errosPagina = [];
    const errosConsole = [];

    page.on("response", (resposta) => {
      const url = resposta.url();
      if (url.startsWith(webUrl) && resposta.status() >= 500) {
        falhasHttp.push(`${resposta.status()} ${new URL(url).pathname}`);
      }
    });
    page.on("requestfailed", (requisicao) => {
      const url = requisicao.url();
      const motivo = requisicao.failure()?.errorText ?? "falha sem motivo";
      if (url.startsWith(webUrl) && motivo !== "net::ERR_ABORTED") {
        falhasRede.push(
          `${requisicao.method()} ${new URL(url).pathname}: ${motivo}`,
        );
      }
    });
    page.on("pageerror", (erro) => errosPagina.push(erro.name));
    page.on("console", (mensagem) => {
      if (mensagem.type() === "error")
        errosConsole.push(mensagem.text().slice(0, 300));
    });

    await page.goto(`${webUrl}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(senha);
    const [respostaLogin] = await Promise.all([
      page.waitForResponse(
        (resposta) =>
          resposta.url() === `${webUrl}/api/auth/login` &&
          resposta.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Entrar", exact: true }).click(),
    ]);
    expect(
      respostaLogin.status(),
      "login profissional deve ser aceito",
    ).toBeLessThan(400);
    await expect.poll(() => new URL(page.url()).pathname).not.toBe("/login");

    const sessaoResposta = await page.request.get(`${webUrl}/api/auth/session`);
    expect(sessaoResposta.status()).toBe(200);
    const sessao = await sessaoResposta.json();
    expect(sessao.papel).toBe(papel);
    expect(sessao.email).toBe(email);

    for (const modulo of perfil.modulos) {
      const resposta = await page.goto(`${webUrl}${modulo.caminho}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      expect(
        resposta?.status(),
        `${modulo.caminho} deve responder sem redirecionamento de erro`,
      ).toBeLessThan(400);
      await expect(page).toHaveURL(`${webUrl}${modulo.caminho}`);
      await expect(page.locator("h1")).toHaveText(modulo.titulo);
      if (modulo.rotulo) {
        await expect(
          page.getByRole("link", { name: modulo.rotulo, exact: true }).first(),
        ).toBeVisible();
      }
      await expect(page.locator("body")).not.toContainText(
        /Internal server error|statusCode.?500|Falha HTTP 500/i,
      );
    }

    if (perfil.rotuloProibido) {
      await expect(
        page.getByRole("link", { name: perfil.rotuloProibido, exact: true }),
      ).toHaveCount(0);
    }

    await page.goto(`${webUrl}${perfil.rotaNegada}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(page).toHaveURL(`${webUrl}${perfil.redirecionamento}`);
    expect(falhasHttp, "respostas HTTP 5xx").toEqual([]);
    expect(falhasRede, "requisicoes de mesma origem que falharam").toEqual([]);
    expect(errosPagina, "excecoes JavaScript nao tratadas").toEqual([]);
    expect(errosConsole, "erros no console").toEqual([]);
  });
});
