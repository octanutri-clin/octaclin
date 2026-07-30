import { normalizarApiUrlBff } from './sessao-bff';

export function obterConfiguracaoAcessoBff() {
  const backendUrl =
    process.env.OCTACLIN_BACKEND_URL?.trim() ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
  const tenantSlug =
    process.env.OCTACLIN_TENANT_SLUG?.trim() ||
    (process.env.NODE_ENV === 'production' ? '' : 'clinica-carla');

  if (!backendUrl || !tenantSlug) {
    throw new Error('Configuracao de acesso incompleta no servidor web.');
  }

  return { apiUrl: normalizarApiUrlBff(backendUrl), tenantSlug };
}
