import { BadRequestException } from '@nestjs/common';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
export interface FiltrosPaginaRespostas { pacienteId?: string; inicio?: string; fim?: string; tamanho: 25 | 50 | 100; cursor?: string }
export interface ContextoCursorRespostas { tenantId: string; usuarioId: string; questionarioId: string; timezone: string; filtros: Omit<FiltrosPaginaRespostas, 'cursor'> }
export interface PosicaoResposta { id: string; finalizadoEm: string | null }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function dataValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor < '0001-01-01') return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}
export function normalizarConsultaRespostas(entrada: Record<string, unknown>): FiltrosPaginaRespostas {
  const erro = () => new BadRequestException('Consulta inválida. Confira o período, o paciente e o tamanho da página.');
  if (!entrada || Array.isArray(entrada) || Object.keys(entrada).some(k => !['pacienteId','inicio','fim','tamanho','cursor'].includes(k))) throw erro();
  const tamanho = entrada.tamanho === undefined ? 25 : typeof entrada.tamanho === 'string' && /^(25|50|100)$/.test(entrada.tamanho) ? Number(entrada.tamanho) : entrada.tamanho;
  if (tamanho !== 25 && tamanho !== 50 && tamanho !== 100) throw erro();
  const resultado: FiltrosPaginaRespostas = { tamanho };
  if (entrada.pacienteId !== undefined) {
    if (typeof entrada.pacienteId !== 'string' || !UUID.test(entrada.pacienteId)) throw erro();
    resultado.pacienteId = entrada.pacienteId.toLowerCase();
  }
  for (const campo of ['inicio', 'fim'] as const) {
    const valor = entrada[campo];
    if (valor !== undefined) { if (!dataValida(valor)) throw erro(); resultado[campo] = valor; }
  }
  if (resultado.inicio && resultado.fim && resultado.inicio > resultado.fim) throw erro();
  if (entrada.cursor !== undefined) {
    if (typeof entrada.cursor !== 'string' || entrada.cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(entrada.cursor)) throw erro();
    resultado.cursor = entrada.cursor;
  }
  return resultado;
}
function posicaoValida(valor: unknown): valor is PosicaoResposta {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const p = valor as PosicaoResposta;
  if (Object.keys(p).some(k => k !== 'id' && k !== 'finalizadoEm') || typeof p.id !== 'string' || !UUID.test(p.id)) return false;
  // Preserve the database timestamp string: Date would discard PostgreSQL microseconds.
  return p.finalizadoEm === null || (typeof p.finalizadoEm === 'string' &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?[+-]\d{2}(?::\d{2})?$/.test(p.finalizadoEm) &&
    dataValida(p.finalizadoEm.slice(0, 10)) && Number.isFinite(Date.parse(p.finalizadoEm)));
}
function escopo(contexto: ContextoCursorRespostas): string {
  const {tenantId, usuarioId, questionarioId, timezone, filtros: f} = contexto;
  return JSON.stringify(['questionarios:respostas:v1', tenantId, usuarioId, questionarioId, timezone,
    f.pacienteId ?? null, f.inicio ?? null, f.fim ?? null, f.tamanho]);
}
export class CursorRespostas {
  constructor(private readonly cripto: CriptografiaDadosSensiveis) {}
  criar(contexto: ContextoCursorRespostas, posicao: PosicaoResposta): string {
    if (!posicaoValida(posicao)) throw new BadRequestException('Cursor inválido. Atualize a consulta.');
    return this.cripto.criptografar(JSON.stringify({escopo: escopo(contexto), posicao})).toString('base64url');
  }
  abrir(contexto: ContextoCursorRespostas, cursor: string): PosicaoResposta {
    try {
      if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
      const bytes = Buffer.from(cursor, 'base64url');
      if (bytes.toString('base64url') !== cursor) throw new Error();
      const envelope = JSON.parse(this.cripto.descriptografar(bytes));
      if (envelope?.escopo !== escopo(contexto) || !posicaoValida(envelope.posicao)) throw new Error();
      return envelope.posicao;
    } catch { throw new BadRequestException('Cursor inválido. Atualize a consulta.'); }
  }
}
