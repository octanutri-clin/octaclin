import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { ControladorPlanosAlimentares } from '../apresentacao/controlador-planos-alimentares';
import { CalculoCombinadoDto, validarSelecoesCalculo } from './dtos-calculo-combinado';
const id = '10000000-0000-4000-8000-000000000001';
const selecao = () => ({ planoId: id, versaoIdEsperada: id, ativacaoRevisaoEsperada: 0, identidadesRefeicoes: [id] });
const validar = (v:unknown) => validateSync(plainToInstance(CalculoCombinadoDto, v), { whitelist:true, forbidNonWhitelisted:true });
describe('PA06 cálculo combinado DTO', () => {
  it.each(['calcularCombinado', 'obterSelecaoCalculo'])('protege %s com leitura e no-store', nome => {
    const metodo = (ControladorPlanosAlimentares.prototype as unknown as Record<string, Function>)[nome];
    expect(typeof metodo).toBe('function');
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, metodo)).toEqual(['planos_alimentares.ler']);
    expect(Reflect.getMetadata(HEADERS_METADATA, metodo)).toContainEqual({name:'Cache-Control',value:'private, no-store'});
  });
  it('limita a soma de identidades e recusa duplicatas com caixa diferente', () => {
    const uuid = (n:number) => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
    const selecoes = Array.from({length:11},(_,p)=>({...selecao(),planoId:uuid(1000+p),identidadesRefeicoes:Array.from({length:50},(_,i)=>uuid(p*50+i))}));
    expect(validar({selecoes:selecoes.slice(0,10)})).toHaveLength(0);
    expect(validar({selecoes}).length).toBeGreaterThan(0);
    const maiusculo='AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    expect(validar({selecoes:[{...selecao(),planoId:maiusculo},{...selecao(),planoId:maiusculo.toLowerCase()}]}).length).toBeGreaterThan(0);
  });
  it('aceita somente seleção vazia ou identidades e precondições limitadas', () => {
    expect(validar({selecoes:[]})).toHaveLength(0);
    expect(validar({selecoes:[selecao()]})).toHaveLength(0);
    expect(validarSelecoesCalculo({selecoes:[selecao()]})).toEqual({selecoes:[selecao()]});
  });
  it.each([
    {}, {selecoes:null}, {selecoes:[],tenantId:id}, {selecoes:[{...selecao(),planoId:'x'}]},
    {selecoes:[{...selecao(),ativacaoRevisaoEsperada:'0'}]}, {selecoes:[{...selecao(),ativacaoRevisaoEsperada:-1}]},
    {selecoes:[{...selecao(),ativacaoRevisaoEsperada:2147483647}]}, {selecoes:[{...selecao(),identidadesRefeicoes:[id,id]}]},
    {selecoes:[selecao(),selecao()]}, {selecoes:[{...selecao(),nutrientes:{energiaKcal:1}}]},
    {selecoes:[{...selecao(),identidadesRefeicoes:new Array(51).fill(id)}]}, {selecoes:new Array(26).fill(selecao())}
  ])('recusa entrada inválida #%#', entrada => {
    expect(validar(entrada).length).toBeGreaterThan(0);
    expect(() => validarSelecoesCalculo(entrada)).toThrow();
  });
});
