import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'crypto';
import * as dto from './dtos-alimentos-personalizados';
const conteudo = () => ({ nome: 'Produto', base: { tipo: 'por100g' }, nutrientes: { energiaKcal: 50 } });
const erros = (v: unknown, tipo = 'CriarAlimentoPersonalizadoDto') => validateSync(plainToInstance((dto as any)[tipo], v), { whitelist: true, forbidNonWhitelisted: true });
describe('FOOD02 DTOs fechados', () => {
  it('aceita cadastro parcial e PATCH completo ou desativação exclusiva', () => {
    expect(erros({ ...conteudo(), chaveIdempotencia: randomUUID() })).toHaveLength(0);
    expect(erros({ ...conteudo(), revisaoEsperada: 1 }, 'AtualizarAlimentoPersonalizadoDto')).toHaveLength(0);
    expect(erros({ revisaoEsperada: 1, ativo: false }, 'AtualizarAlimentoPersonalizadoDto')).toHaveLength(0);
  });
  it.each([{ nome: null }, { base: { tipo: 'ml' } }, { nutrientes: { energiaKcal: '50' } }, { nutrientes: null }, { tenantId: randomUUID() }, { profissionalId: randomUUID() }, { escopo: null }, { fonte: 'taco' }, { chaveIdempotencia: 'x' }])('rejeita cadastro inválido ou metadado arbitrário %#', v => expect(erros({ ...conteudo(), chaveIdempotencia: randomUUID(), ...v }).length).toBeGreaterThan(0));
  it.each([{ revisaoEsperada: 0, ativo: false }, { revisaoEsperada: 1, ativo: true }, { revisaoEsperada: 1, ativo: false, nome: 'x' }, { ...conteudo(), revisaoEsperada: 1, escopo: 'clinica' }, { revisaoEsperada: 1 }, { ...conteudo(), revisaoEsperada: '1' }])('rejeita PATCH ambíguo/sem revisão %#', v => expect(erros(v, 'AtualizarAlimentoPersonalizadoDto').length).toBeGreaterThan(0));
  it('deixa overflow numérico estruturalmente válido chegar ao serviço para resposta422', () => {
    expect(erros({ ...conteudo(), chaveIdempotencia: randomUUID(), base: { tipo: 'porcao', pesoGramas: 0.001 }, nutrientes: { energiaKcal: 1000 } })).toHaveLength(0);
  });
  it('limita paginação e exige corpo de busca textual', () => {
    expect(erros({ pagina: '2', limite: '25', escopo: 'clinica' }, 'ListarAlimentosPersonalizadosDto')).toHaveLength(0);
    expect(erros({ busca: 'pro', pagina: 1 }, 'BuscarAlimentosPersonalizadosDto')).toHaveLength(0);
    expect(erros({ busca: 'a' }, 'BuscarAlimentosPersonalizadosDto').length).toBeGreaterThan(0);
    expect(erros({ pagina: 1, busca: 'produto' }, 'ListarAlimentosPersonalizadosDto').length).toBeGreaterThan(0);
    expect(erros({ pagina: 10001 }, 'ListarAlimentosPersonalizadosDto').length).toBeGreaterThan(0);
  });
});
