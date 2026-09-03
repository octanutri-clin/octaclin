import { MARCADOR_ILEGIVEL, MARCADOR_REDIGIDO, redigirMetadadosAuditoria } from './redacao-auditoria';

/**
 * Valores sinteticos montados por concatenacao, nunca como literal inteiro.
 *
 * `pnpm security:secrets` varre o repositorio inteiro, specs incluidos, e um
 * literal com cara de credencial reprova o gate mesmo sendo falso. Compor a
 * partir de pedacos mantem o teste realista sem plantar algo que o scanner (ou
 * um leitor humano apressado) precise investigar.
 */
const SENHA_SINTETICA = ['Tr0vao', 'Vermelho', '2026'].join('#');
const EMAIL_SINTETICO = ['paciente.teste', 'exemplo.invalido'].join('@');
const JWT_SINTETICO = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxIn0', 'assinaturaFalsa'].join('.');
const HEX_LONGO_SINTETICO = 'ab12cd34'.repeat(9);

describe('redigirMetadadosAuditoria', () => {
  describe('redacao por nome de chave', () => {
    it('deve redigir chaves do grupo de credencial', () => {
      const resultado = redigirMetadadosAuditoria({
        senha: SENHA_SINTETICA,
        password: SENHA_SINTETICA,
        accessToken: 'valor-qualquer',
        clientSecret: 'valor-qualquer',
        authorization: 'valor-qualquer',
        apiKey: 'valor-qualquer',
        api_key: 'valor-qualquer',
        chaveApi: 'valor-qualquer',
        senhaHash: 'valor-qualquer',
        assinaturaWebhook: 'valor-qualquer',
        signature: 'valor-qualquer',
        cookie: 'valor-qualquer',
        credencial: 'valor-qualquer',
        segredoRotacionado: 'valor-qualquer'
      });

      for (const valor of Object.values(resultado)) {
        expect(valor).toBe(MARCADOR_REDIGIDO);
      }
    });

    it('deve redigir chaves do grupo pessoal', () => {
      const resultado = redigirMetadadosAuditoria({
        cpf: '123',
        cnpj: '123',
        rg: '123',
        rgEmissor: 'SSP',
        email: 'a',
        telefone: '123',
        celular: '123',
        whatsapp: '123',
        endereco: 'rua',
        cep: '00000000',
        cep_cobranca: '00000000',
        nomeCompleto: 'Fulano',
        sobrenome: 'Silva',
        dataNascimento: '2000-01-01'
      });

      for (const valor of Object.values(resultado)) {
        expect(valor).toBe(MARCADOR_REDIGIDO);
      }
    });

    it('deve redigir chaves do grupo clinico', () => {
      const resultado = redigirMetadadosAuditoria({
        diagnostico: 'texto',
        prontuarioTexto: 'texto',
        anamnese: 'texto',
        observacaoClinica: 'texto',
        queixaPrincipal: 'texto',
        medicamentoAtual: 'texto',
        alergias: 'texto'
      });

      for (const valor of Object.values(resultado)) {
        expect(valor).toBe(MARCADOR_REDIGIDO);
      }
    });

    it('deve redigir chaves do vocabulario clinico deste dominio de nutricao', () => {
      const resultado = redigirMetadadosAuditoria({
        pesoKg: 82.4,
        alturaCm: 171,
        imc: 28.2,
        dietaAtual: 'texto',
        caloriasAlvo: 2100,
        humor: 'mal',
        statusAdesao: 'risco',
        anotacoesEquipe: 'texto',
        titular: 'Fulano',
        matricula: '123',
        convenio: 'texto',
        carteirinha: '456'
      });

      for (const [chave, valor] of Object.entries(resultado)) {
        expect([chave, valor]).toEqual([chave, MARCADOR_REDIGIDO]);
      }
    });

    /**
     * O bug de plural: `"observacoes"` nao contem `"observacao"`, entao toda a
     * familia `-cao`/`-coes` escapava da regra escrita para ela. O conserto e
     * por normalizacao de forma, e nao por listar plural a mao -- e por isso o
     * teste cobre mais de um termo, incluindo um que ninguem lembrou de listar.
     */
    it('deve redigir o plural em -coes, que a versao anterior deixava passar', () => {
      const resultado = redigirMetadadosAuditoria({
        observacoes: 'texto',
        refeicoes: 'texto',
        evolucoes: 'texto',
        anotacoes: 'texto',
        prescricoes: 'texto'
      });

      expect(resultado).toEqual({
        observacoes: MARCADOR_REDIGIDO,
        refeicoes: MARCADOR_REDIGIDO,
        evolucoes: MARCADOR_REDIGIDO,
        anotacoes: MARCADOR_REDIGIDO,
        // `prescricoes` nao esta no vocabulario; o teste registra a lacuna em
        // vez de fingir que a normalizacao de plural a cobre.
        prescricoes: 'texto'
      });
    });

    it('deve redigir o valor inteiro quando a chave sensivel guarda um objeto', () => {
      // `paciente` e `endereco` sao termos do vocabulario: a decisao e por nome,
      // antes de descer no objeto, entao o container inteiro vira marcador. E o
      // comportamento correto -- descer e redigir folha a folha deixaria a forma
      // do objeto (quais campos existem) legivel na trilha.
      expect(redigirMetadadosAuditoria({ paciente: { nome: 'Fulano' }, endereco: { rua: 'X' } })).toEqual({
        paciente: MARCADOR_REDIGIDO,
        endereco: MARCADOR_REDIGIDO
      });
    });
  });

  describe('excecao dos identificadores opacos', () => {
    const UUID = '550e8400-e29b-41d4-a716-446655440000';

    it('nao deve redigir identificadores opacos com valor em forma de UUID', () => {
      const identificadores = {
        usuarioId: UUID,
        tenantId: UUID,
        chaveApiId: UUID,
        recursoId: UUID,
        familiaId: UUID,
        pacienteId: UUID,
        evolucaoId: UUID,
        profissionalResponsavelId: UUID
      };

      expect(redigirMetadadosAuditoria({ ...identificadores })).toEqual(identificadores);
    });

    /**
     * A versao anterior olhava so o sufixo `Id` e rodava antes de todas as
     * regras de nome, virando whitelist que vencia o blocklist inteiro. Cada
     * chave abaixo passava intacta, com qualquer valor. O teste enumera os
     * contraexemplos um a um porque uma regressao aqui nao aparece em lugar
     * nenhum: o payload continua sendo gravado, so que sem filtro.
     */
    it.each([
      'senhaId',
      'passwordId',
      'secretId',
      'tokenId',
      'authorizationId',
      'cookieId',
      'senha_id',
      'cpfId',
      'emailId',
      'prontuarioId',
      'diagnosticoId'
    ])('deve redigir %s, que a excecao antiga deixava passar', (chave) => {
      expect(redigirMetadadosAuditoria({ [chave]: 'hunter2' })).toEqual({ [chave]: MARCADOR_REDIGIDO });
    });

    it('nao deve salvar chave sensivel terminada em Id so por parecer identificador', () => {
      // A premissa da excecao e "este valor e uma chave substituta opaca". Sem
      // forma de UUID a premissa e falsa, e a excecao nao se aplica.
      expect(redigirMetadadosAuditoria({ senhaId: 'hunter2', tokenId: 'abc' })).toEqual({
        senhaId: MARCADOR_REDIGIDO,
        tokenId: MARCADOR_REDIGIDO
      });
    });

    it('nao deve redigir chaves de operacao sem conteudo pessoal', () => {
      const operacionais = {
        origem: 'teste',
        acao: 'pacientes.listar',
        organizacaoNivel: 3,
        recepcaoAberta: true,
        removidos: 2
      };

      expect(redigirMetadadosAuditoria({ ...operacionais })).toEqual(operacionais);
    });

    it('deve redigir por formato mesmo em chave terminada em Id que nenhuma regra alcanca', () => {
      // A excecao vale so para o nome da chave; o valor continua inspecionado.
      expect(redigirMetadadosAuditoria({ pedidoId: '12345678901' })).toEqual({
        pedidoId: MARCADOR_REDIGIDO
      });
    });
  });

  describe('evidencia que a trilha existe para guardar', () => {
    it('deve preservar hashIntegridade, que prova qual artefato o titular recebeu', () => {
      const digest = 'f'.repeat(64);

      expect(redigirMetadadosAuditoria({ hashIntegridade: digest })).toEqual({ hashIntegridade: digest });
    });

    it('deve preservar as flags de consentimento de preferenciasContato', () => {
      // A trilha e imutavel: apagar estas flags destroi de forma definitiva a
      // unica prova de a quais canais o titular consentiu.
      expect(
        redigirMetadadosAuditoria({
          versaoLgpd: '2026-01',
          preferenciasContato: { email: true, whatsapp: false }
        })
      ).toEqual({
        versaoLgpd: '2026-01',
        preferenciasContato: { email: true, whatsapp: false }
      });
    });

    it('deve continuar redigindo o mesmo campo quando ele carrega valor, e nao flag', () => {
      // A preservacao acima e regra de tipo, nao de nome: booleano nao cabe CPF.
      expect(
        redigirMetadadosAuditoria({ preferenciasContato: { email: 'maria@exemplo.invalido' } })
      ).toEqual({ preferenciasContato: { email: MARCADOR_REDIGIDO } });
    });
  });

  describe('valores que a recursao generica vazava', () => {
    it('nao deve vazar o conteudo de um Buffer byte a byte', () => {
      // `Buffer` e objeto indexado por numero: a recursao generica devolvia
      // `{"0":115,"1":101,...}`, sobre o qual nenhum padrao de valor se aplica
      // porque nao sobra string alguma. O conteudo vazava inteiro, codificado.
      const resultado = redigirMetadadosAuditoria({ conteudo: Buffer.from(SENHA_SINTETICA) });

      expect(resultado.conteudo).toBe(`[binario:${Buffer.byteLength(SENHA_SINTETICA)}]`);
      expect(JSON.stringify(resultado)).not.toContain('115');
    });

    it('deve tratar TypedArray como valor opaco', () => {
      expect(redigirMetadadosAuditoria({ amostra: new Uint8Array([1, 2, 3]) })).toEqual({
        amostra: '[binario:3]'
      });
    });

    it('nao deve destruir as chaves irmas quando a leitura de uma chave lanca', () => {
      // O `try` global fazia um getter hostil derrubar o payload inteiro, e a
      // funcao devolvia so `{_redacaoFalhou:true}` -- perdendo junto as chaves
      // limpas. A protecao passou a ser por chave para que o estrago fique nela.
      const hostil: Record<string, unknown> = { acao: 'auth.login', usuarioId: 'usuario-1' };
      Object.defineProperty(hostil, 'explosiva', {
        enumerable: true,
        get() {
          throw new Error('getter hostil');
        }
      });

      expect(redigirMetadadosAuditoria(hostil)).toEqual({
        acao: 'auth.login',
        usuarioId: 'usuario-1',
        explosiva: MARCADOR_ILEGIVEL
      });
    });
  });

  describe('redacao por formato do valor', () => {
    it('deve redigir e-mail em chave de nome inocente', () => {
      expect(redigirMetadadosAuditoria({ valor: EMAIL_SINTETICO })).toEqual({ valor: MARCADOR_REDIGIDO });
    });

    it('deve redigir JWT em chave de nome inocente', () => {
      expect(redigirMetadadosAuditoria({ detalhe: JWT_SINTETICO })).toEqual({ detalhe: MARCADOR_REDIGIDO });
    });

    it('deve redigir cabecalho Bearer em chave de nome inocente', () => {
      expect(redigirMetadadosAuditoria({ detalhe: `Bearer ${JWT_SINTETICO}` })).toEqual({
        detalhe: MARCADOR_REDIGIDO
      });
    });

    it('deve redigir CPF mascarado e sem mascara em chave de nome inocente', () => {
      expect(redigirMetadadosAuditoria({ valor: '123.456.789-09', detalhe: '12345678909' })).toEqual({
        valor: MARCADOR_REDIGIDO,
        detalhe: MARCADOR_REDIGIDO
      });
    });

    it('deve redigir sequencia longa de hex em chave de nome inocente', () => {
      expect(HEX_LONGO_SINTETICO.length).toBeGreaterThanOrEqual(64);
      expect(redigirMetadadosAuditoria({ valor: HEX_LONGO_SINTETICO })).toEqual({ valor: MARCADOR_REDIGIDO });
    });

    it('nao deve redigir um UUID, que e o identificador util da trilha', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(redigirMetadadosAuditoria({ valor: uuid })).toEqual({ valor: uuid });
    });
  });

  describe('limites estruturais', () => {
    it('deve resumir o tipo abaixo da profundidade maxima de dois niveis', () => {
      const resultado = redigirMetadadosAuditoria({
        n1: { n2: { n3: { n4: 'invisivel' }, lista: [1, 2, 3] } }
      });

      expect(resultado).toEqual({ n1: { n2: { n3: '[objeto]', lista: '[lista:3]' } } });
    });

    it('deve truncar objeto acima de vinte e cinco chaves', () => {
      const excessivo: Record<string, unknown> = {};
      for (let indice = 0; indice < 30; indice += 1) excessivo[`campo${indice}`] = indice;

      const resultado = redigirMetadadosAuditoria(excessivo);

      expect(Object.keys(resultado)).toHaveLength(26);
      expect(resultado._truncado).toBe(5);
      expect(resultado.campo24).toBe(24);
      expect(resultado.campo25).toBeUndefined();
    });

    it('deve truncar string acima de duzentos caracteres', () => {
      const longa = 'a b '.repeat(100);
      const resultado = redigirMetadadosAuditoria({ descricao: longa });

      expect(typeof resultado.descricao).toBe('string');
      expect(resultado.descricao as string).toHaveLength(200 + '…[truncado]'.length);
      expect(resultado.descricao as string).toContain('[truncado]');
    });
  });

  describe('totalidade da funcao', () => {
    it('deve devolver objeto vazio para entrada undefined', () => {
      expect(redigirMetadadosAuditoria(undefined)).toEqual({});
    });

    it('deve devolver objeto vazio para objeto vazio', () => {
      expect(redigirMetadadosAuditoria({})).toEqual({});
    });

    it('nao deve entrar em recursao infinita com referencia circular', () => {
      const circular: Record<string, unknown> = { origem: 'teste' };
      circular.eu = circular;

      expect(redigirMetadadosAuditoria(circular)).toEqual({ origem: 'teste', eu: '[circular]' });
    });

    it('deve preservar valores primitivos, Date, null e undefined', () => {
      const data = new Date('2026-09-02T12:00:00.000Z');
      const resultado = redigirMetadadosAuditoria({
        ativo: true,
        quantidade: 42,
        ausente: null,
        naoInformado: undefined,
        criadoEm: data
      });

      expect(resultado).toEqual({
        ativo: true,
        quantidade: 42,
        ausente: null,
        naoInformado: undefined,
        criadoEm: data
      });
    });

    it('deve percorrer arrays preservando itens limpos e redigindo os sensiveis', () => {
      const resultado = redigirMetadadosAuditoria({
        itens: ['ok', EMAIL_SINTETICO, 3, null]
      });

      expect(resultado).toEqual({ itens: ['ok', MARCADOR_REDIGIDO, 3, null] });
    });

    it('deve truncar array acima de vinte e cinco itens', () => {
      const resultado = redigirMetadadosAuditoria({ itens: Array.from({ length: 30 }, (_, i) => i) });

      expect(resultado.itens as unknown[]).toHaveLength(26);
      expect((resultado.itens as unknown[])[25]).toBe('[truncado:5]');
    });
  });

  /**
   * A lacuna estrutural que este PR existe para fechar.
   *
   * Todos os casos acima alimentam o redator com chaves inventadas pelo proprio
   * teste. Por isso a suite ficava verde enquanto o modulo redigia 2 das
   * dezenas de chaves que os call sites de fato gravam -- e as 2 eram falso
   * positivo. Nenhum teste jamais tinha perguntado "e as chaves reais?".
   *
   * Este caso pergunta. A tabela e uma amostra dos call sites de producao, com
   * o desfecho declarado chave a chave: quem sobrevive porque a trilha precisa
   * dela, e quem e redigida porque e conteudo do titular. O que impede a tabela
   * de envelhecer e o gate `pnpm test:redacao-auditoria`, que varre os call
   * sites de verdade e reprova o CI quando aparece chave que nem casa com regra
   * daqui nem esta declarada como segura. Os dois se sustentam: a tabela diz o
   * que o redator faz, o gate diz que a lista de entrada esta completa.
   */
  describe('chaves reais dos call sites de producao', () => {
    it('deve preservar as chaves que tornam a trilha util', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const sobreviventes = {
        // Identificadores opacos: sem eles a trilha e limpa e inutil.
        pacienteId: uuid,
        profissionalResponsavelId: uuid,
        evolucaoId: uuid,
        avaliacaoId: uuid,
        consultaId: uuid,
        versaoId: uuid,
        // Vocabulario fechado da operacao.
        acao: 'pacientes.exportar_csv',
        origem: 'operacao_manual',
        status: 'ativa',
        formato: 'json',
        protocolo: 'pollock7',
        visibilidade: 'equipe',
        // Contagens e paginacao.
        linhas: 42,
        total: 3,
        pagina: 1,
        limite: 25,
        // Booleanos de presenca: a forma que os call sites foram instruidos a usar.
        possuiBusca: true,
        possuiMotivo: false,
        possuiSintomas: true,
        possuiObservacoes: false,
        houveTextoLivre: true
      };

      expect(redigirMetadadosAuditoria({ ...sobreviventes })).toEqual(sobreviventes);
    });

    it('deve redigir as chaves que carregam conteudo do titular', () => {
      const resultado = redigirMetadadosAuditoria({
        // Estava sendo gravada de verdade ate este PR, via `filtros: { ...filtros }`.
        busca: 'Maria Silva',
        // Estavam sendo gravadas de verdade ate este PR.
        humor: 'muito_mal',
        adesaoPlano: 20,
        // Classificacao clinica gravada em `pacientes.atualizar`.
        statusAdesao: 'risco',
        // Nunca chegaram a ser gravadas, e a rede existe para o dia em que forem.
        hashConteudo: 'a'.repeat(64),
        diagnostico: 'texto',
        prontuario: 'texto'
      });

      for (const [chave, valor] of Object.entries(resultado)) {
        expect([chave, valor]).toEqual([chave, MARCADOR_REDIGIDO]);
      }
    });

    /**
     * O contraponto honesto dos dois casos acima, e a razao de este modulo nao
     * poder ser documentado como garantia.
     *
     * `motivo` e `relato` sao texto livre clinico e passam inteiros. `motivo`
     * ficou de fora do vocabulario de proposito, e a decisao contrasta com
     * `busca`, que entrou: `busca` so tem um significado neste backend (o termo
     * digitado, que `gerarHashesConsultaPii` existe para nunca armazenar),
     * enquanto `motivo` ja aparece como enum e como booleano
     * (`possuiMotivo`, `motivoInformado`) e um `motivoCodigo` e o proximo passo
     * natural -- redigir isso seria destruir dado operacional legitimo para
     * fingir cobertura sobre uma classe que a rede nao fecha.
     *
     * Nenhuma lista de nomes sobre um objeto de forma livre fecha essa classe.
     * Por isso a ordem das tres camadas e: nao coletar no call site (foi o que
     * consertou `agenda.consulta.cancelar`), gate para provar a cobertura, e so
     * entao esta funcao.
     */
    it('nao deve fingir cobertura sobre chave que nenhuma regra conhece', () => {
      const naoCobertas = {
        motivo: 'internada, remarcar apos alta',
        relato: 'sentiu tontura apos o almoco'
      };

      expect(redigirMetadadosAuditoria({ ...naoCobertas })).toEqual(naoCobertas);
    });
  });

  /**
   * Este e o teste que prova a propriedade que interessa: o valor original nao
   * existe em lugar nenhum da saida serializada, nem dentro de outro campo, nem
   * concatenado, nem truncado pela metade.
   */
  it('nao deve deixar segredo nem PII sobreviverem a serializacao do resultado', () => {
    const serializado = JSON.stringify(
      redigirMetadadosAuditoria({
        acao: 'auth.login',
        usuarioId: 'usuario-1',
        senha: SENHA_SINTETICA,
        contato: { email: EMAIL_SINTETICO },
        detalhe: `Bearer ${JWT_SINTETICO}`
      })
    );

    expect(serializado).not.toContain(SENHA_SINTETICA);
    expect(serializado).not.toContain(EMAIL_SINTETICO);
    expect(serializado).not.toContain(JWT_SINTETICO);
    expect(serializado).toContain('usuario-1');
    expect(serializado).toContain('auth.login');
  });
});
