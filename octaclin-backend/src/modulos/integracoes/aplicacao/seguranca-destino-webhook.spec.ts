import { enderecoPublico } from './seguranca-destino-webhook';

describe('seguranca de destino de webhook', () => {
  it.each(['127.0.0.1', '10.2.3.4', '172.16.0.1', '192.168.1.1', '169.254.1.1', '100.64.1.1'])(
    'bloqueia IPv4 privado %s',
    (endereco) => expect(enderecoPublico(endereco)).toBe(false)
  );

  it.each(['::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:192.168.1.2', '::ffff:7f00:1'])(
    'bloqueia IPv6 privado ou mapeado %s',
    (endereco) => expect(enderecoPublico(endereco)).toBe(false)
  );

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
    'aceita endereco publico %s',
    (endereco) => expect(enderecoPublico(endereco)).toBe(true)
  );
});
