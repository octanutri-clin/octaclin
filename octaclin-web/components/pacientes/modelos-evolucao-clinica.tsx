'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { BookmarkPlus, LayoutTemplate, Trash2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Etiqueta } from '@/components/ui/etiqueta';
import { AlertaOperacional } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  arquivarModeloEvolucaoClinica,
  criarModeloEvolucaoClinica,
  listarModelosEvolucaoClinica,
  obterModeloEvolucaoClinica,
  type ModeloEvolucaoClinicaResumoApi,
  type OrigemModeloEvolucaoApi,
  type TipoEvolucaoClinicaApi
} from '@/lib/prontuario-api';

const ROTULO_ORIGEM: Record<OrigemModeloEvolucaoApi, string> = {
  pessoal: 'Pessoal',
  clinica: 'Da clinica'
};

const ROTULO_TIPO: Record<TipoEvolucaoClinicaApi, string> = {
  observacao: 'Observação',
  consulta: 'Consulta',
  retorno: 'Retorno',
  ajuste_plano: 'Ajuste de plano'
};

export interface ModelosEvolucaoClinicaProps {
  /** Tipo e conteudo atuais do formulario, para salvar como modelo. */
  tipoAtual: () => TipoEvolucaoClinicaApi;
  conteudoAtual: () => string;
  /** Substitui tipo e conteudo do formulario pelos do modelo escolhido. */
  aoAplicar: (modelo: { tipo: TipoEvolucaoClinicaApi; conteudo: string }) => void;
  desabilitado?: boolean;
}

export function ModelosEvolucaoClinica({
  tipoAtual,
  conteudoAtual,
  aoAplicar,
  desabilitado = false
}: ModelosEvolucaoClinicaProps) {
  const id = useId();
  const [modelos, setModelos] = useState<ModeloEvolucaoClinicaResumoApi[]>([]);
  const [selecionado, setSelecionado] = useState('');
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState<OrigemModeloEvolucaoApi>('pessoal');
  const [ocupado, setOcupado] = useState<'carregando' | 'aplicando' | 'salvando' | 'arquivando' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);

  const carregar = useCallback(async () => {
    setOcupado('carregando');
    setErro(null);
    try {
      const pagina = await listarModelosEvolucaoClinica();
      setModelos(pagina.itens);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar os modelos.'));
    } finally {
      setOcupado(null);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function aplicar() {
    if (!selecionado) return;
    setOcupado('aplicando');
    setErro(null);
    setAviso(null);
    try {
      const modelo = await obterModeloEvolucaoClinica(selecionado);
      aoAplicar({ tipo: modelo.tipo, conteudo: modelo.conteudo });
      setAviso('Modelo aplicado à evolução. Revise e registre para confirmar.');
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível aplicar o modelo.'));
    } finally {
      setOcupado(null);
    }
  }

  async function salvar() {
    const conteudo = conteudoAtual();
    if (!nome.trim() || conteudo.trim().length < 3) {
      setErro('Informe um nome e ao menos 3 caracteres no conteúdo da evolução.');
      return;
    }
    setOcupado('salvando');
    setErro(null);
    setAviso(null);
    try {
      await criarModeloEvolucaoClinica({ nome: nome.trim(), origem, tipo: tipoAtual(), conteudo });
      setNome('');
      setAviso('Modelo salvo.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar o modelo.'));
    } finally {
      setOcupado(null);
    }
  }

  async function arquivar() {
    setConfirmarArquivo(false);
    if (!selecionado) return;
    setOcupado('arquivando');
    setErro(null);
    try {
      await arquivarModeloEvolucaoClinica(selecionado);
      setSelecionado('');
      setAviso('Modelo arquivado.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível arquivar o modelo.'));
    } finally {
      setOcupado(null);
    }
  }

  const modeloAtual = modelos.find((modelo) => modelo.id === selecionado);

  return (
    <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
      <div className="flex items-center gap-2">
        <LayoutTemplate aria-hidden="true" size={17} className="text-primaria" />
        <h3 className="text-sm font-semibold text-tinta">Modelos de evolução</h3>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {aviso ? (
        <p role="status" className="rounded-md bg-superficie px-3 py-2 text-sm text-tinta">
          {aviso}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-modelo`}>Aplicar modelo à evolução</Rotulo>
          <Selecao
            id={`${id}-modelo`}
            value={selecionado}
            onChange={(evento) => setSelecionado(evento.target.value)}
            disabled={desabilitado || !modelos.length}
          >
            <option value="">{modelos.length ? 'Escolha um modelo' : 'Nenhum modelo salvo'}</option>
            {modelos.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.nome} - {ROTULO_ORIGEM[modelo.origem]} - {ROTULO_TIPO[modelo.tipo]}
              </option>
            ))}
          </Selecao>
        </div>
        <Botao
          type="button"
          variante="primario"
          className="min-h-11"
          onClick={() => void aplicar()}
          carregando={ocupado === 'aplicando'}
          disabled={desabilitado || !selecionado || Boolean(ocupado)}
        >
          Aplicar
        </Botao>
        <Botao
          type="button"
          variante="fantasma"
          className="min-h-11"
          onClick={() => setConfirmarArquivo(true)}
          disabled={desabilitado || !selecionado || Boolean(ocupado)}
        >
          <Trash2 aria-hidden="true" size={15} />
          Arquivar
        </Botao>
      </div>

      {modeloAtual ? (
        <p className="text-xs text-texto-suave">
          <Etiqueta variante={modeloAtual.origem === 'clinica' ? 'primaria' : 'neutra'}>
            {ROTULO_ORIGEM[modeloAtual.origem]}
          </Etiqueta>{' '}
          Aplicar substitui o tipo e o conteúdo atuais do formulário.
        </p>
      ) : null}

      <div className="grid gap-2 border-t border-linha pt-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-nome`}>Salvar evolução atual como modelo</Rotulo>
          <Campo
            id={`${id}-nome`}
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            maxLength={180}
            placeholder="Nome do modelo"
            disabled={desabilitado}
          />
        </div>
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-origem`}>Visibilidade</Rotulo>
          <Selecao
            id={`${id}-origem`}
            value={origem}
            onChange={(evento) => setOrigem(evento.target.value as OrigemModeloEvolucaoApi)}
            disabled={desabilitado}
          >
            <option value="pessoal">Só para mim</option>
            <option value="clinica">Toda a clínica</option>
          </Selecao>
        </div>
        <Botao
          type="button"
          className="min-h-11"
          onClick={() => void salvar()}
          carregando={ocupado === 'salvando'}
          disabled={desabilitado || !nome.trim() || Boolean(ocupado)}
        >
          <BookmarkPlus aria-hidden="true" size={15} />
          Salvar modelo
        </Botao>
      </div>

      <ModalConfirmacao
        aberto={confirmarArquivo}
        titulo="Arquivar modelo"
        mensagem="O modelo deixa de aparecer na lista. Evoluções já registradas a partir dele não mudam."
        rotuloConfirmar="Arquivar"
        aoConfirmar={() => void arquivar()}
        aoCancelar={() => setConfirmarArquivo(false)}
      />
    </section>
  );
}
