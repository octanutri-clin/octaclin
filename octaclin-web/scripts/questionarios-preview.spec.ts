import assert from 'node:assert/strict';
import test from 'node:test';
import { criarCampoPreview } from '../lib/questionarios-preview';

test('deve traduzir multipla escolha em campo de preview com opcoes e cardinalidade', () => {
  const campo = criarCampoPreview({
    id: 'pergunta-1',
    tipo: 'multipla_escolha',
    categoriaId: 'cat-1',
    enunciado: 'Quais refeicoes voce fez hoje?',
    peso: 2,
    obrigatoria: true,
    configuracao: { multipla: true },
    opcoes: [
      { rotulo: 'Cafe da manha', valor: 'cafe', ordem: 1 },
      { rotulo: 'Almoco', valor: 'almoco', ordem: 2 }
    ],
    ordem: 1
  });

  assert.equal(campo.tipoEntrada, 'checkbox');
  assert.equal(campo.ajuda, 'Selecione uma ou mais opcoes.');
  assert.deepEqual(
    campo.opcoes.map((opcao) => opcao.rotulo),
    ['Cafe da manha', 'Almoco']
  );
});

test('deve respeitar configuracao especifica de metrica, texto e upload', () => {
  assert.deepEqual(
    criarCampoPreview({
      id: 'peso',
      tipo: 'metrica',
      categoriaId: 'cat-1',
      enunciado: 'Peso atual',
      peso: 1,
      obrigatoria: true,
      configuracao: { unidade: 'kg', minimo: 30, maximo: 200, passo: 0.1 },
      opcoes: [],
      ordem: 1
    }),
    {
      id: 'peso',
      enunciado: 'Peso atual',
      obrigatoria: true,
      tipoEntrada: 'number',
      ajuda: 'Informe um valor entre 30 e 200 kg.',
      opcoes: [],
      atributos: { min: 30, max: 200, step: 0.1, unidade: 'kg' }
    }
  );

  assert.equal(
    criarCampoPreview({
      id: 'texto',
      tipo: 'texto_longo',
      categoriaId: 'cat-1',
      enunciado: 'Observacoes',
      peso: 1,
      obrigatoria: false,
      configuracao: { limiteCaracteres: 500, placeholder: 'Conte em poucas palavras' },
      opcoes: [],
      ordem: 2
    }).atributos.placeholder,
    'Conte em poucas palavras'
  );

  assert.deepEqual(
    criarCampoPreview({
      id: 'upload',
      tipo: 'upload_midia',
      categoriaId: 'cat-1',
      enunciado: 'Foto da refeicao',
      peso: 1,
      obrigatoria: false,
      configuracao: { tiposAceitos: ['image/*'], maxArquivos: 3 },
      opcoes: [],
      ordem: 3
    }).atributos,
    { accept: 'image/*', maxArquivos: 3 }
  );
});
