import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { executarProvas } from './validar-instalacao-congelada.mjs';

// A prova executa o pnpm real duas vezes por cenario e baixa a fixture de um
// registry local; o limite maior evita falso vermelho em runner lento.
test(
  'lifecycle nao aprovado falha, lifecycle aprovado passa e manifest divergente reprova o modo congelado',
  { timeout: 300000 },
  async () => {
    assert.match(await executarProvas(), /provados com o pnpm real/);
  }
);

test('nenhum workspace habilita execucao irrestrita de build script', () => {
  for (const arquivo of [
    'pnpm-workspace.yaml',
    'octaclin-backend/pnpm-workspace.yaml',
    'octaclin-web/pnpm-workspace.yaml',
    'octaclin-mobile/pnpm-workspace.yaml',
  ]) {
    const conteudo = readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
    assert.doesNotMatch(
      conteudo,
      /dangerouslyAllowAllBuilds\s*:\s*true/,
      `${arquivo} nao pode liberar todos os build scripts`
    );
    assert.match(
      conteudo,
      /^strictDepBuilds:\s*true$/m,
      `${arquivo} precisa negar lifecycle script por padrao`
    );
    assert.match(conteudo, /^blockExoticSubdeps:\s*true$/m, `${arquivo} precisa bloquear subdeps exoticas`);
    assert.match(conteudo, /^trustPolicy:\s*no-downgrade$/m, `${arquivo} precisa de trustPolicy`);
    assert.match(conteudo, /^minimumReleaseAge:\s*\d+$/m, `${arquivo} precisa de minimumReleaseAge`);
    assert.match(
      conteudo,
      /^verifyStoreIntegrity:\s*true$/m,
      `${arquivo} nao pode desligar a verificacao de integridade do store`
    );
    assert.match(
      conteudo,
      /^strictStorePkgContentCheck:\s*true$/m,
      `${arquivo} nao pode desligar a checagem de conteudo do store`
    );
    assert.doesNotMatch(
      conteudo,
      /^trustLockfile:\s*true$/m,
      `${arquivo} nao pode confiar cegamente no lockfile`
    );
  }
});
