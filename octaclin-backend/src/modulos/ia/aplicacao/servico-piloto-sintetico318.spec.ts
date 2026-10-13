import { ServicoPilotoSintetico318 } from "./servico-piloto-sintetico318";
import {
  ConteudoRascunhos318,
  contextoSessao318,
} from "../dominio/rascunhos-clinicos";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
const u: any = {
  tenantId: "tenant-fixture",
  usuarioId: "usuario-fixture",
  sessaoId: "sessao-fixture",
  papel: "Professional",
  permissoes: ["ia.executar", "pacientes.gerenciar"],
};
function fixture(permitido = true, direitos = false) {
  let config: any = {
    habilitada: permitido,
    usuarioId: u.usuarioId,
    profissionalId: "prof-fixture",
    versao: 1,
  };
  let versao = "1";
  let ledger: any;
  const queries: string[] = [];
  const auditorias: any[] = [];
  let falhaAuditoria = false;
  const m: any = {
    getRepository: () => ({
      create: (v: any) => v,
      save: async (v: any) => {
        if (falhaAuditoria) throw new Error("Auditoria indisponível");
        auditorias.push(v);
        return v;
      },
    }),
    query: async (sql: string, args: any[]) => {
      queries.push(sql);
      if (sql.includes("select valor"))
        return [
          {
            valor: sql.includes("chave='ia318_piloto_sintetico'")
              ? config
              : ledger,
          },
        ];
      if (sql.includes("insert into tenant_configuracoes")) {
        ledger = args[2];
        return [];
      }
      return [];
    },
  };
  const conteudo = new ConteudoRascunhos318(new CriptografiaDadosSensiveis());
  const base: any = {
    conteudo,
    executar: async (ator: any, fn: Function) => {
      if (
        ator.papel !== "Professional" ||
        !ator.sessaoId ||
        ator.tenantId !== u.tenantId ||
        ator.usuarioId !== u.usuarioId
      )
        throw new Error("Vínculo indisponível");
      return fn({
        m,
        u: ator,
        profissionalId: "prof-fixture",
        profissionalVersao: versao,
        usuarioVersao: "1",
        tenantVersao: "1",
      });
    },
    credencial: async () => ({
      chave_criptografada: conteudo.cifrar(
        `${u.tenantId}:prof-fixture:${u.usuarioId}:credencial:1`,
        "chave-fixture",
      ),
      versao: 1,
    }),
  };
  const provider: any = {
    gerar: jest.fn(async () => ({
      itens: [{ texto: "fato", refs: ["F1"] }],
      limitacoes: [],
    })),
  };
  const s = new ServicoPilotoSintetico318(base, provider, {
    ativo: true,
    direitos,
    modelos: [
      {
        id: "fixture",
        versao: "v1",
        nome: "Fixture",
        maxOutputTokens: 512,
        padrao: true,
        precoEm: "2026-10-13",
        precoEntradaMilhaoUsd: 1,
        precoSaidaMilhaoUsd: 1,
      },
    ],
  });
  return {
    s,
    provider,
    queries,
    auditorias,
    falharAuditoria: () => {
      falhaAuditoria = true;
    },
    revogar: () => {
      config.habilitada = false;
    },
    mudarVersao: () => {
      versao = "3";
    },
    ledger: () => ledger,
  };
}
describe("piloto318 isolado", () => {
  it("bloqueia alvo nao liberado, SID ausente, outro tenant e outro ator", async () => {
    const f = fixture(false);
    await expect(f.s.catalogo(u)).rejects.toThrow();
    for (const ator of [
      { ...u, sessaoId: undefined },
      { ...u, tenantId: "outro" },
      { ...u, usuarioId: "outro" },
      { ...u, papel: "Client" },
    ])
      await expect(fixture().s.catalogo(ator)).rejects.toThrow();
  });
  it("composicao local nao consulta nenhuma tabela clinica nem chama fornecedor", async () => {
    const f = fixture();
    const r = await f.s.previa(u, {
      casoId: "C06",
      contextoSessao: contextoSessao318(u),
    });
    expect(r.baseline.itens[0].texto).toContain("70,4 kg");
    expect(r.chamadaPermitida).toBe(false);
    expect(f.provider.gerar).not.toHaveBeenCalled();
    expect(f.queries.join(" ")).not.toMatch(
      /pacientes|evolucoes_clinicas|avaliacoes_antropometricas|comandos_ia318/,
    );
  });
  it("nao aceita paciente, fontes, texto livre ou caso de contrato como geracao", async () => {
    const f = fixture();
    for (const d of [
      { casoId: "C06", pacienteId: "real" },
      { casoId: "C06", fontes: [] },
      { casoId: "C06", texto: "real" },
      { casoId: "C27" },
    ])
      await expect(
        f.s.previa(u, { contextoSessao: contextoSessao318(u), ...d } as any),
      ).rejects.toThrow();
  });
  it("direitos pendentes negam chamada mesmo com alvo e modelo presentes", async () => {
    const f = fixture();
    const p = await f.s.previa(u, {
      casoId: "C06",
      contextoSessao: contextoSessao318(u),
    });
    await expect(
      f.s.gerar(u, {
        prova: p.prova,
        modeloId: "fixture",
        modalidade: "pre_consulta",
        aceiteCobranca: true,
      }),
    ).rejects.toThrow();
    expect(f.provider.gerar).not.toHaveBeenCalled();
  });
  it("revogacao e versao monotônica invalidam prova anterior", async () => {
    for (const acao of ["revogar", "mudarVersao"] as const) {
      const f = fixture(true, true);
      const p = await f.s.previa(u, {
        casoId: "C06",
        contextoSessao: contextoSessao318(u),
      });
      f[acao]();
      await expect(
        f.s.gerar(u, {
          prova: p.prova,
          modeloId: "fixture",
          modalidade: "pre_consulta",
          aceiteCobranca: true,
        }),
      ).rejects.toThrow();
      expect(f.provider.gerar).not.toHaveBeenCalled();
    }
  });
  it("replay nao repete chamada paga e ledger nao persiste resposta ou chave", async () => {
    const f = fixture(true, true);
    const p = await f.s.previa(u, {
      casoId: "C06",
      contextoSessao: contextoSessao318(u),
    });
    const d: any = {
      prova: p.prova,
      modeloId: "fixture",
      modalidade: "pre_consulta",
      aceiteCobranca: true,
    };
    const r = await f.s.gerar(u, d);
    expect(r.itens).toHaveLength(1);
    await expect(f.s.gerar(u, d)).rejects.toThrow();
    expect(f.provider.gerar).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(f.ledger())).not.toMatch(/chave-fixture|fato|70,4/);
  });
  it("descarta retorno apos revogacao sem reenvio automatico", async () => {
    const f = fixture(true, true);
    const p = await f.s.previa(u, {
      casoId: "C06",
      contextoSessao: contextoSessao318(u),
    });
    f.provider.gerar.mockImplementation(async () => {
      f.revogar();
      return { itens: [{ texto: "fato", refs: ["F1"] }], limitacoes: [] };
    });
    await expect(
      f.s.gerar(u, {
        prova: p.prova,
        modeloId: "fixture",
        modalidade: "evolucao",
        aceiteCobranca: true,
      }),
    ).rejects.toThrow();
    expect(f.provider.gerar).toHaveBeenCalledTimes(1);
  });
});
describe("cadastro piloto nao amplia direitos clinicos", () => {
  it("direitos sintéticos pendentes bloqueiam cadastro", async () => {
    const f = fixture();
    await expect(
      f.s.definirCredencial(u, {
        chave: "fixture",
        versaoEsperada: 0,
        contextoSessao: contextoSessao318(u),
      }),
    ).rejects.toThrow("contratual");
  });
  it.each(["", "com espaço", "com\nquebra"])(
    "recusa credencial malformada %s",
    async (chave) => {
      const f = fixture(true, true);
      await expect(
        f.s.definirCredencial(u, {
          chave,
          versaoEsperada: 0,
          contextoSessao: contextoSessao318(u),
        }),
      ).rejects.toThrow("credencial");
    },
  );
});

describe("auditoria minima do piloto", () => {
  it("audita solicitação antes de chamar provider e não copia conteudo", async () => {
    const f = fixture(true, true);
    const p = await f.s.previa(u, {
      casoId: "C06",
      contextoSessao: contextoSessao318(u),
    });
    await f.s.gerar(u, {
      prova: p.prova,
      modeloId: "fixture",
      modalidade: "pre_consulta",
      aceiteCobranca: true,
    });
    expect(f.auditorias.map((x) => x.acao)).toContain(
      "ia318.piloto.geracao.solicitar",
    );
    expect(JSON.stringify(f.auditorias)).not.toMatch(
      /70,4|chave-fixture|sintetica|F1/,
    );
  });
  it("falha de auditoria impede chamada externa", async () => {
    const f = fixture(true, true);
    const p = await f.s.previa(u, {
      casoId: "C06",
      contextoSessao: contextoSessao318(u),
    });
    f.falharAuditoria();
    await expect(
      f.s.gerar(u, {
        prova: p.prova,
        modeloId: "fixture",
        modalidade: "pre_consulta",
        aceiteCobranca: true,
      }),
    ).rejects.toThrow("Auditoria");
    expect(f.provider.gerar).not.toHaveBeenCalled();
  });
});
