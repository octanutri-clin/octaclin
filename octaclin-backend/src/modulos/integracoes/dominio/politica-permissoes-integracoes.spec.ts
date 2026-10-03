import { estaDentroDaConcessao } from './politica-permissoes-integracoes';

describe('politica de escopos autorizados para integracoes', () => {
  it('permite uma credencial cujos escopos foram todos concedidos', () => {
    expect(estaDentroDaConcessao(['pacientes:ler', 'agenda:ler'], ['pacientes:ler', 'agenda:ler', 'agenda:escrever'])).toBe(true);
  });

  it('nega uma credencial que solicita um escopo fora da concessao', () => {
    expect(estaDentroDaConcessao(['pacientes:ler', 'agenda:escrever'], ['pacientes:ler'])).toBe(false);
  });

  it('aplica a mesma regra aos eventos de webhook', () => {
    expect(estaDentroDaConcessao(['paciente.criado'], ['paciente.criado', 'consulta.criada'])).toBe(true);
    expect(estaDentroDaConcessao(['consulta.cancelada'], ['paciente.criado'])).toBe(false);
  });

  it('nao autoriza recurso algum quando o gestor revogou todos os itens', () => {
    expect(estaDentroDaConcessao(['agenda:ler'], [])).toBe(false);
  });
});
