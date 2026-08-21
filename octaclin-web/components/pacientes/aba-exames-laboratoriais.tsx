'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FlaskConical, Plus, Trash2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo } from '@/components/ui/campo';
import { AlertaOperacional, AlertaSucesso, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  criarColetaExameLaboratorial,
  listarExamesLaboratoriais,
  type ColetaExameLaboratorialApi,
  type CriarMarcadorExameLaboratorialEntrada
} from '@/lib/exames-laboratoriais-api';

interface FormularioColeta {
  coletadaEm: string;
  recebidaEm: string;
  laboratorio: string;
  observacoes: string;
  marcadores: CriarMarcadorExameLaboratorialEntrada[];
}

function novoMarcador(): CriarMarcadorExameLaboratorialEntrada {
  return { nome: '', valor: '', unidade: '', referencia: '', metodo: '' };
}

function formularioInicial(): FormularioColeta {
  return {
    coletadaEm: new Date().toISOString().slice(0, 10),
    recebidaEm: '',
    laboratorio: '',
    observacoes: '',
    marcadores: [novoMarcador()]
  };
}

function formatarData(valor: string) {
  const data = new Date(`${valor.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(data.getTime())
    ? valor
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(data);
}

interface AbaExamesLaboratoriaisProps {
  pacienteId: string;
  podeGerenciar: boolean;
}

export function AbaExamesLaboratoriais({ pacienteId, podeGerenciar }: AbaExamesLaboratoriaisProps) {
  const [coletas, setColetas] = useState<ColetaExameLaboratorialApi[]>([]);
  const [formulario, setFormulario] = useState<FormularioColeta>(formularioInicial);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setColetas(await listarExamesLaboratoriais(pacienteId));
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível carregar os exames laboratoriais.'));
    } finally {
      setCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function atualizarMarcador(indice: number, chave: keyof CriarMarcadorExameLaboratorialEntrada, valor: string) {
    setFormulario((atual) => ({
      ...atual,
      marcadores: atual.marcadores.map((marcador, marcadorIndice) =>
        marcadorIndice === indice ? { ...marcador, [chave]: valor } : marcador
      )
    }));
  }

  function adicionarMarcador() {
    setFormulario((atual) => ({ ...atual, marcadores: [...atual.marcadores, novoMarcador()] }));
  }

  function removerMarcador(indice: number) {
    setFormulario((atual) => ({
      ...atual,
      marcadores: atual.marcadores.length === 1 ? atual.marcadores : atual.marcadores.filter((_, itemIndice) => itemIndice !== indice)
    }));
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);
    const marcadores = formulario.marcadores
      .map((marcador) => ({
        nome: marcador.nome.trim(),
        valor: marcador.valor.trim(),
        unidade: marcador.unidade?.trim() || undefined,
        referencia: marcador.referencia?.trim() || undefined,
        metodo: marcador.metodo?.trim() || undefined
      }))
      .filter((marcador) => marcador.nome || marcador.valor);

    if (!marcadores.length || marcadores.some((marcador) => !marcador.nome || !marcador.valor)) {
      setErro('Informe nome e valor em cada marcador adicionado.');
      return;
    }

    setSalvando(true);
    try {
      await criarColetaExameLaboratorial(pacienteId, {
        coletadaEm: formulario.coletadaEm,
        recebidaEm: formulario.recebidaEm || undefined,
        laboratorio: formulario.laboratorio.trim() || undefined,
        observacoes: formulario.observacoes.trim() || undefined,
        marcadores
      });
      setFormulario(formularioInicial());
      setSucesso('Coleta laboratorial registrada no prontuário.');
      await carregar();
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível registrar a coleta laboratorial.'));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <BarraCarregamento visivel rotulo="Carregando exames laboratoriais" />;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-linha bg-white p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria">
            <FlaskConical size={19} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-tinta">Exames laboratoriais</h2>
            <p className="mt-1 text-sm text-texto-suave">Registre coletas e acompanhe os marcadores sem classificação automática.</p>
          </div>
        </div>
        <p className="text-sm text-texto-suave">{coletas.length} {coletas.length === 1 ? 'coleta registrada' : 'coletas registradas'}</p>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}

      {podeGerenciar ? (
        <form onSubmit={salvar} className="grid gap-4 rounded-md border border-linha bg-white p-4">
          <div>
            <h3 className="text-sm font-semibold text-tinta">Nova coleta</h3>
            <p className="mt-1 text-sm text-texto-suave">Os resultados ficam restritos ao prontuário e não recebem interpretação pelo sistema.</p>
          </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
             <div className="grid gap-1"><Rotulo htmlFor="coleta-data">Data da coleta</Rotulo><Campo id="coleta-data" type="date" value={formulario.coletadaEm} onChange={(evento) => setFormulario((atual) => ({ ...atual, coletadaEm: evento.target.value }))} required /></div>
             <div className="grid gap-1"><Rotulo htmlFor="coleta-recebimento">Data de recebimento</Rotulo><Campo id="coleta-recebimento" type="date" value={formulario.recebidaEm} onChange={(evento) => setFormulario((atual) => ({ ...atual, recebidaEm: evento.target.value }))} /></div>
             <div className="grid gap-1 md:col-span-2"><Rotulo htmlFor="coleta-laboratorio">Laboratório</Rotulo><Campo id="coleta-laboratorio" value={formulario.laboratorio} maxLength={180} onChange={(evento) => setFormulario((atual) => ({ ...atual, laboratorio: evento.target.value }))} /></div>
          </div>

          <div className="grid gap-3 border-y border-linha py-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-tinta">Marcadores</h4><Botao type="button" tamanho="sm" onClick={adicionarMarcador}><Plus size={15} />Adicionar marcador</Botao></div>
            {formulario.marcadores.map((marcador, indice) => (
              <div key={indice} className="grid gap-3 rounded-md border border-linha p-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_minmax(0,1fr)_minmax(0,1fr)_44px] xl:items-end">
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-nome-${indice}`}>Marcador</Rotulo><Campo id={`marcador-nome-${indice}`} value={marcador.nome} maxLength={120} onChange={(evento) => atualizarMarcador(indice, 'nome', evento.target.value)} required /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-valor-${indice}`}>Valor</Rotulo><Campo id={`marcador-valor-${indice}`} value={marcador.valor} maxLength={80} onChange={(evento) => atualizarMarcador(indice, 'valor', evento.target.value)} required /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-unidade-${indice}`}>Unidade</Rotulo><Campo id={`marcador-unidade-${indice}`} value={marcador.unidade ?? ''} maxLength={40} onChange={(evento) => atualizarMarcador(indice, 'unidade', evento.target.value)} /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-referencia-${indice}`}>Referência</Rotulo><Campo id={`marcador-referencia-${indice}`} value={marcador.referencia ?? ''} maxLength={160} onChange={(evento) => atualizarMarcador(indice, 'referencia', evento.target.value)} /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-metodo-${indice}`}>Método</Rotulo><Campo id={`marcador-metodo-${indice}`} value={marcador.metodo ?? ''} maxLength={120} onChange={(evento) => atualizarMarcador(indice, 'metodo', evento.target.value)} /></div>
                <Botao type="button" tamanho="sm" variante="fantasma" aria-label={`Remover marcador ${indice + 1}`} onClick={() => removerMarcador(indice)} disabled={formulario.marcadores.length === 1}><Trash2 size={16} /></Botao>
              </div>
            ))}
          </div>

          <div className="grid gap-1"><Rotulo htmlFor="coleta-observacoes">Observações</Rotulo><AreaTexto id="coleta-observacoes" value={formulario.observacoes} maxLength={4000} onChange={(evento) => setFormulario((atual) => ({ ...atual, observacoes: evento.target.value }))} /></div>
          <div className="flex justify-end"><Botao type="submit" variante="primario" carregando={salvando}><FlaskConical size={16} />Registrar coleta</Botao></div>
        </form>
      ) : null}

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold text-tinta">Série laboratorial</h3>
        {coletas.length ? coletas.map((coleta) => (
          <article key={coleta.id} className="grid gap-3 rounded-md border border-linha bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-semibold text-tinta">Coleta de {formatarData(coleta.coletadaEm)}</h4><p className="mt-1 text-sm text-texto-suave">{coleta.laboratorio || 'Laboratório não informado'}{coleta.recebidaEm ? ` · Recebido em ${formatarData(coleta.recebidaEm)}` : ''}</p></div><span className="rounded-md bg-superficie px-2 py-1 text-xs font-medium text-texto-suave">{coleta.marcadores.length} {coleta.marcadores.length === 1 ? 'marcador' : 'marcadores'}</span></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-linha text-xs uppercase text-texto-suave"><tr><th className="px-2 py-2 font-semibold">Marcador</th><th className="px-2 py-2 font-semibold">Valor</th><th className="px-2 py-2 font-semibold">Referência</th><th className="px-2 py-2 font-semibold">Método</th></tr></thead><tbody>{coleta.marcadores.map((marcador) => <tr key={marcador.id} className="border-b border-linha last:border-0"><td className="px-2 py-2 font-medium text-tinta">{marcador.nome}</td><td className="px-2 py-2 text-tinta">{marcador.valor}{marcador.unidade ? ` ${marcador.unidade}` : ''}</td><td className="px-2 py-2 text-texto-suave">{marcador.referencia || '-'}</td><td className="px-2 py-2 text-texto-suave">{marcador.metodo || '-'}</td></tr>)}</tbody></table></div>
            {coleta.observacoes ? <p className="border-t border-linha pt-3 text-sm text-texto-suave">{coleta.observacoes}</p> : null}
          </article>
        )) : <EstadoVazio titulo="Nenhuma coleta registrada" descricao="Registre a primeira coleta para acompanhar a série laboratorial deste paciente." />}
      </div>
    </section>
  );
}
