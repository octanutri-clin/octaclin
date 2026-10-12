import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ConteudoPiloto } from './contexto-piloto';
describe('cifra contextual do piloto', () => {
  const codec = new ConteudoPiloto(new CriptografiaDadosSensiveis());
  it('preserva conteudo sintetico sem gravar texto em claro', () => {
    const sealed = codec.cifrar('tenant:a:recurso:1', { texto: 'publicacao sintetica' });
    expect(sealed.toString()).not.toContain('publicacao sintetica');
    expect(codec.ler('tenant:a:recurso:1', sealed)).toEqual({ texto: 'publicacao sintetica' });
  });
  it('recusa ciphertext trocado entre recurso ou tenant', () => {
    const sealed = codec.cifrar('tenant:a:recurso:1', { texto: 'sintetico' });
    expect(() => codec.ler('tenant:b:recurso:1', sealed)).toThrow('Conteudo indisponivel');
    expect(() => codec.ler('tenant:a:recurso:2', sealed)).toThrow('Conteudo indisponivel');
  });
  it('recusa adulteracao e cursor de outro contexto', () => {
    const sealed = codec.cifrar('a', { texto: 'sintetico' }); sealed[sealed.length - 1] ^= 1;
    expect(() => codec.ler('a', sealed)).toThrow('Conteudo indisponivel');
    const cursor = codec.cursor('circulo:a', { id: 'sintetico' });
    expect(codec.abrirCursor('circulo:a', cursor)).toEqual({ id: 'sintetico' });
    expect(() => codec.abrirCursor('circulo:b', cursor)).toThrow();
    expect(() => codec.abrirCursor('circulo:a', '!!')).toThrow();
  });
});
