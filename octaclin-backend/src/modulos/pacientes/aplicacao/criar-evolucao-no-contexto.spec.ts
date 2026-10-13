import { criarEvolucaoNoContexto } from "./criar-evolucao-no-contexto";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
describe("builder transacional de evolução", () => {
  it("usa gerente fornecido, cifra dados e mantém privada sem outra transacao", async () => {
    const c = new CriptografiaDadosSensiveis();
    let registro: any;
    const repo = {
      create: (v: unknown) => v,
      save: async (v: unknown) => {
        registro = v;
        return { id: "sintetico", ...(v as object) };
      },
    };
    const m = { getRepository: () => repo };
    expect(
      await criarEvolucaoNoContexto(
        m as never,
        c,
        "tenant",
        "paciente",
        "autor",
        {
          titulo: "Título sintético",
          conteudo: "Texto sintético",
          tipo: "observacao",
        } as never,
      ),
    ).toHaveProperty("id", "sintetico");
    expect(registro.visibilidade).toBe("privada");
    expect(registro.conteudoCriptografado.toString()).not.toContain(
      "Texto sintético",
    );
    expect(c.descriptografar(registro.conteudoCriptografado)).toBe(
      "Texto sintético",
    );
  });
});
