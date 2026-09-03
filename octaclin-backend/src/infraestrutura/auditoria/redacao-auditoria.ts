/**
 * Rede de ultima instancia sobre o payload livre da trilha de auditoria
 * (PR 52, fase 1a).
 *
 * `user_action_logs.metadados` e uma coluna `jsonb` sem schema, alimentada por
 * ~100 chamadas espalhadas. Cada chamada escolhe suas proprias chaves, e nada
 * -- nem tipo, nem migration -- impede que uma delas passe adiante a senha que
 * acabou de validar, o termo de busca digitado pela recepcao ou o motivo
 * clinico de um cancelamento.
 *
 * O risco nao e teorico: a trilha e justamente a tabela que mais gente le. Ela
 * e exposta em `/operacoes/logs`, entra em backup, viaja em dump de suporte e
 * sobrevive ao expurgo do dado de origem. Um segredo que caia aqui vaza para
 * todo mundo que tem leitura de auditoria, e continua vazado depois que o
 * titular pediu exclusao -- a trilha e imutavel por definicao.
 *
 * # O que este modulo NAO e
 *
 * Ele nao e garantia de que nenhum dado sensivel chega a coluna, e a versao
 * anterior deste comentario afirmava justamente isso. A afirmacao era falsa e
 * perigosa: um blocklist por nome de chave sobre um objeto de forma livre nunca
 * e completo, e documenta-lo como garantia forte faz o proximo revisor confiar
 * nele e parar de olhar o call site. Foi assim que `filtros: { ...filtros }`,
 * `humor` e `motivo` passaram por revisao.
 *
 * A distincao e a mesma que `seguranca/menor-privilegio-providers.ts` faz entre
 * `nao-verificado` e aprovado: um controle que nao inspecionou o caso nao pode
 * ser lido como carimbo de que o caso esta certo.
 *
 * # O que ele e
 *
 * Tres camadas, em ordem decrescente de forca:
 *
 * 1. **Responsabilidade primaria: nao coletar.** O call site nao deve escrever
 *    o dado. `possuiMotivo: Boolean(motivo)` no lugar de `motivo` nao depende
 *    de nenhuma regra aqui e nao tem falso negativo. E onde a correcao vale.
 * 2. **Gate de cobertura:** `scripts/validar-redacao-auditoria.mjs` varre todos
 *    os call sites, extrai as chaves reais de `metadados` e reprova o CI quando
 *    aparece uma chave que nem casa com uma regra deste arquivo nem esta
 *    declarada como segura com justificativa. E o que torna a cobertura
 *    verificavel em vez de afirmada, e o que impede o 98o call site de reabrir
 *    o buraco em silencio.
 * 3. **Este modulo:** rede que apara o call site distraido que escapou dos dois
 *    primeiros. Reducao de dano, nao classificacao perfeita.
 *
 * Este modulo e dominio puro de proposito (mesmo padrao de
 * `menor-privilegio-providers.ts`): sem Nest, sem I/O, sem relogio. Isso o
 * torna testavel de forma exaustiva, chamavel de qualquer camada e importavel
 * pelo gate do item 2 -- que usa a funcao real, e nao uma reimplementacao que
 * poderia divergir.
 *
 * A funcao erra deliberadamente para o lado de redigir demais: perder o valor
 * de um campo de auditoria e um incomodo reversivel; gravar PHI na trilha nao
 * e.
 */

/**
 * Substitui todo valor considerado sensivel. Literal unico e estavel de
 * proposito: e a string que se procura ao auditar o proprio log.
 */
export const MARCADOR_REDIGIDO = '[redigido]';

/**
 * Substitui o valor de uma chave cuja leitura lancou. Distinto de
 * `MARCADOR_REDIGIDO` para que a trilha diga a verdade: o dado nao foi julgado
 * sensivel, ele nao pode ser lido.
 */
export const MARCADOR_ILEGIVEL = '[ilegivel]';

/**
 * Sufixo aposto a string truncada. Unico literal fora de ASCII no arquivo; a
 * regra do repositorio proibe acento em identificador, nome de arquivo e
 * comentario, nao em marcador de dado.
 */
const SUFIXO_TRUNCADO = '…[truncado]';

/** Profundidade maxima de objetos aninhados preservados; abaixo disso vira resumo de tipo. */
const PROFUNDIDADE_MAXIMA = 2;

/** Teto de chaves por objeto (e de itens por lista). Impede que a trilha vire deposito de payload. */
const MAXIMO_CHAVES = 25;

/** Teto de caracteres por string. */
const MAXIMO_CARACTERES = 200;

/**
 * Grupo 1 -- credencial e segredo.
 *
 * Valor deste grupo autentica alguem. Vazado na trilha ele nao expoe um dado:
 * ele concede acesso, e continua concedendo ate a rotacao. `hash` e
 * `assinatura` entram junto porque hash de senha e material para ataque
 * offline, e assinatura vazada permite forjar a proxima.
 */
const TERMOS_CREDENCIAL = [
  'senha',
  'password',
  'token',
  'secret',
  'segredo',
  'authorization',
  'apikey',
  'api_key',
  'chave',
  'hash',
  'assinatura',
  'signature',
  'cookie',
  'credencial'
];

/**
 * Grupo 2 -- identificador pessoal direto (PII).
 *
 * Valor que aponta para uma pessoa natural fora do sistema. E o que transforma
 * uma linha de log pseudonimizada em identificacao, e e o que a LGPD manda
 * apagar quando o titular pede -- pedido impossivel de atender numa trilha de
 * auditoria imutavel. Por isso o dado nao pode entrar, em vez de sair depois.
 *
 * `paciente`, `titular` e `responsavel` entraram porque sao os rotulos que um
 * call site usa quando vai escrever a pessoa inteira (`paciente: 'Maria
 * Silva'`), e nesse formato nenhum padrao de valor dispara. Eles nao destroem
 * `pacienteId` nem `responsavelId`: esses casam com a excecao de identificador
 * opaco abaixo, que os preserva por terem valor em forma de UUID.
 */
const TERMOS_PESSOAIS = [
  'cpf',
  'cnpj',
  'email',
  'telefone',
  'celular',
  'whatsapp',
  'endereco',
  'nome',
  'sobrenome',
  'nascimento',
  'paciente',
  'titular',
  'responsavel',
  'documento',
  'matricula',
  'convenio',
  'carteirinha',
  // `busca` e o termo digitado na tela de pacientes: nome, pedaco de CPF,
  // telefone. Nao e PII por definicao, mas neste backend so existe com esse
  // conteudo -- `servico-pacientes.ts` o passa por `gerarHashesConsultaPii`
  // justamente para nunca armazena-lo. Entrou depois de o call site ja ter sido
  // corrigido, e nao no lugar dele: a correcao em `controlador-pacientes.ts` e
  // que elimina o vazamento; este termo e a rede para o proximo call site que
  // resolver gravar `termoBusca`. Nao destroi `possuiBusca`, que sobrevive pela
  // regra de booleano.
  'busca'
];

/**
 * Grupo 3 -- dado clinico (PHI).
 *
 * Conteudo de prontuario. O `AGENTS.md` proibe dado clinico em log, e a trilha
 * e lida por perfis de operacao que tem direito de saber *que* um prontuario
 * foi acessado sem ter direito de ler o prontuario. Gravar o diagnostico dentro
 * do log do acesso ao diagnostico anula exatamente essa separacao.
 *
 * Num produto de nutricao a lista generica de "termo clinico" nao cobre o PHI
 * que de fato circula: peso, altura, IMC, dieta, refeicao, caloria, sintoma,
 * evolucao, humor e adesao sao o prontuario deste dominio. `imc` fica fora do
 * casamento por substring pelo mesmo motivo de `rg` e `cep` -- ver
 * `TERMOS_POR_SEGMENTO`.
 *
 * Cada termo foi confrontado com as chaves que os call sites reais gravam hoje
 * -- 181 delas, em 148 call sites (`pnpm audit:redacao-auditoria` lista todas).
 * O que a evidencia mostrou:
 *
 * - `peso`, `altura`, `dieta`, `caloria`, `queixa`, `anotacao`, `humor` e
 *   `medicamento` nao colidem com chave nenhuma em uso. Substring, sem custo.
 * - `adesao` alcanca `statusAdesao` (`pacientes.atualizar`), e alcancar e o
 *   certo: a classificacao de adesao de um paciente e avaliacao clinica, nao
 *   estado operacional. Nao e falso positivo, e um acerto.
 * - `evolucao`, `paciente` e `responsavel` alcancam `evolucaoId`,
 *   `pacienteId` e `profissionalResponsavelId`, que sao os identificadores mais
 *   uteis da trilha. Eles sobrevivem pela excecao de identificador opaco, que
 *   confere forma de UUID no valor -- por isso a excecao existe.
 * - `refeicao` alcanca `totalRefeicoes`, uma contagem de refeicoes de um modelo.
 *   E falso positivo assumido. A saida obvia -- isentar chave que comece por
 *   `total`/`quantidade` quando o valor for numero -- foi recusada: num produto
 *   de nutricao `totalCalorias` e prescricao, nao contagem de registros, e a
 *   regra nao consegue distinguir os dois. Perder uma contagem numa entrada de
 *   `modelo_criar` custa menos que abrir essa porta.
 * - `observacao` e `sintoma` alcancam `possuiObservacoes` e `possuiSintomas`,
 *   preservados pela regra de booleano em `redigirEntrada` -- que existe
 *   exatamente para nao punir o call site que fez a coisa certa.
 */
const TERMOS_CLINICOS = [
  'diagnostico',
  'prontuario',
  'anamnese',
  'observacao',
  'anotacao',
  'queixa',
  'medicamento',
  'alergia',
  'peso',
  'altura',
  'dieta',
  'refeicao',
  'caloria',
  'sintoma',
  'evolucao',
  'humor',
  'adesao'
];

/** Casamento por substring sobre a chave normalizada. */
const TERMOS_POR_SUBSTRING = new Set(
  [...TERMOS_CREDENCIAL, ...TERMOS_PESSOAIS, ...TERMOS_CLINICOS].map((termo) => normalizarTexto(termo))
);

/**
 * Termos curtos demais para casar por substring sem destruir chave legitima:
 * `organizacao` contem "rg", `recepcao` contem "cep". `imc` entrou na mesma
 * categoria por ter so tres letras -- e a mesma analise, feita antes de
 * adicionar o termo, e nao depois de quebrar uma chave.
 *
 * Estes casam apenas como segmento inteiro da chave (`rg`, `rgEmissor`,
 * `cep_cobranca`, `imc`, `imcAtual`).
 *
 * A checagem foi refeita contra as chaves em uso hoje: nenhuma contem `imc`
 * como substring, mas o termo tem tres letras e a colisao futura e questao de
 * tempo (`limcache`, `simcard`). Segmento e a escolha barata aqui, porque toda
 * chave real que carrega IMC o escreve como segmento proprio.
 */
const TERMOS_POR_SEGMENTO = new Set(['rg', 'cep', 'imc']);

/**
 * Excecao de evidencia: chaves em que o valor *e* a prova que a trilha existe
 * para guardar, e nao o dado que ela existe para nao guardar.
 *
 * Verificada antes de qualquer varredura, por nome e por formato, porque as
 * duas destroem estes casos:
 *
 * - `hashIntegridade` -- digest do artefato entregue ao proprio titular numa
 *   exportacao LGPD. Cai na regra `hash` e tambem no padrao de corrida longa de
 *   hex. A regra `hash` se justifica por "material para ataque offline": isso e
 *   verdade para hash de senha e falso para digest de um conteudo que o titular
 *   ja recebeu inteiro. Apagado, some a unica prova de *qual* artefato foi
 *   entregue -- o registro da exportacao nao guarda id nenhum do arquivo.
 *   Contraste deliberado com `hashConteudo` de plano alimentar, que continua
 *   redigido: la o `versaoId` gravado ao lado ja identifica o artefato, entao o
 *   digest nao acrescenta evidencia e so acrescenta um oraculo de confirmacao
 *   sobre conteudo clinico.
 * - `documentoLegal` -- tipo do documento legal aceito (`consentimento_lgpd`,
 *   `termo_uso`). Cai na regra `documento`, que existe para CPF e RG. Apagado,
 *   a trilha registra que houve um consentimento sem registrar a que. E a
 *   mesma classe das flags de consentimento preservadas pela regra de booleano
 *   abaixo: e a evidencia, nao o dado.
 *
 * A lista e curta de proposito. Cada entrada custa uma justificativa escrita e
 * e conferida pelo gate de cobertura; ela nao e o lugar de acomodar um call
 * site que nao deveria estar gravando aquilo.
 */
const EXCECOES_EVIDENCIA = new Set(['hashintegridade', 'documentolegal'].map((chave) => normalizarTexto(chave)));

/** UUID canonico: e a forma que prova que um identificador e mesmo opaco. */
const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Formatos reconhecidos no *valor*, para o caso em que a chave nao denuncia
 * nada. Existem porque `{ detalhe: 'Bearer eyJ...' }` e justamente o formato
 * que um call site escreve sem perceber, e a chave `detalhe` nao dispara
 * nenhuma regra de nome.
 */
const PADROES_SENSIVEIS: RegExp[] = [
  // E-mail.
  /[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/,
  // JWT: cabecalho base64url de `{"` seguido do ponto separador.
  /\beyJ[A-Za-z0-9_-]{4,}\./,
  // Cabecalho ou parametro de portador.
  /\bbearer\s+\S/i,
  // CPF mascarado.
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
  // CPF sem mascara: 11 digitos isolados.
  /\b\d{11}\b/,
  // Corrida longa e continua do alfabeto hex/base64: token, hash ou payload
  // codificado. UUID nao casa aqui porque tem 36 caracteres, abaixo do piso de
  // 64 -- e nao porque o hifen o quebre: o hifen esta dentro da classe do
  // padrao. A distincao importa: quem baixar o piso de 64 para 32 passa a
  // redigir todo UUID da trilha, e o hifen nao protege nada.
  /[A-Za-z0-9+/=_-]{64,}/
];

/**
 * Minusculas, sem acento, sem separador e sem flexao de numero, para que
 * `API_Key` e `apiKey` colidam e para que `observacao` alcance `observacoes`.
 *
 * O dobramento de plural e o conserto de um bug de cobertura silencioso: a
 * string `"observacoes"` nao contem `"observacao"`, entao `possuiObservacoes`,
 * `refeicoes` e `evolucoes` escapavam da regra que existia para eles. O
 * conserto e por normalizacao de forma, e nao por acrescentar cada plural a
 * mao, porque a lista feita a mao volta a ficar incompleta no proximo termo.
 *
 * `oes` -> `ao` cobre toda a familia `-cao`/`-coes` (e tambem `-sao`/`-soes`);
 * o `s` final cobre o plural regular (`sintomas`, `calorias`, `senhas`). As
 * duas regras valem para o termo e para a chave, sempre pela mesma funcao, de
 * modo que os dois lados chegam a mesma forma.
 */
function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/oes/g, 'ao')
    .replace(/s$/, '');
}

/** Quebra `chaveApiId`, `cep_cobranca` ou `rg-emissor` em segmentos comparaveis. */
function segmentosDaChave(chave: string): string[] {
  return chave
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((parte) => normalizarTexto(parte))
    .filter(Boolean);
}

/**
 * Excecao deliberada: identificador opaco terminado em `Id` cujo valor tem
 * forma de UUID nao e redigido por nome.
 *
 * `usuarioId`, `tenantId`, `pacienteId` e `evolucaoId` sao UUID sem conteudo
 * pessoal, e sao precisamente o que torna a trilha util -- sem eles nao da para
 * saber quem fez o que em qual recurso, que e a unica razao de a tabela
 * existir. Redigir esses campos entregaria uma trilha tecnicamente limpa e
 * operacionalmente inutil, o pior dos dois mundos.
 *
 * A versao anterior olhava so o sufixo `Id`, e por rodar antes de todas as
 * regras de nome funcionava como whitelist que vencia o blocklist inteiro:
 * `senhaId`, `tokenId`, `cookieId`, `cpfId`, `prontuarioId` e
 * `authorizationId` passavam intactos, com qualquer valor.
 *
 * A restricao escolhida foi exigir **forma de UUID no valor**, e nao apenas
 * "nenhum outro segmento sensivel". As duas fecham os contraexemplos, mas a
 * premissa da excecao e "este valor e uma chave substituta opaca", e o UUID
 * *verifica* essa premissa em vez de inferi-la do nome. O efeito colateral e
 * bem-vindo nas duas pontas: `senhaId: 'hunter2'` volta a ser redigido, e
 * `chaveApiId: <uuid>` continua legivel em vez de ser sacrificado por conter
 * "chave".
 */
function ehIdentificadorOpaco(chave: string, valor: unknown): boolean {
  const segmentos = segmentosDaChave(chave);
  if (segmentos.length === 0 || segmentos[segmentos.length - 1] !== 'id') return false;
  return typeof valor === 'string' && PADRAO_UUID.test(valor);
}

/**
 * Classificacao por nome, sem olhar o valor. Exportada porque e exatamente a
 * pergunta que o gate de cobertura faz sobre cada chave real encontrada nos
 * call sites: "existe alguma regra deste arquivo que alcance esta chave?".
 *
 * O gate importa esta funcao em vez de reimplementar as listas, de modo que
 * acrescentar um termo aqui atualiza o gate no mesmo commit e nao existe
 * versao paralela do vocabulario para divergir.
 */
export function chaveEhCobertaPorRegra(chave: string): boolean {
  const normalizada = normalizarTexto(chave);
  for (const termo of TERMOS_POR_SUBSTRING) {
    if (normalizada.includes(termo)) return true;
  }

  return segmentosDaChave(chave).some((segmento) => TERMOS_POR_SEGMENTO.has(segmento));
}

/** Chave declarada como evidencia; ver {@link EXCECOES_EVIDENCIA}. Exportada para o gate. */
export function chaveEhExcecaoDeEvidencia(chave: string): boolean {
  return EXCECOES_EVIDENCIA.has(normalizarTexto(chave));
}

function valorEhSensivel(valor: string): boolean {
  return PADROES_SENSIVEIS.some((padrao) => padrao.test(valor));
}

function resumirContainer(valor: unknown): string {
  return Array.isArray(valor) ? `[lista:${valor.length}]` : '[objeto]';
}

function truncarTexto(valor: string): string {
  return valor.length > MAXIMO_CARACTERES ? `${valor.slice(0, MAXIMO_CARACTERES)}${SUFIXO_TRUNCADO}` : valor;
}

function redigirTexto(valor: string): string {
  if (valorEhSensivel(valor)) return MARCADOR_REDIGIDO;
  return truncarTexto(valor);
}

/**
 * `ancestrais` carrega os containers do caminho atual. A profundidade maxima ja
 * torna recursao infinita impossivel, mas o teste de ciclo fica explicito para
 * que um aumento futuro do limite nao reintroduza o travamento em silencio.
 */
function redigirValor(valor: unknown, nivel: number, ancestrais: Set<object>): unknown {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor === 'boolean' || typeof valor === 'number') return valor;
  if (typeof valor === 'string') return redigirTexto(valor);
  if (valor instanceof Date) return valor;

  // Binario antes de `object`: `Buffer` e `TypedArray` sao objetos indexados
  // por numero, e a recursao generica os serializava byte a byte --
  // `Buffer.from('senha-secreta')` virava `{"0":115,"1":101,...}`, sobre o qual
  // nenhum padrao de valor se aplica porque nao ha string alguma. O conteudo
  // vazava inteiro, so que codificado. Aqui viram resumo opaco.
  if (ArrayBuffer.isView(valor) || valor instanceof ArrayBuffer) {
    return `[binario:${valor.byteLength}]`;
  }

  if (typeof valor === 'object') {
    const container = valor as object;
    if (ancestrais.has(container)) return '[circular]';
    if (nivel > PROFUNDIDADE_MAXIMA) return resumirContainer(valor);

    const proximosAncestrais = new Set(ancestrais).add(container);
    return Array.isArray(valor)
      ? redigirLista(valor, nivel, proximosAncestrais)
      : redigirObjeto(valor as Record<string, unknown>, nivel, proximosAncestrais);
  }

  // `function`, `symbol` e `bigint` nao tem representacao estavel em jsonb.
  return MARCADOR_REDIGIDO;
}

function redigirLista(lista: unknown[], nivel: number, ancestrais: Set<object>): unknown[] {
  const preservados = lista.slice(0, MAXIMO_CHAVES).map((item) => redigirValor(item, nivel + 1, ancestrais));
  const excedente = lista.length - preservados.length;
  return excedente > 0 ? [...preservados, `[truncado:${excedente}]`] : preservados;
}

/**
 * Decide uma unica entrada. A ordem e o contrato:
 *
 * 1. excecao de evidencia -- antes de nome e de formato, senao as duas apagam;
 * 2. booleano -- ver abaixo;
 * 3. nome sensivel, com a saida pela excecao de identificador opaco;
 * 4. recursao normal, que ainda inspeciona o formato do valor.
 *
 * O passo 2 e uma regra de tipo, nao de nome: um booleano carrega um bit e nao
 * pode conter CPF, endereco nem senha, entao redigi-lo por causa do nome da
 * chave nao remove risco nenhum e destroi justamente a forma segura que os call
 * sites foram instruidos a usar -- `possuiSintomas`, `possuiObservacoes`,
 * `possuiMotivo` e as flags de consentimento de `preferenciasContato`. Essas
 * flags sao a unica prova de a quais canais o titular consentiu, e a trilha e
 * imutavel: apaga-las e definitivo. Numero nao entra nessa regra de proposito
 * (`senha: 1234` e um PIN).
 */
function redigirEntrada(
  objeto: Record<string, unknown>,
  chave: string,
  nivel: number,
  ancestrais: Set<object>
): unknown {
  // A leitura fica dentro do `try` porque a propria leitura pode lancar: um
  // getter que joga (ou um Proxy hostil) derrubava a redacao inteira e a funcao
  // devolvia so `{_redacaoFalhou:true}`, perdendo junto todas as chaves irmas
  // que estavam limpas. A protecao e por chave para que o estrago fique nela.
  try {
    const valor = objeto[chave];

    if (chaveEhExcecaoDeEvidencia(chave)) {
      return typeof valor === 'string' ? truncarTexto(valor) : redigirValor(valor, nivel + 1, ancestrais);
    }

    if (typeof valor === 'boolean') return valor;

    if (chaveEhCobertaPorRegra(chave)) {
      return ehIdentificadorOpaco(chave, valor) ? valor : MARCADOR_REDIGIDO;
    }

    return redigirValor(valor, nivel + 1, ancestrais);
  } catch {
    return MARCADOR_ILEGIVEL;
  }
}

function redigirObjeto(
  objeto: Record<string, unknown>,
  nivel: number,
  ancestrais: Set<object>
): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  const chaves = Object.keys(objeto);
  const preservadas = chaves.slice(0, MAXIMO_CHAVES);

  for (const chave of preservadas) {
    saida[chave] = redigirEntrada(objeto, chave, nivel, ancestrais);
  }

  const excedente = chaves.length - preservadas.length;
  if (excedente > 0) saida._truncado = excedente;

  return saida;
}

/**
 * Aplica a redacao ao payload que sera gravado em `user_action_logs.metadados`.
 *
 * A funcao e total por contrato: nunca lanca. Uma excecao aqui derrubaria a
 * gravacao da trilha, e uma trilha que falha por causa do proprio filtro de
 * seguranca e pior do que a trilha sem filtro. O `try` externo cobre so o que
 * sobra depois da protecao por chave -- `Object.keys` sobre um Proxy hostil,
 * por exemplo; tudo que acontece dentro de uma chave e contido nela.
 */
export function redigirMetadadosAuditoria(metadados: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadados || typeof metadados !== 'object') return {};

  try {
    return redigirObjeto(metadados, 0, new Set<object>([metadados as object]));
  } catch {
    return { _redacaoFalhou: true };
  }
}
