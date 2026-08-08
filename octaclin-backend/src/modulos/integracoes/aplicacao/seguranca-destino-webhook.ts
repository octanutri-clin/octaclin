import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import type { LookupAddress } from 'dns';
import { isIP } from 'net';

export interface DestinoWebhookValidado {
  url: URL;
  hostname: string;
  endereco: string;
  familia: 4 | 6;
}

function ipv4Privado(endereco: string): boolean {
  const partes = endereco.split('.').map(Number);
  const [a, b] = partes;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6Privado(endereco: string): boolean {
  const valor = endereco.toLowerCase().split('%')[0];
  // Rejeita todo endereco IPv4 mapeado, inclusive a notacao hexadecimal
  // comprimida, para nao deixar representacoes alternativas contornarem SSRF.
  if (valor.startsWith('::ffff:')) return true;
  return (
    valor === '::' ||
    valor === '::1' ||
    valor.startsWith('fc') ||
    valor.startsWith('fd') ||
    /^fe[89ab]/.test(valor) ||
    valor.startsWith('ff') ||
    valor.startsWith('2001:db8:')
  );
}

export function enderecoPublico(endereco: string): boolean {
  const familia = isIP(endereco);
  if (familia === 4) return !ipv4Privado(endereco);
  if (familia === 6) return !ipv6Privado(endereco);
  return false;
}

export async function validarDestinoWebhook(valor: string): Promise<DestinoWebhookValidado> {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new BadRequestException('URL do webhook invalida.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new BadRequestException('Webhook deve usar HTTPS na porta 443 e nao pode conter credenciais.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new BadRequestException('Destino do webhook precisa usar um host publico.');
  }
  let resultados: LookupAddress[];
  try {
    resultados = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new BadRequestException('Nao foi possivel resolver o host do webhook.');
  }
  if (!resultados.length || resultados.some((resultado) => !enderecoPublico(resultado.address))) {
    throw new BadRequestException('Destino do webhook precisa resolver exclusivamente para enderecos publicos.');
  }
  const escolhido = resultados[0];
  return { url, hostname, endereco: escolhido.address, familia: escolhido.family as 4 | 6 };
}
