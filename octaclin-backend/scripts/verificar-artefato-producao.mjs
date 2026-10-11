import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const entrada = resolve('dist/main.js');

if (!existsSync(entrada)) {
  throw new Error(`Artefato de producao ausente: ${entrada}`);
}

console.log('Artefato de producao validado: dist/main.js');

// Fase314: a investigação e seus coeficientes não podem ser distribuídos no runtime.
function verificarPasta(pasta) {
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    const arquivo = resolve(pasta, item.name);
    if (item.isDirectory()) { verificarPasta(arquivo); continue; }
    if (/intergrowth-investigacao|\.spec\./.test(item.name)) throw new Error('Artefato de pesquisa/teste indevido no build.');
    if (item.name.endsWith('.js') && /2\.591277|2201\.705|505\.92394/.test(readFileSync(arquivo,'utf8'))) throw new Error('Coeficientes de pesquisa indevidos no runtime.');
  }
}
verificarPasta(resolve('dist'));
