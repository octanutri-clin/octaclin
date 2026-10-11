import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CriarAvaliacaoAntropometricaDto } from './dtos';
const contexto = { confirmado: true, nascimento: '2024-01-01', sexoCurva: 'nao_informado', tecnica: 'deitado', edema: 'desconhecido', nascimentoTipo: 'nao_informado', tipoMedida: 'pos_natal' };
describe('DTO pediátrico sem bypass', () => {
  const verificar = (corpo: unknown) => validate(plainToInstance(CriarAvaliacaoAntropometricaDto, corpo), { whitelist: true, forbidNonWhitelisted: true });
  it('permite medidas neonatais com contexto confirmado', async () => expect(await verificar({ pesoKg: 0.5, alturaCm: 25, pediatrico: contexto })).toEqual([]));
  it.each([{ pesoKg: 0.5 }, { alturaCm: 25 }, { pesoKg: -1, pediatrico: contexto }, { pesoKg: '0.5', pediatrico: contexto }, { pediatrico: { ...contexto, habilitado: true } }, { pediatrico: {} }])('rejeita corpo inválido ou flag de habilitação %#', async corpo => expect((await verificar(corpo)).length).toBeGreaterThan(0));
});
