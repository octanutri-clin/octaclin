import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { ControladorPlanosAlimentares } from '../apresentacao/controlador-planos-alimentares';
import { ContribuicoesMicronutrientesDto } from './dtos-contribuicoes-micronutrientes';
import { validarContribuicoes } from './dtos-contribuicoes-micronutrientes';
describe('FOOD06 detalhe paginado', () => {
  const entrada = { selecoes: [], codigo: 'calcioMg', pagina: 1, limite: 50 };
  it('preserva somente o contrato explícito', () => expect(validarContribuicoes(entrada)).toEqual(entrada));
  it('permite alcançar o último dos dez mil itens mesmo com limite um', () => {
    expect(validarContribuicoes({...entrada,pagina:10000,limite:1})).toMatchObject({pagina:10000,limite:1});
  });
  it('pipe mantém herança, whitelist, limites e proteção de leitura/no-store', () => {
    const validar = (v: unknown) => validateSync(plainToInstance(ContribuicoesMicronutrientesDto,v),{whitelist:true,forbidNonWhitelisted:true});
    expect(validar({...entrada,pagina:10000,limite:1})).toHaveLength(0);
    for (const v of [{...entrada,pagina:10001},{...entrada,tenantId:'x'},{...entrada,codigo:'__proto__'},{...entrada,selecoes:[null]}]) expect(validar(v).length).toBeGreaterThan(0);
    const metodo=ControladorPlanosAlimentares.prototype.detalharMicronutrientes;
    expect(Reflect.getMetadata(CHAVE_PERMISSOES,metodo)).toEqual(['planos_alimentares.ler']);
    expect(Reflect.getMetadata(HEADERS_METADATA,metodo)).toContainEqual({name:'Cache-Control',value:'private, no-store'});
  });
  it.each([{}, null, { ...entrada, codigo: '__proto__' }, { ...entrada, codigo: 'energiaKcal' },
    { ...entrada, pagina: 0 }, { ...entrada, pagina: '1' }, { ...entrada, pagina: 10001 },
    { ...entrada, limite: 0 }, { ...entrada, limite: 101 }, { ...entrada, limite: 1.5 },
    { ...entrada, tenantId: 'x' }, { ...entrada, snapshots: [] }, { ...entrada, selecoes: [null] }
  ])('rejeita entrada manipulada %#', valor => expect(() => validarContribuicoes(valor)).toThrow());
});

it('FOOD06 aceita ordem explícita validada, preservando clientes sem ordenação',()=>{
 const r={selecoes:[],codigo:'ferroMg',pagina:1,limite:25};
 expect(()=>validarContribuicoes({...r,ordem:'contribuicao'})).not.toThrow();
 for(const ordem of [null,{},'__proto__','total','CONTRIBUICAO']) expect(()=>validarContribuicoes({...r,ordem})).toThrow();
 expect(validateSync(plainToInstance(ContribuicoesMicronutrientesDto,{...r,ordem:'contribuicao'}),{whitelist:true,forbidNonWhitelisted:true})).toHaveLength(0);
});

it.each([null,42,{},'__proto__'])('FOOD06 pipe rejeita ordem inválida %j',ordem=>{
 const erro=validateSync(plainToInstance(ContribuicoesMicronutrientesDto,{selecoes:[],codigo:'ferroMg',pagina:1,limite:25,ordem}),{whitelist:true,forbidNonWhitelisted:true});
 expect(erro.length).toBeGreaterThan(0);
});
