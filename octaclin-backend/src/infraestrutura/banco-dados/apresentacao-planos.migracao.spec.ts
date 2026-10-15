import { QueryRunner } from 'typeorm';
import { ApresentacaoPlanos1720000001072 } from './migracoes/1720000001072-ApresentacaoPlanos';
import { criarOpcoesTypeOrm } from './opcoes-typeorm';

describe('PA05 migration aditiva', () => {
  it('é registrada no bootstrap sem habilitar migrations automáticas', () => {
    expect(criarOpcoesTypeOrm().migrations).toContain(ApresentacaoPlanos1720000001072);
  });
  it('recusa rollback destrutivo quando há preferências gravadas', async () => {
    const query = jest.fn().mockResolvedValue([{ possuiDados: true }]);
    await expect(new ApresentacaoPlanos1720000001072().down({ query } as unknown as QueryRunner)).rejects.toThrow('Rollback recusado');
    expect(query).not.toHaveBeenCalled();
  });
});
