/** Matemática genérica original, sem tabelas, coeficientes científicos ou roteamento assistencial. */
export interface ParametrosLms { l: number; m: number; s: number }
export interface AncoraLms extends ParametrosLms { x: number }
function finito(valor: number) { if (!Number.isFinite(valor)) throw new Error('parametro_matematico_invalido'); }
function positivo(valor: number) { finito(valor); if (valor <= 0) throw new Error('parametro_matematico_invalido'); }
function validar(p: ParametrosLms) { finito(p.l); positivo(p.m); positivo(p.s); }
export function escoreLms(valor: number, p: ParametrosLms): number {
  positivo(valor); validar(p);
  const logRazao = Math.log(valor / p.m);
  const z = p.l === 0 ? logRazao / p.s : Math.expm1(p.l * logRazao) / (p.l * p.s);
  finito(z); return z;
}
export function inversaLms(z: number, p: ParametrosLms): number {
  finito(z); validar(p);
  const base = 1 + p.l * p.s * z;
  if (p.l !== 0 && base <= 0) throw new Error('dominio_lms_invalido');
  const valor = p.m * Math.exp(p.l === 0 ? p.s * z : Math.log1p(p.l * p.s * z) / p.l);
  positivo(valor); return valor;
}
export function interpolarLms(x: number, ancoras: readonly AncoraLms[]): ParametrosLms {
  finito(x);
  if (!ancoras.length) throw new Error('referencia_ausente');
  ancoras.forEach((a, i) => {
    validar(a); finito(a.x);
    if (i && a.x <= ancoras[i - 1].x) throw new Error('ancoras_invalidas');
  });
  if (x < ancoras[0].x || x > ancoras[ancoras.length - 1].x) throw new Error('fora_da_referencia');
  const superior = ancoras.findIndex(a => a.x >= x);
  const b = ancoras[superior];
  if (b.x === x) return { l: b.l, m: b.m, s: b.s };
  const a = ancoras[superior - 1];
  const t = (x - a.x) / (b.x - a.x);
  return { l: a.l + t * (b.l - a.l), m: a.m + t * (b.m - a.m), s: a.s + t * (b.s - a.s) };
}
export function escoreLognormal(valor: number, mu: number, sigma: number): number {
  positivo(valor); finito(mu); positivo(sigma);
  const z = (Math.log(valor) - mu) / sigma;
  finito(z); return z;
}
export type PercentilNormal = { valor: number } | { limite: 'abaixo_do_limite_numerico' | 'acima_do_limite_numerico'; valor?: never };
/** Série integral da densidade normal. Limites textuais evitam saturação em 0/100. */
export function percentilNormal(z: number): PercentilNormal {
  finito(z);
  if (Math.abs(z) > 7) return { limite: z < 0 ? 'abaixo_do_limite_numerico' : 'acima_do_limite_numerico' };
  let termo = z, soma = z;
  for (let n = 1; n < 200; n++) {
    termo *= z * z / (2 * n + 1);
    soma += termo;
    if (Math.abs(termo) < Math.abs(soma) * 1e-16) break;
  }
  const valor = 100 * (0.5 + Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) * soma);
  if (valor <= 0 || valor >= 100) return { limite: z < 0 ? 'abaixo_do_limite_numerico' : 'acima_do_limite_numerico' };
  return { valor };
}
