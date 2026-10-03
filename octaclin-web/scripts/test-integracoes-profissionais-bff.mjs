import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ler = (caminho) => readFileSync(resolve(process.cwd(), caminho), 'utf8');
const profissionalBff = ler('app/api/profissional/integracoes/[...segmentos]/route.ts');
const clienteBff = ler('app/api/cliente/integracoes/[...segmentos]/route.ts');
const controlador = ler('../octaclin-backend/src/modulos/integracoes/apresentacao/controlador-integracoes-profissional.ts');
const servico = ler('../octaclin-backend/src/modulos/integracoes/aplicacao/servico-gestao-integracoes.ts');

assert.match(profissionalBff, /exigirPermissaoBff\('integracoes\.acessar'\)/);
assert.match(profissionalBff, /requisitarBackendAutenticado\(`\/profissional\/integracoes\/\$\{caminho\}`/);
assert.match(profissionalBff, /Cache-Control/);
assert.match(profissionalBff, /const rotasPermitidas = \[/);
assert.match(controlador, /@Papeis\('Professional'\)/);
assert.match(controlador, /@Permissoes\('integracoes\.acessar'\)/);
assert.doesNotMatch(controlador, /tenantId\s*:\s*string/);
assert.match(clienteBff, /permissoes-profissionais/);
assert.match(clienteBff, /profissionais\\\/\[0-9a-f-\]\+\\\/permissoes/);
assert.match(clienteBff, /export const PATCH/);
assert.match(servico, /obterConcessaoNoGerenciador/);
assert.match(servico, /validarDestinoWebhook\(dados\.url\)/);
assert.ok(servico.indexOf('obterAcessoAtual(tenantId, profissional.usuarioId)') < servico.indexOf('await validarDestinoWebhook(dados.url)'));

console.log('Integracoes profissionais BFF: autenticacao, allowlist, papel, grants e ordem de validacao aprovados.');
