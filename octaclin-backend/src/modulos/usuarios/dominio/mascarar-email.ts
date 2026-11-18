/**
 * FOOD06 P3-0b: e-mail mascarado para identificar uma conta sem revelá-la a quem não precisa do endereço completo.
 * Mantém só a primeira letra do usuário, a primeira do domínio e o sufixo final (`helena@example.test` → `h***@e***.test`).
 * Entrada malformada vira `***` (nunca devolve o texto original).
 */
export function mascararEmail(email: string): string {
  const partes = typeof email === 'string' ? email.trim().toLowerCase().split('@') : [];
  if (partes.length !== 2 || !partes[0] || !partes[1]) return '***';
  const [local, dominio] = partes;
  const ponto = dominio.lastIndexOf('.');
  const sufixo = ponto > 0 && ponto < dominio.length - 1 ? dominio.slice(ponto) : '';
  return `${local[0]}***@${dominio[0]}***${sufixo}`;
}
