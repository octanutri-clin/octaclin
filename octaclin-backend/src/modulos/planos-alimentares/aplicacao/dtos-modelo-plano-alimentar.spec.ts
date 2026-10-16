import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EditarModeloPlanoAlimentarDto, RestaurarVersaoModeloPlanoAlimentarDto, CriarModeloPlanoAlimentarDto, CriarReceitaNutricionalDto } from './dtos';

describe('DTOs de versionamento de modelo de plano', () => {
  it('preserva micronutrientes manuais no contrato compartilhado de modelos/receitas', async () => {
    const item = { descricao:'Ingrediente sintético',quantidade:1,unidade:'porção',porcaoGramas:100,nutrientesPor100g:{energiaKcal:1,proteinasG:1,carboidratosG:1,gordurasG:1},micronutrientesPor100g:{ferroMg:0,vitaminaCMg:1} };
    const modelo = plainToInstance(CriarModeloPlanoAlimentarDto,{nome:'Modelo sintético',origem:'pessoal',refeicoes:[{nome:'Refeição',itens:[item]}]});
    expect(await validate(modelo,{whitelist:true,forbidNonWhitelisted:true})).toHaveLength(0);
    expect(JSON.parse(JSON.stringify(modelo)).refeicoes[0].itens[0].micronutrientesPor100g).toEqual(item.micronutrientesPor100g);
    const receita = plainToInstance(CriarReceitaNutricionalDto,{nome:'Receita sintética',origem:'pessoal',tipo:'receita',categoria:'Categoria sintética',instrucoes:'Modo sintético',itens:[item]});
    expect(await validate(receita,{whitelist:true,forbidNonWhitelisted:true})).toHaveLength(0);
    expect(receita.itens[0].micronutrientesPor100g).toEqual(item.micronutrientesPor100g);
  });
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
