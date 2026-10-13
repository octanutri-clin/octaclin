import { ConflictException } from "@nestjs/common";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
import { Fonte318 } from "./rascunhos-clinicos";
const data = (v: string | Date) =>
  v instanceof Date ? v.toISOString() : String(v);
export function projetarMedida318(
  r: {
    id: string;
    avaliada_em: string;
    medidas_criptografadas: Buffer;
    [k: string]: unknown;
  },
  c: CriptografiaDadosSensiveis,
): Fonte318 {
  try {
    const medidas = JSON.parse(c.descriptografar(r.medidas_criptografadas));
    const nomes: Record<string, string> = {
      pesoKg: "Peso registrado (kg)",
      alturaCm: "Altura/comprimento registrado (cm)",
      cinturaCm: "Cintura registrada (cm)",
      quadrilCm: "Quadril registrado (cm)",
    };
    const itens = Object.entries(nomes)
      .filter(
        ([k]) => typeof medidas[k] === "number" && Number.isFinite(medidas[k]),
      )
      .map(([k, n]) => `${n}: ${medidas[k]}`);
    return {
      ref: `medida:${r.id}`,
      tipo: "medida",
      data: data(r.avaliada_em),
      texto: itens.length
        ? itens.join("; ")
        : "Sem medidas factuais aplicáveis nesta fonte.",
    };
  } catch {
    throw new ConflictException("Fonte de medida indisponível.");
  }
}
export function projetarEvolucao318(
  r: {
    id: string;
    criado_em: Date;
    titulo?: string;
    titulo_criptografado?: Buffer;
    conteudo_criptografado: Buffer;
  },
  c: CriptografiaDadosSensiveis,
): Fonte318 {
  try {
    return {
      ref: `evolucao:${r.id}`,
      tipo: "evolucao",
      data: data(r.criado_em),
      texto: `${r.titulo_criptografado ? c.descriptografar(r.titulo_criptografado) : (r.titulo ?? "Evolução")}\n${c.descriptografar(r.conteudo_criptografado)}`,
    };
  } catch {
    throw new ConflictException("Fonte de evolução indisponível.");
  }
}
