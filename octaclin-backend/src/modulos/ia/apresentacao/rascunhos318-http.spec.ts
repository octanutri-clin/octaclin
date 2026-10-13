import "reflect-metadata";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import {
  GerarRascunho318Dto,
  CapturarFontes318Dto,
  Configurar318Dto,
  ConfirmarRascunho318Dto,
} from "./rascunhos318-dtos";
import { ControladorRascunhos318 } from "./controlador-rascunhos318";
describe("contratos HTTP318", () => {
  it("fontes geracao e configuracao exigem marcador de sessao da tela", async () => {
    for (const cls of [
      CapturarFontes318Dto,
      GerarRascunho318Dto,
      Configurar318Dto,
    ]) {
      const errors = await validate(plainToInstance(cls as any, {}));
      expect(errors.some((e) => e.property === "contextoSessao")).toBe(true);
    }
  });
  it("rejeita modelo/url arbitrario e fonte malformada", async () => {
    const dto = plainToInstance(GerarRascunho318Dto, {
      chaveComando: "invalida",
      modeloId: "x",
      selecoes: [{ tipo: "mensagem", id: "x" }],
      url: "https://externo",
    });
    expect(
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
        .length,
    ).toBeGreaterThan(0);
  });
  it("exige confirmacao e limita conteudo", async () => {
    expect(
      (
        await validate(
          plainToInstance(ConfirmarRascunho318Dto, {
            confirmado: false,
            conteudo: "x".repeat(6001),
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it("controller clinico usa papel proprio e no-store", () => {
    expect(
      Reflect.getMetadata("papeisPermitidos", ControladorRascunhos318),
    ).toEqual(["Professional"]);
    expect(
      Reflect.getMetadata(
        "__headers__",
        ControladorRascunhos318.prototype.fontes,
      ),
    ).toContainEqual({ name: "Cache-Control", value: "no-store" });
  });
  it("catalogo projeta somente metadados publicos", async () => {
    const contexto = {
      executar: async (_u: unknown, fn: Function) => fn({ m: {} }),
      operacaoAprovada: () => true,
      modelos: [
        { id: "fixture", nome: "Sintetico", versao: "v1", chave: "segredo" },
      ],
      config: async () => ({ habilitada: false }),
    };
    const r = await new ControladorRascunhos318(
      {} as never,
      contexto as never,
    ).modelos({} as never);
    expect(JSON.stringify(r)).not.toContain("segredo");
  });
});
