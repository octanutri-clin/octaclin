'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, CloudUpload, HeartHandshake, RefreshCcw, Save, Smartphone, UploadCloud } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import {
  AcompanhanteApi,
  ArquivoMidiaApi,
  LogDiarioRapidoApi,
  RespostaSincronizacaoMobile,
  TipoDiarioRapido,
  TipoMidiaMobile,
  carregarBootstrapMobile,
  confirmarUploadMidia,
  criarAcompanhante,
  registrarDiarioRapido,
  sincronizarLoteMobile,
  solicitarUploadMidia
} from '@/lib/mobile-api';
import { PacienteResumo, RespostaPaginada } from '@/lib/cadastros-api';

interface FormularioDiario {
  pacienteId: string;
  tipo: TipoDiarioRapido;
  valor: string;
}

interface FormularioUpload {
  pacienteId: string;
  duracaoSegundos: string;
}

interface FormularioAcompanhante {
  pacienteId: string;
  nome: string;
  contato: string;
  pin: string;
}

interface FormularioSincronizacao {
  pacienteId: string;
  idLocal: string;
  tipo: 'diario_rapido' | 'midia_captura' | 'midia_audio' | 'acompanhante';
}

const diarioInicial: FormularioDiario = {
  pacienteId: '',
  tipo: 'humor',
  valor: 'Paciente relatou boa adesao no almoco.'
};

const uploadInicial: FormularioUpload = {
  pacienteId: '',
  duracaoSegundos: ''
};

const acompanhanteInicial: FormularioAcompanhante = {
  pacienteId: '',
  nome: 'Acompanhante Demo',
  contato: '+55 11 98888-0000',
  pin: '1234'
};

const sincronizacaoInicial: FormularioSincronizacao = {
  pacienteId: '',
  idLocal: '',
  tipo: 'diario_rapido'
};

function montarValorDiario(formulario: FormularioDiario) {
  if (formulario.tipo === 'agua') return { copos: Number(formulario.valor || 0) || 1 };
  if (formulario.tipo === 'atividade') return { descricao: formulario.valor, minutos: 30 };
  if (formulario.tipo === 'refeicao') return { descricao: formulario.valor };
  return { humor: formulario.valor, escala: 4 };
}

function resumirJson(valor: unknown) {
  return JSON.stringify(valor);
}

function tipoDoArquivo(arquivo: File): TipoMidiaMobile {
  if (arquivo.type.startsWith('image/')) return 'imagem';
  if (arquivo.type.startsWith('audio/')) return 'audio';
  if (arquivo.type.startsWith('video/')) return 'video';
  return 'documento';
}

export function PainelMobile() {
  const [pacientes, setPacientes] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [diario, setDiario] = useState<FormularioDiario>(diarioInicial);
  const [upload, setUpload] = useState<FormularioUpload>(uploadInicial);
  const [acompanhante, setAcompanhante] = useState<FormularioAcompanhante>(acompanhanteInicial);
  const [sincronizacao, setSincronizacao] = useState<FormularioSincronizacao>(sincronizacaoInicial);
  const [logsDiario, setLogsDiario] = useState<LogDiarioRapidoApi[]>([]);
  const [arquivosMidia, setArquivosMidia] = useState<ArquivoMidiaApi[]>([]);
  const [acompanhantes, setAcompanhantes] = useState<AcompanhanteApi[]>([]);
  const [arquivoUpload, setArquivoUpload] = useState<File | null>(null);
  const [resultadoSincronizacao, setResultadoSincronizacao] = useState<RespostaSincronizacaoMobile | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const bootstrap = await carregarBootstrapMobile();
      const pacienteId = bootstrap.pacientes.itens[0]?.id ?? '';
      setPacientes(bootstrap.pacientes);
      setLogsDiario(bootstrap.diarios);
      setArquivosMidia(bootstrap.arquivos);
      setAcompanhantes(bootstrap.acompanhantes);
      setDiario((atual) => ({ ...atual, pacienteId: atual.pacienteId || pacienteId }));
      setUpload((atual) => ({ ...atual, pacienteId: atual.pacienteId || pacienteId }));
      setAcompanhante((atual) => ({ ...atual, pacienteId: atual.pacienteId || pacienteId }));
      setSincronizacao((atual) => ({
        ...atual,
        pacienteId: atual.pacienteId || pacienteId,
        idLocal: atual.idLocal || `local-${Date.now()}`
      }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar mobile.');
    } finally {
      setCarregando(false);
    }
  }

  async function salvarDiario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const log = await registrarDiarioRapido({
        pacienteId: diario.pacienteId,
        tipo: diario.tipo,
        valor: montarValorDiario(diario)
      });
      setLogsDiario((atuais) => [log, ...atuais].slice(0, 6));
      setSucesso('Diario rapido registrado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar diario.');
    } finally {
      setSalvando(false);
    }
  }

  async function solicitarUpload(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      if (!arquivoUpload) throw new Error('Selecione um arquivo.');
      const resposta = await solicitarUploadMidia({
        pacienteId: upload.pacienteId,
        tipo: tipoDoArquivo(arquivoUpload),
        categoria: 'diario',
        nomeArquivo: arquivoUpload.name,
        mimeType: arquivoUpload.type,
        tamanhoBytes: arquivoUpload.size,
        duracaoSegundos: upload.duracaoSegundos ? Number(upload.duracaoSegundos) : undefined
      });
      const envio = await fetch(resposta.uploadUrl, { method: 'PUT', headers: resposta.uploadHeaders, body: arquivoUpload });
      if (!envio.ok) throw new Error('O armazenamento recusou o arquivo.');
      const confirmado = await confirmarUploadMidia(resposta.arquivo.id);
      setArquivosMidia((atuais) => [confirmado, ...atuais].slice(0, 50));
      setArquivoUpload(null);
      evento.currentTarget.reset();
      setSucesso('Midia enviada e confirmada.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao solicitar upload.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarAcompanhante(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarAcompanhante({
        pacienteId: acompanhante.pacienteId,
        nome: acompanhante.nome,
        contato: acompanhante.contato || undefined,
        pin: acompanhante.pin
      });
      setAcompanhantes((atuais) => [criado, ...atuais].slice(0, 50));
      setSucesso('Acompanhante criado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar acompanhante.');
    } finally {
      setSalvando(false);
    }
  }

  async function sincronizar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resposta = await sincronizarLoteMobile({
        itens: [
          {
            idLocal: sincronizacao.idLocal,
            tipo: sincronizacao.tipo,
            payload:
              sincronizacao.tipo === 'acompanhante'
                ? { pacienteId: sincronizacao.pacienteId, nome: 'Sync Acompanhante', pin: '1234' }
                : { pacienteId: sincronizacao.pacienteId, tipo: 'humor', valor: { humor: 'sincronizado' } }
          }
        ]
      });
      setResultadoSincronizacao(resposta);
      setSincronizacao((atual) => ({ ...atual, idLocal: `local-${Date.now()}` }));
      setSucesso('Lote sincronizado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao sincronizar lote.');
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const opcoesPacientes = pacientes?.itens ?? [];

  return (
    <section className="grid gap-4">
      <Cartao>
        <CartaoConteudo className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Operacoes mobile</h2>
            <p className="mt-1 text-sm text-texto-suave">
              {opcoesPacientes.length} pacientes, {logsDiario.length} diarios, {arquivosMidia.length} midias, {acompanhantes.length} acompanhantes
            </p>
          </div>
          <Botao onClick={carregar} disabled={carregando}>
            <RefreshCcw size={16} />
            {carregando ? 'Atualizando' : 'Atualizar'}
          </Botao>
        </CartaoConteudo>
      </Cartao>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      <BarraCarregamento visivel={carregando} />
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
          <CheckCircle2 size={16} />
          {sucesso}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Cartao>
        <form onSubmit={salvarDiario}>
          <CartaoCabecalho>
            <CartaoTitulo icone={<Smartphone size={18} className="text-primaria" />}>Diario rapido</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-diario-paciente">Paciente</Rotulo>
              <Selecao
                id="mobile-diario-paciente"
                value={diario.pacienteId}
                onChange={(evento) => setDiario((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {opcoesPacientes.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-diario-tipo">Tipo</Rotulo>
              <Selecao
                id="mobile-diario-tipo"
                value={diario.tipo}
                onChange={(evento) => setDiario((atual) => ({ ...atual, tipo: evento.target.value as TipoDiarioRapido }))}
              >
                <option value="humor">Humor</option>
                <option value="refeicao">Refeição</option>
                <option value="agua">Agua</option>
                <option value="atividade">Atividade</option>
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-diario-valor">Valor</Rotulo>
              <AreaTexto
                id="mobile-diario-valor"
                value={diario.valor}
                onChange={(evento) => setDiario((atual) => ({ ...atual, valor: evento.target.value }))}
                required
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !diario.pacienteId}>
              <Save size={16} />
              Registrar
            </Botao>
          </div>
          </CartaoConteudo>
        </form>
        </Cartao>

        <Cartao>
        <form onSubmit={solicitarUpload}>
          <CartaoCabecalho>
            <CartaoTitulo icone={<UploadCloud size={18} className="text-primaria" />}>Upload de midia</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="mobile-upload-paciente">Paciente</Rotulo>
              <Selecao
                id="mobile-upload-paciente"
                value={upload.pacienteId}
                onChange={(evento) => setUpload((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {opcoesPacientes.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="mobile-upload-arquivo">Arquivo</Rotulo>
              <Campo
                id="mobile-upload-arquivo"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/ogg,audio/wav,video/mp4,video/webm"
                onChange={(evento) => setArquivoUpload(evento.target.files?.[0] ?? null)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-upload-duracao">Duracao</Rotulo>
              <Campo
                id="mobile-upload-duracao"
                type="number"
                min={1}
                max={600}
                value={upload.duracaoSegundos}
                onChange={(evento) => setUpload((atual) => ({ ...atual, duracaoSegundos: evento.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !upload.pacienteId || !arquivoUpload}>
              <CloudUpload size={16} />
              Solicitar
            </Botao>
          </div>
          </CartaoConteudo>
        </form>
        </Cartao>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Cartao>
        <form onSubmit={salvarAcompanhante}>
          <CartaoCabecalho>
            <CartaoTitulo icone={<HeartHandshake size={18} className="text-primaria" />}>Acompanhante</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="mobile-acompanhante-paciente">Paciente</Rotulo>
              <Selecao
                id="mobile-acompanhante-paciente"
                value={acompanhante.pacienteId}
                onChange={(evento) => setAcompanhante((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {opcoesPacientes.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-acompanhante-nome">Nome</Rotulo>
              <Campo
                id="mobile-acompanhante-nome"
                value={acompanhante.nome}
                onChange={(evento) => setAcompanhante((atual) => ({ ...atual, nome: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-acompanhante-contato">Contato</Rotulo>
              <Campo
                id="mobile-acompanhante-contato"
                value={acompanhante.contato}
                onChange={(evento) => setAcompanhante((atual) => ({ ...atual, contato: evento.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-acompanhante-pin">PIN</Rotulo>
              <Campo
                id="mobile-acompanhante-pin"
                value={acompanhante.pin}
                onChange={(evento) => setAcompanhante((atual) => ({ ...atual, pin: evento.target.value }))}
                required
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !acompanhante.pacienteId}>
              <Save size={16} />
              Criar
            </Botao>
          </div>
          </CartaoConteudo>
        </form>
        </Cartao>

        <Cartao>
        <form onSubmit={sincronizar}>
          <CartaoCabecalho>
            <CartaoTitulo icone={<RefreshCcw size={18} className="text-primaria" />}>Sincronizacao em lote</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-sync-paciente">Paciente</Rotulo>
              <Selecao
                id="mobile-sync-paciente"
                value={sincronizacao.pacienteId}
                onChange={(evento) => setSincronizacao((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {opcoesPacientes.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-sync-id">ID local</Rotulo>
              <Campo
                id="mobile-sync-id"
                value={sincronizacao.idLocal}
                onChange={(evento) => setSincronizacao((atual) => ({ ...atual, idLocal: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="mobile-sync-tipo">Tipo</Rotulo>
              <Selecao
                id="mobile-sync-tipo"
                value={sincronizacao.tipo}
                onChange={(evento) =>
                  setSincronizacao((atual) => ({ ...atual, tipo: evento.target.value as FormularioSincronizacao['tipo'] }))
                }
              >
                <option value="diario_rapido">Diario rapido</option>
                <option value="midia_captura">Midia captura</option>
                <option value="midia_audio">Midia audio</option>
                <option value="acompanhante">Acompanhante</option>
              </Selecao>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !sincronizacao.pacienteId}>
              <RefreshCcw size={16} />
              Sincronizar
            </Botao>
          </div>
          </CartaoConteudo>
        </form>
        </Cartao>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Diarios recentes</CartaoTitulo>
          </CartaoCabecalho>
          <div className="max-h-[320px] divide-y divide-linha overflow-auto">
            {logsDiario.length ? (
              logsDiario.map((log) => (
                <div key={log.id} className="grid gap-1 px-4 py-3 text-sm">
                  <strong>{log.tipo}</strong>
                  <p className="break-all text-xs text-texto-suave">{resumirJson(log.valor)}</p>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhum diario persistido." />
            )}
          </div>
        </Cartao>

        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Resultados</CartaoTitulo>
          </CartaoCabecalho>
          <div className="grid gap-3 p-4 text-sm">
            <div className="rounded-md border border-linha bg-fundo p-3">
              <p className="text-xs font-semibold uppercase text-texto-suave">Midias</p>
              <p className="mt-1 break-all text-xs text-tinta">
                {arquivosMidia.map((arquivo) => `${arquivo.tipo}:${arquivo.id}`).join(', ') || 'Nenhuma midia persistida.'}
              </p>
            </div>
            <div className="rounded-md border border-linha bg-fundo p-3">
              <p className="text-xs font-semibold uppercase text-texto-suave">Acompanhantes</p>
              <p className="mt-1 break-all text-xs text-tinta">
                {acompanhantes.map((item) => `${item.pacienteId}:${item.ativo ? 'ativo' : 'inativo'}`).join(', ') || 'Nenhum acompanhante persistido.'}
              </p>
            </div>
            <div className="rounded-md border border-linha bg-fundo p-3">
              <p className="text-xs font-semibold uppercase text-texto-suave">Sincronizacao</p>
              <p className="mt-1 break-all text-xs text-tinta">
                {resultadoSincronizacao ? resumirJson(resultadoSincronizacao.resultados) : 'Nenhum lote sincronizado.'}
              </p>
            </div>
          </div>
        </Cartao>
      </section>
    </section>
  );
}
