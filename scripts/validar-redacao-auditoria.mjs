// Gate de cobertura da redacao da trilha de auditoria (PR 52, fase 1a).
//
// O defeito que este gate existe para impedir nao e um bug do redator: e a
// distancia entre o que `redacao-auditoria.ts` cobre e o que os 148 call sites
// de fato escrevem em `user_action_logs.metadados`. Nenhum teste unitario
// atravessa essa distancia -- os testes do redator alimentam chaves inventadas
// pelo proprio teste, entao a suite ficava verde enquanto o modulo redigia 2
// das dezenas de chaves reais, e as 2 eram falso positivo.
//
// O gate fecha o circuito: varre o backend, extrai as chaves realmente
// gravadas e exige que cada uma esteja (a) alcancada por uma regra do redator,
// (b) declarada como evidencia no proprio redator, ou (c) declarada aqui como
// segura, com justificativa escrita ao lado. Chave nova e desconhecida reprova
// o CI em vez de vazar em silencio.
//
// Ele importa `chaveEhCobertaPorRegra` do arquivo real em vez de reimplementar
// o vocabulario: acrescentar um termo la atualiza o gate no mesmo commit, e nao
// existe segunda copia da lista para divergir.
//
// A fase 1b fechou o ponto cego do proprio gate: escrita sem literal a vista era
// pulada em silencio -- o mesmo defeito que ele existe para impedir --, e a
// familia de envoltorios privados de auditoria (`auditar`, `registrar`,
// `registrarAuditoria`) mantinha as chaves de 14 arquivos fora do inventario.
// Escrita opaca agora reprova, e o envoltorio e declarado em
// ENVOLTORIOS_DECLARADOS.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  chaveEhCobertaPorRegra,
  chaveEhExcecaoDeEvidencia
} from '../octaclin-backend/src/infraestrutura/auditoria/redacao-auditoria.ts';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const RAIZ_BACKEND = join(RAIZ, 'octaclin-backend', 'src');

/**
 * Chaves operacionais que nenhuma regra do redator alcanca e que nao deveriam
 * ser alcancadas: elas descrevem a operacao, nao o titular.
 *
 * Cada entrada e uma decisao explicita, nao um atalho para calar o gate. A
 * pergunta a responder antes de acrescentar uma linha aqui e a mesma que o
 * revisor fara: "se este valor aparecer num dump de suporte, alguem se
 * incomoda?". Se a resposta for sim, a correcao e no call site, e nao aqui.
 *
 * A chave e a forma normalizada (minuscula, sem separador), para que
 * `usuarioAlvoId` e `usuario_alvo_id` nao precisem de duas linhas.
 */
const CHAVES_SEGURAS = new Map([
  // --- Identificadores opacos: UUID de recurso, sem conteudo pessoal ---
  ['alertaid', 'UUID do alerta clinico, nao o conteudo dele'],
  ['avaliacaoid', 'UUID da avaliacao antropometrica; medida e resultado ficam fora'],
  ['consultaid', 'UUID da consulta'],
  ['conviteid', 'UUID do convite'],
  ['itemid', 'UUID do item do plano alimentar'],
  ['substituicaoid', 'UUID da substituicao escolhida'],
  ['tarefaid', 'UUID da tarefa de acompanhamento'],
  ['versaoid', 'UUID da versao do plano'],
  ['profissionalid', 'UUID de profissional; e conta interna, nao titular'],
  ['usuarioalvoid', 'UUID de usuario interno alvo da acao administrativa'],
  ['planoatualid', 'UUID do plano comercial da clinica'],
  ['googleeventid', 'identificador opaco do evento no Google Calendar'],
  ['arquivoid', 'UUID do arquivo de midia'],
  ['arquivomidiaid', 'UUID da imagem enviada ao reconhecimento alimentar; a imagem e o que foi inferido dela ficam fora'],
  ['badgeid', 'UUID do badge de gamificacao'],
  ['canalid', 'UUID do canal de notificacao'],
  ['categoriaid', 'UUID da categoria de pergunta'],
  ['circuloid', 'UUID do circulo de pacientes'],
  ['condutaid', 'UUID da conduta terapeutica; o texto prescrito fica fora'],
  ['consentimentoid', 'UUID do consentimento de evolucao fotografica'],
  ['desafioid', 'UUID do desafio de gamificacao'],
  ['materialid', 'UUID do material educativo enviado'],
  ['modeloid', 'UUID do questionario usado como modelo'],
  ['origemid', 'UUID do questionario de origem na duplicacao'],
  ['perguntabibliotecaid', 'UUID da pergunta da biblioteca incluida'],
  ['questionarioid', 'UUID do questionario'],
  ['recursoalvoid', 'UUID do recurso usado como filtro na exportacao da trilha'],
  ['referenciaid', 'UUID do registro referenciado pela falha de comunicacao'],
  ['regraid', 'UUID da regra de automacao'],
  ['respostacheckinid', 'UUID da resposta de check-in analisada; o relato do paciente fica fora'],
  ['templateid', 'UUID do template de mensagem'],
  ['transcricaomidiaid', 'UUID da transcricao analisada; o texto transcrito fica fora'],
  ['candidatos', 'lista de UUID de pacientes candidatos a duplicidade; nome decifrado e termo digitado ficam fora por decisao explicita do call site'],

  // --- Vocabulario fechado do dominio: enum, nao texto do usuario ---
  ['acao', 'verbo da trilha, vocabulario fechado do proprio backend'],
  ['origem', 'canal de origem (portal, mobile, operacao_manual)'],
  ['status', 'situacao do recurso, enum'],
  ['tipo', 'tipo do recurso, enum'],
  ['tipos', 'nomes dos campos enviados (Object.keys), nao os valores'],
  ['campos', 'nomes dos campos alterados (Object.keys), nao os valores'],
  ['tipopessoa', 'pessoa fisica ou juridica da clinica contratante, nao do paciente'],
  ['formato', 'formato da exportacao LGPD (json, csv)'],
  ['categoria', 'categoria da tarefa de acompanhamento, enum operacional'],
  ['categorias', 'nomes das categorias de dado incluidas na exportacao LGPD, nao os dados'],
  ['prioridade', 'prioridade da tarefa, enum'],
  ['protocolo', 'nome do protocolo antropometrico usado (metodo de calculo); medida e resultado ficam fora'],
  ['visibilidade', 'visibilidade da evolucao clinica (equipe, restrita), regra de acesso e nao conteudo'],
  ['role', 'papel RBAC do usuario administrado'],
  ['especialidade', 'especialidade do profissional; atributo do perfil profissional da clinica, nao dado de titular'],
  ['periodo', 'janela do painel (7d, 30d)'],
  ['planodesejado', 'plano comercial pedido pela clinica; nada a ver com plano alimentar'],
  ['versaolgpd', 'versao do texto de consentimento aceito, evidencia do que foi aceito'],
  ['canal', 'canal do template de mensagem (email, whatsapp), enum'],
  ['canaissugeridos', 'canais sugeridos para responder a solicitacao LGPD; sao os rotulos `email`/`whatsapp`, nunca um endereco'],
  ['decisao', 'desfecho da revisao humana da sugestao de IA (aceita, editada, rejeitada)'],
  ['formapagamento', 'forma de pagamento da consulta, enum'],
  ['modelo', 'nome do modelo de IA que produziu a inferencia; identifica o software, nao o titular'],
  ['motivotecnico', 'motivo de vocabulario fechado emitido pelo proprio backend (credencial_invalida, contato_ausente, canal_ausente, template_ausente). Deliberadamente nao se chama `motivo`: `motivo` e o nome que os call sites usam para o texto que uma pessoa escreveu, e liberar esse nome aqui liberaria o texto no proximo call site. Motivo livre continua virando `possuiMotivo`'],
  ['origemcontexto', 'origem do texto analisado (checkin_manual, transcricao_audio, mensagem_paciente), @IsIn fechado no DTO'],
  ['provedor', 'provedor de visao computacional usado, enum de infraestrutura'],
  ['rotacao', 'motivo tecnico da emissao do novo par de tokens (refresh_token), enum'],
  ['statusatendimento', 'estado do atendimento no WhatsApp, enum'],
  ['statuspagamento', 'estado do pagamento da consulta ou do pacote, enum'],
  ['timezone', 'fuso do agendamento do questionario, configuracao da clinica'],
  ['variaveisvazias', 'nomes das variaveis do modelo de documento que ficaram sem valor (Object.keys), nao os valores'],
  ['versao', 'numero da versao do termo de consentimento aceito, evidencia do que foi aceito'],
  ['notificacoes', 'canais notificados na operacao de agenda, enum'],

  // --- Contagens e medidas da operacao ---
  ['total', 'contagem'],
  ['totalitens', 'contagem de itens do modelo ou da receita'],
  ['totallinhas', 'contagem de linhas do arquivo'],
  ['linhas', 'contagem de linhas exportadas'],
  ['eventos', 'contagem de eventos devolvidos na timeline'],
  ['avisos', 'contagem de avisos do calculo antropometrico, nao o texto deles'],
  ['criados', 'contagem'],
  ['duplicados', 'contagem'],
  ['invalidos', 'contagem'],
  ['convitescriados', 'contagem'],
  ['bloqueadosporplano', 'contagem de registros barrados pelo limite do plano comercial'],
  ['tamanhobytes', 'tamanho do arquivo processado'],
  ['duracaominutos', 'duracao do agendamento; horario de agenda nao carrega conteudo clinico'],
  ['numeroversao', 'numero sequencial da versao do plano'],
  ['pagina', 'paginacao'],
  ['limite', 'paginacao'],
  ['arquivosremovidos', 'contagem de arquivos apagados junto com a evolucao fotografica'],
  ['diassemconsulta', 'janela em dias da regra de recall; e parametro da regra, nao o historico de um paciente'],
  ['duracaoms', 'duracao da chamada ao provedor de IA'],
  ['limitesolicitado', 'teto de linhas pedido na exportacao'],
  [
    'loginssuprimidos',
    'contagem de eventos auth.login.sucesso colapsados pela janela de deduplicacao desde a ultima linha gravada (PR 52, fase 2, EXC-AUD-002). E volume, e nao conteudo: sem ela o teto de escrita compraria custo de backup com sub-reporte silencioso do numero real de logins'
  ],
  ['mensagensatualizadas', 'contagem de mensagens religadas ao paciente'],
  ['mimetype', 'tipo MIME declarado no upload'],
  ['ordem', 'posicao da categoria na lista, inteiro'],
  ['pontos', 'pontos do desafio de gamificacao; contador de engajamento, e nao medida antropometrica ou clinica'],
  ['sessoesconsumidas', 'contagem de sessoes ja usadas do pacote'],
  ['sessoescontratadas', 'contagem de sessoes do pacote'],
  ['tamanhoiconecaracteres', 'tamanho do SVG do badge, gravado no lugar do markup'],
  ['tamanhotextocaracteres', 'tamanho do relato enviado a IA, gravado no lugar do relato'],
  ['tentativas', 'contagem de tentativas de entrega do evento'],
  ['totalacoes', 'contagem de acoes da regra de automacao'],
  ['totalalimentos', 'contagem de alimentos detectados; a lista inferida fica fora'],
  ['totalcandidatos', 'contagem de candidatos da simulacao de recall'],
  ['totalcondicoes', 'contagem de condicoes da regra de automacao'],
  ['totalexcluidos', 'contagem de candidatos descartados pela simulacao'],
  ['totalitensvencidos', 'contagem de itens vencidos na programacao de retencao LGPD'],
  ['totalperguntas', 'contagem de perguntas reordenadas'],
  ['totalsincronizados', 'contagem de itens do lote de sincronizacao mobile'],
  ['valorcentavos', 'valor do pagamento registrado, em centavos; e a evidencia da propria operacao financeira auditada'],
  ['valortotalcentavos', 'valor total do pacote de sessoes, em centavos; mesma razao de valorCentavos'],
  ['paginada', 'booleano de modo de leitura'],

  // --- Marcas de tempo geradas pelo servidor ---
  ['geradoem', 'instante da geracao, gerado pelo servidor'],
  ['avaliadaem', 'instante da avaliacao, gerado pelo servidor'],
  ['expiraem', 'instante de expiracao do convite'],
  ['revogadoem', 'instante da revogacao do convite'],
  ['ocultoateem', 'instante ate quando o alerta fica oculto'],
  ['inicioem', 'inicio do agendamento; horario, sem conteudo clinico'],
  ['iniciaem', 'inicio da janela do desafio de gamificacao'],
  ['terminaem', 'fim da janela do desafio de gamificacao'],
  ['renovacaoem', 'proxima renovacao da assinatura comercial da clinica'],
  ['retencaoate', 'prazo de retencao do consentimento de evolucao fotografica'],
  ['revisadoem', 'instante da revisao do envio de questionario, gerado pelo servidor'],
  ['fimem', 'fim do agendamento; horario, sem conteudo clinico'],

  // --- Booleanos de presenca: a forma que os call sites devem usar ---
  ['possuibusca', 'booleano de presenca do termo de busca; o termo em si nunca entra'],
  ['possuimotivo', 'booleano de presenca do motivo de cancelamento ou recusa'],
  ['possuidetalhes', 'booleano de presenca de detalhe da solicitacao LGPD'],
  ['houvetextolivre', 'booleano de presenca de texto livre'],
  ['conteudoeditadoinformado', 'booleano de presenca de edicao do conteudo sugerido pela IA'],
  ['possuicontato', 'booleano de presenca do contato do acompanhante; o telefone em si nunca entra'],
  ['aprovado', 'booleano: o template foi aprovado pelo provedor de mensageria'],
  ['ativa', 'booleano: a regra de automacao esta habilitada'],
  ['ativo', 'booleano: o canal de notificacao esta habilitado'],
  ['executar', 'booleano: a avaliacao da regra roda em modo simulacao (false) ou execucao (true)'],
  ['obrigatoria', 'booleano: a pergunta e de resposta obrigatoria'],
  ['privado', 'booleano: o circulo de pacientes e fechado'],
  ['detalhesinformados', 'booleano de presenca de detalhe na solicitacao LGPD'],
  ['mfaverificado', 'booleano: a sessao nasceu com MFA ja verificado'],
  ['semfiltro', 'booleano: a exportacao da trilha saiu sem periodo e sem alvo, que e o formato da varredura'],
  ['metasbadgeshabilitados', 'booleano: o modulo de metas e badges esta habilitado no tenant'],
  ['comunidadehabilitada', 'booleano: a comunidade de pacientes esta habilitada no tenant'],
  ['rankinghabilitado', 'booleano: o ranking de desafios esta habilitado no tenant'],
  ['retornouaoprincipal', 'booleano: o paciente voltou ao item principal do plano'],

  // --- Filtros estruturados, ja sem o termo de busca ---
  ['filtroacao', 'acao usada como filtro na exportacao da trilha, vocabulario fechado do backend'],
  ['filtrorecursotipo', 'tipo de recurso usado como filtro na exportacao da trilha, enum'],
  ['filtrotipo', 'tipo de evento usado como filtro na exportacao de falhas do outbox, enum'],
  ['periodoinicio', 'inicio da janela pedida na exportacao'],
  ['periodofim', 'fim da janela pedida na exportacao'],
  ['risco', 'faixa de risco usada como filtro da consulta, nao a classificacao gravada de um paciente'],

  // --- Container cujas folhas e que sao julgadas ---
  ['preferenciascontato', 'objeto de flags de consentimento; `email` e `whatsapp` dentro dele sao julgados pelo redator, e sobrevivem por serem booleanos'],

  // --- Autorizacao negada (modulos/auth): descreve a requisicao, nao o titular ---
  ['exigido', 'permissao ou papel exigido pela rota'],
  ['metodo', 'verbo HTTP'],
  ['rota', 'padrao de rota do controlador, sem valor de parametro'],
  ['alvo', 'identificador do alvo da autorizacao; o call site troca por `alvoOpaco` quando o alvo e concreto'],
  ['alvoopaco', 'booleano que declara que havia alvo concreto e que ele nao foi gravado'],

  // --- Sessoes e integracoes ---
  ['deteccao', 'motivo tecnico da revogacao de sessao (reuso de refresh token)'],
  ['familiarevogada', 'booleano: a familia de refresh tokens foi revogada'],
  ['removidos', 'contagem de sessoes removidas do historico'],
  ['escopos', 'escopos da chave de API, vocabulario fechado de permissao'],
  ['possuiexpiracao', 'booleano de presenca de expiracao na chave de API'],
  ['host', 'hostname do endpoint de webhook configurado pela clinica; infraestrutura, nao titular'],
  ['envioid', 'UUID do envio de formulario publico'],
  ['perguntaid', 'UUID da pergunta do formulario'],
  ['candidatosdispensados', 'lista de UUID de pacientes dispensados na checagem de duplicidade'],

  // --- Operacoes de tenant ---
  ['tenantalvoid', 'UUID da clinica alvo da operacao administrativa'],
  ['planoid', 'identificador do plano comercial'],
  ['flagsalteradas', 'nomes das feature flags alteradas (Object.keys), nao os valores'],
  ['ciclovidastatus', 'estado do ciclo de vida do tenant, enum'],
  ['convitestatus', 'estado do convite, enum'],
  ['exportacaoconfirmada', 'booleano de confirmacao da exportacao antes do encerramento'],
  ['protocoloexportacao', 'protocolo emitido para a exportacao de encerramento; identificador de processo'],
  ['motivoinformado', 'booleano de presenca do motivo; o texto nunca entra']
]);

/** Arquivos de teste nao gravam trilha real; fixture de spec nao e call site. */
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

/**
 * Recorta o literal que comeca em `inicio`, contando chaves e ignorando o que
 * estiver dentro de string ou comentario.
 *
 * Um contador ingenuo casa o fechamento errado assim que um valor contem uma
 * chave de fechamento -- e `motivo: 'nao compareceu }'` existe. Devolve `null`
 * quando o literal nao fecha, para que o gate reclame em vez de analisar um
 * recorte truncado.
 */
export function recortarLiteral(fonte, inicio) {
  let profundidade = 0;
  let dentroDeString = null;
  let escapado = false;
  let dentroDeLinha = false;
  let dentroDeBloco = false;

  for (let posicao = inicio; posicao < fonte.length; posicao += 1) {
    const atual = fonte[posicao];
    const proximo = fonte[posicao + 1];

    if (dentroDeLinha) {
      if (atual === '\n') dentroDeLinha = false;
      continue;
    }
    if (dentroDeBloco) {
      if (atual === '*' && proximo === '/') {
        dentroDeBloco = false;
        posicao += 1;
      }
      continue;
    }
    if (dentroDeString) {
      if (escapado) escapado = false;
      else if (atual === '\\') escapado = true;
      else if (atual === dentroDeString) dentroDeString = null;
      continue;
    }
    if (atual === '/' && proximo === '/') {
      dentroDeLinha = true;
      posicao += 1;
      continue;
    }
    if (atual === '/' && proximo === '*') {
      dentroDeBloco = true;
      posicao += 1;
      continue;
    }
    if (atual === "'" || atual === '"' || atual === '`') {
      dentroDeString = atual;
      continue;
    }
    if (atual === '{') profundidade += 1;
    if (atual === '}') {
      profundidade -= 1;
      if (profundidade === 0) return fonte.slice(inicio, posicao + 1);
    }
  }

  return null;
}

/** Avanca ate depois da string aberta em `inicio`, respeitando escape. */
function pularString(texto, inicio) {
  const aspas = texto[inicio];
  let posicao = inicio + 1;

  while (posicao < texto.length) {
    if (texto[posicao] === '\\') {
      posicao += 2;
      continue;
    }
    if (texto[posicao] === aspas) return posicao + 1;
    posicao += 1;
  }

  return texto.length;
}

/**
 * Diz o que esta sendo espalhado, quando o espalhamento esconde suas chaves.
 *
 * Transparente (devolve `null`): `...{ a: 1 }` e `...(cond ? { a: 1 } : {})` --
 * ha literal a vista, e o percurso principal recolhe as chaves dele. Opaco
 * (devolve o texto da origem): `...filtros`, `...dados.extras`,
 * `...montarExtras()` -- o conteudo vive em outro lugar.
 *
 * Devolver o texto, e nao um booleano, e o que permite a um envoltorio
 * declarado reconhecer o proprio salto: `registrarExportacao` acrescenta
 * `totalLinhas` e `tamanhoBytes` ao `...filtros` que recebeu do call site, e
 * `filtros` e justamente o identificador que ele declara repassar. Qualquer
 * outra origem opaca no mesmo literal continua reprovando.
 */
function origemDoEspalhamento(literal, inicio) {
  let posicao = inicio;
  while (posicao < literal.length && /\s/.test(literal[posicao])) posicao += 1;

  if (literal[posicao] === '{') return null;

  if (literal[posicao] === '(') {
    let profundidade = 0;
    for (let fim = posicao; fim < literal.length; fim += 1) {
      if (literal[fim] === '(') profundidade += 1;
      if (literal[fim] === ')') {
        profundidade -= 1;
        if (profundidade === 0) {
          const trecho = literal.slice(posicao, fim + 1);
          return trecho.includes('{') ? null : trecho;
        }
      }
    }
    return literal.slice(posicao);
  }

  const identificador = /^[A-Za-z0-9_$.]+/.exec(literal.slice(posicao));
  return identificador ? identificador[0] : literal.slice(posicao, posicao + 1);
}

/**
 * Extrai os nomes de propriedade de um literal de objeto, em todos os niveis.
 *
 * Percorre caractere a caractere com pilha de containers, e nao linha a linha.
 * A primeira versao era por linha e perdia, em silencio, todo literal escrito
 * numa unica linha -- `metadados: { origem: 'teste' }`, que e a forma mais
 * comum nos call sites. Um gate que perde call site em silencio e pior do que
 * gate nenhum: ele produz a mesma confianca infundada que o PR inteiro existe
 * para desfazer.
 *
 * Vale para qualquer profundidade porque o redator tambem julga chave a chave
 * em qualquer profundidade: `preferenciasContato: { email }` tem duas chaves a
 * conferir, e nao uma. Shorthand (`totalItens,`) conta, porque e o nome que vai
 * para o jsonb. Nome dentro de array nao conta, porque ali nao ha nome.
 */
export function extrairChavesDoLiteral(literal) {
  const chaves = [];
  const containers = [];
  const espalhamentos = [];
  let aguardandoChave = false;
  let posicao = 0;

  const dentroDeObjeto = () => containers[containers.length - 1] === '{';

  while (posicao < literal.length) {
    const atual = literal[posicao];

    if (atual === '/' && literal[posicao + 1] === '/') {
      const fim = literal.indexOf('\n', posicao);
      posicao = fim === -1 ? literal.length : fim + 1;
      continue;
    }
    if (atual === '/' && literal[posicao + 1] === '*') {
      const fim = literal.indexOf('*/', posicao);
      posicao = fim === -1 ? literal.length : fim + 2;
      continue;
    }
    if (atual === '{' || atual === '[') {
      containers.push(atual);
      aguardandoChave = atual === '{';
      posicao += 1;
      continue;
    }
    if (atual === '}' || atual === ']') {
      containers.pop();
      aguardandoChave = false;
      posicao += 1;
      continue;
    }
    if (atual === ',') {
      aguardandoChave = dentroDeObjeto();
      posicao += 1;
      continue;
    }
    if (atual === "'" || atual === '"' || atual === '`') {
      const fim = pularString(literal, posicao);
      const nome = literal.slice(posicao + 1, fim - 1);
      if (aguardandoChave && literal.slice(fim).trimStart()[0] === ':' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(nome)) {
        chaves.push(nome);
      }
      aguardandoChave = false;
      posicao = fim;
      continue;
    }
    if (literal.startsWith('...', posicao)) {
      // Espalhamento so importa dentro de objeto (`[...ids]` nao cria chave) e
      // so quando a origem e opaca.
      //
      // `...(condicao ? { alvoOpaco: true } : {})` e o idioma normal de campo
      // condicional: as chaves estao escritas ali e este mesmo percurso as
      // recolhe, entao nao ha nada por provar. Reprovar esse idioma treinaria
      // o time a contornar o gate, que e o pior desfecho possivel para um gate.
      // O que nao da para provar e `...filtros`: o conteudo esta em outro
      // arquivo e muda sozinho quando o DTO cresce.
      if (dentroDeObjeto()) {
        const origem = origemDoEspalhamento(literal, posicao + 3);
        if (origem !== null) espalhamentos.push(origem);
      }
      aguardandoChave = false;
      posicao += 3;
      continue;
    }
    if (/\s/.test(atual)) {
      posicao += 1;
      continue;
    }

    const identificador = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(literal.slice(posicao));
    if (identificador) {
      const nome = identificador[0];
      const seguinte = literal.slice(posicao + nome.length).trimStart()[0];
      // `nome:` e chave nomeada; `nome,` e `nome}` sao shorthand. Qualquer
      // outra coisa (`nome.campo`, `nome(`, `nome ?`) e um valor sendo lido.
      if (aguardandoChave && (seguinte === ':' || seguinte === ',' || seguinte === '}')) chaves.push(nome);
      aguardandoChave = false;
      posicao += nome.length;
      continue;
    }

    aguardandoChave = false;
    posicao += 1;
  }

  return { chaves, espalhamentos };
}

/**
 * Ancoras de escrita da trilha: os dois -- e unicos dois -- caminhos que chegam
 * a `user_action_logs`, cada um verificado por
 * {@link garantirAusenciaDeCaminhoNaoMapeado}.
 *
 * Sao ancoras globais, aplicadas a todo arquivo do backend. Os envoltorios
 * privados que apenas repassam o payload para um destes dois nao entram aqui:
 * eles sao declarados em {@link ENVOLTORIOS_DECLARADOS} e ancorados por arquivo,
 * porque um nome como `registrar` ou `auditar` e comum demais para virar ancora
 * global sem varrer meio backend para dentro do inventario.
 */
const CAMINHOS_DE_ESCRITA = [
  {
    // Caminho normal: `this.servicoAuditoria.registrar({ ... })` e
    // `this.auditoria.registrar({ ... })`. O prefixo antes de `auditoria` e
    // opcional de proposito: exigir ao menos um caractere perdia, em silencio,
    // os 32 call sites que usam o campo chamado exatamente `auditoria`.
    ancora: /(?:^|[^A-Za-z0-9_$])[A-Za-z0-9_$]*[Aa]uditoria\s*\.\s*registrar\s*\(/g,
    argumento: 0,
    entradaDaTrilha: true
  },
  {
    // Caminho de transacao em curso: `registrarAuditoriaNaTransacao(
    // gerenciador, { ... })`. A entrada da trilha e o *segundo* argumento -- por
    // isso o indice, e nao um "primeiro argumento" implicito: procurar o literal
    // logo depois do parenteses achava `gerenciador` e acusava de opaca uma
    // escrita perfeitamente legivel.
    //
    // O nome e exato, e nao mais um prefixo que tambem alcancava
    // `registrarAuditoria`: o prefixo casava com a *declaracao* dos envoltorios
    // privados de `planos-alimentares`, e uma assinatura contada como call site
    // vira reprovacao contra codigo que nao grava nada.
    ancora: /(?:^|[^A-Za-z0-9_$])registrarAuditoriaNaTransacao\s*\(/g,
    argumento: 1,
    entradaDaTrilha: true
  }
];

/**
 * Ancora unica dos call sites de envoltorio, com o nome do metodo capturado.
 *
 * O nome sai do padrao e vira captura de proposito: montar uma `new RegExp`
 * por envoltorio interpolava o nome dentro do padrao -- construcao dinamica que
 * o Semgrep sinaliza (detect-non-literal-regexp, CWE-1333) e que ainda custava
 * um percurso inteiro da fonte por envoltorio declarado no arquivo. Estatica, a
 * ancora casa qualquer `this.<nome>(` numa passada so, e o nome capturado e
 * resolvido contra as declaracoes do arquivo -- mesma decisao, sem regex montada
 * em tempo de execucao a partir de dado de configuracao.
 */
const ANCORA_ENVOLTORIO = /(?:^|[^A-Za-z0-9_$])this\s*\.\s*([A-Za-z0-9_$]+)\s*\(/g;

/**
 * Envoltorios privados que apenas repassam o payload livre para uma das duas
 * ancoras acima.
 *
 * Um envoltorio assim e legitimo -- `ServicoAuth.registrarTrilha` existe para
 * impedir que uma rejeicao da trilha suba no lugar do `UnauthorizedException` e
 * transforme um login recusado em 500; os controladores tem o seu para nao
 * repetir `tenantId`/`ip`/`userAgent` em cada rota --, mas ele parte a leitura
 * do gate em duas metades que precisam ser costuradas de volta:
 *
 * 1. **O salto interno** e opaco: a chamada de dentro passa `metadados`,
 *    `entrada` ou `entrada.metadados`, nunca um literal. Sem declaracao ele
 *    reprova, e e assim que uma escrita opaca de verdade continua reprovando.
 * 2. **O literal de verdade esta nos call sites do envoltorio**, e o gate so
 *    chega la se souber o nome dele. Enquanto `auditar` e `registrar` nao eram
 *    reconhecidos, as chaves de `metadados` de rotas clinicas inteiras nunca
 *    entraram no inventario -- ninguem as tinha aprovado, o gate e que nao as
 *    via.
 *
 * Por isso a declaracao e uma so, e informa as duas metades:
 *
 * - `arquivo`     -- onde o envoltorio esta declarado. A ancora vale so nele.
 * - `envoltorio`  -- o nome do metodo. O gate ancora em `this.<envoltorio>(`,
 *                    o que exclui a propria assinatura (`private async
 *                    <envoltorio>(`) sem precisar de regra a parte: definicao
 *                    nao e call site.
 * - `argumento`   -- indice (base 0) do parametro que carrega o payload livre.
 *                    Chamada com menos argumentos que isso simplesmente nao tem
 *                    payload; chamada em que esse argumento nao e literal e
 *                    opaca e reprova.
 * - `entradaDaTrilha` -- `true` quando esse argumento e a entrada nomeada da
 *                    trilha e o payload esta sob o rotulo `metadados:`;
 *                    ausente quando o argumento ja e o proprio literal livre.
 * - `repassa`     -- o identificador exato do salto interno. O gate silencia
 *                    esse salto pelo nome, e nao pelo arquivo: trocar o
 *                    argumento por qualquer outra coisa volta a reprovar, e
 *                    qualquer outra escrita opaca no mesmo arquivo continua
 *                    reprovando.
 * - `porque`      -- a justificativa escrita, como em `CHAVES_SEGURAS`.
 *
 * O mecanismo e fail-closed nas duas pontas: envoltorio nao declarado nao tem
 * seus call sites lidos, mas tambem nao tem o salto interno perdoado -- ele
 * reprova. Declarar e a unica forma de ficar verde, e declarar obriga a expor
 * as chaves dos call sites ao inventario.
 *
 * `registrarAuditoriaNaTransacao`, exportado por `servico-auditoria.ts`, nao
 * entra aqui: ele e caminho de escrita (aplica a redacao), e nao envoltorio.
 */
const ENVOLTORIOS_DECLARADOS = [
  {
    arquivo: 'octaclin-backend/src/modulos/auth/aplicacao/servico-auth.ts',
    envoltorio: 'registrarTrilha',
    argumento: 0,
    entradaDaTrilha: true,
    repassa: 'entrada',
    porque:
      'ServicoAuth.registrarTrilha e a segunda barreira que impede a trilha de converter 401 em 500'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/agenda/apresentacao/controlador-financeiro-agenda.ts',
    envoltorio: 'registrar',
    argumento: 5,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria do controlador financeiro da agenda; monta ip e userAgent uma vez so'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/automacoes/apresentacao/controlador-automacoes.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 5,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria do controlador de automacoes'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/comunicacoes/apresentacao/controlador-comunicacoes.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 5,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria do controlador de comunicacoes'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/gamificacao/apresentacao/controlador-gamificacao.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 5,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria do controlador de gamificacao'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/ia/apresentacao/controlador-ia.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 5,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria do controlador de IA, que audita ate a releitura do resultado ja derivado'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/materiais/apresentacao/controlador-materiais.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 5,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria do controlador de materiais educativos'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/mobile/apresentacao/controlador-mobile.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 5,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria do controlador mobile; ha rotas que auditam sem payload nenhum'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/operacoes/apresentacao/controlador-operacoes.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 5,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria do console operacional'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/operacoes/apresentacao/controlador-operacoes.ts',
    envoltorio: 'registrarExportacao',
    argumento: 5,
    repassa: 'filtros',
    porque:
      'envoltorio de segundo nivel sobre registrarAuditoria: acrescenta volume (totalLinhas, tamanhoBytes) aos filtros do call site, que e o que separa a consulta pontual da varredura'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/questionarios/apresentacao/controlador-questionarios.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 5,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria do controlador de questionarios'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/pacientes/apresentacao/controlador-condutas-terapeuticas.ts',
    envoltorio: 'auditar',
    argumento: 4,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria das condutas terapeuticas; recursoTipo e sempre `paciente`'
  },
  {
    arquivo:
      'octaclin-backend/src/modulos/pacientes/apresentacao/controlador-consentimentos-evolucao-fotografica.ts',
    envoltorio: 'auditar',
    argumento: 4,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria dos consentimentos de evolucao fotografica'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/pacientes/apresentacao/controlador-documentos-clinicos.ts',
    envoltorio: 'registrar',
    argumento: 4,
    repassa: 'metadados',
    porque:
      'ponto unico de auditoria dos documentos clinicos, inclusive da leitura -- e o que responde "quem abriu a declaracao deste paciente"'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/pacientes/apresentacao/controlador-evolucoes-fotograficas.ts',
    envoltorio: 'auditar',
    argumento: 4,
    repassa: 'metadados',
    porque: 'ponto unico de auditoria das evolucoes fotograficas'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/planos-alimentares/aplicacao/servico-modelos-plano-alimentar.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 1,
    entradaDaTrilha: true,
    repassa: 'entrada.metadados',
    porque:
      'o chamador ja esta dentro do executorTenant da operacao de negocio; ServicoAuditoria.registrar abriria uma segunda transacao'
  },
  {
    arquivo: 'octaclin-backend/src/modulos/planos-alimentares/aplicacao/servico-receitas-nutricionais.ts',
    envoltorio: 'registrarAuditoria',
    argumento: 1,
    entradaDaTrilha: true,
    repassa: 'entrada.metadados',
    porque:
      'mesma razao do gemeo em servico-modelos-plano-alimentar.ts: transacao em curso, entrada nomeada para o literal ficar a vista'
  }
];

const ENVOLTORIOS_POR_ARQUIVO = new Map();
for (const declaracao of ENVOLTORIOS_DECLARADOS) {
  const existentes = ENVOLTORIOS_POR_ARQUIVO.get(declaracao.arquivo) ?? [];
  existentes.push(declaracao);
  ENVOLTORIOS_POR_ARQUIVO.set(declaracao.arquivo, existentes);
}

/**
 * Diz se o nome que a ancora achou e a *declaracao* da funcao, e nao uma
 * chamada dela.
 *
 * `export async function registrarAuditoriaNaTransacao(gerenciador: ...)` tem a
 * mesma forma lexica de um call site, e a lista de parametros tipados nunca e um
 * literal -- a assinatura viraria uma "escrita opaca" perpetua contra o arquivo
 * que justamente aplica a redacao. Para os envoltorios o problema nao existe: la
 * a ancora exige `this.`, que uma assinatura nao tem.
 */
/**
 * Descarta espaco e comentario no comeco de um argumento.
 *
 * Um call site escreve o porque logo antes do literal -- e a forma que a
 * revisao deste PR pediu --, e o argumento passa a comecar por `//`. Sem esta
 * limpeza o gate leria o comentario como "nao e literal" e reprovaria
 * exatamente o call site mais bem documentado do arquivo.
 */
function semComentarioInicial(texto) {
  let resto = texto.trimStart();

  for (;;) {
    if (resto.startsWith('//')) {
      const fim = resto.indexOf('\n');
      resto = (fim === -1 ? '' : resto.slice(fim + 1)).trimStart();
      continue;
    }
    if (resto.startsWith('/*')) {
      const fim = resto.indexOf('*/');
      resto = (fim === -1 ? '' : resto.slice(fim + 2)).trimStart();
      continue;
    }
    return resto;
  }
}

function ehDeclaracaoDeFuncao(fonte, inicioDoNome) {
  return /\bfunction\s*$/.test(fonte.slice(Math.max(0, inicioDoNome - 40), inicioDoNome));
}

/**
 * Recorta os argumentos de nivel superior da chamada que abre em `inicio`.
 *
 * Necessario porque os envoltorios recebem o payload por posicao
 * (`this.auditar(usuario, requisicao, acao, pacienteId, { ... })`), e nao sob um
 * rotulo. Ignora virgula dentro de string, comentario, parenteses, colchete ou
 * chave aninhada. Devolve `null` quando a chamada nao fecha, para que o gate
 * reclame em vez de analisar um recorte truncado.
 */
export function recortarArgumentos(fonte, inicio) {
  const argumentos = [];
  let profundidade = 0;
  let comeco = inicio + 1;
  let dentroDeString = null;
  let escapado = false;
  let dentroDeLinha = false;
  let dentroDeBloco = false;

  for (let posicao = inicio; posicao < fonte.length; posicao += 1) {
    const atual = fonte[posicao];
    const proximo = fonte[posicao + 1];

    if (dentroDeLinha) {
      if (atual === '\n') dentroDeLinha = false;
      continue;
    }
    if (dentroDeBloco) {
      if (atual === '*' && proximo === '/') {
        dentroDeBloco = false;
        posicao += 1;
      }
      continue;
    }
    if (dentroDeString) {
      if (escapado) escapado = false;
      else if (atual === '\\') escapado = true;
      else if (atual === dentroDeString) dentroDeString = null;
      continue;
    }
    if (atual === '/' && proximo === '/') {
      dentroDeLinha = true;
      posicao += 1;
      continue;
    }
    if (atual === '/' && proximo === '*') {
      dentroDeBloco = true;
      posicao += 1;
      continue;
    }
    if (atual === "'" || atual === '"' || atual === '`') {
      dentroDeString = atual;
      continue;
    }
    if (atual === '(' || atual === '[' || atual === '{') {
      profundidade += 1;
      continue;
    }
    if (atual === ')' || atual === ']' || atual === '}') {
      profundidade -= 1;
      if (profundidade === 0) {
        const ultimo = fonte.slice(comeco, posicao);
        if (argumentos.length || ultimo.trim()) argumentos.push(ultimo);
        return argumentos;
      }
      continue;
    }
    if (atual === ',' && profundidade === 1) {
      argumentos.push(fonte.slice(comeco, posicao));
      comeco = posicao + 1;
    }
  }

  return null;
}

/**
 * Localiza o payload livre dentro de um argumento de escrita da trilha.
 *
 * `sobRotulo` distingue os dois formatos que existem: a entrada nomeada da
 * trilha, em que o payload esta sob `metadados:`, e o argumento que ja e o
 * proprio literal livre. A escolha e declarada, e nao inferida do conteudo:
 * inferir abriria a porta para um literal que por acaso tenha uma chave chamada
 * `metadados` ser lido pela metade, em silencio.
 */
function localizarMetadados(argumento, sobRotulo) {
  if (!sobRotulo) return { tipo: 'literal', literal: argumento };

  // `[:,}]` e nao so `:` para alcancar tambem o shorthand `{ acao, metadados }`,
  // que e uma escrita de payload livre como qualquer outra -- so que com o valor
  // fora de vista.
  const rotulo = argumento.search(/(^|[^A-Za-z0-9_$.])metadados\s*[:,}]/);
  // Escrita sem metadados nenhum e legitima e nao e uma lacuna: nao ha payload
  // livre para conferir.
  if (rotulo === -1) return { tipo: 'ausente' };

  const fimDoRotulo = argumento.indexOf('metadados', rotulo) + 'metadados'.length;
  const doisPontos = argumento.indexOf(':', rotulo + 1);
  if (doisPontos === -1 || argumento.slice(fimDoRotulo, doisPontos).trim() !== '') {
    return { tipo: 'opaco', identificador: 'metadados' };
  }

  const depois = argumento.slice(doisPontos + 1);
  const avanco = depois.length - depois.trimStart().length;
  if (depois.trimStart()[0] === '{') {
    const literal = recortarLiteral(depois, avanco);
    return literal === null ? { tipo: 'opaco', identificador: null } : { tipo: 'literal', literal };
  }

  const expressao = /^[A-Za-z0-9_$.]+/.exec(depois.trimStart());
  return { tipo: 'opaco', identificador: expressao ? expressao[0] : null };
}

/**
 * Localiza cada escrita da trilha e devolve as chaves de `metadados` que ela
 * grava.
 *
 * A varredura e ancorada na chamada de auditoria, e nao na palavra `metadados`
 * solta. `metadados` e um nome comum no backend -- o importador da TACO e o
 * adaptador SMTP tem o seu -- e contar aqueles como call site encheria o
 * inventario de chaves que nunca chegam a `user_action_logs`. O gate perderia o
 * sentido por excesso de zelo: ninguem mantem uma lista de chaves seguras com
 * centenas de linhas irrelevantes, e uma lista que ninguem mantem para de
 * reprovar o que deveria.
 *
 * Escrita cujo `metadados` nao e literal (variavel, parametro tipado, campo de
 * interface) e contada como opaca, e nao como aprovada: o gate nao consegue
 * provar nada sobre ela. E a mesma distincao entre `nao-verificado` e aprovado
 * que `seguranca/menor-privilegio-providers.ts` faz.
 *
 * `envoltorios` e parametro, e nao leitura direta do mapa, para que o teste do
 * proprio gate consiga exercitar uma declaracao sem inventar um arquivo real.
 */
export function extrairChavesDeMetadados(
  fonte,
  caminho,
  envoltorios = ENVOLTORIOS_POR_ARQUIVO.get(caminho) ?? []
) {
  const ocorrencias = [];
  const declarados = new Set(envoltorios.map(({ repassa }) => repassa));
  const linhaDe = (indice) => fonte.slice(0, indice).split('\n').length;

  const registrar = (linha, payload) => {
    if (payload.tipo === 'ausente') return;

    if (payload.tipo === 'opaco') {
      if (payload.identificador !== null && declarados.has(payload.identificador)) return;
      ocorrencias.push({
        caminho,
        linha,
        opaco: true,
        semLiteral: payload.identificador ?? undefined,
        chaves: [],
        espalhamentos: []
      });
      return;
    }

    const { chaves, espalhamentos } = extrairChavesDoLiteral(payload.literal);
    ocorrencias.push({
      caminho,
      linha,
      opaco: false,
      chaves,
      espalhamentos: espalhamentos.filter((origem) => !declarados.has(origem))
    });
  };

  // Um percurso so para os dois caminhos globais e para os call sites dos
  // envoltorios declarados: os tres leem o mesmo argumento posicional e caem na
  // mesma decisao (literal, ausente ou opaco). Duas maquinarias diferentes foi
  // exatamente o que deixou passar a assinatura de `registrarAuditoriaNaTransacao`
  // contada como call site.
  const declaracaoPorNome = new Map(envoltorios.map((declaracao) => [declaracao.envoltorio, declaracao]));
  const percursos = [
    ...CAMINHOS_DE_ESCRITA.map((caminhoDeEscrita) => ({ ...caminhoDeEscrita, global: true })),
    ...(declaracaoPorNome.size > 0 ? [{ ancora: ANCORA_ENVOLTORIO, declaracaoPorNome, global: false }] : [])
  ];

  for (const percurso of percursos) {
    percurso.ancora.lastIndex = 0;
    let achado;

    while ((achado = percurso.ancora.exec(fonte)) !== null) {
      let { argumento, entradaDaTrilha } = percurso;
      if (percurso.declaracaoPorNome !== undefined) {
        const declaracao = percurso.declaracaoPorNome.get(achado[1]);
        // A ancora estatica casa qualquer `this.qualquerCoisa(`; so os nomes
        // declarados para este arquivo sao caminho de escrita da trilha.
        if (declaracao === undefined) continue;
        argumento = declaracao.argumento;
        entradaDaTrilha = Boolean(declaracao.entradaDaTrilha);
      }

      const abertura = achado.index + achado[0].length - 1;
      const linha = linhaDe(achado.index);
      // A ancora consome um caractere separador antes do nome, salvo no inicio
      // do arquivo.
      const inicioDoNome = achado.index + (/^[A-Za-z0-9_$]/.test(achado[0]) ? 0 : 1);
      if (percurso.global && ehDeclaracaoDeFuncao(fonte, inicioDoNome)) continue;

      const argumentos = recortarArgumentos(fonte, abertura);
      if (argumentos === null) {
        ocorrencias.push({ caminho, linha, opaco: true, chaves: [], espalhamentos: [] });
        continue;
      }
      // Chamada mais curta que o parametro do payload: a escrita audita sem
      // payload livre, o que e legitimo (`mobile.midia.visualizar`).
      if (argumentos.length <= argumento) continue;

      const texto = semComentarioInicial(argumentos[argumento]);
      if (texto[0] !== '{') {
        const expressao = /^[A-Za-z0-9_$.]+/.exec(texto);
        registrar(linha, { tipo: 'opaco', identificador: expressao ? expressao[0] : null });
        continue;
      }

      const literal = recortarLiteral(texto, 0);
      if (literal === null) {
        ocorrencias.push({ caminho, linha, opaco: true, chaves: [], espalhamentos: [] });
        continue;
      }

      registrar(linha, localizarMetadados(literal, entradaDaTrilha));
    }
  }

  return ocorrencias;
}

/**
 * Reprova se aparecer um terceiro caminho de escrita da trilha.
 *
 * As ancoras acima so encontram o que passa por `ServicoAuditoria.registrar` ou
 * por `registrarAuditoriaNaTransacao`. Um `getRepository(UserActionLogOrm)`
 * seguido de `save` em qualquer outro arquivo escaparia do inventario inteiro,
 * e foi exatamente essa a falha original: quatro escritas diretas em
 * `planos-alimentares` gravavam `metadados` livre enquanto os comentarios do
 * modulo afirmavam que o servico era o unico ponto de escrita. A afirmacao de
 * exclusividade agora e um teste, e nao uma frase.
 */
export function garantirAusenciaDeCaminhoNaoMapeado(arquivos) {
  const permitidos = new Set([
    'octaclin-backend/src/infraestrutura/auditoria/servico-auditoria.ts'
  ]);

  return arquivos
    .filter(({ caminho, fonte }) => !permitidos.has(caminho) && /getRepository\(UserActionLogOrm\)[\s\S]{0,400}?\.(save|insert|upsert)\(/.test(fonte))
    .map(
      ({ caminho }) =>
        `${caminho} grava em UserActionLogOrm fora de servico-auditoria.ts. ` +
        'A trilha tem dois caminhos de escrita e os dois aplicam a redacao: ' +
        '`ServicoAuditoria.registrar` (abre a propria transacao) e ' +
        '`registrarAuditoriaNaTransacao` (reusa a transacao em curso). Use um deles.'
    );
}

function normalizarChave(chave) {
  return chave
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function executarGate() {
  const arquivos = listarArquivos(RAIZ_BACKEND).map((absoluto) => ({
    caminho: relative(RAIZ, absoluto).replace(/\\/g, '/'),
    fonte: readFileSync(absoluto, 'utf8')
  }));

  const ocorrencias = arquivos.flatMap(({ fonte, caminho }) => extrairChavesDeMetadados(fonte, caminho));

  const violacoes = [...garantirAusenciaDeCaminhoNaoMapeado(arquivos)];
  const inventario = new Map();

  for (const ocorrencia of ocorrencias) {
    for (const origem of ocorrencia.espalhamentos) {
      violacoes.push(
        `${ocorrencia.caminho}:${ocorrencia.linha} espalha \`${origem}\` inteiro dentro de metadados. ` +
          'Nao da para provar que chave ele carrega hoje, nem o que passara a carregar quando o DTO crescer. ' +
          'Liste as chaves uma a uma, ou grave um booleano de presenca.'
      );
    }
    if (ocorrencia.opaco) {
      // Opaco nao e aprovado. E a mesma distincao que
      // `seguranca/menor-privilegio-providers.ts` faz entre `nao-verificado` e
      // `conforme`: o gate nao provou nada sobre esta escrita, e ficar calado
      // aqui e exatamente como a lacuna original passou verde.
      violacoes.push(
        `${ocorrencia.caminho}:${ocorrencia.linha} escreve na trilha sem literal a vista` +
          (ocorrencia.semLiteral ? ` (argumento \`${ocorrencia.semLiteral}\`)` : '') +
          '. Passe o literal direto na chamada, ou declare o envoltorio em ' +
          'ENVOLTORIOS_DECLARADOS deste arquivo (arquivo, nome, indice do argumento, ' +
          'identificador repassado e justificativa).'
      );
      continue;
    }

    for (const chave of ocorrencia.chaves) {
      const normal = normalizarChave(chave);
      if (!inventario.has(normal)) inventario.set(normal, { chave, locais: [] });
      inventario.get(normal).locais.push(`${ocorrencia.caminho}:${ocorrencia.linha}`);
    }
  }

  for (const [normal, { chave, locais }] of [...inventario].sort()) {
    if (chaveEhCobertaPorRegra(chave) || chaveEhExcecaoDeEvidencia(chave)) continue;
    if (CHAVES_SEGURAS.has(normal)) continue;
    violacoes.push(
      `${locais[0]} grava a chave \`${chave}\` em metadados, e nada a cobre. ` +
        'Ou o call site nao deveria grava-la (troque por um booleano de presenca), ' +
        'ou ela e termo sensivel que falta em redacao-auditoria.ts, ' +
        'ou e operacional e entra em CHAVES_SEGURAS deste arquivo com justificativa escrita.'
    );
  }

  return { inventario, ocorrencias, violacoes };
}

/** Mesma ordem de precedencia do redator: evidencia e verificada antes das regras de nome. */
function classificar(normal, chave) {
  if (chaveEhExcecaoDeEvidencia(chave)) return 'EVIDENCIA';
  if (chaveEhCobertaPorRegra(chave)) return 'REGRA';
  return CHAVES_SEGURAS.has(normal) ? 'SEGURA' : 'DESCOBERTA';
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const { inventario, ocorrencias, violacoes } = executarGate();

  if (process.argv.includes('--inventario')) {
    for (const [normal, { chave, locais }] of [...inventario].sort()) {
      console.log(`${classificar(normal, chave).padEnd(11)} ${chave} (${locais.length}) ${locais[0]}`);
    }
  }

  console.log(`${inventario.size} chaves distintas em ${ocorrencias.length} call sites de metadados.`);

  if (violacoes.length) {
    console.error(`\n${violacoes.length} reprovacoes:\n`);
    for (const violacao of violacoes) console.error(`  - ${violacao}`);
    process.exit(1);
  }
  console.log('Cobertura da redacao de auditoria verificada.');
}
