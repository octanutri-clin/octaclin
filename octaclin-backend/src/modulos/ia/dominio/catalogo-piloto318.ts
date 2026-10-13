import { Modelo318 } from "./rascunhos-clinicos";
/** Candidatos técnicos para ensaio sintético; não são modelos clinicamente ratificados.
 * Metadados oficiais consultados em 2026-10-13, manifesto FONTES_PILOTO_SINTETICO318.json.
 * A política de direitos e o grant do piloto continuam bloqueantes e independentes. */
export function catalogoTecnicoPiloto318(): Modelo318[] {
  return [
    {
      id: "gpt-5.4-mini-2026-03-17",
      versao: "2026-03-17",
      nome: "GPT-5.4 mini",
      padrao: true,
      maxOutputTokens: 2048,
      precoEntradaMilhaoUsd: 0.75,
      precoSaidaMilhaoUsd: 4.5,
      precoEm: "2026-10-13",
    },
    {
      id: "gpt-5.4-2026-03-05",
      versao: "2026-03-05",
      nome: "GPT-5.4",
      padrao: false,
      maxOutputTokens: 2048,
      precoEntradaMilhaoUsd: 2.5,
      precoSaidaMilhaoUsd: 15,
      precoEm: "2026-10-13",
    },
  ];
}
