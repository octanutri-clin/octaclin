import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  ControladorPilotoSintetico318,
  PreviaPiloto318Dto,
  GerarPiloto318Dto,
} from "./controlador-piloto-sintetico318";
describe("contratos HTTP piloto sintetico", () => {
  it("exige Professional e permissoes, sem rota de confirmacao", () => {
    expect(
      Reflect.getMetadata("papeisPermitidos", ControladorPilotoSintetico318),
    ).toEqual(["Professional"]);
    expect(
      Object.getOwnPropertyNames(ControladorPilotoSintetico318.prototype),
    ).not.toContain("confirmar");
    for (const m of ["catalogo", "previa", "gerar", "credencial"] as const)
      expect(
        Reflect.getMetadata(
          "__headers__",
          ControladorPilotoSintetico318.prototype[m],
        ),
      ).toContainEqual({ name: "Cache-Control", value: "no-store" });
  });
  it("recusa paciente, fonte arbitraria e contexto fora do corpus", async () => {
    for (const d of [
      { casoId: "C00" },
      { casoId: "C31" },
      { casoId: "C06", pacienteId: "real" },
      { casoId: "C06", fontes: [] },
    ])
      expect(
        (
          await validate(
            plainToInstance(PreviaPiloto318Dto, {
              contextoSessao: "a".repeat(64),
              ...d,
            }),
            { whitelist: true, forbidNonWhitelisted: true },
          )
        ).length,
      ).toBeGreaterThan(0);
  });
  it("exige aceite de cobrança e proíbe URL/modelo livre longo", async () => {
    expect(
      (
        await validate(
          plainToInstance(GerarPiloto318Dto, {
            prova: "fixture",
            modeloId: "fixture",
            modalidade: "pre_consulta",
            aceiteCobranca: false,
            url: "https://externo",
          }),
          { whitelist: true, forbidNonWhitelisted: true },
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
