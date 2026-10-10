import { validateSync } from 'class-validator';
import { CHAVES_KIT_INICIAL_CLINICA } from '../kit-inicial-clinica';
import { InstalarKitInicialClinicaRequestDto } from './instalar-kit-inicial-clinica.dto';

function validar(valor: object) {
  return validateSync(Object.assign(new InstalarKitInicialClinicaRequestDto(), valor), {
    whitelist: true,
    forbidNonWhitelisted: true
  });
}

describe('InstalarKitInicialClinicaRequestDto', () => {
  it('aceita uma seleção conhecida com confirmação explícita', () => {
    expect(validar({ confirmacao: true, versao: 2, itens: [CHAVES_KIT_INICIAL_CLINICA[0]] })).toEqual([]);
  });

  it.each([
    { confirmacao: false, versao: 2, itens: [CHAVES_KIT_INICIAL_CLINICA[0]] },
    { confirmacao: true, versao: 1, itens: [CHAVES_KIT_INICIAL_CLINICA[0]] },
    { confirmacao: true, versao: 2, itens: [] },
    { confirmacao: true, versao: 2, itens: ['desconhecido'] },
    { confirmacao: true, versao: 2, itens: [CHAVES_KIT_INICIAL_CLINICA[0], CHAVES_KIT_INICIAL_CLINICA[0]] },
    { confirmacao: true, versao: 2, itens: [CHAVES_KIT_INICIAL_CLINICA[0]], tenantId: 'outro-tenant' }
  ])('rejeita body inválido ou com campos que o cliente não controla', (valor) => {
    expect(validar(valor).length).toBeGreaterThan(0);
  });
});
