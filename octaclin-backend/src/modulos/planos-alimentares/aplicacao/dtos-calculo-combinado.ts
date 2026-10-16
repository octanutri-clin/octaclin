import { Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
export interface SelecaoPlanoCalculo {
  planoId: string; versaoIdEsperada: string; ativacaoRevisaoEsperada: number; identidadesRefeicoes: string[];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function falhar(): never { throw new Error('Seleção do cálculo combinado inválida.'); }
export function validarSelecoesCalculo(valor: unknown): { selecoes: SelecaoPlanoCalculo[] } {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).some(k => k !== 'selecoes')) falhar();
  if (Buffer.byteLength(JSON.stringify(valor), 'utf8') > 64 * 1024) falhar();
  const selecoes = (valor as {selecoes?: unknown}).selecoes;
  if (!Array.isArray(selecoes) || selecoes.length > 25) falhar();
  const planos = new Set<string>(); let quantidade = 0;
  for (const selecao of selecoes) {
    if (!selecao || typeof selecao !== 'object' || Array.isArray(selecao)) falhar();
    const s = selecao as Record<string, unknown>;
    if (Object.keys(s).some(k => !['planoId','versaoIdEsperada','ativacaoRevisaoEsperada','identidadesRefeicoes'].includes(k))) falhar();
    if (typeof s.planoId !== 'string' || !UUID.test(s.planoId) || planos.has(s.planoId.toLowerCase())) falhar();
    planos.add(s.planoId.toLowerCase());
    if (typeof s.versaoIdEsperada !== 'string' || !UUID.test(s.versaoIdEsperada)) falhar();
    if (!Number.isInteger(s.ativacaoRevisaoEsperada) || (s.ativacaoRevisaoEsperada as number) < 0 || (s.ativacaoRevisaoEsperada as number) >= 2147483647) falhar();
    if (!Array.isArray(s.identidadesRefeicoes) || s.identidadesRefeicoes.length > 50) falhar();
    const identidades = s.identidadesRefeicoes;
    if (identidades.some(i => typeof i !== 'string' || !UUID.test(i)) || new Set(identidades.map(i => i.toLowerCase())).size !== identidades.length) falhar();
    quantidade += identidades.length;
    if (quantidade > 500) falhar();
  }
  // UUID tem representação canônica única para comparação e ordenação dos locks.
  return { selecoes: selecoes.map(s => ({ planoId:s.planoId.toLowerCase(), versaoIdEsperada:s.versaoIdEsperada.toLowerCase(), ativacaoRevisaoEsperada:s.ativacaoRevisaoEsperada, identidadesRefeicoes:s.identidadesRefeicoes.map((i:string) => i.toLowerCase()) })) };
}
@ValidatorConstraint({ name: 'selecoesCalculoCombinado', async: false })
class ValidadorSelecoesCalculo implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean { try { validarSelecoesCalculo({ selecoes:valor }); return true; } catch { return false; } }
  defaultMessage(): string { return 'Seleção do cálculo combinado inválida.'; }
}
export class CalculoCombinadoDto {
  @Validate(ValidadorSelecoesCalculo) selecoes: SelecaoPlanoCalculo[];
}
