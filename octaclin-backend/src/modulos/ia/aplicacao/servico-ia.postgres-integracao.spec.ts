import { createHash, randomUUID } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import {
  criarFonteDadosPostgresIntegracao,
  obterUrlPostgresIntegracao,
  prepararSchemaPostgresIntegracao
} from '../../../infraestrutura/testes/postgres-integracao';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { ReconhecimentoAlimentarOrm } from '../infraestrutura/reconhecimento-alimentar.orm';
import { ServicoIa } from './servico-ia';

const urlIntegracao = obterUrlPostgresIntegracao();
const descreverPostgres = urlIntegracao ? describe : describe.skip;

interface CenarioReconhecimento {
  tenantId: string;
  paciente: PacienteOrm;
  profissional: ProfissionalOrm;
  arquivo: ArquivoMidiaOrm;
}

descreverPostgres('ServicoIa com PostgreSQL real', () => {
  let fonteDados: DataSource;
  let servico: ServicoIa;
  let fetchOriginal: typeof fetch;
  let ambienteOriginal: string | undefined;

  beforeAll(async () => {
    fonteDados = criarFonteDadosPostgresIntegracao(urlIntegracao!);
    await fonteDados.initialize();
    await prepararSchemaPostgresIntegracao(fonteDados);
    servico = new ServicoIa(new ExecutorTenant(fonteDados));
    fetchOriginal = global.fetch;
    ambienteOriginal = process.env.ARMAZENAMENTO_UPLOAD_BASE_URL;
    process.env.ARMAZENAMENTO_UPLOAD_BASE_URL = 'http://midia.teste';
  });

  beforeEach(async () => {
    await fonteDados.query(
      'truncate table food_recognition_cache, arquivos_midia, pacientes, profissionais restart identity cascade'
    );
  });

  afterAll(async () => {
    global.fetch = fetchOriginal;
    if (ambienteOriginal === undefined) delete process.env.ARMAZENAMENTO_UPLOAD_BASE_URL;
    else process.env.ARMAZENAMENTO_UPLOAD_BASE_URL = ambienteOriginal;
    await fonteDados.destroy();
  });

  it('serializa duas requisicoes concorrentes e persiste apenas um cache', async () => {
    const cenario = await criarCenarioReconhecimento(fonteDados);
    const primeiraChamada = criarBarreira();
    const liberarPrimeiraResposta = criarBarreira();
    let chamadas = 0;

    global.fetch = jest.fn(async (_url, init) => {
      chamadas += 1;
      const corpo = JSON.parse(String(init?.body ?? '{}')) as { imagem_url: string };
      if (chamadas === 1) {
        primeiraChamada.liberar();
        await liberarPrimeiraResposta.aguardar;
      }
      return criarRespostaReconhecimento(corpo.imagem_url);
    }) as unknown as typeof fetch;

    const usuario = criarSuperAdmin(cenario.tenantId);
    const primeira = servico.reconhecerAlimento(
      cenario.tenantId,
      { pacienteId: cenario.paciente.id, arquivoMidiaId: cenario.arquivo.id },
      usuario
    );
    await primeiraChamada.aguardar;

    const segunda = servico.reconhecerAlimento(
      cenario.tenantId,
      { pacienteId: cenario.paciente.id, arquivoMidiaId: cenario.arquivo.id },
      usuario
    );
    await esperarProximoTick();
    liberarPrimeiraResposta.liberar();

    const [resultadoPrimeiro, resultadoSegundo] = await Promise.all([primeira, segunda]);
    const caches = await fonteDados.getRepository(ReconhecimentoAlimentarOrm).find();

    expect(chamadas).toBe(1);
    expect(resultadoSegundo.id).toBe(resultadoPrimeiro.id);
    expect(caches).toHaveLength(1);
  });

  it('nao reutiliza cache nem conflita na constraint entre pacientes diferentes', async () => {
    const primeiro = await criarCenarioReconhecimento(fonteDados, { chaveObjeto: 'refeicao/unica.jpg' });
    const segundo = await criarCenarioReconhecimento(fonteDados, { chaveObjeto: 'refeicao/unica.jpg' });
    let chamadas = 0;

    global.fetch = jest.fn(async (_url, init) => {
      chamadas += 1;
      const corpo = JSON.parse(String(init?.body ?? '{}')) as { imagem_url: string };
      return criarRespostaReconhecimento(corpo.imagem_url);
    }) as unknown as typeof fetch;

    const usuario = criarSuperAdmin(primeiro.tenantId);
    await servico.reconhecerAlimento(
      primeiro.tenantId,
      { pacienteId: primeiro.paciente.id, arquivoMidiaId: primeiro.arquivo.id },
      usuario
    );
    await servico.reconhecerAlimento(
      segundo.tenantId,
      { pacienteId: segundo.paciente.id, arquivoMidiaId: segundo.arquivo.id },
      usuario
    );

    const caches = await fonteDados.getRepository(ReconhecimentoAlimentarOrm).find({
      order: { pacienteId: 'ASC' }
    });

    expect(chamadas).toBe(2);
    expect(caches).toHaveLength(2);
    expect(caches[0].imagemHash).not.toBe(caches[1].imagemHash);
  });

  it('bloqueia paciente de outro profissional antes de chamar o provedor', async () => {
    const permitido = await criarCenarioReconhecimento(fonteDados);
    const naoPermitido = await criarCenarioReconhecimento(fonteDados, { tenantId: permitido.tenantId });
    global.fetch = jest.fn() as unknown as typeof fetch;

    const profissional = criarProfissionalAutenticado(permitido.tenantId, permitido.profissional.usuarioId);

    await expect(
      servico.reconhecerAlimento(
        permitido.tenantId,
        { pacienteId: naoPermitido.paciente.id, arquivoMidiaId: naoPermitido.arquivo.id },
        profissional
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

async function criarCenarioReconhecimento(
  fonteDados: DataSource,
  opcoes: { tenantId?: string; chaveObjeto?: string } = {}
): Promise<CenarioReconhecimento> {
  const tenantId = opcoes.tenantId ?? randomUUID();
  const profissional = await fonteDados.getRepository(ProfissionalOrm).save({
    id: randomUUID(),
    tenantId,
    usuarioId: randomUUID(),
    nomeCriptografado: Buffer.from('Profissional de teste')
  });
  const paciente = await fonteDados.getRepository(PacienteOrm).save({
    id: randomUUID(),
    tenantId,
    profissionalResponsavelId: profissional.id,
    nomeCriptografado: Buffer.from('Paciente de teste'),
    scoreRisco: '0'
  });
  const arquivo = await fonteDados.getRepository(ArquivoMidiaOrm).save({
    id: randomUUID(),
    tenantId,
    pacienteId: paciente.id,
    tipo: 'imagem',
    bucket: 'midias',
    chaveObjeto: opcoes.chaveObjeto ?? `refeicao/${randomUUID()}.jpg`,
    mimeType: 'image/jpeg',
    tamanhoBytes: '32',
    metadados: {}
  });

  return { tenantId, paciente, profissional, arquivo };
}

function criarSuperAdmin(tenantId: string): UsuarioAutenticado {
  return {
    usuarioId: randomUUID(),
    tenantId,
    papel: 'SuperAdmin',
    emailHash: 'superadmin-teste',
    permissoes: []
  };
}

function criarProfissionalAutenticado(tenantId: string, usuarioId: string): UsuarioAutenticado {
  return {
    usuarioId,
    tenantId,
    papel: 'Professional',
    emailHash: 'profissional-teste',
    permissoes: []
  };
}

function criarRespostaReconhecimento(imagemUrl: string): Pick<Response, 'ok' | 'json'> {
  return {
    ok: true,
    json: async () => ({
      provedor: 'stub-postgres',
      imagem_hash: createHash('sha256').update(imagemUrl).digest('hex'),
      alimentos_detectados: []
    })
  };
}

function criarBarreira(): { aguardar: Promise<void>; liberar: () => void } {
  let liberar!: () => void;
  const aguardar = new Promise<void>((resolver) => {
    liberar = resolver;
  });
  return { aguardar, liberar };
}

function esperarProximoTick(): Promise<void> {
  return new Promise((resolver) => setImmediate(resolver));
}
