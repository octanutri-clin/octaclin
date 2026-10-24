import { randomUUID } from 'crypto';
import { validarConteudoGrupo, identidadeEntradaGrupo, porcaoGrupoValida } from './grupos-substituicoes';
const entrada = () => ({ id: randomUUID(), origem: 'catalogo', alimentoId: randomUUID(), quantidade: 1, unidade: 'porção', porcaoGramas: 30 });
const grupo = () => ({ nome: ' Grupo sintético ', descricao: ' Alternativas ', categoria: ' Livre ', etiquetas: ['rápido', 'caseiro'], entradas: [entrada()] });
describe('FOOD04 contrato de grupo reutilizável', () => {
  it('normaliza metadados e não compartilha referências mutáveis', () => {
    const input = grupo(), g = validarConteudoGrupo(input);
    expect(g).toMatchObject({ nome: 'Grupo sintético', descricao: 'Alternativas', categoria: 'Livre', etiquetas: ['rápido', 'caseiro'] });
    g.entradas[0].porcaoGramas = 50; expect(input.entradas[0].porcaoGramas).toBe(30);
  });
  it('não aceita composição, tenant, flags ou identidade arbitrários', () => {
    for (const extra of [{ tenantId: randomUUID() }, { nutrientes: { energiaKcal: 0 } }, { preferida: true }, { revisao: 1 }]) expect(() => validarConteudoGrupo({ ...grupo(), entradas: [{ ...entrada(), ...extra }] })).toThrow();
  });
  it('custom exige revisão e identidade discriminada', () => {
    const e = { ...entrada(), origem: 'custom', revisao: 2 };
    expect(validarConteudoGrupo({ ...grupo(), entradas: [e] }).entradas[0]).toMatchObject(e);
    expect(() => validarConteudoGrupo({ ...grupo(), entradas: [{ ...e, revisao: undefined }] })).toThrow();
    expect(identidadeEntradaGrupo(e as any)).not.toBe(identidadeEntradaGrupo({ ...e, origem: 'catalogo' } as any));
  });
  it.each([0, -1, NaN, Infinity, 10001, 0.0001, 1.2345])('recusa porção inválida %s sem arredondar', peso => {
    expect(porcaoGrupoValida(peso)).toBe(false);
    expect(() => validarConteudoGrupo({ ...grupo(), entradas: [{ ...entrada(), porcaoGramas: peso }] })).toThrow();
  });
  it('conserva ordem/porções distintas e recusa repetição exata/chave duplicada', () => {
    const a = entrada(), b = { ...a, id: randomUUID(), porcaoGramas: 50 };
    expect(validarConteudoGrupo({ ...grupo(), entradas: [b, a] }).entradas.map(e => e.porcaoGramas)).toEqual([50, 30]);
    expect(() => validarConteudoGrupo({ ...grupo(), entradas: [a, { ...a, id: randomUUID() }] })).toThrow();
    expect(() => validarConteudoGrupo({ ...grupo(), entradas: [a, { ...a, porcaoGramas: 40 }] })).toThrow();
  });
  it('limita conteúdo e rejeita objetos não planos', () => {
    for (const entradas of [[], Array.from({ length: 21 }, entrada)]) expect(() => validarConteudoGrupo({ ...grupo(), entradas })).toThrow();
    expect(() => validarConteudoGrupo({ ...grupo(), nome: ' ' })).toThrow();
    expect(() => validarConteudoGrupo({ ...grupo(), etiquetas: Array(11).fill('rótulo') })).toThrow();
    expect(() => validarConteudoGrupo({ ...grupo(), desconhecido: true })).toThrow();
    expect(() => validarConteudoGrupo(Object.create({ nome: 'herdado' }))).toThrow();
  });
});

it('FOOD04 rejeita alimento com mesmo peso físico repetido sob outro rótulo',()=>{
  const a=entrada();expect(()=>validarConteudoGrupo({...grupo(),entradas:[a,{...a,id:randomUUID(),quantidade:30,unidade:'g'}]})).toThrow();
});
