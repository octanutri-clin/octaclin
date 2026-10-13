import { EntityManager } from "typeorm";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
import { CriarEvolucaoClinicaDto } from "./dtos";
import { EvolucaoClinicaOrm } from "../infraestrutura/evolucao-clinica.orm";
import { resolverConsultaOpcional } from "./vinculo-consulta";
/** Caller owns authorization and transaction; this builder never starts another one. */
export async function criarEvolucaoNoContexto(
  m: EntityManager,
  cripto: CriptografiaDadosSensiveis,
  tenantId: string,
  pacienteId: string,
  autorUsuarioId: string,
  d: CriarEvolucaoClinicaDto,
): Promise<EvolucaoClinicaOrm> {
  const consultaId = await resolverConsultaOpcional(
    m,
    tenantId,
    pacienteId,
    d.consultaId,
  );
  const repo = m.getRepository(EvolucaoClinicaOrm);
  return repo.save(
    repo.create({
      tenantId,
      pacienteId,
      autorUsuarioId,
      tituloCriptografado: cripto.criptografar(d.titulo.trim()),
      conteudoCriptografado: cripto.criptografar(d.conteudo.trim()),
      tipo: d.tipo ?? "observacao",
      visibilidade: d.visibilidade ?? "privada",
      consultaId,
    }),
  );
}
