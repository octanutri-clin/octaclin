// Gate de guardas de autorizacao nos controladores (Fase 261).
//
// O audit inicial da Fase 261 confirmou que toda rota autenticada hoje usa
// @UseGuards(GuardaJwt, GuardaPapeis[, GuardaPermissoes]) -- mas achou uma
// lacuna estrutural: nao existe `APP_GUARD` global em `modulo-aplicacao.ts`,
// entao a protecao de cada controlador e opt-in, decorator por decorator.
// Nada no CI ate agora provava que um controlador novo lembraria de
// declarar o guard; a suite ficava verde mesmo que ele nascesse sem
// nenhuma barreira de autenticacao.
//
// Este gate fecha esse ponto cego: varre todo `@Controller` do backend e
// exige `@UseGuards(...)` em algum lugar do arquivo, ou uma entrada
// explicita e justificada em CONTROLADORES_PUBLICOS. Controlador novo sem
// nenhum dos dois reprova o CI em vez de vazar em silencio.
//
// Nao substitui um teste de autorizacao por rota (guarda errada, papel
// errado continuam sendo bugs que so um teste funcional pega). O que este
// gate prova e mais estreito e ainda assim o que faltava: que a rota tem
// alguma barreira, ou que a ausencia dela foi uma decisao registrada.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const RAIZ_BACKEND = join(RAIZ, 'octaclin-backend', 'src');

/**
 * Controladores publicos por decisao explicita: resolvem quem pode chamar a
 * rota dentro do proprio handler ou com um guard proprio (token opaco,
 * assinatura HMAC, chave de API), nao com a sessao autenticada padrao. Cada
 * entrada exige a mesma pergunta que caberia a um revisor: "por que esta
 * rota nao exige sessao?" -- e a resposta escrita ao lado.
 */
const CONTROLADORES_PUBLICOS = new Map([
  [
    'octaclin-backend/src/modulos/agenda/apresentacao/controlador-agendamento-publico.ts',
    'link publico de agendamento resolvido por token opaco de curta duracao vinculado ao registro, nao por sessao'
  ],
  [
    'octaclin-backend/src/modulos/comunicacoes/apresentacao/controlador-webhook-whatsapp.ts',
    'webhook do Meta: autenticado por assinatura HMAC do corpo bruto (ver controlador), nao por sessao de usuario'
  ],
  [
    'octaclin-backend/src/modulos/saude/controlador-saude.ts',
    'sondas de liveness/readiness (/health, /health/detalhado, /health/pronto) consumidas sem token por monitor e pelo Render'
  ],
  [
    'octaclin-backend/src/modulos/questionarios/apresentacao/controlador-formularios-publicos.ts',
    'formulario publico resolvido por token do envio especifico, nao por sessao'
  ]
]);

function ehArquivoDeProducao(caminho) {
  return caminho.endsWith('.ts') && !caminho.endsWith('.spec.ts') && !caminho.endsWith('.d.ts');
}

function listarArquivos(diretorio) {
  const encontrados = [];
  for (const entrada of readdirSync(diretorio)) {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) encontrados.push(...listarArquivos(caminho));
    else if (ehArquivoDeProducao(caminho)) encontrados.push(caminho);
  }
  return encontrados;
}

/** Remove comentario de linha e de bloco antes de procurar decorators, para que um exemplo comentado nao conte como guarda real. */
function semComentarios(fonte) {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function ehControlador(fonte) {
  return /@Controller\s*\(/.test(semComentarios(fonte));
}

export function listarArquivosControladores(raizBackend = RAIZ_BACKEND) {
  return listarArquivos(raizBackend)
    .map((absoluto) => ({
      caminho: relative(RAIZ, absoluto).replace(/\\/g, '/'),
      fonte: readFileSync(absoluto, 'utf8')
    }))
    .filter(({ fonte }) => ehControlador(fonte));
}

export function executarGate(arquivos = listarArquivosControladores()) {
  const violacoes = [];

  for (const { caminho, fonte } of arquivos) {
    const semComentario = semComentarios(fonte);
    const temGuarda = /@UseGuards\s*\(/.test(semComentario);
    const justificativaPublico = CONTROLADORES_PUBLICOS.get(caminho);

    if (!temGuarda && !justificativaPublico) {
      violacoes.push(
        `${caminho} declara @Controller sem nenhum @UseGuards. Toda rota autenticada precisa de ` +
          'GuardaJwt/GuardaPapeis/GuardaPermissoes (ou guarda equivalente). Se a rota e legitimamente ' +
          'publica, declare-a em CONTROLADORES_PUBLICOS deste arquivo com a justificativa.'
      );
    }
    if (temGuarda && justificativaPublico) {
      violacoes.push(
        `${caminho} esta em CONTROLADORES_PUBLICOS mas ja declara @UseGuards. ` +
          'A entrada ficou obsoleta -- remova-a de CONTROLADORES_PUBLICOS deste arquivo.'
      );
    }
  }

  return { total: arquivos.length, violacoes };
}

/**
 * So faz sentido contra o percurso real e completo do backend: um teste que
 * passa um subconjunto sintetico de arquivos nao pode ser acusado de allowlist
 * obsoleta so por nao incluir os quatro caminhos publicos conhecidos.
 */
export function verificarAllowlistAtualizada(arquivos) {
  const caminhos = new Set(arquivos.map((arquivo) => arquivo.caminho));
  return [...CONTROLADORES_PUBLICOS.keys()]
    .filter((caminho) => !caminhos.has(caminho))
    .map(
      (caminho) =>
        `CONTROLADORES_PUBLICOS referencia ${caminho}, que nao existe mais ou nao declara @Controller. ` +
        'Remova a entrada obsoleta deste arquivo.'
    );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const arquivos = listarArquivosControladores();
  const { total, violacoes } = executarGate(arquivos);
  const violacoesAllowlist = verificarAllowlistAtualizada(arquivos);
  console.log(`${total} controladores verificados.`);

  const todasViolacoes = [...violacoes, ...violacoesAllowlist];
  if (todasViolacoes.length) {
    console.error(`\n${todasViolacoes.length} reprovacoes:\n`);
    for (const violacao of todasViolacoes) console.error(`  - ${violacao}`);
    process.exit(1);
  }
  console.log('Guardas de autorizacao dos controladores verificadas.');
}
