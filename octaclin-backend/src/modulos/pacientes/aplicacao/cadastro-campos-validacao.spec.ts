import 'reflect-metadata';
import { BadRequestException, type Type } from '@nestjs/common';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import {
  AtualizarContatoCadastroPacienteDto, AtualizarFiscalCadastroPacienteDto,
  AtualizarIdentificacaoCadastroPacienteDto, AtualizarOperacaoCadastroPacienteDto,
  AtualizarPacienteDto
} from './dtos';

async function mensagens(tipo: Type<unknown>, dados: object): Promise<{ message: string[] }> {
  try {
    await criarPipeValidacaoHttp().transform(dados, { type: 'body', metatype: tipo });
  } catch (erro) {
    expect(erro).toBeInstanceOf(BadRequestException);
    return (erro as BadRequestException).getResponse() as { message: string[] };
  }
  throw new Error('A fixture inválida deveria ter sido rejeitada.');
}

describe('Contrato existente de validação cadastral para F05', () => {
  it('preserva os caminhos de campos e objetos aninhados sem devolver a entrada', async () => {
    const resposta = await mensagens(AtualizarContatoCadastroPacienteDto, {
      email: 'sintetico-invalido', ddi: '0', celular: '123', endereco: { cep: 'x'.repeat(13) }
    });
    expect(resposta.message).toEqual(expect.arrayContaining([
      'email must be an email', 'endereco.cep must be shorter than or equal to 12 characters',
      'ddi must match /^\\+[1-9]\\d{0,2}$/ regular expression',
      'celular must match /^\\d{10,11}$/ regular expression'
    ]));
    expect(JSON.stringify(resposta)).not.toContain('sintetico-invalido');
    expect(resposta).not.toHaveProperty('target');
  });

  it.each([
    [AtualizarPacienteDto, { nome: 'x'.repeat(181) }, 'nome must be shorter than or equal to 180 characters'],
    [AtualizarIdentificacaoCadastroPacienteDto, { sexo: 'invalido' }, 'sexo must be one of the following values: feminino, masculino, intersexo, nao_informar'],
    [AtualizarOperacaoCadastroPacienteDto, { responsavel: { nome: 'x'.repeat(181) } }, 'responsavel.nome must be shorter than or equal to 180 characters'],
    [AtualizarFiscalCadastroPacienteDto, { emailRecibo: 'invalido' }, 'emailRecibo must be an email']
  ] as const)('mantém o contrato de %p', async (tipo, dados, mensagem) => {
    const resposta = await mensagens(tipo, dados);
    expect(resposta.message).toContain(mensagem);
  });

  it('mantém regras legadas: CPF só exige formato de onze dígitos neste DTO', async () => {
    await expect(criarPipeValidacaoHttp().transform({ cpf: '12345678901' }, {
      type: 'body', metatype: AtualizarFiscalCadastroPacienteDto
    })).resolves.toMatchObject({ cpf: '12345678901' });
  });

  it('mantém rejeição de campos desconhecidos', async () => {
    const resposta = await mensagens(AtualizarContatoCadastroPacienteDto, { interno: 'sintetico' });
    expect(resposta.message).toContain('property interno should not exist');
  });
});
