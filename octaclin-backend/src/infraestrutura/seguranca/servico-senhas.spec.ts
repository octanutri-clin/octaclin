import { ServicoSenhas } from './servico-senhas';

describe('ServicoSenhas', () => {
  it('deve validar a senha original contra o hash gerado', () => {
    const servico = new ServicoSenhas();
    const hash = servico.gerarHash('senha-forte-123');

    expect(servico.verificar('senha-forte-123', hash)).toBe(true);
    expect(servico.verificar('senha-errada', hash)).toBe(false);
  });

  it('deve rejeitar formatos de hash desconhecidos', () => {
    const servico = new ServicoSenhas();

    expect(servico.verificar('qualquer', 'bcrypt$hash-legado')).toBe(false);
  });
});
