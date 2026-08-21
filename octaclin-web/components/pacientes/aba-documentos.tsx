'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { BarraCarregamento } from '@/components/ui/feedback';
import { formatarValorBRL, listarConsultasAgenda } from '@/lib/agenda-api';
import { useRequisicaoCancelavel } from '@/lib/hooks';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  DocumentoClinicoApi,
  TipoDocumentoClinicoApi,
  cancelarDocumentoClinico,
  emitirDocumentoClinico,
  enviarDocumentoClinicoPorEmail,
  listarDocumentosClinicos
} from '@/lib/prontuario-api';

export interface ConsultaConcluidaOpcao {
  id: string;
  rotulo: string;
}

interface AbaDocumentosProps {
  pacienteId: string;
  podeGerenciar: boolean;
  /** Vem do prontuario ja carregado: nao ha chamada extra so para o seletor. */
  consultasConcluidas: ConsultaConcluidaOpcao[];
}

const ROTULO_TIPO: Record<TipoDocumentoClinicoApi, string> = {
  declaracao_comparecimento: 'Declaracao de comparecimento',
  relatorio_alta: 'Relatorio de alta',
  recibo_consulta: 'Recibo'
};

/** Tipos que saem de uma consulta especifica e por isso exigem o seletor. */
const TIPOS_COM_CONSULTA: TipoDocumentoClinicoApi[] = ['declaracao_comparecimento', 'recibo_consulta'];

const MOTIVO_ENVIO: Record<string, string> = {
  contato_ausente: 'Paciente sem e-mail cadastrado ou que optou por nao receber e-mail.',
  canal_ausente: 'Nenhum canal de e-mail ativo configurado para a clinica.',
  template_ausente: 'Nenhum template de e-mail cadastrado para a clinica.'
};

const ROTULO_VARIAVEL: Record<string, string> = {
  clinicaDocumento: 'CNPJ/CPF da clinica',
  clinicaEndereco: 'endereco da clinica',
  cidadeEmissao: 'cidade de emissao',
  profissionalRegistro: 'registro do profissional',
  profissionalEspecialidade: 'especialidade do profissional',
  conteudo: 'texto do relatorio'
};

function formatarInstante(valor: string) {
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function AbaDocumentos({ pacienteId, podeGerenciar, consultasConcluidas }: AbaDocumentosProps) {
  const [documentos, setDocumentos] = useState<DocumentoClinicoApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoDocumentoClinicoApi>('declaracao_comparecimento');
  const [consultaId, setConsultaId] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [cidadeEmissao, setCidadeEmissao] = useState('');
  const [documentoAbertoId, setDocumentoAbertoId] = useState<string | null>(null);
  const [consultasPagas, setConsultasPagas] = useState<ConsultaConcluidaOpcao[]>([]);
  const iniciarRequisicao = useRequisicaoCancelavel();

  const carregar = useCallback(async () => {
    const { signal, ehAtual } = iniciarRequisicao();
    setCarregando(true);
    try {
      const dados = await listarDocumentosClinicos(pacienteId, { signal });
      if (!ehAtual()) return;
      setDocumentos(dados);
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível carregar os documentos.'));
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }, [iniciarRequisicao, pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Recibo sai de consulta **paga**, nao de consulta concluida: a lista da linha
   * do tempo nao carrega pagamento, entao ela vem da agenda. Consulta de pacote
   * fica de fora — o valor dela foi pago no pacote.
   */
  useEffect(() => {
    if (tipo !== 'recibo_consulta' || consultasPagas.length) return;
    let ativo = true;
    void listarConsultasAgenda()
      .then((consultas) => {
        if (!ativo) return;
        setConsultasPagas(
          consultas
            .filter(
              (consulta) =>
                consulta.pacienteId === pacienteId &&
                consulta.statusPagamento === 'pago' &&
                !consulta.pacoteId
            )
            .map((consulta) => ({
              id: consulta.id,
              rotulo: `${formatarInstante(consulta.inicioEm)} - ${formatarValorBRL(consulta.valorCentavos)}`
            }))
        );
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [consultasPagas.length, pacienteId, tipo]);

  const documentoAberto = useMemo(
    () => documentos.find((documento) => documento.id === documentoAbertoId) ?? null,
    [documentoAbertoId, documentos]
  );

  async function emitir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);
    setSalvando(true);
    try {
      const documento = await emitirDocumentoClinico(pacienteId, {
        tipo,
        ...(TIPOS_COM_CONSULTA.includes(tipo) && consultaId ? { consultaId } : {}),
        ...(tipo === 'relatorio_alta' && conteudo.trim() ? { conteudo: conteudo.trim() } : {}),
        ...(cidadeEmissao.trim() ? { cidadeEmissao: cidadeEmissao.trim() } : {})
      });
      setSucesso(`${ROTULO_TIPO[documento.tipo]} emitida. Confira antes de imprimir.`);
      setConteudo('');
      setDocumentoAbertoId(documento.id);
      await carregar();
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível emitir o documento.'));
    } finally {
      setSalvando(false);
    }
  }

  async function cancelar(documento: DocumentoClinicoApi) {
    const motivo = window.prompt('Motivo do cancelamento (opcional):') ?? undefined;
    setErro(null);
    setSucesso(null);
    try {
      await cancelarDocumentoClinico(pacienteId, documento.id, motivo);
      setSucesso('Documento cancelado. O registro continua no historico.');
      if (documentoAbertoId === documento.id) setDocumentoAbertoId(null);
      await carregar();
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível cancelar o documento.'));
    }
  }

  async function enviar(documento: DocumentoClinicoApi) {
    setErro(null);
    setSucesso(null);
    try {
      const resultado = await enviarDocumentoClinicoPorEmail(pacienteId, documento.id);
      if (resultado.status === 'pendente') {
        setSucesso('Documento enviado para a fila de e-mail do paciente.');
        await carregar();
        return;
      }
      setErro(MOTIVO_ENVIO[resultado.motivo ?? ''] ?? 'Envio nao realizado.');
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível enviar o documento.'));
    }
  }

  const semConsultaConcluida = consultasConcluidas.length === 0;
  const opcoesConsulta = tipo === 'recibo_consulta' ? consultasPagas : consultasConcluidas;

  return (
    <div className="grid gap-4">
      {erro ? (
        <p role="alert" className="nao-imprimir rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo-forte">
          {erro}
        </p>
      ) : null}
      {sucesso ? (
        <p role="status" className="nao-imprimir rounded-md border border-sucesso-borda bg-sucesso-suave p-3 text-sm text-sucesso-forte">
          {sucesso}
        </p>
      ) : null}

      {podeGerenciar ? (
        <Cartao className="nao-imprimir">
          <CartaoCabecalho>
            <CartaoTitulo>Emitir documento</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={emitir}>
              <label className="grid gap-1">
                <Rotulo>Tipo</Rotulo>
                <Selecao
                  value={tipo}
                  onChange={(evento) => setTipo(evento.target.value as TipoDocumentoClinicoApi)}
                >
                  <option value="declaracao_comparecimento">Declaracao de comparecimento</option>
                  <option value="relatorio_alta">Relatorio de alta</option>
                  <option value="recibo_consulta">Recibo</option>
                </Selecao>
              </label>

              {TIPOS_COM_CONSULTA.includes(tipo) ? (
                <label className="grid gap-1">
                  <Rotulo>Consulta</Rotulo>
                  <Selecao
                    required
                    value={consultaId}
                    disabled={opcoesConsulta.length === 0}
                    aria-describedby="ajuda-consulta-documento"
                    onChange={(evento) => setConsultaId(evento.target.value)}
                  >
                    <option value="">Selecione</option>
                    {opcoesConsulta.map((consulta) => (
                      <option key={consulta.id} value={consulta.id}>
                        {consulta.rotulo}
                      </option>
                    ))}
                  </Selecao>
                </label>
              ) : (
                <label className="grid gap-1 sm:col-span-2">
                  <Rotulo>Texto do relatorio</Rotulo>
                  <AreaTexto
                    rows={5}
                    value={conteudo}
                    placeholder="Evolucao, condutas e orientacoes de encerramento."
                    onChange={(evento) => setConteudo(evento.target.value)}
                  />
                </label>
              )}

              <label className="grid gap-1">
                <Rotulo>Cidade de emissao</Rotulo>
                <Campo
                  value={cidadeEmissao}
                  placeholder="Usa a cidade do perfil da empresa"
                  onChange={(evento) => setCidadeEmissao(evento.target.value)}
                />
              </label>

              <div className="flex items-end sm:col-span-2">
                <Botao
                  type="submit"
                  variante="primario"
                  carregando={salvando}
                  disabled={salvando || (TIPOS_COM_CONSULTA.includes(tipo) && opcoesConsulta.length === 0)}
                >
                  Emitir documento
                </Botao>
              </div>

              {TIPOS_COM_CONSULTA.includes(tipo) ? (
                <p id="ajuda-consulta-documento" className="text-xs text-texto-suave sm:col-span-2">
                  {tipo === 'recibo_consulta'
                    ? opcoesConsulta.length === 0
                      ? 'Nenhuma consulta com pagamento registrado nos ultimos 30 dias. Registre o pagamento na agenda antes de emitir o recibo.'
                      : 'A lista traz apenas consultas com pagamento registrado. Consulta paga por pacote nao gera recibo proprio.'
                    : semConsultaConcluida
                      ? 'Nenhuma consulta concluida ate agora. A declaracao so sai de consulta ja concluida.'
                      : 'A lista traz apenas consultas concluidas.'}
                </p>
              ) : null}
            </form>
          </CartaoConteudo>
        </Cartao>
      ) : null}

      <Cartao className="nao-imprimir">
        <CartaoCabecalho className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CartaoTitulo>Documentos emitidos</CartaoTitulo>
          <BarraCarregamento visivel={carregando} rotulo="Carregando documentos" />
        </CartaoCabecalho>
        <CartaoConteudo>
          {documentos.length === 0 && !carregando ? (
            <p className="text-sm text-texto-suave">Nenhum documento emitido para este paciente.</p>
          ) : (
            <ul className="grid gap-2">
              {documentos.map((documento) => (
                <li
                  key={documento.id}
                  className="flex flex-col gap-2 rounded-md border border-linha bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-tinta">
                      {documento.titulo}
                      {documento.canceladoEm ? ' (cancelado)' : ''}
                    </p>
                    <p className="text-xs text-texto-suave">
                      {ROTULO_TIPO[documento.tipo]} - emitido em {formatarInstante(documento.emitidoEm)}
                      {documento.enviadoEm ? ` - enviado em ${formatarInstante(documento.enviadoEm)}` : ''}
                    </p>
                    {documento.motivoCancelamento ? (
                      <p className="text-xs text-texto-suave">Motivo: {documento.motivoCancelamento}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Botao
                      type="button"
                      tamanho="sm"
                      onClick={() => setDocumentoAbertoId(documento.id === documentoAbertoId ? null : documento.id)}
                    >
                      {documento.id === documentoAbertoId ? 'Fechar' : 'Ver'}
                    </Botao>
                    {podeGerenciar && documento.podeEnviarPorEmail && !documento.canceladoEm ? (
                      <Botao type="button" tamanho="sm" onClick={() => void enviar(documento)}>
                        Enviar por e-mail
                      </Botao>
                    ) : null}
                    {podeGerenciar && !documento.canceladoEm ? (
                      <Botao type="button" tamanho="sm" variante="perigo" onClick={() => void cancelar(documento)}>
                        Cancelar
                      </Botao>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CartaoConteudo>
      </Cartao>

      {documentoAberto ? (
        <section aria-label="Visualizacao do documento" className="grid gap-3">
          <div className="nao-imprimir flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-texto-suave">
              Confira o documento antes de imprimir. A impressao sai so com a folha abaixo.
            </p>
            <Botao type="button" variante="primario" onClick={() => window.print()}>
              Imprimir / salvar PDF
            </Botao>
          </div>

          {documentoAberto.variaveisVazias.length ? (
            <p className="nao-imprimir rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-alerta-forte">
              Campos sem valor no cadastro:{' '}
              {documentoAberto.variaveisVazias
                .map((variavel) => ROTULO_VARIAVEL[variavel] ?? variavel)
                .join(', ')}
              . O documento saiu com esses trechos em branco.
            </p>
          ) : null}

          <article className="folha-documento mx-auto w-full max-w-[820px] rounded-md border border-linha bg-white p-10 text-tinta">
            <header className="border-b border-linha pb-4">
              <h2 className="text-lg font-semibold">{documentoAberto.cabecalho?.clinicaNome}</h2>
              {documentoAberto.cabecalho?.clinicaDocumento ? (
                <p className="text-xs text-texto-suave">{documentoAberto.cabecalho.clinicaDocumento}</p>
              ) : null}
              {documentoAberto.cabecalho?.clinicaEndereco ? (
                <p className="text-xs text-texto-suave">{documentoAberto.cabecalho.clinicaEndereco}</p>
              ) : null}
            </header>

            <h1 className="mt-8 text-center text-base font-semibold uppercase tracking-wide">
              {documentoAberto.titulo}
            </h1>

            <div className="mt-8 grid gap-4 text-sm leading-7">
              {documentoAberto.paragrafos.map((paragrafo, indice) => (
                <p key={indice} className="whitespace-pre-line">
                  {paragrafo}
                </p>
              ))}
            </div>

            <footer className="mt-10 border-t border-linha pt-3 text-xs text-texto-suave">
              Documento {documentoAberto.id} emitido em {formatarInstante(documentoAberto.emitidoEm)}.
              {documentoAberto.canceladoEm ? ' CANCELADO.' : ''}
            </footer>
          </article>
        </section>
      ) : null}
    </div>
  );
}
