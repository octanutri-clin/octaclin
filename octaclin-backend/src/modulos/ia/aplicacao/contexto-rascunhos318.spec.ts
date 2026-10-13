import { contextoSessao318 } from "../dominio/rascunhos-clinicos";
import { ContextoRascunhos318 } from "./contexto-rascunhos318";
import { ConteudoRascunhos318 } from "../dominio/rascunhos-clinicos";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
const u = {
  tenantId: "tenant-sintetico",
  usuarioId: "usuario-sintetico",
  papel: "Professional",
  permissoes: ["ia.executar", "pacientes.gerenciar"],
  emailHash: "",
} as never;
function fixture(direitos = true, config: any = undefined) {
  const auditorias: any[] = [];
  let row: any;
  const m = {
    getRepository: () => ({
      create: (v: any) => v,
      save: async (v: any) => {
        auditorias.push(v);
        return v;
      },
    }),
    query: async (sql: string, args: any[]) => {
      if (sql.includes("from tenant_configuracoes"))
        return config ? [{ valor: config }] : [];
      if (sql.includes("from profissionais pr"))
        return [
          {
            id: "prof-sintetico",
            versao_contexto_ia318: "0",
            usuario_versao: "0",
            tenant_versao: "0",
          },
        ];
      if (sql.includes("from credenciais_ia318")) return row ? [row] : [];
      if (sql.includes("insert into credenciais_ia318")) {
        row = {
          usuario_id: args[2],
          chave_criptografada: args[3],
          versao: (row?.versao ?? 0) + 1,
        };
        return [];
      }
      return [];
    },
  };
  const ex = { executar: async (_t: string, op: Function) => op(m) };
  const c = new ContextoRascunhos318(
    ex as never,
    new ConteudoRascunhos318(new CriptografiaDadosSensiveis()),
    direitos,
    [],
  );
  return { c, m, auditorias, obterRow: () => row };
}
describe("credencial318 privada", () => {
  it("cifra chave e responde somente estado/versao", async () => {
    const f = fixture();
    expect(
      await f.c.definirCredencial(u, {
        chave: "chave-sintetica-sem-valor",
        contextoSessao: contextoSessao318(u),
        versaoEsperada: 0,
      }),
    ).toEqual({ estado: "cadastrada", versao: 1 });
    expect(f.obterRow().chave_criptografada.toString()).not.toContain(
      "chave-sintetica-sem-valor",
    );
    expect(await f.c.obterCredencial(u)).toEqual({
      estado: "cadastrada",
      versao: 1,
    });
  });
  it("audita alteracao sem chave ou derivado", async () => {
    const f = fixture();
    await f.c.definirCredencial(u, {
      chave: "chave-sintetica-sem-valor",
      contextoSessao: contextoSessao318(u),
      versaoEsperada: 0,
    });
    expect(f.auditorias).toHaveLength(1);
    expect(JSON.stringify(f.auditorias)).not.toContain(
      "chave-sintetica-sem-valor",
    );
  });
  it("CAS recusa substituir versao antiga", async () => {
    const f = fixture();
    await f.c.definirCredencial(u, {
      chave: "chave-sintetica-sem-valor",
      contextoSessao: contextoSessao318(u),
      versaoEsperada: 0,
    });
    await expect(
      f.c.definirCredencial(u, {
        chave: "outra-sintetica",
        versaoEsperada: 0,
        contextoSessao: contextoSessao318(u),
      }),
    ).rejects.toThrow();
  });
  it("gate contratual bloqueia cadastro mesmo com flag ambiente", async () => {
    const f = fixture(false);
    await expect(
      f.c.definirCredencial(u, {
        chave: "chave-sintetica-sem-valor",
        contextoSessao: contextoSessao318(u),
        versaoEsperada: 0,
      }),
    ).rejects.toThrow();
    expect(f.obterRow()).toBeUndefined();
  });
  it("SuperAdmin nao usa ou le credencial de profissional", async () => {
    await expect(
      fixture().c.obterCredencial({ ...(u as any), papel: "SuperAdmin" }),
    ).rejects.toThrow();
  });
  it("modelos assistenciais indisponiveis mantem operacao bloqueada", () =>
    expect(fixture().c.operacaoAprovada()).toBe(false));
  it("configuracao malformada nao habilita geracao", async () => {
    const f = fixture(true, { habilitada: true, versao: "invalida" });
    expect((await f.c.config(f.m as never, "tenant")).habilitada).toBe(false);
  });
  it("quota configuravel preserva teto tecnico", async () => {
    const f = fixture(true, {
      habilitada: false,
      versao: 1,
      maxChamadas15min: 2,
      maxTokensSaida: 512,
    });
    expect(await f.c.config(f.m as never, "tenant")).toMatchObject({
      maxChamadas15min: 2,
      maxTokensSaida: 512,
    });
  });
  it("gestor nao seleciona outra clinica pela rota operacional", async () => {
    await expect(
      fixture().c.configurarOperacoes(
        {
          ...(u as any),
          papel: "Client",
          permissoes: ["cliente.configuracoes.gerenciar"],
        },
        "outra",
      ),
    ).rejects.toThrow("Acesso operacional");
  });
  it("sessao revogada nega acesso antes da credencial", async () => {
    await expect(
      fixture().c.obterCredencial({ ...(u as any), sessaoId: "revogada" }),
    ).rejects.toThrow("Sessão");
  });
  it("cadastro nao atravessa troca de sessao da tela", async () => {
    await expect(
      fixture().c.definirCredencial(u, {
        chave: "fixture-sintetica",
        versaoEsperada: 0,
        contextoSessao: "b".repeat(64),
      } as never),
    ).rejects.toThrow("sessão");
  });
});
