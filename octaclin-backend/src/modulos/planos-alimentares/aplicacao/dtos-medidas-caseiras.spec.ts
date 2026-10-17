import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'crypto';
import * as contrato from './dtos-medidas-caseiras';
const entrada = () => ({ chaveIdempotencia: randomUUID(), nome: 'colher rasa', quantidadeReferencia: 1, pesoReferenciaGramas: 25 });
describe('FOOD01 DTOs de biblioteca', () => {
    beforeAll(() => expect(typeof (contrato as any).CriarMedidaCaseiraDto).toBe('function'));
    const erros = (v: any, t = 'CriarMedidaCaseiraDto') => validateSync(plainToInstance((contrato as any)[t], v), { whitelist: true, forbidNonWhitelisted: true });
    it('aceita equivalência explícita e pessoal por padrão', () => expect(erros(entrada())).toHaveLength(0));
    it.each([{ nome: ' ' }, { nome: 'a'.repeat(41) }, { pesoReferenciaGramas: 0 }, { pesoReferenciaGramas: '25' }, { quantidadeReferencia: 0.0001 }, { escopo: 'global' }, { tenantId: randomUUID() }, { profissionalId: randomUUID() }, { chaveIdempotencia: 'x' }, { nome: null }])('recusa payload inválido ou campo arbitrário %#', v => expect(erros({ ...entrada(), ...v }).length).toBeGreaterThan(0));
    it('PATCH exige revisão e não admite alterar escopo ou reativar', () => {
        expect(erros({ revisaoEsperada: 1, ativa: false }, 'AtualizarMedidaCaseiraDto')).toHaveLength(0);
        for (const v of [{ ativa: false }, { revisaoEsperada: 0 }, { revisaoEsperada: 1, ativa: true }, { revisaoEsperada: 1, escopo: 'clinica' }, { revisaoEsperada: 1, nome: null }])
            expect(erros(v, 'AtualizarMedidaCaseiraDto').length).toBeGreaterThan(0);
    });
});
