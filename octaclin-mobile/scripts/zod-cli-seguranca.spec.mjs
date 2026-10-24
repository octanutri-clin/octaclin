import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const requireExpo = createRequire(require.resolve('expo/package.json'));
const requireCli = createRequire(requireExpo.resolve('@expo/cli/package.json'));
const { z } = requireCli('zod');
const { PluginSchema, DevToolsPluginOutputSchema } = requireCli('./build/src/start/server/DevToolsPlugin.schema.js');
const { createMCPDevToolsExtensionSchema } = requireCli('./build/src/start/server/createMCPDevToolsExtensionSchema.js');

// Entradas pequenas e sinteticas: provar o curto-circuito sem pressionar memoria.
test('Zod da Expo CLI rejeita array acima do limite antes de processar elementos', () => {
  let processados = 0;
  const elemento = z.string().refine(() => { processados += 1; return true; });
  for (const schema of [z.array(elemento).max(2), z.array(elemento).length(2)]) {
    const resultado = schema.safeParse(['a', 'b', 'c']);
    assert.equal(resultado.success, false);
    assert.equal(resultado.error.issues[0].code, 'too_big');
    assert.equal(processados, 0);
  }
});

test('Zod da Expo CLI rejeita array excedente antes das refinacoes assincronas', async () => {
  let processados = 0;
  const schema = z.array(z.string().refine(async () => { processados += 1; return true; })).max(2);
  assert.equal((await schema.safeParseAsync(['a', 'b', 'c'])).success, false);
  assert.equal(processados, 0);
});

test('limite de tamanho preserva a validacao dos elementos permitidos', () => {
  const schema = z.array(z.string()).max(2);
  assert.deepEqual(schema.parse(['a', 'b']), ['a', 'b']);
  assert.equal(schema.safeParse(['a', 2]).success, false);
});

test('schemas reais da Expo CLI conservam plugins, saidas e parametros MCP', () => {
  const plugin = {
    packageName: 'plugin-sintetico', packageRoot: '/sintetico',
    cliExtensions: { description: 'Fixture sintetica', entryPoint: 'fixture.js', commands: [
      { name: 'consultar', title: 'Consulta sintetica', environments: ['cli', 'mcp'], parameters: [
        { name: 'pagina', type: 'number' }, { name: 'confirmado', type: 'confirm' }, { name: 'texto', type: 'text' }
      ] }
    ] }
  };
  const validado = PluginSchema.parse(plugin);
  assert.equal(Object.isFrozen(validado.cliExtensions.commands[0].environments), true);
  assert.equal(PluginSchema.safeParse({ ...plugin, packageName: '' }).success, false);
  const schema = createMCPDevToolsExtensionSchema(validado);
  assert.deepEqual(schema.parse({ command: 'consultar', pagina: 1, confirmado: true, texto: 'fixture' }),
    { command: 'consultar', pagina: 1, confirmado: true, texto: 'fixture' });
  assert.equal(schema.safeParse({ command: 'inexistente' }).success, false);
  assert.equal(schema.safeParse({ command: 'consultar', pagina: '1' }).success, false);
  assert.equal(schema.safeParse({ command: 'consultar', extra: true }).success, false);
  assert.deepEqual(DevToolsPluginOutputSchema.parse([{ type: 'text', text: 'Fixture', level: 'info' }]),
    [{ type: 'text', text: 'Fixture', level: 'info' }]);
  assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'text', text: 1 }]).success, false);
});
