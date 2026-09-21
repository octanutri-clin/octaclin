export interface VersaoCondutaTerapeuticaElegivel {
  condutaTerapeuticaId: string;
  numero: number;
  publicadaEm?: Date;
  descartadaEm?: Date;
  validadeFim?: string;
}

/**
 * Por conduta, a versao vigente e a publicada e nao descartada de maior
 * numero. `uq_condutas_terapeuticas_versao_publicada` (indice unico parcial
 * em `(tenant_id, conduta_terapeutica_id) where publicada_em is not null
 * and descartada_em is null`) ja garante no maximo uma por conduta no
 * banco; resolver explicitamente aqui so torna essa garantia explicita no
 * dominio, sem depender da ordem de iteracao das versoes recebidas.
 */
export function resolverVersaoVigentePorConduta<T extends VersaoCondutaTerapeuticaElegivel>(
  versoes: T[]
): Map<string, T> {
  const vigentePorConduta = new Map<string, T>();
  for (const versao of versoes) {
    if (!versao.publicadaEm || versao.descartadaEm) continue;
    const atual = vigentePorConduta.get(versao.condutaTerapeuticaId);
    if (!atual || versao.numero > atual.numero) {
      vigentePorConduta.set(versao.condutaTerapeuticaId, versao);
    }
  }
  return vigentePorConduta;
}

/** Vencida = `validadeFim` estritamente anterior a hoje, zero dias de tolerancia. */
export function condutaEstaVencida(
  versao: Pick<VersaoCondutaTerapeuticaElegivel, 'validadeFim'>,
  hojeIso: string
): boolean {
  return Boolean(versao.validadeFim) && versao.validadeFim! < hojeIso;
}
