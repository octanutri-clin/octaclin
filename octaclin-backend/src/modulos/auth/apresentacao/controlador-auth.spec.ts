import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CHAVE_REAUTENTICACAO } from './decorators';
import { ControladorAuth } from './controlador-auth';
import { GuardaJwt } from './guarda-jwt';
import { GuardaReautenticacao } from './guarda-reautenticacao';

describe('ControladorAuth - protecao MFA e reautenticacao', () => {
  const prototipo = ControladorAuth.prototype as unknown as Record<string, object>;

  it.each([
    'iniciarConfiguracaoMfa',
    'confirmarConfiguracaoMfa',
    'regenerarCodigosMfa',
    'removerMfa',
    'limparHistoricoSessoes',
    'encerrarOutrasSessoes',
    'encerrarTodasSessoes'
  ])('exige JWT e reautenticacao recente em %s', (metodo) => {
    const alvo = prototipo[metodo];
    const guardas = Reflect.getMetadata(GUARDS_METADATA, alvo) as unknown[];

    expect(guardas).toEqual([GuardaJwt, GuardaReautenticacao]);
    expect(Reflect.getMetadata(CHAVE_REAUTENTICACAO, alvo)).toBe(true);
  });

  it('mantem apenas o desafio assinado como autorizacao dos endpoints publicos de MFA', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, prototipo.configuracaoMfaLogin)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, prototipo.concluirLoginMfa)).toBeUndefined();
  });
});
