import {
  casosSinteticos318,
  casoSintetico318,
  comporSintetico318,
} from "./piloto-sintetico318";
import { validarFontes318, validarSaida318 } from "./rascunhos-clinicos";
describe("corpus executavel sintetico318", () => {
  it("tem exatamente os 30 IDs unicos e separa qualidade de contratos", () => {
    expect(casosSinteticos318.map((c) => c.id)).toEqual(
      Array.from(
        { length: 30 },
        (_, i) => `C${String(i + 1).padStart(2, "0")}`,
      ),
    );
    expect(casosSinteticos318.filter((c) => c.geravel).length).toBe(19);
  });
  it("preserva numeros, negacoes, datas e refs sem inferencias na composicao local", () => {
    for (const c of casosSinteticos318.filter((c) => c.geravel)) {
      validarFontes318(c.fontes);
      const r = comporSintetico318(c.id);
      validarSaida318(r, c.fontes);
      expect(r.itens.map((i) => i.texto)).toEqual(c.fontes.map((f) => f.texto));
      expect(r.itens.map((i) => i.refs)).toEqual(c.fontes.map((f) => [f.ref]));
    }
  });
  it("nao transforma testes negativos em geracoes nem inclui fonte nao selecionada", () => {
    for (const id of [
      "C02",
      "C16",
      "C17",
      "C23",
      "C24",
      "C25",
      "C26",
      "C27",
      "C28",
      "C29",
      "C30",
    ])
      expect(() => comporSintetico318(id)).toThrow();
    expect(JSON.stringify(comporSintetico318("C04"))).not.toContain("fadiga");
    expect(() => casoSintetico318("paciente-real")).toThrow();
  });
  it("retorna copias para impedir contaminacao do corpus entre requisicoes", () => {
    const c = casoSintetico318("C06");
    c.fontes[0].texto = "alterado";
    expect(casoSintetico318("C06").fontes[0].texto).toContain("70,4 kg");
  });
});
