import { contextoSessao318 } from "../dominio/rascunhos-clinicos";
import { ServicoRascunhosClinicosIa } from "./servico-rascunhos-clinicos";
import { ConteudoRascunhos318, Modelo318 } from "../dominio/rascunhos-clinicos";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
import { randomUUID } from "crypto";
const modelo: Modelo318 = {
  id: "fixture",
  versao: "v1",
  nome: "Fixture",
  maxOutputTokens: 2000,
  precoEntradaMilhaoUsd: 0,
  precoSaidaMilhaoUsd: 0,
  precoEm: "2026-10-13",
  padrao: true,
};
const u = {
  tenantId: "tenant",
  usuarioId: "autor",
  papel: "Professional",
  permissoes: ["ia.executar", "pacientes.gerenciar"],
  emailHash: "",
} as never;
function fixture() {
  const cripto = new CriptografiaDadosSensiveis(),
    conteudo = new ConteudoRascunhos318(cripto);
  let versao = "0",
    tenantVersao = "0";
  const ledger = new Map<string, any>();
  const evolucoes: any[] = [];
  let tail = Promise.resolve();
  const m = {
    getRepository: (entity: any) =>
      entity.name === "UserActionLogOrm"
        ? { create: (v: any) => v, save: async (v: any) => v }
        : {
            create: (v: any) => v,
            save: async (v: any) => {
              const e = {
                ...v,
                id: randomUUID(),
                criadoEm: new Date(),
                atualizadoEm: new Date(),
              };
              evolucoes.push(e);
              return e;
            },
            findOne: async () => evolucoes[0],
          },
    query: async (sql: string, args: any[]) => {
      if (sql.includes("from comandos_ia318") && sql.includes("count("))
        return [{ total: 0, ativos: 0 }];
      if (sql.includes("from comandos_ia318")) {
        if (sql.includes("geracao_chave=$3")) {
          const r = [...ledger.values()].find(
            (r) => r.geracao_chave === args[2],
          );
          return r ? [r] : [];
        }
        return ledger.has(args[2]) ? [ledger.get(args[2])] : [];
      }
      if (sql.includes("insert into comandos_ia318")) {
        ledger.set(args[2], {
          chave: args[2],
          paciente_id: args[3],
          acao: args[4],
          fingerprint_criptografado: args[5],
          estado: args[6] ?? "iniciado",
          resultado_id: args[7],
          geracao_chave: args[8],
        });
        return [];
      }
      if (sql.includes("update comandos_ia318")) {
        const row = ledger.get(args[2]);
        if (row) row.estado = "retornado";
        return [];
      }
      if (sql.includes("from agenda_consultas")) return [];
      if (sql.includes("from evolucoes_clinicas")) return [];
      if (sql.includes("from avaliacoes_antropometricas")) return [];
      return [];
    },
  };
  const context = {
    conteudo,
    modelos: [modelo],
    executar: async (_u: any, fn: Function) => {
      const p = tail.then(() =>
        fn({
          m,
          u,
          profissionalId: "prof",
          profissionalVersao: "0",
          usuarioVersao: "0",
          tenantVersao,
        }),
      );
      tail = p.catch(() => undefined);
      return p;
    },
    paciente: async () => ({ id: "paciente", versao_contexto_ia318: versao }),
    exigirGeracao: async () => ({
      habilitada: true,
      versao: 1,
      operacaoAprovada: true,
      maxChamadas15min: 5,
      maxTokensSaida: 2048,
    }),
    credencial: async () => ({
      versao: 1,
      chave_criptografada: conteudo.cifrar(
        "tenant:prof:autor:credencial:1",
        "segredo-sintetico",
      ),
    }),
  };
  const provider = {
    gerar: jest.fn(async () => ({
      itens: [{ texto: "Sem consulta anterior", refs: ["F1"] }],
      limitacoes: [],
    })),
  };
  const service = new ServicoRascunhosClinicosIa(
    context as never,
    provider as never,
    cripto,
  );
  const dado = {
    contextoSessao: contextoSessao318(u),
    chaveComando: randomUUID(),
    modeloId: "fixture",
    selecoes: [{ tipo: "preparacao" as const, id: "resumo" }],
  };
  return {
    service,
    provider,
    dado,
    evolucoes,
    desativarTenant: () => {
      tenantVersao = String(Number(tenantVersao) + 2);
    },
    transferir: () => {
      versao = String(Number(versao) + 2);
    },
  };
}
describe("geracao318 autorizada e efemera", () => {
  it("troca de SID depois do precheck recusa antes de nonce e fornecedor", async () => {
    const f = fixture();
    await expect(
      f.service.gerar(
        u,
        "paciente",
        { ...f.dado, contextoSessao: "b".repeat(64) } as never,
        "evolucao",
      ),
    ).rejects.toThrow("sessão");
    expect(f.provider.gerar).not.toHaveBeenCalled();
  });
  it("fontes nao atravessam troca da sessao da tela", async () => {
    const f = fixture();
    await expect(
      (f.service.fontes as any)(u, "paciente", "b".repeat(64)),
    ).rejects.toThrow("sessão");
  });
  it("gera previa com prova sem persistir texto como rascunho", async () => {
    const f = fixture();
    const r = await f.service.gerar(u, "paciente", f.dado, "pre_consulta");
    expect(r.itens).toHaveLength(1);
    expect(r.provaRevisao).toBeTruthy();
    expect(r).not.toHaveProperty("chave");
  });
  it("replay da geracao nao cobra outra chamada nem recupera draft perdido", async () => {
    const f = fixture();
    await f.service.gerar(u, "paciente", f.dado, "pre_consulta");
    await expect(
      f.service.gerar(u, "paciente", f.dado, "pre_consulta"),
    ).rejects.toThrow();
    expect(f.provider.gerar).toHaveBeenCalledTimes(1);
  });
  it("transferencia e retorno durante inferencia invalidam resultado", async () => {
    const f = fixture();
    f.provider.gerar.mockImplementationOnce(async () => {
      f.transferir();
      return {
        itens: [{ texto: "Sem consulta anterior", refs: ["F1"] }],
        limitacoes: [],
      };
    });
    await expect(
      f.service.gerar(u, "paciente", f.dado, "pre_consulta"),
    ).rejects.toThrow();
  });
  it("fonte nao disponivel recusa antes do envio", async () => {
    const f = fixture();
    await expect(
      f.service.gerar(
        u,
        "paciente",
        { ...f.dado, selecoes: [{ tipo: "evolucao", id: randomUUID() }] },
        "pre_consulta",
      ),
    ).rejects.toThrow();
    expect(f.provider.gerar).not.toHaveBeenCalled();
  });
  it("confirma e repete de forma idempotente sem criar outra evolucao", async () => {
    const f = fixture(),
      p = await f.service.gerar(u, "paciente", f.dado, "evolucao");
    const d = {
      chaveComando: randomUUID(),
      provaRevisao: p.provaRevisao,
      titulo: "Titulo sintetico",
      conteudo: "Nota revisada sintetica",
      tipo: "observacao",
      confirmado: true,
    };
    const a = await f.service.confirmar(u, "paciente", d),
      b = await f.service.confirmar(u, "paciente", d);
    expect(a.id).toBeTruthy();
    expect(b.id).toBe(a.id);
    expect(f.evolucoes).toHaveLength(1);
  });
  it("nao permite duas evolucoes da mesma prova com nonces diferentes", async () => {
    const f = fixture(),
      p = await f.service.gerar(u, "paciente", f.dado, "evolucao");
    const d = {
      chaveComando: randomUUID(),
      provaRevisao: p.provaRevisao,
      titulo: "Titulo",
      conteudo: "Nota revisada",
      tipo: "observacao",
      confirmado: true,
    };
    const a = await f.service.confirmar(u, "paciente", d);
    const b = await f.service.confirmar(u, "paciente", {
      ...d,
      chaveComando: randomUUID(),
    });
    expect(a.id).toBe(b.id);
    expect(f.evolucoes).toHaveLength(1);
  });
  it("contexto transferido nao confirma prova anterior", async () => {
    const f = fixture(),
      p = await f.service.gerar(u, "paciente", f.dado, "evolucao");
    f.transferir();
    await expect(
      f.service.confirmar(u, "paciente", {
        chaveComando: randomUUID(),
        provaRevisao: p.provaRevisao,
        titulo: "Titulo",
        conteudo: "Nota revisada",
        tipo: "observacao",
        confirmado: true,
      }),
    ).rejects.toThrow();
    expect(f.evolucoes).toHaveLength(0);
  });
  it("nao salva sintese pre-consulta como evolucao", async () => {
    const f = fixture(),
      p = await f.service.gerar(u, "paciente", f.dado, "pre_consulta");
    await expect(
      f.service.confirmar(u, "paciente", {
        chaveComando: randomUUID(),
        provaRevisao: p.provaRevisao,
        titulo: "Titulo",
        conteudo: "Nota revisada",
        tipo: "observacao",
        confirmado: true,
      }),
    ).rejects.toThrow();
  });
  it("prova nao duplica nota atual e confirmacao verifica sua integridade", async () => {
    const f = fixture(),
      nota = "Não refere náuseas.",
      p = await f.service.gerar(
        u,
        "paciente",
        { ...f.dado, textoProfissional: nota },
        "evolucao",
      );
    expect(
      f.service.base.conteudo.abrir<any>(p.provaRevisao),
    ).not.toHaveProperty("textoProfissional");
    const d = {
      chaveComando: randomUUID(),
      provaRevisao: p.provaRevisao,
      titulo: "Sintetico",
      conteudo: "Texto revisado",
      confirmado: true,
      textoProfissional: nota,
    };
    await expect(
      f.service.confirmar(u, "paciente", {
        ...d,
        textoProfissional: "Nota alterada",
      } as never),
    ).rejects.toThrow("Fontes");
    expect((await f.service.confirmar(u, "paciente", d)).id).toBeTruthy();
  });
  it("desativacao e reativacao da clinica invalida geracao anterior", async () => {
    const f = fixture();
    f.provider.gerar.mockImplementationOnce(async () => {
      f.desativarTenant();
      return {
        itens: [{ texto: "Sem consulta anterior", refs: ["F1"] }],
        limitacoes: [],
      };
    });
    await expect(
      f.service.gerar(u, "paciente", f.dado, "evolucao"),
    ).rejects.toThrow("Contexto");
  });
});
