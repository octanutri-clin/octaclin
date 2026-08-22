import ts from 'typescript';

export const termosInterface = new Map([
  ['acao', 'ação'],
  ['acoes', 'ações'],
  ['adesao', 'adesão'],
  ['alteracao', 'alteração'],
  ['alteracoes', 'alterações'],
  ['aparecerao', 'aparecerão'],
  ['apos', 'após'],
  ['ate', 'até'],
  ['area', 'área'],
  ['areas', 'áreas'],
  ['aprovacao', 'aprovação'],
  ['atencao', 'atenção'],
  ['atualizacao', 'atualização'],
  ['ativacao', 'ativação'],
  ['automatico', 'automático'],
  ['automacoes', 'automações'],
  ['antropometrica', 'antropométrica'],
  ['antropometricas', 'antropométricas'],
  ['avaliacao', 'avaliação'],
  ['avaliacoes', 'avaliações'],
  ['analise', 'análise'],
  ['cabecalho', 'cabeçalho'],
  ['calculo', 'cálculo'],
  ['calculos', 'cálculos'],
  ['catalogo', 'catálogo'],
  ['classificacao', 'classificação'],
  ['codigo', 'código'],
  ['clinica', 'clínica'],
  ['clinicas', 'clínicas'],
  ['clinico', 'clínico'],
  ['comunicacao', 'comunicação'],
  ['comunicacoes', 'comunicações'],
  ['composicao', 'composição'],
  ['concluida', 'concluída'],
  ['conclusao', 'conclusão'],
  ['confirmacao', 'confirmação'],
  ['conexao', 'conexão'],
  ['configuracao', 'configuração'],
  ['configuracoes', 'configurações'],
  ['conteudo', 'conteúdo'],
  ['copia', 'cópia'],
  ['criterio', 'critério'],
  ['condicoes', 'condições'],
  ['descricao', 'descrição'],
  ['declaracao', 'declaração'],
  ['diagnostico', 'diagnóstico'],
  ['diretorio', 'diretório'],
  ['diaria', 'diária'],
  ['diarias', 'diárias'],
  ['disponivel', 'disponível'],
  ['disponiveis', 'disponíveis'],
  ['distribuicao', 'distribuição'],
  ['edicao', 'edição'],
  ['endereco', 'endereço'],
  ['energetica', 'energética'],
  ['equacoes', 'equações'],
  ['evidencia', 'evidência'],
  ['evolucao', 'evolução'],
  ['evolucoes', 'evoluções'],
  ['execucao', 'execução'],
  ['expiracao', 'expiração'],
  ['exibicao', 'exibição'],
  ['formulario', 'formulário'],
  ['formularios', 'formulários'],
  ['formula', 'fórmula'],
  ['fotografica', 'fotográfica'],
  ['fotograficas', 'fotográficas'],
  ['historico', 'histórico'],
  ['grafico', 'gráfico'],
  ['ha', 'há'],
  ['horario', 'horário'],
  ['horarios', 'horários'],
  ['indisponivel', 'indisponível'],
  ['identificacao', 'identificação'],
  ['informacao', 'informação'],
  ['informacoes', 'informações'],
  ['impressao', 'impressão'],
  ['integracao', 'integração'],
  ['integracoes', 'integrações'],
  ['interpretacao', 'interpretação'],
  ['inicio', 'início'],
  ['ja', 'já'],
  ['metodo', 'método'],
  ['mes', 'mês'],
  ['modulo', 'módulo'],
  ['modulos', 'módulos'],
  ['nao', 'não'],
  ['necessario', 'necessário'],
  ['necessarios', 'necessários'],
  ['nivel', 'nível'],
  ['nutricao', 'nutrição'],
  ['numero', 'número'],
  ['obrigatoria', 'obrigatória'],
  ['observacao', 'observação'],
  ['observacoes', 'observações'],
  ['opcao', 'opção'],
  ['opcoes', 'opções'],
  ['operacao', 'operação'],
  ['operacoes', 'operações'],
  ['orientacao', 'orientação'],
  ['orientacoes', 'orientações'],
  ['pagina', 'página'],
  ['pendencia', 'pendência'],
  ['pendencias', 'pendências'],
  ['permissao', 'permissão'],
  ['permissoes', 'permissões'],
  ['periodo', 'período'],
  ['periodos', 'períodos'],
  ['politica', 'política'],
  ['podera', 'poderá'],
  ['posicao', 'posição'],
  ['possivel', 'possível'],
  ['prioritarios', 'prioritários'],
  ['preferencia', 'preferência'],
  ['preferencias', 'preferências'],
  ['prescricao', 'prescrição'],
  ['protecao', 'proteção'],
  ['proteinas', 'proteínas'],
  ['proxima', 'próxima'],
  ['proximas', 'próximas'],
  ['proximo', 'próximo'],
  ['proximos', 'próximos'],
  ['prontuario', 'prontuário'],
  ['publicacao', 'publicação'],
  ['publica', 'pública'],
  ['publicas', 'públicas'],
  ['publico', 'público'],
  ['questionario', 'questionário'],
  ['questionarios', 'questionários'],
  ['rapida', 'rápida'],
  ['rapidas', 'rápidas'],
  ['receituario', 'receituário'],
  ['refeicao', 'refeição'],
  ['refeicoes', 'refeições'],
  ['relatorio', 'relatório'],
  ['responsavel', 'responsável'],
  ['retencao', 'retenção'],
  ['revisao', 'revisão'],
  ['rotulo', 'rótulo'],
  ['rotacao', 'rotação'],
  ['selecao', 'seleção'],
  ['secao', 'seção'],
  ['seguranca', 'segurança'],
  ['subareas', 'subáreas'],
  ['sessao', 'sessão'],
  ['sensivel', 'sensível'],
  ['serie', 'série'],
  ['sera', 'será'],
  ['serao', 'serão'],
  ['situacao', 'situação'],
  ['simulacao', 'simulação'],
  ['dependera', 'dependerá'],
  ['solicitacao', 'solicitação'],
  ['solicitacoes', 'solicitações'],
  ['so', 'só'],
  ['sugestao', 'sugestão'],
  ['sugestoes', 'sugestões'],
  ['tambem', 'também'],
  ['terapeutica', 'terapêutica'],
  ['terapeuticas', 'terapêuticas'],
  ['titulo', 'título'],
  ['transicao', 'transição'],
  ['ultima', 'última'],
  ['ultimo', 'último'],
  ['unica', 'única'],
  ['unico', 'único'],
  ['usuario', 'usuário'],
  ['usuarios', 'usuários'],
  ['validacao', 'validação'],
  ['valido', 'válido'],
  ['versao', 'versão'],
  ['versoes', 'versões'],
  ['visao', 'visão'],
  ['visualizacao', 'visualização'],
  ['vinculo', 'vínculo'],
  ['voce', 'você']
]);

const substituicoesExatas = new Map([
  ['Seu acesso e individual e protegido.', 'Seu acesso é individual e protegido.'],
  ['Dashboard', 'painel clínico'],
  ['Status', 'Situação'],
  ['ID recurso', 'Identificador do recurso'],
  ['Traces sanitizados', 'Rastreamentos sanitizados']
]);

const propriedadesVisiveis = new Set([
  'aria-label', 'ariaLabel', 'confirmar', 'descricao', 'detalhe', 'grupo', 'label', 'mensagem',
  'placeholder', 'rotulo', 'rotuloConfirmar', 'rotuloCancelar', 'subtitulo', 'texto', 'title', 'titulo'
]);

const funcoesVisiveis = new Set([
  'setErro', 'setSucesso', 'setAviso', 'setMensagem', 'classificarFalhaInterface',
  'executar', 'executarAcao', 'getByText', 'getByLabel', 'getByPlaceholder', 'toContainText', 'toHaveText'
]);

function nomeNo(no) {
  if (ts.isIdentifier(no) || ts.isStringLiteral(no)) return no.text;
  if (ts.isPropertyAccessExpression(no)) return no.name.text;
  return '';
}

function ehArgumentoVisivel(no, chamada) {
  const nome = nomeNo(chamada.expression);
  const indice = chamada.arguments.indexOf(no);
  if (nome === 'executar') return indice === 1 || indice === 3;
  if (nome === 'executarAcao') return indice === 1;
  if (/^set(Erro|Sucesso|Aviso|Mensagem)/.test(nome)) return indice === 0;
  return funcoesVisiveis.has(nome) && indice === 0;
}

function ehExpressaoTransparente(no) {
  if (ts.isConditionalExpression(no) || ts.isParenthesizedExpression(no)) return true;
  if (!ts.isBinaryExpression(no)) return false;
  return [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken]
    .includes(no.operatorToken.kind);
}

function estaEmExpressaoJsx(no) {
  let atual = no.parent;
  while (atual && ehExpressaoTransparente(atual)) atual = atual.parent;
  return Boolean(atual && ts.isJsxExpression(atual) && (ts.isJsxElement(atual.parent) || ts.isJsxFragment(atual.parent)));
}

function estaEmArgumentoVisivel(no) {
  let atual = no;
  while (atual.parent && ehExpressaoTransparente(atual.parent)) atual = atual.parent;
  return Boolean(atual.parent && ts.isCallExpression(atual.parent) && ehArgumentoVisivel(atual, atual.parent));
}

function estaEmAtributoJsxVisivel(no) {
  let atual = no;
  while (atual.parent && ehExpressaoTransparente(atual.parent)) atual = atual.parent;
  const expressao = atual.parent;
  const atributo = expressao?.parent;
  return Boolean(expressao && ts.isJsxExpression(expressao)
    && atributo && ts.isJsxAttribute(atributo)
    && propriedadesVisiveis.has(nomeNo(atributo.name)));
}

function ehNomeAcessivelPlaywright(no) {
  const propriedade = no.parent;
  if (!ts.isPropertyAssignment(propriedade) || nomeNo(propriedade.name) !== 'name') return false;
  const objeto = propriedade.parent;
  const chamada = objeto.parent;
  return ts.isObjectLiteralExpression(objeto)
    && ts.isCallExpression(chamada)
    && nomeNo(chamada.expression) === 'getByRole'
    && chamada.arguments[1] === objeto;
}

function ehTextoVisivel(no) {
  const pai = no.parent;
  if (ts.isJsxText(no)) return true;
  if (!ts.isStringLiteralLike(no)) return false;
  if (ts.isJsxAttribute(pai)) return propriedadesVisiveis.has(nomeNo(pai.name));
  if (estaEmExpressaoJsx(no)) return true;
  if (estaEmAtributoJsxVisivel(no)) return true;
  if (ehNomeAcessivelPlaywright(no)) return true;
  if (ts.isPropertyAssignment(pai) && propriedadesVisiveis.has(nomeNo(pai.name))) return true;
  if (estaEmArgumentoVisivel(no)) return true;
  return false;
}

function preservarCaixa(original, corrigido) {
  if (original === original.toUpperCase()) return corrigido.toUpperCase();
  if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(original)) return corrigido[0].toUpperCase() + corrigido.slice(1);
  return corrigido;
}

export function corrigirTextoInterface(texto) {
  let resultado = texto;
  for (const [origem, destino] of substituicoesExatas) resultado = resultado.replaceAll(origem, destino);
  for (const [origem, destino] of termosInterface) {
    const palavraIsolada = new RegExp(`(?<![\\p{L}\\p{M}])${origem}(?![\\p{L}\\p{M}])`, 'giu');
    resultado = resultado.replace(palavraIsolada, (termo) => preservarCaixa(termo, destino));
  }
  return resultado;
}

export function extrairTextosInterface(codigo, arquivo = 'interface.tsx') {
  const fonte = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const textos = [];
  function visitar(no) {
    if (ehTextoVisivel(no)) {
      const inicio = ts.isJsxText(no) ? no.getStart(fonte) : no.getStart(fonte) + 1;
      const fim = ts.isJsxText(no) ? no.getEnd() : no.getEnd() - 1;
      textos.push({ inicio, fim, texto: codigo.slice(inicio, fim), linha: fonte.getLineAndCharacterOfPosition(inicio).line + 1 });
    }
    ts.forEachChild(no, visitar);
  }
  visitar(fonte);
  return textos;
}

export function auditarCodigoInterface(codigo, arquivo) {
  return extrairTextosInterface(codigo, arquivo).flatMap((item) => {
    const corrigido = corrigirTextoInterface(item.texto);
    return corrigido === item.texto ? [] : [{ ...item, corrigido }];
  });
}

export function corrigirCodigoInterface(codigo, arquivo) {
  const alteracoes = auditarCodigoInterface(codigo, arquivo).sort((a, b) => b.inicio - a.inicio);
  return alteracoes.reduce(
    (resultado, item) => resultado.slice(0, item.inicio) + item.corrigido + resultado.slice(item.fim),
    codigo
  );
}
