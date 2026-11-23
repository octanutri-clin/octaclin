import { normalizarConsultaRespostas, CursorRespostas, ContextoCursorRespostas } from './consulta-respostas';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
const id = '00000000-0000-4000-8000-000000000001';
const contexto: ContextoCursorRespostas = { tenantId: id, usuarioId: id, questionarioId: id, timezone: 'America/Sao_Paulo', filtros: { tamanho: 25 } };
describe('consulta limitada de respostas', () => {
  it('normaliza paciente, período e tamanho explícito', () => {
    expect(normalizarConsultaRespostas({ pacienteId: id.toUpperCase(), inicio: '2024-02-29', fim: '2024-03-01', tamanho: '50' })).toEqual({ pacienteId: id, inicio: '2024-02-29', fim: '2024-03-01', tamanho: 50 });
  });
  it('preserva o padrão de 25 sem inventar período', () => expect(normalizarConsultaRespostas({})).toEqual({ tamanho: 25 }));
  it.each([{tamanho: '101'}, {tamanho: 0}, {tamanho: [25]}, {inicio: '2023-02-29'}, {fim: '2024-04-31'}, {inicio: '2024-04-02', fim: '2024-04-01'}, {pacienteId: 'outro'}, {timezone: 'UTC'}, {inicio: '2024-01-01T00:00Z'}, {cursor: 'x'.repeat(3000)}, {fim: ['2024-01-01']}])('rejeita entrada inválida %j', entrada => expect(() => normalizarConsultaRespostas(entrada)).toThrow());
});
describe('cursor cifrado sem capacidade de autorização', () => {
  const codec = new CursorRespostas(new CriptografiaDadosSensiveis());
  it.each(['2026-11-23 12:34:56.123456+00', null])('preserva desempate e microssegundos: %s', finalizadoEm => {
    const posicao = {id, finalizadoEm}; const cursor = codec.criar(contexto, posicao);
    expect(cursor.length).toBeGreaterThan(30);
    expect(codec.abrir(contexto, cursor)).toEqual(posicao);
    expect(Buffer.from(cursor, 'base64url').toString()).not.toContain('America/Sao_Paulo');
  });
  it.each(['tenantId', 'usuarioId', 'questionarioId', 'timezone'] as const)('não pode ser reutilizado com outro %s', campo => {
    const cursor = codec.criar(contexto, {id, finalizadoEm: null});
    expect(() => codec.abrir({...contexto, [campo]: 'outro'}, cursor)).toThrow();
  });
  it('vincula todos os filtros e tamanho', () => {
    const cursor = codec.criar(contexto, {id, finalizadoEm: null});
    expect(() => codec.abrir({...contexto, filtros: {...contexto.filtros, pacienteId:id}}, cursor)).toThrow();
    expect(() => codec.abrir({...contexto, filtros: {tamanho:50}}, cursor)).toThrow();
  });
  it('rejeita corrupção e payloads malformados sem expor conteúdo', () => {
    const cursor = codec.criar(contexto, {id, finalizadoEm:null});
    expect(() => codec.abrir(contexto, cursor.slice(0,-10)+'AAAAAAAAAA')).toThrow('Cursor inválido');
    expect(() => codec.abrir(contexto, 'não é um cursor')).toThrow('Cursor inválido');
    expect(() => codec.criar(contexto, {id:'inválido', finalizadoEm:null})).toThrow();
    expect(() => codec.criar(contexto, {id, finalizadoEm:'2026-02-30 00:00:00+00'})).toThrow();
  });
});
