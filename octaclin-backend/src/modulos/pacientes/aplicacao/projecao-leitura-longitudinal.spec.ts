import { projetarRespostasQuestionario } from './projecao-leitura-longitudinal';

describe('projetarRespostasQuestionario', () => {
  it('usa enunciado, versão, unidade e rótulo da estrutura histórica, sem pontuação', () => {
    const resultado = projetarRespostasQuestionario({
      versaoQuestionario: 3,
      titulo: 'Acompanhamento',
      perguntas: [
        {
          id: 'pergunta-1', categoriaId: 'categoria-1', tipo: 'multipla_escolha',
          enunciado: 'Como foi a semana?', peso: '5', obrigatoria: false,
          configuracao: {}, ordem: 2,
          opcoes: [{ id: 'opcao-1', valor: 'bem', rotulo: 'Bem', ordem: 1 }]
        },
        {
          id: 'pergunta-2', categoriaId: 'categoria-1', tipo: 'metrica',
          enunciado: 'Horas de sono', peso: '10', obrigatoria: false,
          configuracao: { unidade: 'h' }, ordem: 1, opcoes: []
        }
      ]
    }, [
      { perguntaId: 'pergunta-1', valor: 'bem' },
      { perguntaId: 'pergunta-desconhecida', valor: 'conteúdo legado' }
    ]);

    expect(resultado).toEqual({
      versao: 3,
      titulo: 'Acompanhamento',
      estruturaIndisponivel: false,
      respostas: [
        { perguntaId: 'pergunta-2', enunciado: 'Horas de sono', unidade: 'h', estado: 'nao_informada' },
        { perguntaId: 'pergunta-1', enunciado: 'Como foi a semana?', valor: 'Bem', estado: 'informada' }
      ]
    });
    expect(JSON.stringify(resultado)).not.toContain('peso');
    expect(JSON.stringify(resultado)).not.toContain('conteúdo legado');
  });

  it('não inventa estrutura ou versão atuais quando o snapshot histórico está ausente', () => {
    expect(projetarRespostasQuestionario(undefined, [{ perguntaId: 'p1', valor: 'resposta' }])).toEqual({
      estruturaIndisponivel: true,
      respostas: []
    });
  });

  it('não expõe objetos arbitrários nem referências de upload', () => {
    const resultado = projetarRespostasQuestionario({
      versaoQuestionario: 1,
      titulo: 'Formulário',
      perguntas: [{
        id: 'p1', categoriaId: 'c1', tipo: 'texto_longo', enunciado: 'Resposta', peso: '0',
        obrigatoria: false, configuracao: {}, ordem: 1, opcoes: []
      }]
    }, [{ perguntaId: 'p1', valor: { url: 'https://example.invalid/segredo' } }]);
    expect(resultado.respostas[0]).toMatchObject({ estado: 'nao_informada' });
    expect(JSON.stringify(resultado)).not.toContain('example.invalid');
  });

  it('preserva zero e falso quando foram explicitamente informados', () => {
    const resultado = projetarRespostasQuestionario({
      versaoQuestionario: 1,
      titulo: 'Formulário',
      perguntas: [
        { id: 'p1', categoriaId: 'c1', tipo: 'metrica', enunciado: 'Quantidade', peso: '0', obrigatoria: false, configuracao: {}, ordem: 1, opcoes: [] },
        { id: 'p2', categoriaId: 'c1', tipo: 'sim_nao', enunciado: 'Presente?', peso: '0', obrigatoria: false, configuracao: {}, ordem: 2, opcoes: [] }
      ]
    }, [{ perguntaId: 'p1', valor: 0 }, { perguntaId: 'p2', valor: false }]);

    expect(resultado.respostas).toEqual([
      { perguntaId: 'p1', enunciado: 'Quantidade', estado: 'informada', valor: 0 },
      { perguntaId: 'p2', enunciado: 'Presente?', estado: 'informada', valor: false }
    ]);
  });
});
