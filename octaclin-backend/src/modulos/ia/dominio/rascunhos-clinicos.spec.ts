import {
  validarFontes318,
  validarSaida318,
  ConteudoRascunhos318,
  autorizarProfissional318,
  catalogoClinico318,
} from "./rascunhos-clinicos";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
describe("contrato de rascunhos318", () => {
  const fontes = [
    {
      ref: "medida:1",
      tipo: "medida" as const,
      data: "2026-01-01",
      texto: "Peso registrado:70,4kg",
    },
  ];
  it("preserva fonte literal sem calcular ou classificar", () =>
    expect(validarFontes318(fontes)).toEqual(fontes));
  it("aceita nota explicita do profissional sem fingir ser registro antigo", () =>
    expect(
      validarFontes318([
        {
          ref: "nota:profissional",
          tipo: "nota_profissional",
          data: "2026-01-01",
          texto: "Nota sintetica",
        } as never,
      ]),
    ).toHaveLength(1));
  it("recusa fonte duplicada", () =>
    expect(() => validarFontes318([...fontes, ...fontes])).toThrow());
  it("recusa mais de20fontes", () =>
    expect(() =>
      validarFontes318(
        Array.from({ length: 21 }, (_, i) => ({ ...fontes[0], ref: `m:${i}` })),
      ),
    ).toThrow());
  it("recusa contexto acima de12000caracteres", () =>
    expect(() =>
      validarFontes318([{ ...fontes[0], texto: "x".repeat(12001) }]),
    ).toThrow());
  it("valida refs de cada afirmacao sem confiar em formato", () => {
    expect(
      validarSaida318(
        {
          itens: [{ texto: "Peso registrado:70,4kg", refs: ["medida:1"] }],
          limitacoes: [],
        },
        fontes,
      ),
    ).toHaveProperty("itens");
    expect(() =>
      validarSaida318(
        {
          itens: [{ texto: "Afirmação", refs: ["ref:inventada"] }],
          limitacoes: [],
        },
        fontes,
      ),
    ).toThrow();
  });
  it("nao permite campos extras nem afirmacao sem fonte", () => {
    expect(() =>
      validarSaida318(
        { itens: [{ texto: "Diagnostico", refs: [] }], limitacoes: [] },
        fontes,
      ),
    ).toThrow();
    expect(() =>
      validarSaida318({ itens: [], limitacoes: [], html: "<script>" }, fontes),
    ).toThrow();
  });
  it("catalogo assistencial nasce vazio enquanto modelos nao forem ratificados", () =>
    expect(catalogoClinico318()).toEqual([]));
  it.each(["SuperAdmin", "Client", "Collaborator", "Patient"])(
    "nega %s mesmo com permissao",
    (papel) =>
      expect(() =>
        autorizarProfissional318({
          papel,
          permissoes: ["ia.executar", "pacientes.gerenciar"],
        } as never),
      ).toThrow(),
  );
  it("exige as duas permissoes do profissional", () => {
    expect(() =>
      autorizarProfissional318({
        papel: "Professional",
        permissoes: ["ia.executar"],
      } as never),
    ).toThrow();
    expect(() =>
      autorizarProfissional318({
        papel: "Professional",
        permissoes: ["ia.executar", "pacientes.gerenciar"],
      } as never),
    ).not.toThrow();
  });
  it("cifra segredos com escopo autenticado e nao aceita transplante", () => {
    const c = new ConteudoRascunhos318(new CriptografiaDadosSensiveis());
    const bytes = c.cifrar("tenantA:profA", "segredo-sintetico");
    expect(bytes.toString()).not.toContain("segredo-sintetico");
    expect(c.ler("tenantA:profA", bytes)).toBe("segredo-sintetico");
    expect(() => c.ler("tenantB:profA", bytes)).toThrow();
  });
  it("permite abrir prova antiga somente para checar replay ja confirmado no servidor", () => {
    const c = new ConteudoRascunhos318(new CriptografiaDadosSensiveis());
    const p = c.selar({ ator: "sintetico" }, 1000);
    expect(() => c.abrir(p, 901001)).toThrow();
    expect((c as any).abrir(p, 901001, true)).toEqual({ ator: "sintetico" });
  });
  it("prova de revisao expira e nao admite corpo adulterado", () => {
    const c = new ConteudoRascunhos318(new CriptografiaDadosSensiveis());
    const prova = c.selar({ ator: "sintetico" }, 1000);
    expect(c.abrir(prova, 1001)).toEqual({ ator: "sintetico" });
    expect(() => c.abrir(prova, 1000 + 900001)).toThrow();
    expect(() => c.abrir(prova.slice(0, -5) + "abcde", 1001)).toThrow();
  });
  it("limite do texto inclui separadores entre itens", () => {
    expect(() =>
      validarSaida318(
        {
          itens: [
            { texto: "x".repeat(3000), refs: [fontes[0].ref] },
            { texto: "y".repeat(3000), refs: [fontes[0].ref] },
          ],
          limitacoes: [],
        },
        fontes,
      ),
    ).toThrow();
  });
});
