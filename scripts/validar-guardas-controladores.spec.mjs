import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ehControlador,
  executarGate,
  listarArquivosControladores,
  verificarAllowlistAtualizada
} from './validar-guardas-controladores.mjs';

function arquivo(caminho, fonte) {
  return { caminho, fonte };
}

test('aceita controlador com @UseGuards de sessao', () => {
  const { violacoes } = executarGate([
    arquivo(
      'octaclin-backend/src/modulos/exemplo/apresentacao/controlador-exemplo.ts',
      "@Controller('exemplo')\n@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)\nexport class ControladorExemplo {}"
    )
  ]);
  assert.deepEqual(violacoes, []);
});

test('aceita controlador com guarda proprio (chave de API)', () => {
  const { violacoes } = executarGate([
    arquivo(
      'octaclin-backend/src/modulos/exemplo/apresentacao/controlador-api.ts',
      "@Controller('api')\n@UseGuards(GuardaChaveApi, GuardaEscopoApi)\nexport class ControladorApi {}"
    )
  ]);
  assert.deepEqual(violacoes, []);
});

test('reprova controlador novo sem nenhum @UseGuards e sem justificativa', () => {
  const { violacoes } = executarGate([
    arquivo(
      'octaclin-backend/src/modulos/exemplo/apresentacao/controlador-sem-guarda.ts',
      "@Controller('exemplo')\nexport class ControladorSemGuarda {\n  @Get()\n  listar() {}\n}"
    )
  ]);
  assert.equal(violacoes.length, 1);
  assert.match(violacoes[0], /sem nenhum @UseGuards/);
  assert.match(violacoes[0], /CONTROLADORES_PUBLICOS/);
});

test('nao deixa um @UseGuards comentado contar como guarda real', () => {
  const { violacoes } = executarGate([
    arquivo(
      'octaclin-backend/src/modulos/exemplo/apresentacao/controlador-guarda-comentada.ts',
      "@Controller('exemplo')\n// @UseGuards(GuardaJwt)\nexport class ControladorGuardaComentada {}"
    )
  ]);
  assert.equal(violacoes.length, 1);
  assert.match(violacoes[0], /sem nenhum @UseGuards/);
});

test('ehControlador nao reconhece um arquivo sem @Controller', () => {
  assert.equal(ehControlador('export class ServicoExemplo {}'), false);
});

test('ehControlador ignora @Controller mencionado so em comentario', () => {
  assert.equal(ehControlador("// @Controller('exemplo')\nexport class ServicoExemplo {}"), false);
});

test('ehControlador reconhece um @Controller real', () => {
  assert.equal(ehControlador("@Controller('exemplo')\nexport class ControladorExemplo {}"), true);
});

test('reprova entrada de CONTROLADORES_PUBLICOS que ja ganhou @UseGuards (allowlist obsoleta)', () => {
  const { violacoes } = executarGate([
    arquivo(
      'octaclin-backend/src/modulos/saude/controlador-saude.ts',
      "@Controller('health')\n@UseGuards(GuardaJwt)\nexport class ControladorSaude {}"
    )
  ]);
  assert.equal(violacoes.length, 1);
  assert.match(violacoes[0], /ja declara @UseGuards/);
});

test('verificarAllowlistAtualizada reprova caminho publico que nao aparece no percurso informado', () => {
  const violacoes = verificarAllowlistAtualizada([]);
  assert.equal(violacoes.length, 4);
  for (const violacao of violacoes) assert.match(violacao, /nao existe mais ou nao declara @Controller/);
});

test('verificarAllowlistAtualizada aceita quando todo caminho publico aparece no percurso', () => {
  const arquivosReais = listarArquivosControladores();
  assert.deepEqual(verificarAllowlistAtualizada(arquivosReais), []);
});

test('varredura real do backend: todo controlador tem guarda ou justificativa registrada', () => {
  const arquivosReais = listarArquivosControladores();
  const { total, violacoes } = executarGate(arquivosReais);
  assert.deepEqual(violacoes, []);
  assert.deepEqual(verificarAllowlistAtualizada(arquivosReais), []);
  assert.ok(total >= 30, `esperava pelo menos 30 controladores reais, achou ${total}`);
});
