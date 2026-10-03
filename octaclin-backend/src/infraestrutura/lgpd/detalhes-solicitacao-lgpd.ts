import { CriptografiaDadosSensiveis } from '../seguranca/criptografia-dados-sensiveis';
import { ConsentimentoLgpdOrm } from './consentimento-lgpd.orm';

/** Leitura legada somente ate a conversao fora de banda dos eventos antigos. */
export function lerDetalhesSolicitacaoLgpd(
  evento: Pick<ConsentimentoLgpdOrm, 'detalhesCriptografados' | 'metadados'>,
  criptografia: CriptografiaDadosSensiveis
): string | undefined {
  if (evento.detalhesCriptografados) {
    return criptografia.descriptografar(evento.detalhesCriptografados);
  }
  const legado = evento.metadados?.detalhes;
  return typeof legado === 'string' && legado.trim() ? legado.trim() : undefined;
}

export function cifrarDetalhesSolicitacaoLgpd(
  texto: string | undefined,
  criptografia: CriptografiaDadosSensiveis
): Buffer | undefined {
  const normalizado = texto?.trim();
  return normalizado ? criptografia.criptografar(normalizado) : undefined;
}
