// Projeta apenas mensagens exatas do contrato atual. Não valida entradas do
// paciente nem devolve texto, valores ou caminhos arbitrários recebidos.
const campos = [];
const regras = new Map();
function campo(secao, caminho, rotulo, opcoes = {}) {
  const id = `${secao}.${caminho}`;
  campos.push(Object.freeze({ campo: id, rotulo }));
  function regra(texto, mensagem) { regras.set(`${secao}\0${texto}`, Object.freeze({ campo: id, mensagem })); }
  if (opcoes.texto) regra(`${caminho} must be a string`, 'Informe um texto válido.');
  if (opcoes.max) regra(`${caminho} must be shorter than or equal to ${opcoes.max} characters`, `Use no máximo ${opcoes.max} caracteres.`);
  if (opcoes.email) regra(`${caminho} must be an email`, 'Informe um e-mail válido.');
  if (opcoes.regex) regra(`${caminho} must match ${opcoes.regex} regular expression`, opcoes.aviso);
  if (opcoes.enum) regra(`${caminho} must be one of the following values: ${opcoes.enum.join(', ')}`, 'Selecione uma opção válida.');
  if (opcoes.data) regra(`${caminho} must be a valid ISO 8601 date string`, 'Informe uma data válida.');
  if (opcoes.etiquetas) {
    regra('tags must be an array', 'Revise as etiquetas informadas.');
    regra('tags must contain no more than 12 elements', 'Informe no máximo 12 etiquetas.');
    regra('each value in tags must be a string', 'Revise as etiquetas informadas.');
    regra('each value in tags must be shorter than or equal to 40 characters', 'Use no máximo 40 caracteres por etiqueta.');
  }
}
campo('basicos', 'nome', 'Nome completo', { texto: true, max: 180 });
campo('identificacao', 'nomeUso', 'Apelido ou nome de uso', { texto: true, max: 180 });
campo('basicos', 'dataNascimento', 'Data de nascimento', { data: true });
campo('identificacao', 'sexo', 'Sexo', { enum: ['feminino', 'masculino', 'intersexo', 'nao_informar'] });
campo('identificacao', 'condicaoBiologica', 'Condição biológica', { enum: ['nao_gestante', 'gestante', 'lactante', 'menopausa'] });
campo('contato', 'email', 'E-mail', { email: true, max: 180 });
campo('contato', 'instagram', 'Usuário do Instagram', { texto: true, max: 80 });
campo('contato', 'ddi', 'DDI', { regex: '/^\\+[1-9]\\d{0,2}$/', aviso: 'Informe o DDI com + e até 3 dígitos.' });
campo('contato', 'celular', 'Celular com DDD', { regex: '/^\\d{10,11}$/', aviso: 'Informe 10 ou 11 dígitos, incluindo o DDD.' });
campo('contato', 'canalPreferido', 'Canal preferido', { enum: ['email', 'whatsapp', 'telefone'] });
for (const [chave, rotulo, max] of [['cep', 'CEP', 12], ['logradouro', 'Endereço', 160], ['bairro', 'Bairro', 80], ['cidade', 'Cidade', 100], ['estado', 'Estado', 2]]) {
  campo('contato', `endereco.${chave}`, rotulo, { texto: true, max });
}
campo('operacao', 'categoria', 'Categoria do paciente', { texto: true, max: 80 });
campo('operacao', 'origem', 'Origem', { texto: true, max: 100 });
campo('operacao', 'proximaRevisaoEm', 'Próxima revisão', { data: true, regex: '/^\\d{4}-\\d{2}-\\d{2}$/', aviso: 'Informe uma data válida.' });
campo('operacao', 'tags', 'Etiquetas', { etiquetas: true });
campo('operacao', 'responsavel.nome', 'Responsável', { texto: true, max: 180 });
campo('operacao', 'responsavel.parentesco', 'Parentesco', { texto: true, max: 80 });
campo('operacao', 'responsavel.contato', 'Contato do responsável', { texto: true, max: 180 });
campo('fiscal', 'nomePagador', 'Nome do pagador', { texto: true, max: 180 });
campo('fiscal', 'cpf', 'CPF do paciente', { regex: '/^\\d{11}$/', aviso: 'Informe os 11 dígitos do CPF.' });
campo('fiscal', 'emailRecibo', 'E-mail para recibo', { email: true, max: 180 });
regras.set('operacao\0Data de proxima revisao invalida.', { campo: 'operacao.proximaRevisaoEm', mensagem: 'Informe uma data válida.' });
regras.set('identificacao\0A condicao biologica so pode ser registrada para sexo feminino.', { campo: 'identificacao.sexo', mensagem: 'Confira a condição biológica e o sexo informados.' });
export const CAMPOS_CADASTRO = Object.freeze(campos);

export function projetarFalhaCadastro(status, corpo, secao) {
  const mensagens = {
    401: 'Sua sessão expirou. Entre novamente para continuar.',
    403: 'Você não tem permissão para salvar esta seção.',
    404: 'Este cadastro não está disponível para esta operação.',
    409: 'Não foi possível concluir esta alteração. Confira os dados atuais antes de tentar novamente.',
    429: 'Muitas tentativas. Aguarde antes de tentar novamente.'
  };
  const validacao = status === 400 || status === 422;
  const resultado = {
    status,
    mensagem: mensagens[status] ?? (validacao ? 'Não foi possível salvar esta seção. Revise os dados e tente novamente.' : 'Não foi possível concluir a operação agora. Tente novamente.'),
    campos: [], temErrosGerais: true
  };
  if (!validacao || !['basicos', 'identificacao', 'contato', 'operacao', 'fiscal'].includes(secao)) return resultado;
  try {
    if (typeof corpo === 'string') {
      if (corpo.length > 32768) return resultado;
      corpo = JSON.parse(corpo);
    }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo) || !Object.hasOwn(corpo, 'message')) return resultado;
    const lista = typeof corpo.message === 'string' ? [corpo.message] : corpo.message;
    if (!Array.isArray(lista) || lista.length === 0 || lista.length > 64 || lista.some((item) => typeof item !== 'string' || item.length > 512)) return resultado;
    const encontrados = new Map();
    let desconhecidos = false;
    for (const texto of lista) {
      const conhecido = regras.get(`${secao}\0${texto}`);
      if (conhecido) { if (!encontrados.has(conhecido.campo)) encontrados.set(conhecido.campo, conhecido); }
      else desconhecidos = true;
    }
    resultado.campos = CAMPOS_CADASTRO.flatMap(({ campo }) => encontrados.has(campo) ? [{ ...encontrados.get(campo) }] : []);
    resultado.temErrosGerais = desconhecidos || resultado.campos.length === 0;
  } catch { /* Conteúdo inválido permanece um erro geral, sem reflexão. */ }
  return resultado;
}
