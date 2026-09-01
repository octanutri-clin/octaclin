// Provas reproduziveis de instalacao congelada e de lifecycle script negado
// por padrao (PR 49).
//
// Configuracao presente nao e controle ativo: ate este PR o repositorio
// declarava `allowBuilds` em pnpm-workspace.yaml enquanto fixava um pnpm que
// ignora essa chave, e o CI instalava com `--frozen-lockfile=false`. Por isso o
// gate executa o pnpm real fixado em `packageManager` sobre fixtures
// sinteticas, em vez de validar YAML por expressao regular.
//
// Nenhum pacote remoto e envolvido: a fixture e gerada no proprio teste e
// servida por um registry local efemero em 127.0.0.1.

import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';

const CAMINHO_REGISTRY = fileURLToPath(new URL('./registry-fixture-local.mjs', import.meta.url));

const NOME_FIXTURE = 'octaclin-fixture-build-script';
const VERSAO_FIXTURE = '1.0.0';
// Data antiga o bastante para nunca esbarrar em minimumReleaseAge.
const PUBLICADO_EM = '2020-01-01T00:00:00.000Z';

function tentarPnpm(args, { cwd, storeDir, env = {} }) {
  try {
    const saida = execFileSync('pnpm', [...args, '--store-dir', storeDir], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    return { ok: true, saida };
  } catch (erro) {
    return { ok: false, saida: `${erro.stdout ?? ''}${erro.stderr ?? ''}` };
  }
}

// O postinstall so escreve um arquivo marcador: o teste observa se o pnpm
// executou codigo da dependencia, sem efeito colateral fora do diretorio.
export function empacotarFixture(raizTemporaria) {
  const pasta = join(raizTemporaria, 'fixture');
  mkdirSync(pasta, { recursive: true });
  writeFileSync(
    join(pasta, 'package.json'),
    `${JSON.stringify(
      {
        name: NOME_FIXTURE,
        version: VERSAO_FIXTURE,
        scripts: { postinstall: 'node postinstall.js' },
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(pasta, 'postinstall.js'),
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "fs.writeFileSync(path.join(process.env.OCTACLIN_FIXTURE_MARCADOR, 'marcador-build.txt'), 'executado');",
      '',
    ].join('\n')
  );
  writeFileSync(join(pasta, 'index.js'), 'module.exports = {};\n');

  execFileSync('npm', ['pack', pasta, '--pack-destination', raizTemporaria], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return join(raizTemporaria, `${NOME_FIXTURE}-${VERSAO_FIXTURE}.tgz`);
}

function escreverProjeto(pasta, { allowBuilds, registry, dependencias }) {
  mkdirSync(pasta, { recursive: true });
  writeFileSync(
    join(pasta, 'package.json'),
    `${JSON.stringify(
      { name: 'prova-supply-chain', version: '1.0.0', private: true, dependencies: dependencias },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(pasta, 'pnpm-workspace.yaml'),
    `packages:\n  - "."\n\nstrictDepBuilds: true\nallowBuilds:${allowBuilds}\n`
  );
  // O registry efemero vale apenas para este projeto temporario.
  writeFileSync(join(pasta, '.npmrc'), `registry=${registry}\n`);
}

export function provarLifecycleNegadoPorPadrao({ raizTemporaria, registry, storeDir }) {
  const pasta = join(raizTemporaria, 'lifecycle');
  const dependencias = { [NOME_FIXTURE]: VERSAO_FIXTURE };

  escreverProjeto(pasta, { allowBuilds: ' {}', registry, dependencias });
  const negado = tentarPnpm(['install', '--no-frozen-lockfile'], {
    cwd: pasta,
    storeDir,
    env: { OCTACLIN_FIXTURE_MARCADOR: pasta },
  });
  if (negado.ok) {
    throw new Error(
      'Dependencia com lifecycle script nao aprovada deveria falhar a instalacao, mas passou.'
    );
  }
  if (!negado.saida.includes('IGNORED_BUILDS')) {
    throw new Error(`Falha esperada por build ignorado, mas a saida foi outra:\n${negado.saida}`);
  }
  if (existsSync(join(pasta, 'marcador-build.txt'))) {
    throw new Error('O lifecycle script da dependencia nao aprovada foi executado.');
  }

  escreverProjeto(pasta, {
    allowBuilds: `\n  ${NOME_FIXTURE}: true`,
    registry,
    dependencias,
  });
  rmSync(join(pasta, 'node_modules'), { recursive: true, force: true });

  const permitido = tentarPnpm(['install', '--no-frozen-lockfile'], {
    cwd: pasta,
    storeDir,
    env: { OCTACLIN_FIXTURE_MARCADOR: pasta },
  });
  if (!permitido.ok) {
    throw new Error(`Dependencia explicitamente aprovada deveria instalar:\n${permitido.saida}`);
  }
  if (!existsSync(join(pasta, 'marcador-build.txt'))) {
    throw new Error('A dependencia aprovada nao executou o proprio build script.');
  }

  return true;
}

export function provarManifestDivergenteFalhaCongelado({ raizTemporaria, registry, storeDir }) {
  const pasta = join(raizTemporaria, 'congelado');
  escreverProjeto(pasta, {
    allowBuilds: `\n  ${NOME_FIXTURE}: true`,
    registry,
    dependencias: { [NOME_FIXTURE]: VERSAO_FIXTURE },
  });

  const semear = tentarPnpm(['install', '--no-frozen-lockfile'], {
    cwd: pasta,
    storeDir,
    env: { OCTACLIN_FIXTURE_MARCADOR: pasta },
  });
  if (!semear.ok) throw new Error(`Nao foi possivel gerar o lockfile da fixture:\n${semear.saida}`);

  const coerente = tentarPnpm(['install', '--frozen-lockfile'], {
    cwd: pasta,
    storeDir,
    env: { OCTACLIN_FIXTURE_MARCADOR: pasta },
  });
  if (!coerente.ok) {
    throw new Error(`Manifest e lockfile coerentes deveriam passar congelados:\n${coerente.saida}`);
  }

  // Altera o manifest sem regenerar o lockfile: o modo congelado precisa recusar.
  const manifesto = JSON.parse(readFileSync(join(pasta, 'package.json'), 'utf8'));
  manifesto.dependencies['pacote-inexistente-de-teste'] = '^1.0.0';
  writeFileSync(join(pasta, 'package.json'), `${JSON.stringify(manifesto, null, 2)}\n`);

  const divergente = tentarPnpm(['install', '--frozen-lockfile'], {
    cwd: pasta,
    storeDir,
    env: { OCTACLIN_FIXTURE_MARCADOR: pasta },
  });
  if (divergente.ok) {
    throw new Error('Manifest divergente do lockfile deveria falhar a instalacao congelada.');
  }
  if (!/OUTDATED_LOCKFILE|frozen/i.test(divergente.saida)) {
    throw new Error(
      `Falha esperada por lockfile desatualizado, mas a saida foi outra:\n${divergente.saida}`
    );
  }

  return true;
}

// O registry vive num processo separado: as provas chamam `pnpm` de forma
// sincrona e bloqueariam o event loop de um servidor no mesmo processo.
function iniciarRegistry(tarball) {
  const processo = spawn(
    process.execPath,
    [CAMINHO_REGISTRY, tarball, NOME_FIXTURE, VERSAO_FIXTURE, PUBLICADO_EM],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  return new Promise((resolver, rejeitar) => {
    let buffer = '';
    const aoFalhar = (erro) => rejeitar(new Error(`Registry local nao subiu: ${erro}`));
    processo.stdout.on('data', (pedaco) => {
      buffer += pedaco.toString();
      const quebra = buffer.indexOf('\n');
      if (quebra !== -1) resolver({ url: buffer.slice(0, quebra).trim(), processo });
    });
    processo.stderr.on('data', (pedaco) => aoFalhar(pedaco.toString()));
    processo.on('error', aoFalhar);
    processo.on('exit', (codigo) => aoFalhar(`saiu com codigo ${codigo}`));
  });
}

export async function executarProvas() {
  const raizTemporaria = mkdtempSync(join(tmpdir(), 'octaclin-supply-'));
  const storeDir = join(raizTemporaria, 'store');
  const tarball = empacotarFixture(raizTemporaria);
  const { url: registry, processo } = await iniciarRegistry(tarball);

  try {
    provarLifecycleNegadoPorPadrao({ raizTemporaria, registry, storeDir });
    provarManifestDivergenteFalhaCongelado({ raizTemporaria, registry, storeDir });
    return 'Instalacao congelada e lifecycle negado por padrao provados com o pnpm real.';
  } finally {
    processo.kill('SIGTERM');
    rmSync(raizTemporaria, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith('validar-instalacao-congelada.mjs')) {
  executarProvas().then(
    (mensagem) => console.log(mensagem),
    (erro) => {
      console.error(erro.message);
      process.exitCode = 1;
    }
  );
}
