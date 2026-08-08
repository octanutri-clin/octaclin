import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const entrada = resolve('dist/main.js');

if (!existsSync(entrada)) {
  throw new Error(`Artefato de producao ausente: ${entrada}`);
}

console.log('Artefato de producao validado: dist/main.js');
