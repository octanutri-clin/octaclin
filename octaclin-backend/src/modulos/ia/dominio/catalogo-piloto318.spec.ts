import { catalogoTecnicoPiloto318 } from "./catalogo-piloto318";
import { catalogoClinico318 } from "./rascunhos-clinicos";
describe("catalogo candidato sintetico, sem aprovação clínica", () => {
  it("fixa snapshots compatíveis e padrão de menor custo entre candidatos não depreciados", () => {
    const m = catalogoTecnicoPiloto318();
    expect(m.map((x) => x.id)).toEqual([
      "gpt-5.4-mini-2026-03-17",
      "gpt-5.4-2026-03-05",
    ]);
    expect(m.filter((x) => x.padrao)).toHaveLength(1);
    expect(m[0].padrao).toBe(true);
    expect(m[0].precoEntradaMilhaoUsd).toBe(0.75);
    expect(m[0].precoSaidaMilhaoUsd).toBe(4.5);
    expect(m[1].precoSaidaMilhaoUsd).toBe(15);
    expect(m.every((x) => x.maxOutputTokens <= 2048)).toBe(true);
  });
  it("não amplia catálogo clínico e retorna cópias independentes", () => {
    expect(catalogoClinico318()).toEqual([]);
    const m = catalogoTecnicoPiloto318();
    if (m[0]) m[0].id = "arbitrario";
    expect(catalogoTecnicoPiloto318()[0]?.id).not.toBe("arbitrario");
  });
});
