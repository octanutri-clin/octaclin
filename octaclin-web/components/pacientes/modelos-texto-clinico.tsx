'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  arquivarModeloEvolucaoClinica,
  criarModeloTextoClinico,
  listarModelosTextoClinico,
  obterModeloTextoClinico,
  type ModeloTextoClinicoApi,
  type OrigemModeloEvolucaoApi
} from '@/lib/prontuario-api';

interface ModelosTextoClinicoProps {
  tipo: 'observacao_antropometrica' | 'relatorio_alta';
  conteudoAtual: string;
  aoAplicar: (conteudo: string) => void;
  desabilitado?: boolean;
}

export function ModelosTextoClinico({ tipo, conteudoAtual, aoAplicar, desabilitado = false }: ModelosTextoClinicoProps) {
  const id = useId();
  const limiteConteudo = tipo === 'observacao_antropometrica' ? 2000 : 4000;
  const [modelos, setModelos] = useState<ModeloTextoClinicoApi[]>([]);
  const [selecionado, setSelecionado] = useState('');
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState<OrigemModeloEvolucaoApi>('pessoal');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);

  const carregar = useCallback(async () => {
    const pagina = await listarModelosTextoClinico(tipo);
    setModelos(pagina.itens);
  }, [tipo]);

  useEffect(() => {
    let ativo = true;
    void listarModelosTextoClinico(tipo)
      .then((pagina) => { if (ativo) setModelos(pagina.itens); })
      .catch((falha) => { if (ativo) setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar os modelos.')); });
    return () => { ativo = false; };
  }, [tipo]);

  async function aplicar() {
    if (!selecionado) return;
    setOcupado(true);
    setErro(null);
    try {
      const modelo = await obterModeloTextoClinico(selecionado);
      if (modelo.tipo !== tipo) throw new Error('Modelo não corresponde a este campo.');
      if (modelo.conteudo.length > limiteConteudo) throw new Error(`Modelo excede o limite de ${limiteConteudo} caracteres deste campo.`);
      aoAplicar(modelo.conteudo);
      setAviso('Modelo aplicado ao rascunho. Revise o texto antes de salvar.');
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível aplicar o modelo.'));
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    if (!nome.trim() || conteudoAtual.trim().length < 3 || conteudoAtual.length > limiteConteudo) {
      setErro(`Informe um nome e texto entre 3 e ${limiteConteudo} caracteres.`);
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      await criarModeloTextoClinico({ nome: nome.trim(), origem, tipo, conteudo: conteudoAtual });
      setNome('');
      await carregar();
      setAviso('Modelo salvo.');
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar o modelo.'));
    } finally {
      setOcupado(false);
    }
  }

  async function arquivar() {
    if (!selecionado) return;
    setOcupado(true);
    setErro(null);
    try {
      await arquivarModeloEvolucaoClinica(selecionado);
      setConfirmarArquivo(false);
      setSelecionado('');
      await carregar();
      setAviso('Modelo arquivado.');
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível arquivar o modelo.'));
    } finally {
      setOcupado(false);
    }
  }

  return <section className="grid gap-3 rounded-md border border-linha bg-superficie p-3" aria-label="Modelos de texto clínico">
    <h4 className="text-sm font-semibold text-tinta">Modelos de texto</h4>
    {erro ? <AlertaOperacional mensagem={erro} /> : null}
    {aviso ? <p role="status" className="text-sm text-tinta">{aviso}</p> : null}
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
      <div className="grid gap-1"><Rotulo htmlFor={`${id}-selecionar`}>Aplicar modelo</Rotulo>
        <Selecao id={`${id}-selecionar`} value={selecionado} onChange={(evento) => setSelecionado(evento.target.value)} disabled={desabilitado || ocupado}>
          <option value="">{modelos.length ? 'Escolha um modelo' : 'Nenhum modelo salvo'}</option>
          {modelos.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.nome} · {modelo.origem === 'pessoal' ? 'Pessoal' : 'Clínica'}</option>)}
        </Selecao>
      </div>
      <Botao type="button" onClick={() => void aplicar()} disabled={desabilitado || ocupado || !selecionado}>Aplicar</Botao>
      <Botao type="button" variante="fantasma" onClick={() => setConfirmarArquivo(true)} disabled={desabilitado || ocupado || !selecionado}>Arquivar</Botao>
    </div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
      <div className="grid gap-1"><Rotulo htmlFor={`${id}-nome`}>Salvar texto atual como modelo</Rotulo>
        <Campo id={`${id}-nome`} value={nome} onChange={(evento) => setNome(evento.target.value)} maxLength={180} disabled={desabilitado || ocupado} />
      </div>
      <div className="grid gap-1"><Rotulo htmlFor={`${id}-origem`}>Visibilidade</Rotulo>
        <Selecao id={`${id}-origem`} value={origem} onChange={(evento) => setOrigem(evento.target.value as OrigemModeloEvolucaoApi)} disabled={desabilitado || ocupado}>
          <option value="pessoal">Só para mim</option><option value="clinica">Toda a clínica</option>
        </Selecao>
      </div>
      <Botao type="button" onClick={() => void salvar()} disabled={desabilitado || ocupado || !nome.trim()}>Salvar modelo</Botao>
    </div>
    <ModalConfirmacao aberto={confirmarArquivo} titulo="Arquivar modelo" mensagem="O modelo deixa de aparecer na lista. Registros já emitidos não mudam."
      rotuloConfirmar="Arquivar" confirmando={ocupado} aoConfirmar={() => void arquivar()}
      aoCancelar={() => setConfirmarArquivo(false)} />
  </section>;
}
