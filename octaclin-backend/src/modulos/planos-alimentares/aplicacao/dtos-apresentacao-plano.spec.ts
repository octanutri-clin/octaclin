import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AtualizarRascunhoPlanoAlimentarDto, PreferenciasApresentacaoPlanoDto } from './dtos';
const conjunto = () => ({ horario: true, macros: false, medidasCaseiras: true, orientacoes: false, substituicoesExpandidas: false, modoCompacto: true });
const prefs = () => ({ schemaVersao: 1, profissional: conjunto(), paciente: conjunto() });

describe('PA05 DTOs de apresentação', () => {
  it('valida dois conjuntos completos sem converter strings em booleanos', async () => {
    expect(await validate(plainToInstance(PreferenciasApresentacaoPlanoDto, prefs()), { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    const invalido = prefs();
    const erros = await validate(plainToInstance(PreferenciasApresentacaoPlanoDto, { ...invalido, paciente: { ...invalido.paciente, horario: 'false' } }));
    expect(erros.map(x => x.property)).toContain('paciente');
  });
  it.each([{}, { ...prefs(), schemaVersao: 2 }, { ...prefs(), profissional: null }, { ...prefs(), paciente: { ...conjunto(), interno: true } }])('recusa objetos incompletos, versão nova e extras (%#)', async valor => {
    expect((await validate(plainToInstance(PreferenciasApresentacaoPlanoDto, valor), { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
  });
  it('identidade e revisão são obrigatórias somente com preferências explícitas', async () => {
    const campos = ['apresentacaoRevisaoEsperada', 'rascunhoIdEsperado'];
    const legado = await validate(plainToInstance(AtualizarRascunhoPlanoAlimentarDto, {}));
    expect(legado.filter(x => campos.includes(x.property))).toHaveLength(0);
    const novo = await validate(plainToInstance(AtualizarRascunhoPlanoAlimentarDto, { preferenciasApresentacao: prefs() }));
    expect(novo.map(x => x.property)).toEqual(expect.arrayContaining(campos));
  });
});
