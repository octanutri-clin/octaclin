import { validate } from 'class-validator';
import { CriarSolicitacaoAgendamentoPublicoDto } from './dtos';

describe('CriarSolicitacaoAgendamentoPublicoDto', () => {
  it('rejeita dados publicos sem contato valido ou horario ISO', async () => {
    const dados = Object.assign(new CriarSolicitacaoAgendamentoPublicoDto(), {
      nome: '',
      email: 'invalido',
      inicioEm: 'amanha'
    });

    const erros = await validate(dados);

    expect(erros.map((erro) => erro.property)).toEqual(expect.arrayContaining(['nome', 'email', 'inicioEm']));
  });
});
