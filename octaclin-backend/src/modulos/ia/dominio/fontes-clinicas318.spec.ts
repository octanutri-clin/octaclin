import { projetarMedida318, projetarEvolucao318 } from "./fontes-clinicas318";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
describe("projecao minima de fontes318", () => {
  const c = new CriptografiaDadosSensiveis();
  it("envia medidas originais e omite resultado/formula/observacao", () => {
    const fonte = projetarMedida318(
      {
        id: "sintetico",
        avaliada_em: "2026-01-01",
        medidas_criptografadas: c.criptografar(
          JSON.stringify({
            pesoKg: 70.4,
            alturaCm: 170,
            observacoes: "nota interna sintetica",
            imc: 24,
            protocolo: "nao transmitir",
          }),
        ),
        resultado_criptografado: c.criptografar("resultado-interditado"),
      },
      c,
    );
    expect(fonte.texto).toContain("70.4");
    expect(fonte.texto).toContain("170");
    expect(fonte.texto).not.toContain("interna");
    expect(fonte.texto).not.toContain("imc");
    expect(fonte.texto).not.toContain("interditado");
  });
  it("evolucao escolhida mantem data/texto sem devolver ciphertext", () => {
    const f = projetarEvolucao318(
      {
        id: "sintetico",
        criado_em: new Date("2026-01-01T12:00:00Z"),
        titulo_criptografado: c.criptografar("Registro"),
        conteudo_criptografado: c.criptografar("Paciente negou nausea"),
      },
      c,
    );
    expect(f.texto).toContain("negou");
    expect(f.data).toContain("2026-01-01");
    expect(Object.keys(f).sort()).toEqual(["data", "ref", "texto", "tipo"]);
  });
});
