import { prepararIdentidadesRefeicoes, lerIdentidadesRefeicoes } from './identidades-refeicoes';

const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const C = '10000000-0000-4000-8000-000000000003';
describe('PA06b identidade estável das refeições', () => {
  it('mantém identidade ao reordenar, remover e reinserir chave; cópia com chave nova é independente', () => {
    const a = prepararIdentidadesRefeicoes(['primeira','segunda'], [], jest.fn().mockReturnValueOnce(A).mockReturnValueOnce(B));
    const b = prepararIdentidadesRefeicoes(['segunda'], a.aliases, () => C);
    const c = prepararIdentidadesRefeicoes(['segunda','primeira','copia'], b.aliases, () => C);
    expect(c.identidades).toEqual([B,A,C]);
    expect(c.aliases).toHaveLength(3);
  });
  it('chave de cliente não é UUID nem nome: trata __proto__ como chave exata sem poluição', () => {
    const plano = prepararIdentidadesRefeicoes(['__proto__'], [], () => A);
    expect(lerIdentidadesRefeicoes(JSON.stringify({ schemaVersao: 1, aliases: plano.aliases }))).toEqual([['__proto__', A]]);
    expect({}).not.toHaveProperty('identidade');
  });
  it('limita bytes do mapa novo antes de cifrar, inclusive chaves Unicode', () => {
    const chave=(i:number)=>'漢'.repeat(96)+String(i).padStart(4,'0');
    const tamanhoEntrada=Buffer.byteLength(JSON.stringify([chave(0),A]))+1;
    const quantidade=Math.floor((1024*1024-200)/tamanhoEntrada);
    const aliases:Array<[string,string]>=Array.from({length:quantidade},(_,i)=>[chave(i),A]);
    expect(()=>lerIdentidadesRefeicoes(JSON.stringify({schemaVersao:1,aliases}))).not.toThrow();
    let sequencia=0;
    expect(()=>prepararIdentidadesRefeicoes(Array.from({length:50},(_,i)=>chave(5000+i)),aliases,
      ()=>`20000000-0000-4000-8000-${String(++sequencia).padStart(12,'0')}`)).toThrow();
  });
  it('recusa alias inválido/duplicado, identidade reutilizada em duas linhas e crescimento sem limite', () => {
    for (const aliases of [[['r','invalido']], [['r',A],['r',B]]]) {
      expect(() => lerIdentidadesRefeicoes(JSON.stringify({ schemaVersao: 1, aliases }))).toThrow();
    }
    expect(() => prepararIdentidadesRefeicoes(['a','b'], [['a',A],['b',A]], () => C)).toThrow();
    const aliases: Array<[string,string]> = Array.from({length: 4096},(_,i)=>[`r${i}`, A]);
    expect(() => prepararIdentidadesRefeicoes(['nova'], aliases, () => B)).toThrow();
    expect(() => lerIdentidadesRefeicoes('{')).toThrow();
  });
});
