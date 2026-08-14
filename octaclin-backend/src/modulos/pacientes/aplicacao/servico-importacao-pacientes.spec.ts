import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { LIMITE_LINHAS_IMPORTACAO, ServicoImportacaoPacientes } from './servico-importacao-pacientes';

const usuarioColaborador: UsuarioAutenticado = {
  usuarioId: 'usuario-colaborador-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash-colaborador',
  permissoes: []
};

const usuarioProfissional: UsuarioAutenticado = {
  usuarioId: 'usuario-profissional-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-profissional',
  permissoes: []
};

const criptografiaFake = {
  criptografar: jest.fn((valor: string) => Buffer.from(`criptografado:${valor}`)),
  descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('criptografado:', '')),
  gerarHashesBuscaPii: jest.fn(() => ['hash-busca'])
};

function pacienteExistente(nome: string, dataNascimento?: string): Partial<PacienteOrm> {
  return {
    id: `paciente-${nome}`,
    tenantId: 'tenant-1',
    nomeCriptografado: criptografiaFake.criptografar(nome),
    dataNascimento
  };
}

function montarServico(opcoes: {
  existentes?: Array<Partial<PacienteOrm>>;
  limite?: { permitido: boolean; restante?: number | null; mensagem?: string };
  profissionalVinculadoId?: string;
} = {}) {
  let transacaoImportacaoAtiva = false;
  const salvos: Array<Record<string, unknown>> = [];
  const repositorioPacientes = {
    find: jest.fn(async () => opcoes.existentes ?? []),
    create: jest.fn((dados: Record<string, unknown>) => dados),
    save: jest.fn(async (dados: Record<string, unknown>) => {
      salvos.push(dados);
      return { id: `novo-${salvos.length}`, ...dados };
    })
  };
  const repositorioProfissionais = {
    findOne: jest.fn(async () => ({
      id: opcoes.profissionalVinculadoId ?? 'profissional-1',
      tenantId: 'tenant-1'
    }))
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) =>
      entidade === ProfissionalOrm ? repositorioProfissionais : repositorioPacientes
    )
  };
  const executorTenant = {
    executar: jest.fn(async (_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => {
      transacaoImportacaoAtiva = true;
      try {
        return await operacao(gerenciador);
      } finally {
        transacaoImportacaoAtiva = false;
      }
    })
  };
  const portalCliente = {
    checarLimite: jest.fn(async () => ({
      permitido: opcoes.limite?.permitido ?? true,
      restante: opcoes.limite?.restante ?? null,
      mensagem: opcoes.limite?.mensagem
    }))
  };

  const convites = {
    criarConvite: jest.fn(async () => {
      if (transacaoImportacaoAtiva) throw new Error('Paciente ainda nao confirmado pela transacao de importacao.');
      return { linkAtivacao: 'https://app.octaclin.test/ativar/token-1' };
    })
  };

  return {
    servico: new ServicoImportacaoPacientes(
      executorTenant as never,
      criptografiaFake as never,
      portalCliente as never,
      convites as never
    ),
    repositorioPacientes,
    convites,
    salvos
  };
}

const CSV_BASE = [
  'nome,contato,data de nascimento',
  'Maria Souza,maria@octaclin.test,1990-05-04',
  'Joao Lima,11988887777,12/03/1985'
].join('\n');

describe('ServicoImportacaoPacientes', () => {
  describe('previa', () => {
    it('valida linha a linha sem gravar nada', async () => {
      const { servico, repositorioPacientes } = montarServico();

      const relatorio = await servico.previa('tenant-1', usuarioColaborador, {
        conteudo: CSV_BASE,
        profissionalResponsavelId: 'profissional-1'
      });

      expect(repositorioPacientes.save).not.toHaveBeenCalled();
      expect(relatorio.criados).toBe(0);
      expect(relatorio.validos).toBe(2);
      expect(relatorio.linhas).toEqual([
        expect.objectContaining({ linha: 2, nome: 'Maria Souza', situacao: 'valido' }),
        expect.objectContaining({ linha: 3, nome: 'Joao Lima', dataNascimento: '1985-03-12' })
      ]);
    });

    it('aceita cabecalho alternativo e acentuado da planilha do cliente', async () => {
      const { servico } = montarServico();

      const relatorio = await servico.previa('tenant-1', usuarioColaborador, {
        conteudo: 'Paciente;Telefone;Nascimento\nMaria Souza;11988887777;04/05/1990',
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.linhas[0]).toEqual(
        expect.objectContaining({
          nome: 'Maria Souza',
          contato: '11988887777',
          dataNascimento: '1990-05-04',
          situacao: 'valido'
        })
      );
    });

    it('recusa arquivo sem coluna de nome, em vez de importar 200 linhas vazias', async () => {
      const { servico } = montarServico();

      await expect(
        servico.previa('tenant-1', usuarioColaborador, {
          conteudo: 'contato,nascimento\nmaria@octaclin.test,1990-05-04',
          profissionalResponsavelId: 'profissional-1'
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('validacao de linha', () => {
    it.each([
      ['nome vazio', ',maria@octaclin.test,1990-05-04', 'nome'],
      ['nome curto demais', 'M,maria@octaclin.test,1990-05-04', 'nome'],
      ['data invalida', 'Maria Souza,maria@octaclin.test,31/02/1990', 'nascimento'],
      ['data no futuro', 'Maria Souza,maria@octaclin.test,2999-01-01', 'nascimento'],
      ['contato longo demais', `Maria Souza,${'a'.repeat(81)},1990-05-04`, 'contato']
    ])('reporta %s com o numero da linha e o motivo', async (_caso, linhaCsv, trecho) => {
      const { servico, repositorioPacientes } = montarServico();

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: `nome,contato,data de nascimento\n${linhaCsv}`,
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.invalidos).toBe(1);
      expect(relatorio.criados).toBe(0);
      expect(repositorioPacientes.save).not.toHaveBeenCalled();
      expect(relatorio.linhas[0].linha).toBe(2);
      expect(relatorio.linhas[0].situacao).toBe('invalido');
      expect(relatorio.linhas[0].erros.join(' ').toLowerCase()).toContain(trecho);
    });

    it('nao deixa linha invalida sumir: toda linha do arquivo aparece no relatorio', async () => {
      const { servico } = montarServico();
      const linhas = ['nome,contato,data de nascimento'];
      for (let indice = 0; indice < 200; indice += 1) {
        linhas.push(
          indice % 40 === 7
            ? `,invalido${indice}@octaclin.test,1990-05-04`
            : `Paciente ${indice},paciente${indice}@octaclin.test,1990-05-04`
        );
      }

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: linhas.join('\n'),
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.total).toBe(200);
      expect(relatorio.criados).toBe(195);
      expect(relatorio.invalidos).toBe(5);
      expect(relatorio.linhas).toHaveLength(200);
      expect(relatorio.linhas.filter((linha) => linha.situacao === 'invalido').map((linha) => linha.linha)).toEqual([
        9, 49, 89, 129, 169
      ]);
    });
  });

  describe('duplicidade', () => {
    it('nao recria paciente que ja existe com mesmo nome e nascimento', async () => {
      const { servico, salvos } = montarServico({
        existentes: [pacienteExistente('Maria Souza', '1990-05-04')]
      });

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: CSV_BASE,
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.duplicados).toBe(1);
      expect(relatorio.criados).toBe(1);
      expect(salvos).toHaveLength(1);
      expect(relatorio.linhas[0].situacao).toBe('duplicado');
    });

    it('ignora acento e caixa ao comparar, que e como a planilha chega', async () => {
      const { servico } = montarServico({
        existentes: [pacienteExistente('Maria Souza', '1990-05-04')]
      });

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: 'nome,data de nascimento\n  MARIA   SOUZA ,04/05/1990',
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.duplicados).toBe(1);
      expect(relatorio.criados).toBe(0);
    });

    it('trata duplicata dentro do proprio arquivo', async () => {
      const { servico } = montarServico();

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: 'nome,data de nascimento\nMaria Souza,1990-05-04\nMaria Souza,1990-05-04',
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.criados).toBe(1);
      expect(relatorio.duplicados).toBe(1);
    });

    it('distingue homonimos por data de nascimento', async () => {
      const { servico } = montarServico({
        existentes: [pacienteExistente('Maria Souza', '1990-05-04')]
      });

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: 'nome,data de nascimento\nMaria Souza,1972-01-09',
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.criados).toBe(1);
      expect(relatorio.duplicados).toBe(0);
    });
  });

  describe('escopo', () => {
    it('ignora profissional informado no corpo e usa o vinculo do proprio profissional', async () => {
      const { servico, salvos } = montarServico({ profissionalVinculadoId: 'profissional-dono' });

      await servico.importar('tenant-1', usuarioProfissional, {
        conteudo: CSV_BASE,
        profissionalResponsavelId: 'profissional-de-outra-pessoa'
      });

      expect(salvos.every((paciente) => paciente.profissionalResponsavelId === 'profissional-dono')).toBe(true);
    });

    it('exige profissional responsavel quando quem importa nao e profissional', async () => {
      const { servico } = montarServico();

      await expect(
        servico.importar('tenant-1', usuarioColaborador, { conteudo: CSV_BASE })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('compara duplicidade so dentro da carteira do profissional responsavel', async () => {
      const { servico, repositorioPacientes } = montarServico();

      await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: CSV_BASE,
        profissionalResponsavelId: 'profissional-1'
      });

      expect(repositorioPacientes.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' })
        })
      );
    });
  });

  describe('anexos', () => {
    it('devolve o id do paciente criado e o anexo declarado, para o upload acontecer depois', async () => {
      const { servico } = montarServico();

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: 'nome,anexo\nMaria Souza,hemograma-maria.pdf',
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.linhas[0]).toEqual(
        expect.objectContaining({ pacienteId: 'novo-1', anexo: 'hemograma-maria.pdf', situacao: 'valido' })
      );
    });

    it('nao devolve pacienteId na previa, que nao cria nada', async () => {
      const { servico } = montarServico();

      const relatorio = await servico.previa('tenant-1', usuarioColaborador, {
        conteudo: 'nome,anexo\nMaria Souza,hemograma-maria.pdf',
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.linhas[0].pacienteId).toBeUndefined();
      expect(relatorio.linhas[0].anexo).toBe('hemograma-maria.pdf');
    });

    it('avisa quando a linha recusada declarava anexo, que ficara sem dono', async () => {
      const { servico } = montarServico();

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: 'nome,anexo\n,orfao.pdf',
        profissionalResponsavelId: 'profissional-1'
      });

      expect(relatorio.linhas[0].situacao).toBe('invalido');
      expect(relatorio.linhas[0].avisos.join(' ').toLowerCase()).toContain('anexo');
    });
  });

  describe('convite de portal', () => {
    it('cria convite para cada paciente importado com email, quando pedido', async () => {
      const { servico, convites } = montarServico();

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: 'nome,contato\nMaria Souza,maria@octaclin.test',
        profissionalResponsavelId: 'profissional-1',
        enviarConvite: true
      });

      expect(convites.criarConvite).toHaveBeenCalledWith('tenant-1', usuarioColaborador, 'novo-1', {
        email: 'maria@octaclin.test'
      });
      expect(relatorio.linhas[0].linkConvite).toBe('https://app.octaclin.test/ativar/token-1');
      expect(relatorio.convitesCriados).toBe(1);
    });

    it('nao cria convite quando nao foi pedido', async () => {
      const { servico, convites } = montarServico();

      await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: 'nome,contato\nMaria Souza,maria@octaclin.test',
        profissionalResponsavelId: 'profissional-1'
      });

      expect(convites.criarConvite).not.toHaveBeenCalled();
    });

    it('avisa em vez de falhar quando o contato nao e email', async () => {
      const { servico, convites } = montarServico();

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: 'nome,contato\nJoao Lima,11988887777',
        profissionalResponsavelId: 'profissional-1',
        enviarConvite: true
      });

      expect(convites.criarConvite).not.toHaveBeenCalled();
      expect(relatorio.linhas[0].situacao).toBe('valido');
      expect(relatorio.convitesCriados).toBe(0);
      expect(relatorio.linhas[0].avisos.join(' ').toLowerCase()).toContain('convite');
    });

    it('nao perde o paciente quando o convite falha: importacao segue e o aviso fica na linha', async () => {
      const { servico, convites, salvos } = montarServico();
      convites.criarConvite.mockRejectedValueOnce(new Error('Paciente ja possui acesso ativo.'));

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: 'nome,contato\nMaria Souza,maria@octaclin.test\nJoao Lima,joao@octaclin.test',
        profissionalResponsavelId: 'profissional-1',
        enviarConvite: true
      });

      expect(salvos).toHaveLength(2);
      expect(relatorio.criados).toBe(2);
      expect(relatorio.convitesCriados).toBe(1);
      expect(relatorio.linhas[0].avisos.join(' ')).toContain('Paciente ja possui acesso ativo.');
    });

    it('nao cria convite na previa', async () => {
      const { servico, convites } = montarServico();

      const relatorio = await servico.previa('tenant-1', usuarioColaborador, {
        conteudo: 'nome,contato\nMaria Souza,maria@octaclin.test',
        profissionalResponsavelId: 'profissional-1',
        enviarConvite: true
      });

      expect(convites.criarConvite).not.toHaveBeenCalled();
      expect(relatorio.linhas[0].avisos).toEqual([]);
    });

    it('avisa ja na previa quando o contato nao pode receber convite', async () => {
      const { servico, convites } = montarServico();

      const relatorio = await servico.previa('tenant-1', usuarioColaborador, {
        conteudo: 'nome,contato\nJoao Lima,11988887777',
        profissionalResponsavelId: 'profissional-1',
        enviarConvite: true
      });

      expect(convites.criarConvite).not.toHaveBeenCalled();
      expect(relatorio.linhas[0].avisos.join(' ').toLowerCase()).toContain('convite');
    });
  });

  describe('limite e abuso', () => {
    it('recusa arquivo acima do teto de linhas por importacao', async () => {
      const { servico } = montarServico();
      const linhas = ['nome'];
      for (let indice = 0; indice <= LIMITE_LINHAS_IMPORTACAO; indice += 1) linhas.push(`Paciente ${indice}`);

      await expect(
        servico.previa('tenant-1', usuarioColaborador, {
          conteudo: linhas.join('\n'),
          profissionalResponsavelId: 'profissional-1'
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('bloqueia quando a assinatura nao permite criar paciente', async () => {
      const { servico } = montarServico({ limite: { permitido: false, mensagem: 'Plano suspenso.' } });

      await expect(
        servico.importar('tenant-1', usuarioColaborador, {
          conteudo: CSV_BASE,
          profissionalResponsavelId: 'profissional-1'
        })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('importa ate o restante do plano e reporta o excedente em vez de estourar o limite', async () => {
      const { servico, salvos } = montarServico({ limite: { permitido: true, restante: 1 } });

      const relatorio = await servico.importar('tenant-1', usuarioColaborador, {
        conteudo: CSV_BASE,
        profissionalResponsavelId: 'profissional-1'
      });

      expect(salvos).toHaveLength(1);
      expect(relatorio.criados).toBe(1);
      expect(relatorio.bloqueadosPorPlano).toBe(1);
      expect(relatorio.linhas[1].situacao).toBe('limite_plano');
    });
  });
});
