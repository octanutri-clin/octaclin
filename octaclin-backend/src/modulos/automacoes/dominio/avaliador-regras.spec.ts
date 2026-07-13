import { avaliarCondicoes } from './avaliador-regras';

describe('avaliarCondicoes', () => {
  it('deve aprovar quando todas as condicoes forem atendidas', () => {
    const resultado = avaliarCondicoes(
      [
        { campo: 'checkinsPerdidos', operador: 'maior_ou_igual', valor: 3 },
        { campo: 'status', operador: 'igual', valor: 'risco' }
      ],
      { checkinsPerdidos: 3, status: 'risco' }
    );

    expect(resultado.executar).toBe(true);
    expect(resultado.motivos).toEqual([]);
  });

  it('deve bloquear quando uma condicao falhar', () => {
    const resultado = avaliarCondicoes(
      [{ campo: 'frustracaoScore', operador: 'maior_que', valor: 70 }],
      { frustracaoScore: 40 }
    );

    expect(resultado.executar).toBe(false);
    expect(resultado.motivos[0]).toContain('frustracaoScore');
  });
});
