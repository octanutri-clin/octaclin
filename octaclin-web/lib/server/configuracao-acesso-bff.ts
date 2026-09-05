import { normalizarApiUrlBff } from './sessao-bff';

/**
 * Onde o BFF encontra o backend. Fonte unica, para as rotas de `app/api`.
 *
 * Ate 2026-09-05 cada rota publica de `app/api` carregava a sua propria copia
 * desta decisao, na forma
 * `OCTACLIN_BACKEND_URL ?? NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`.
 * Eram onze copias, e as tres partes da expressao estavam erradas por motivos
 * diferentes:
 *
 * 1. **`NEXT_PUBLIC_API_URL` e publica.** O prefixo `NEXT_PUBLIC_` existe para
 *    embarcar o valor no bundle do navegador. Usa-la para decidir a origem do
 *    backend numa rota **server-side** entrega essa decisao a uma variavel cujo
 *    proposito e o oposto. Ela nao esta em `VARIAVEIS_AMBIENTE.md`, nao esta em
 *    nenhum `.env.example` e nao aparece em compose nem em workflow: era
 *    configuracao invisivel decidindo trafego de servidor.
 * 2. **O fallback mascarava a ausencia da variavel certa.** Em 2026-09-03 o web
 *    de staging estava sem `OCTACLIN_BACKEND_URL`. O login quebrou -- ele passa
 *    por {@link obterConfiguracaoAcessoBff}, que nao tem fallback -- e as onze
 *    rotas publicas continuaram respondendo, porque caiam na variavel legada.
 *    Um desvio de configuracao que derruba uma parte do sistema e deixa a outra
 *    verde e mais dificil de diagnosticar do que uma queda inteira.
 * 3. **`'http://localhost:3001'` nao e um destino valido em producao.** Ali ele
 *    nao e um padrao: e uma falha adiada, que troca "configuracao ausente" por
 *    "conexao recusada" no momento em que alguem usa a rota.
 *
 * A regra passa a ser a mesma do login, que ja estava certa: em producao a
 * variavel e obrigatoria e a ausencia falha fechado; fora de producao, o
 * localhost continua sendo o padrao de desenvolvimento.
 *
 * `normalizarApiUrlBff` continua sendo quem valida a URL -- protocolo, ausencia
 * de credencial, ausencia de query e a lista de origens permitidas do ambiente.
 * Esta funcao decide **de onde vem** o valor; ela nao afrouxa nada do que ja era
 * verificado.
 */
export function obterApiUrlBff(): string {
  const backendUrl =
    process.env.OCTACLIN_BACKEND_URL?.trim() ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');

  if (!backendUrl) {
    throw new Error('Configuracao de acesso incompleta no servidor web.');
  }

  return normalizarApiUrlBff(backendUrl);
}

/**
 * Configuracao do fluxo de acesso: origem do backend e tenant.
 *
 * O tenant e exigido aqui e nao em {@link obterApiUrlBff} porque as rotas
 * publicas -- formulario por token, convite de acesso, recuperacao de senha,
 * agendamento publico -- resolvem o tenant a partir do proprio token, no
 * backend. Exigir `OCTACLIN_TENANT_SLUG` delas derrubaria rota que nao usa o
 * valor.
 */
export function obterConfiguracaoAcessoBff() {
  const tenantSlug =
    process.env.OCTACLIN_TENANT_SLUG?.trim() ||
    (process.env.NODE_ENV === 'production' ? '' : 'clinica-carla');

  if (!tenantSlug) {
    throw new Error('Configuracao de acesso incompleta no servidor web.');
  }

  return { apiUrl: obterApiUrlBff(), tenantSlug };
}
