// Registry npm local e efemero para provas de supply chain (PR 49).
//
// Uma dependencia `file:` nao exercita o mesmo caminho de um pacote de
// registry: o pnpm identifica tarball local pelo id de resolucao completo e
// pula parte da verificacao quando o store ja esta quente. Para que a prova de
// lifecycle script seja fiel, o gate publica a fixture num registry local que
// existe apenas durante o teste.
//
// Nao ha publicacao externa, credencial ou pacote remoto envolvido: o servidor
// escuta em 127.0.0.1, numa porta efemera, e serve um unico pacote sintetico.

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

function integridadeSha512(buffer) {
  return `sha512-${createHash('sha512').update(buffer).digest('base64')}`;
}

export function criarRegistryLocal({ nome, versao, tarball, publicadoEm }) {
  const integrity = integridadeSha512(tarball);
  const caminhoTarball = `/${nome}/-/${nome}-${versao}.tgz`;

  const servidor = createServer((requisicao, resposta) => {
    const url = requisicao.url ?? '/';

    if (url === caminhoTarball) {
      resposta.writeHead(200, {
        'content-type': 'application/octet-stream',
        'content-length': String(tarball.length),
      });
      resposta.end(tarball);
      return;
    }

    if (url === `/${nome}` || url === `/${encodeURIComponent(nome)}`) {
      const endereco = servidor.address();
      const base = `http://127.0.0.1:${endereco.port}`;
      const packument = {
        _id: nome,
        name: nome,
        'dist-tags': { latest: versao },
        time: { created: publicadoEm, modified: publicadoEm, [versao]: publicadoEm },
        versions: {
          [versao]: {
            name: nome,
            version: versao,
            scripts: { postinstall: 'node postinstall.js' },
            dist: { tarball: `${base}${caminhoTarball}`, integrity },
          },
        },
      };
      const corpo = Buffer.from(JSON.stringify(packument));
      resposta.writeHead(200, {
        'content-type': 'application/json',
        'content-length': String(corpo.length),
      });
      resposta.end(corpo);
      return;
    }

    resposta.writeHead(404, { 'content-type': 'application/json' });
    resposta.end('{"error":"Not found"}');
  });

  return {
    async iniciar() {
      await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
      return `http://127.0.0.1:${servidor.address().port}/`;
    },
    async parar() {
      await new Promise((resolver) => servidor.close(resolver));
    },
  };
}

// Executavel como processo separado: as provas rodam `pnpm` de forma sincrona
// e bloqueariam o event loop deste servidor se ele vivesse no mesmo processo.
// Uso: node scripts/registry-fixture-local.mjs <tarball> <nome> <versao> <publicadoEm>
// Imprime a URL do registry na primeira linha do stdout e permanece no ar ate
// receber SIGTERM.
if (process.argv[1] && process.argv[1].endsWith('registry-fixture-local.mjs')) {
  const [tarballPath, nome, versao, publicadoEm] = process.argv.slice(2);
  const { readFileSync } = await import('node:fs');
  const servidor = criarRegistryLocal({
    nome,
    versao,
    tarball: readFileSync(tarballPath),
    publicadoEm,
  });
  const url = await servidor.iniciar();
  process.stdout.write(`${url}\n`);
  const encerrar = () => {
    servidor.parar().then(() => process.exit(0));
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}
