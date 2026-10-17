export interface MedidaCaseiraAplicadaApi {
  id: string;
  revisao: number;
  aplicacaoId: string;
}

export interface MedidaCaseiraReferenciaApi {
  nome: string;
  quantidadeReferencia: number;
  pesoReferenciaGramas: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAXIMO_MILESIMOS = 10_000_000n;

function converterParaMileSimos(valor: number | string): bigint {
  if (typeof valor !== 'number' && typeof valor !== 'string') throw new Error('Informe valores numéricos válidos.');
  const texto = String(valor).trim().replace(',', '.');
  const correspondencia = /^(\d{1,5})(?:\.(\d{1,3}))?$/.exec(texto);
  if (!correspondencia) throw new Error('Use valores positivos com até três casas decimais.');
  const inteiro = BigInt(correspondencia[1]);
  const decimal = BigInt((correspondencia[2] ?? '').padEnd(3, '0') || '0');
  const milessimos = inteiro * 1000n + decimal;
  if (milessimos < 1n || milessimos > MAXIMO_MILESIMOS) throw new Error('O valor está fora dos limites permitidos.');
  return milessimos;
}

/** Espelha o contrato decimal do backend: BigInt, validação exata e único half-up final. */
export function calcularPesoMedidaCaseira(
  quantidade: number | string,
  pesoReferenciaGramas: number | string,
  quantidadeReferencia: number | string
): number {
  const quantidadeM = converterParaMileSimos(quantidade);
  const pesoM = converterParaMileSimos(pesoReferenciaGramas);
  const referenciaM = converterParaMileSimos(quantidadeReferencia);
  const numerador = quantidadeM * pesoM;
  // Resultado em milésimos de grama: q_m * p_m / r_m.
  if (numerador < referenciaM || numerador > MAXIMO_MILESIMOS * referenciaM) {
    throw new Error('O peso calculado está fora dos limites permitidos.');
  }
  const arredondado = (numerador * 2n + referenciaM) / (2n * referenciaM);
  if (arredondado < 1n || arredondado > MAXIMO_MILESIMOS) throw new Error('O peso calculado está fora dos limites permitidos.');
  return Number(arredondado) / 1000;
}

export function validarMedidaCaseiraAplicada(valor: unknown): valor is MedidaCaseiraAplicadaApi {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const medida = valor as Partial<MedidaCaseiraAplicadaApi>;
  return typeof medida.id === 'string' && UUID.test(medida.id)
    && Number.isSafeInteger(medida.revisao) && Number(medida.revisao) > 0
    && typeof medida.aplicacaoId === 'string' && UUID.test(medida.aplicacaoId);
}

export function validarReferenciaMedidaCaseira(valor: unknown): valor is MedidaCaseiraReferenciaApi {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const referencia = valor as Partial<MedidaCaseiraReferenciaApi>;
  return typeof referencia.nome === 'string' && referencia.nome.trim().length > 0
    && Number.isFinite(referencia.quantidadeReferencia) && Number(referencia.quantidadeReferencia) > 0
    && Number.isFinite(referencia.pesoReferenciaGramas) && Number(referencia.pesoReferenciaGramas) > 0;
}
