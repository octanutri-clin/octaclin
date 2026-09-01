// Gate do lock Python do AI service (PR 49).
//
// `fastapi==0.141.1` em requirements.txt fixa a dependencia direta, mas nao
// congela nada do grafo transitivo: starlette, anyio, h11 e o resto flutuavam a
// cada build. O lock resolvido com hashes fecha esse buraco, e este gate
// garante que ele continue exato, completo e coerente com as diretas.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_AI = join(RAIZ, 'octaclin-ai-service');
export const CAMINHO_DIRETAS = join(PASTA_AI, 'requirements.txt');
export const CAMINHO_LOCK = join(PASTA_AI, 'requirements.lock.txt');

// `uvicorn[standard]==0.52.4` -> nome uvicorn, versao 0.52.4.
const REQUISITO = /^([A-Za-z0-9][A-Za-z0-9._-]*)(\[[^\]]*\])?\s*(==|>=|<=|~=|>|<|!=)?\s*([^\s\;#]+)?/;

function normalizar(nome) {
  return nome.toLowerCase().replace(/[-_.]+/g, '-');
}

export function lerRequisitos(conteudo) {
  const encontrados = [];
  for (const linha of conteudo.split(/\r?\n/)) {
    if (linha.trim() === '' || linha.trimStart().startsWith('#')) continue;
    if (linha.trimStart().startsWith('--')) continue;
    if (/^\s/.test(linha)) continue;
    const casamento = linha.match(REQUISITO);
    if (!casamento) continue;
    encontrados.push({ nome: normalizar(casamento[1]), operador: casamento[3], versao: casamento[4] });
  }
  return encontrados;
}

// Um requisito do lock ocupa uma linha de nome e as linhas indentadas de hash.
export function lerLock(conteudo) {
  const linhas = conteudo.split(/\r?\n/);
  const requisitos = [];
  let atual = null;

  for (const linha of linhas) {
    if (linha.trim() === '') continue;
    if (linha.trimStart().startsWith('#')) continue;

    if (/^\s/.test(linha)) {
      if (atual && linha.includes('--hash=sha256:')) atual.hashes += 1;
      continue;
    }

    const casamento = linha.match(REQUISITO);
    if (!casamento) continue;
    atual = {
      nome: normalizar(casamento[1]),
      operador: casamento[3],
      versao: casamento[4],
      hashes: 0,
    };
    // Hash na mesma linha, quando o gerador nao quebra a linha.
    if (linha.includes('--hash=sha256:')) atual.hashes += 1;
    requisitos.push(atual);
  }

  return requisitos;
}

export function avaliarLock(conteudoLock, conteudoDiretas) {
  const problemas = [];

  if (!/^#.*uv pip compile|^#.*pip-compile/m.test(conteudoLock)) {
    problemas.push(
      'o lock precisa manter o cabecalho que registra o comando de geracao (rastreabilidade).'
    );
  }

  const travados = lerLock(conteudoLock);
  if (travados.length === 0) problemas.push('o lock nao contem nenhum requisito.');

  for (const requisito of travados) {
    if (requisito.operador !== '==' || !requisito.versao) {
      problemas.push(`${requisito.nome}: o lock precisa de versao exata com "==".`);
      continue;
    }
    if (requisito.hashes === 0) {
      problemas.push(`${requisito.nome}==${requisito.versao}: requisito sem hash no lock.`);
    }
  }

  const porNome = new Map(travados.map((requisito) => [requisito.nome, requisito]));
  for (const direta of lerRequisitos(conteudoDiretas)) {
    const travado = porNome.get(direta.nome);
    if (!travado) {
      problemas.push(`${direta.nome}: dependencia direta ausente do lock.`);
      continue;
    }
    if (direta.operador === '==' && travado.versao !== direta.versao) {
      problemas.push(
        `${direta.nome}: requirements.txt pede ${direta.versao} e o lock traz ${travado.versao}; diverge.`
      );
    }
  }

  return problemas.length === 0
    ? {
        aprovado: true,
        pacotes: travados.length,
        problemas,
        mensagem: `Lock Python valido: ${travados.length} pacotes travados com hash.`,
      }
    : {
        aprovado: false,
        pacotes: travados.length,
        problemas,
        mensagem: `Lock Python reprovado (${problemas.length}): ${problemas.join(' ')}`,
      };
}

export function validarLockDoRepositorio() {
  const resultado = avaliarLock(
    readFileSync(CAMINHO_LOCK, 'utf8'),
    readFileSync(CAMINHO_DIRETAS, 'utf8')
  );
  if (!resultado.aprovado) throw new Error(resultado.mensagem);
  return resultado.mensagem;
}

if (process.argv[1] && process.argv[1].endsWith('validar-lock-python.mjs')) {
  console.log(validarLockDoRepositorio());
}
