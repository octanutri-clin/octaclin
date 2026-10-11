"""Transporte HTTPS restrito para pesquisa pública, fora do runtime clínico.

Hosts explícitos, TLS padrão e nenhum redirecionamento automático. Uma fonte que
mudar de endereço exige revisão do manifesto; nunca seguir destino arbitrário.
"""
import http.client
import ssl
import urllib.parse


def fetch_https(url, *, allowed_hosts, data=None, headers=None, timeout=30):
    if not isinstance(url, str) or any(ord(c) <= 32 or ord(c) == 127 for c in url) or '\\' in url:
        raise ValueError('URL de pesquisa inválida')
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'https' or parsed.hostname not in allowed_hosts
            or parsed.username is not None or parsed.password is not None
            or parsed.port not in (None, 443) or parsed.fragment):
        raise ValueError('Fonte fora da allowlist HTTPS de pesquisa')
    target = urllib.parse.urlunsplit(('', '', parsed.path or '/', parsed.query, ''))
    request_headers = dict(headers or {})
    if data is not None:
        request_headers.setdefault('Content-Type', 'application/x-www-form-urlencoded')
    # CERT_REQUIRED + check_hostname explícitos: não depender de defaults históricos.
    context = ssl.create_default_context()
    context.verify_mode = ssl.CERT_REQUIRED
    context.check_hostname = True
    connection = http.client.HTTPSConnection(parsed.hostname, timeout=timeout, context=context)
    try:
        connection.request('POST' if data is not None else 'GET', target,
                           body=data, headers=request_headers)
        response = connection.getresponse()
        if not 200 <= response.status < 300:
            raise ValueError(f'Fonte respondeu HTTP {response.status}; redirecionamentos não permitidos')
        return response.read(), response.status
    finally:
        connection.close()
