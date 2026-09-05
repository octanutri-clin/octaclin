import assert from 'node:assert/strict';
import test from 'node:test';

import {
  executarGate,
  extrairChavesDeMetadados,
  extrairChavesDoLiteral,
  garantirAusenciaDeCaminhoNaoMapeado,
  recortarArgumentos,
  recortarLiteral
} from './validar-redacao-auditoria.mjs';

// O gate so vale se ele mesmo for testado contra o que deveria reprovar. Um
// extrator que perde call site em silencio devolve verde e produz a mesma
// confianca infundada que o PR 52 existe para desfazer -- foi assim que
// `filtros: { ...filtros }`, `humor` e `motivo` passaram por revisao humana, e
// foi assim que a familia inteira de envoltorios privados (`auditar`,
// `registrar`, `registrarAuditoria`) ficou fora do inventario ate a fase 1b.

/** Uma declaracao de envoltorio, no formato de ENVOLTORIOS_DECLARADOS. */
const ENVOLTORIO_EXEMPLO = [
  { envoltorio: 'auditar', argumento: 4, repassa: 'metadados', porque: 'exemplo de teste' }
];

test('o backend atual passa no gate de cobertura da redacao', () => {
  const { violacoes, inventario, ocorrencias } = executarGate();
  assert.deepEqual(violacoes, [], violacoes.join('\n'));
  // Piso de sanidade: se o extrator quebrar e passar a achar quase nada, o
  // gate ficaria verde por nao olhar para lugar nenhum. O piso subiu junto com
  // o inventario -- a fase 1b passou a ler os call sites dos envoltorios
  // declarados, e o que era 97 chaves em 90 call sites virou 181 em 148. Um
  // piso que nao acompanha o crescimento deixa de detectar a regressao que ele
  // existe para detectar.
  assert.ok(inventario.size > 150, `inventario suspeito de chaves: ${inventario.size}`);
  assert.ok(ocorrencias.length > 120, `poucos call sites encontrados: ${ocorrencias.length}`);
});

test('extrai chave de literal em uma unica linha, que e a forma mais comum', () => {
  const { chaves } = extrairChavesDoLiteral("{ origem: 'teste', total: 3 }");
  assert.deepEqual(chaves, ['origem', 'total']);
});

test('extrai chave aninhada, shorthand e chave entre aspas', () => {
  const { chaves } = extrairChavesDoLiteral(
    "{ preferenciasContato: { email: a, whatsapp: b }, totalItens, 'status': 'ativa' }"
  );
  assert.deepEqual(chaves, ['preferenciasContato', 'email', 'whatsapp', 'totalItens', 'status']);
});

test('nao confunde item de array nem chamada de metodo com chave', () => {
  const { chaves } = extrairChavesDoLiteral(
    '{ categorias: [alfa, beta], possuiMotivo: Boolean(dados.motivo?.trim()) }'
  );
  assert.deepEqual(chaves, ['categorias', 'possuiMotivo']);
});

test('acusa espalhamento de origem opaca dentro de metadados, e diz qual e a origem', () => {
  assert.deepEqual(extrairChavesDoLiteral('{ ...filtros }').espalhamentos, ['filtros']);
  assert.deepEqual(extrairChavesDoLiteral('{ ...dados.extras }').espalhamentos, ['dados.extras']);
  assert.deepEqual(extrairChavesDoLiteral('{ ...montarExtras() }').espalhamentos, ['montarExtras']);
});

test('nao acusa campo condicional, cujas chaves estao a vista e sao recolhidas', () => {
  const resultado = extrairChavesDoLiteral('{ tipo: t, ...(opaco ? { alvoOpaco: true } : {}) }');

  assert.deepEqual(resultado.espalhamentos, []);
  assert.deepEqual(resultado.chaves, ['tipo', 'alvoOpaco']);
});

test('recorte do literal ignora chave de fechamento dentro de string', () => {
  const fonte = "{ motivo: 'nao compareceu }', ok: 1 } sobra";
  assert.equal(recortarLiteral(fonte, 0), "{ motivo: 'nao compareceu }', ok: 1 }");
});

test('recorta argumentos de nivel superior sem se perder em virgula aninhada', () => {
  const fonte = "f(usuario, 'a, b', { x: [1, 2], y: g(3, 4) }, ultimo)";
  const argumentos = recortarArgumentos(fonte, fonte.indexOf('('));

  assert.equal(argumentos.length, 4);
  assert.equal(argumentos[1].trim(), "'a, b'");
  assert.equal(argumentos[2].trim(), '{ x: [1, 2], y: g(3, 4) }');
});

test('so considera metadados de escrita da trilha, e nao a palavra solta', () => {
  const fonte = [
    "const relatorio = { metadados: { arquivoOrigem: 'taco.csv' } };",
    "await this.servicoAuditoria.registrar({ acao: 'x', metadados: { origem: 'teste' } });"
  ].join('\n');

  const ocorrencias = extrairChavesDeMetadados(fonte, 'exemplo.ts');

  assert.equal(ocorrencias.length, 1);
  assert.deepEqual(ocorrencias[0].chaves, ['origem']);
});

test('enxerga a escrita que reusa a transacao em curso, cujo payload e o segundo argumento', () => {
  const fonte = "await registrarAuditoriaNaTransacao(gerenciador, { acao: 'y', metadados: { pacienteId } });";
  const ocorrencias = extrairChavesDeMetadados(fonte, 'exemplo.ts');

  assert.equal(ocorrencias.length, 1);
  assert.deepEqual(ocorrencias[0].chaves, ['pacienteId']);
});

test('nao conta a declaracao de registrarAuditoriaNaTransacao como call site', () => {
  // A assinatura tem a mesma forma lexica de uma chamada, e a lista de
  // parametros tipados nunca e um literal: contada como escrita, ela viraria
  // uma acusacao permanente contra o arquivo que aplica a redacao.
  const fonte = [
    'export async function registrarAuditoriaNaTransacao(',
    '  gerenciador: EntityManager,',
    '  entrada: RegistrarAuditoriaNaTransacaoEntrada',
    '): Promise<void> {}'
  ].join('\n');

  assert.deepEqual(extrairChavesDeMetadados(fonte, 'exemplo.ts'), []);
});

test('conta como opaca, e nao como aprovada, a escrita cujo metadados nao e literal', () => {
  const fonte = 'await this.auditoria.registrar({ acao, metadados });';
  const [ocorrencia] = extrairChavesDeMetadados(fonte, 'exemplo.ts');

  assert.equal(ocorrencia.opaco, true);
  assert.equal(ocorrencia.semLiteral, 'metadados');
  assert.deepEqual(ocorrencia.chaves, []);
});

test('escrita opaca sem envoltorio declarado reprova', () => {
  const fonte = 'await this.auditoria.registrar(entrada);';
  const [ocorrencia] = extrairChavesDeMetadados(fonte, 'exemplo.ts');

  assert.equal(ocorrencia.opaco, true);
  assert.equal(ocorrencia.semLiteral, 'entrada');
});

test('envoltorio declarado: o salto interno e silenciado e o literal do call site e lido', () => {
  const fonte = [
    "await this.auditar(usuario, requisicao, 'pacientes.evolucao_fotografica.excluir', pacienteId, {",
    '  evolucaoFotograficaId: evolucaoId,',
    '  arquivosRemovidos: resultado.arquivosRemovidos',
    '});',
    'private async auditar(usuario, requisicao, acao, pacienteId, metadados: Record<string, unknown>) {',
    '  await this.auditoria.registrar({ tenantId: usuario.tenantId, acao, metadados });',
    '}'
  ].join('\n');

  const ocorrencias = extrairChavesDeMetadados(fonte, 'exemplo.ts', ENVOLTORIO_EXEMPLO);

  assert.deepEqual(ocorrencias.filter(({ opaco }) => opaco), []);
  assert.deepEqual(
    ocorrencias.flatMap(({ chaves }) => chaves),
    ['evolucaoFotograficaId', 'arquivosRemovidos']
  );
});

test('a declaracao do envoltorio nao e contada como call site dele', () => {
  // `private async auditar(...)` nao tem `this.`; se a ancora fosse pelo nome
  // solto, a assinatura entraria como escrita e a lista de parametros tipados
  // seria acusada de opaca.
  const fonte = [
    'private async auditar(usuario, requisicao, acao, pacienteId, metadados: Record<string, unknown>) {',
    '  return metadados;',
    '}'
  ].join('\n');

  assert.deepEqual(extrairChavesDeMetadados(fonte, 'exemplo.ts', ENVOLTORIO_EXEMPLO), []);
});

test('trocar o identificador repassado volta a reprovar o salto interno', () => {
  const fonte = 'await this.auditoria.registrar({ acao, metadados: outraCoisa });';
  const [ocorrencia] = extrairChavesDeMetadados(fonte, 'exemplo.ts', ENVOLTORIO_EXEMPLO);

  assert.equal(ocorrencia.opaco, true);
  assert.equal(ocorrencia.semLiteral, 'outraCoisa');
});

test('declarar um envoltorio nao perdoa outra escrita opaca do mesmo arquivo', () => {
  const fonte = 'await this.auditoria.registrar(entradaMontadaEmOutroLugar);';
  const [ocorrencia] = extrairChavesDeMetadados(fonte, 'exemplo.ts', ENVOLTORIO_EXEMPLO);

  assert.equal(ocorrencia.opaco, true);
  assert.equal(ocorrencia.semLiteral, 'entradaMontadaEmOutroLugar');
});

test('call site do envoltorio que passa variavel em vez de literal reprova', () => {
  const fonte = "await this.auditar(usuario, requisicao, 'acao', pacienteId, extras);";
  const [ocorrencia] = extrairChavesDeMetadados(fonte, 'exemplo.ts', ENVOLTORIO_EXEMPLO);

  assert.equal(ocorrencia.opaco, true);
  assert.equal(ocorrencia.semLiteral, 'extras');
});

test('call site do envoltorio sem payload nenhum e legitimo', () => {
  const fonte = "await this.auditar(usuario, requisicao, 'mobile.midia.visualizar', pacienteId);";

  assert.deepEqual(extrairChavesDeMetadados(fonte, 'exemplo.ts', ENVOLTORIO_EXEMPLO), []);
});

test('comentario antes do literal nao transforma o call site em opaco', () => {
  const fonte = [
    "await this.auditar(usuario, requisicao, 'acao', pacienteId,",
    '  // o porque da escolha das chaves fica aqui',
    '  { total: itens.length });'
  ].join('\n');

  const [ocorrencia] = extrairChavesDeMetadados(fonte, 'exemplo.ts', ENVOLTORIO_EXEMPLO);

  assert.equal(ocorrencia.opaco, false);
  assert.deepEqual(ocorrencia.chaves, ['total']);
});

test('espalhamento do identificador declarado e o proprio salto, e nao esconde chave nova', () => {
  // `registrarExportacao` acrescenta volume ao `...filtros` que recebeu do call
  // site: o espalhamento e o repasse declarado, as outras chaves sao lidas.
  const envoltorios = [
    { envoltorio: 'registrarAuditoria', argumento: 5, repassa: 'filtros', porque: 'exemplo' }
  ];
  const fonte =
    'return this.registrarAuditoria(requisicao, usuario, acao, recursoTipo, undefined, ' +
    '{ ...filtros, totalLinhas: contarLinhasCsv(csv) });';

  const [ocorrencia] = extrairChavesDeMetadados(fonte, 'exemplo.ts', envoltorios);

  assert.deepEqual(ocorrencia.espalhamentos, []);
  assert.deepEqual(ocorrencia.chaves, ['totalLinhas']);
});

test('espalhamento de origem nao declarada continua reprovando no mesmo call site', () => {
  const envoltorios = [
    { envoltorio: 'registrarAuditoria', argumento: 5, repassa: 'filtros', porque: 'exemplo' }
  ];
  const fonte =
    'return this.registrarAuditoria(requisicao, usuario, acao, recursoTipo, undefined, ' +
    '{ ...filtros, ...dados });';

  const [ocorrencia] = extrairChavesDeMetadados(fonte, 'exemplo.ts', envoltorios);

  assert.deepEqual(ocorrencia.espalhamentos, ['dados']);
});

test('reprova um terceiro caminho de escrita da trilha', () => {
  const violacoes = garantirAusenciaDeCaminhoNaoMapeado([
    {
      caminho: 'octaclin-backend/src/modulos/exemplo/servico-exemplo.ts',
      fonte: 'const r = gerenciador.getRepository(UserActionLogOrm);\nawait r.save(r.create({ metadados }));'
    }
  ]);

  assert.equal(violacoes.length, 1);
  assert.match(violacoes[0], /servico-exemplo\.ts/);
  assert.match(violacoes[0], /registrarAuditoriaNaTransacao/);
});

test('nao reprova o proprio servico-auditoria, que e um dos dois caminhos legitimos', () => {
  const violacoes = garantirAusenciaDeCaminhoNaoMapeado([
    {
      caminho: 'octaclin-backend/src/infraestrutura/auditoria/servico-auditoria.ts',
      fonte: 'const r = gerenciador.getRepository(UserActionLogOrm);\nawait r.save(r.create({}));'
    }
  ]);

  assert.deepEqual(violacoes, []);
});
