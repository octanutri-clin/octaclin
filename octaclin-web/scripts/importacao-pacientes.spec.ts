import assert from 'node:assert/strict';
import test from 'node:test';
import { importarPacientes, type LinhaImportacaoPaciente } from '../lib/cadastros-api';
import { enviarAnexosImportados } from '../lib/importacao-pacientes-anexos';

function arquivo(nome: string, tipo = 'application/pdf'): File {
  return Object.assign(new Blob(['conteudo'], { type: tipo }), {
    name: nome,
    lastModified: 0,
    webkitRelativePath: ''
  }) as File;
}

function linha(parcial: Partial<LinhaImportacaoPaciente>): LinhaImportacaoPaciente {
  return {
    linha: 2,
    situacao: 'valido',
    erros: [],
    avisos: [],
    ...parcial
  };
}

test('importacao envia a escolha de criar convites ao backend', async () => {
  const original = global.fetch;
  let corpo: Record<string, unknown> | undefined;
  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    corpo = JSON.parse(String(init?.body));
    return Response.json({ total: 0, validos: 0, duplicados: 0, invalidos: 0, bloqueadosPorPlano: 0, criados: 0, convitesCriados: 0, linhas: [] });
  }) as typeof global.fetch;

  try {
    await importarPacientes('nome,contato', {
      profissionalResponsavelId: 'profissional-1',
      enviarConvite: true
    });
    assert.equal(corpo?.enviarConvite, true);
  } finally {
    global.fetch = original;
  }
});

test('anexa pelo nome declarado e avisa quando o arquivo nao foi selecionado', async () => {
  const original = global.fetch;
  const chamadas: string[] = [];
  global.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    chamadas.push(url);
    if (url === '/api/mobile/midias/uploads') {
      const corpo = JSON.parse(String(init?.body));
      assert.equal(corpo.pacienteId, 'paciente-1');
      assert.equal(corpo.nomeArquivo, 'Hemograma.PDF');
      return Response.json({
        arquivo: { id: 'arquivo-1' },
        uploadUrl: 'https://storage.octaclin.test/arquivo-1',
        uploadHeaders: { 'Content-Type': 'application/pdf' },
        expiraEmSegundos: 600
      });
    }
    if (url === 'https://storage.octaclin.test/arquivo-1') return new Response(null, { status: 200 });
    if (url === '/api/mobile/midias/uploads/arquivo-1/confirmacao') return Response.json({ id: 'arquivo-1' });
    throw new Error(`URL inesperada: ${url}`);
  }) as typeof global.fetch;

  try {
    const resultado = await enviarAnexosImportados(
      [
        linha({ pacienteId: 'paciente-1', anexo: 'hemograma.pdf' }),
        linha({ linha: 3, pacienteId: 'paciente-2', anexo: 'nao-selecionado.pdf' }),
        linha({ linha: 4, situacao: 'invalido', anexo: 'orfao.pdf', erros: ['Nome ausente.'] })
      ],
      [arquivo('Hemograma.PDF')]
    );

    assert.equal(resultado.confirmados, 1);
    assert.equal(resultado.naoSelecionados, 1);
    assert.equal(resultado.falhas, 0);
    assert.deepEqual(chamadas, [
      '/api/mobile/midias/uploads',
      'https://storage.octaclin.test/arquivo-1',
      '/api/mobile/midias/uploads/arquivo-1/confirmacao'
    ]);
    assert.match(resultado.linhas[1].avisos.join(' '), /nao foi selecionado/i);
  } finally {
    global.fetch = original;
  }
});

test('falha de um anexo nao apaga o paciente nem interrompe os demais', async () => {
  const original = global.fetch;
  let solicitacoes = 0;
  global.fetch = (async (entrada: string | URL | Request) => {
    const url = String(entrada);
    if (url === '/api/mobile/midias/uploads') {
      solicitacoes += 1;
      return Response.json({
        arquivo: { id: `arquivo-${solicitacoes}` },
        uploadUrl: `https://storage.octaclin.test/arquivo-${solicitacoes}`,
        uploadHeaders: {},
        expiraEmSegundos: 600
      });
    }
    if (url.endsWith('arquivo-1')) return new Response(null, { status: 503 });
    if (url.endsWith('arquivo-2')) return new Response(null, { status: 200 });
    if (url.endsWith('arquivo-2/confirmacao')) return Response.json({ id: 'arquivo-2' });
    throw new Error(`URL inesperada: ${url}`);
  }) as typeof global.fetch;

  try {
    const resultado = await enviarAnexosImportados(
      [
        linha({ pacienteId: 'paciente-1', anexo: 'um.pdf' }),
        linha({ linha: 3, pacienteId: 'paciente-2', anexo: 'dois.pdf' })
      ],
      [arquivo('um.pdf'), arquivo('dois.pdf')]
    );

    assert.equal(resultado.confirmados, 1);
    assert.equal(resultado.falhas, 1);
    assert.match(resultado.linhas[0].avisos.join(' '), /armazenamento recusou/i);
    assert.equal(resultado.linhas[1].avisos.length, 0);
  } finally {
    global.fetch = original;
  }
});
