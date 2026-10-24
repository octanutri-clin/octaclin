import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'crypto';
import { CriarGrupoDto, AtualizarGrupoDto, DuplicarGrupoDto, ConsultarGruposDto } from './dtos-grupos-substituicoes';
const conteudo = () => ({ nome: 'Grupo sintético', entradas: [{ id: randomUUID(), origem: 'catalogo', alimentoId: randomUUID(), quantidade: 1, unidade: 'porção', porcaoGramas: 50 }] });
const erros = (t: new () => any, d: unknown) => validateSync(plainToInstance(t, d), { whitelist: true, forbidNonWhitelisted: true });
describe('FOOD04 DTO fechado', () => {
  it('valida criação, edição completa e transições explícitas', () => {
    expect(erros(CriarGrupoDto, { chaveIdempotencia: randomUUID(), conteudo: conteudo() })).toHaveLength(0);
    for (const dados of [{ revisaoEsperada: 1, conteudo: conteudo() }, { revisaoEsperada: 1, estado: 'arquivado' }, { revisaoEsperada: 2, estado: 'ativo' }, { revisaoEsperada: 1, escopo: 'clinica' }]) expect(erros(AtualizarGrupoDto, dados)).toHaveLength(0);
    expect(erros(DuplicarGrupoDto, { revisaoEsperada: 1, chaveIdempotencia: randomUUID(), conteudo: conteudo() })).toHaveLength(0);
  });
  it('nega PATCH ambíguo, vazio, extra e revisão inválida', () => {
    for (const dados of [{ revisaoEsperada: 1 }, { revisaoEsperada: '1', estado: 'ativo' }, { revisaoEsperada: 1, estado: null }, { revisaoEsperada: 1, escopo: 'pessoal' }, { revisaoEsperada: 1, estado: 'ativo', conteudo: conteudo() }, { revisaoEsperada: 1, estado: 'ativo', tenantId: randomUUID() }]) expect(erros(AtualizarGrupoDto, dados).length).toBeGreaterThan(0);
  });
  it('limita filtros e não coerçe false em true', () => {
    expect(erros(ConsultarGruposDto, { pagina: '2', limite: '25', favoritos: false, estado: 'arquivado', categoria: 'caseiro' })).toHaveLength(0);
    for (const d of [{ pagina: 10001 }, { categoria: '  ' }, { etiqueta: '  ' }, { favoritos: 'false' }, { estado: 'excluido' }, { busca: 'x' }, { escopo: null }, { tenantId: randomUUID() }]) expect(erros(ConsultarGruposDto, d).length).toBeGreaterThan(0);
  });
});
