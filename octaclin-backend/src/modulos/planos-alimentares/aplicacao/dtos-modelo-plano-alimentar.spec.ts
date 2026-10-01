import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EditarModeloPlanoAlimentarDto, RestaurarVersaoModeloPlanoAlimentarDto } from './dtos';

describe('DTOs de versionamento de modelo de plano', () => {
  it('rejeita versão esperada não positiva e snapshots sem refeição válida', async () => {
    const dto = plainToInstance(EditarModeloPlanoAlimentarDto, {
      versaoEsperada: 0,
      nome: 'Modelo válido',
      refeicoes: [{ nome: 'Café', itens: [] }]
    });
    const erros = await validate(dto);
    expect(erros.map((erro) => erro.property)).toEqual(expect.arrayContaining(['versaoEsperada', 'refeicoes']));
  });

  it('rejeita número de versão restaurada fracionário ou não positivo', async () => {
    const dto = plainToInstance(RestaurarVersaoModeloPlanoAlimentarDto, { versaoEsperada: 1.5 });
    expect((await validate(dto)).map((erro) => erro.property)).toContain('versaoEsperada');
  });
});
