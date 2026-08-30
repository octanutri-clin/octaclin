import * as OTPAuth from 'otpauth';
import { ServicoTotp } from './servico-totp';

const SEGREDO = 'JBSWY3DPEHPK3PXP';
const INSTANTE = Date.UTC(2026, 7, 29, 12, 0, 0);

describe('ServicoTotp', () => {
  const servico = new ServicoTotp();

  it('gera segredo forte e URI sem registrar material externo', () => {
    const segredo = servico.gerarSegredo();
    const uri = servico.criarUri(segredo, 'conta-sintetica');

    expect(OTPAuth.Secret.fromBase32(segredo).bytes.byteLength).toBeGreaterThanOrEqual(20);
    expect(uri).toMatch(/^otpauth:\/\/totp\/OctaClin:/);
    expect(uri).toContain('issuer=OctaClin');
  });

  it('aceita somente codigo numerico valido e devolve o contador usado', () => {
    const token = new OTPAuth.TOTP({
      issuer: 'OctaClin',
      label: 'conta-sintetica',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: SEGREDO
    }).generate({ timestamp: INSTANTE });

    expect(servico.validar(SEGREDO, token, INSTANTE)).toEqual({ valido: true, contador: INSTANTE / 30_000 });
    expect(servico.validar(SEGREDO, 'abcdef', INSTANTE)).toEqual({ valido: false });
    expect(servico.validar(SEGREDO, '000000', INSTANTE)).toEqual({ valido: false });
  });
});
