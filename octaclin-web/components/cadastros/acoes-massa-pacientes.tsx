'use client';

import { useEffect, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Aviso, AvisoRegiao } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { listarMateriais, enviarMaterialLote, type MaterialEducativoApi } from '@/lib/materiais-api';
import { criarEnviosQuestionarioLote, listarQuestionarios, type QuestionarioApi } from '@/lib/questionarios-api';

interface Props {
  pacienteIds: string[];
  podeEnviarMaterial: boolean;
  podeEnviarFormulario: boolean;
  aoConcluir: () => void;
}

export function AcoesMassaPacientes({ pacienteIds, podeEnviarMaterial, podeEnviarFormulario, aoConcluir }: Props) {
  const [tipo, setTipo] = useState<'material' | 'formulario' | ''>('');
  const [itemId, setItemId] = useState('');
  const [materiais, setMateriais] = useState<MaterialEducativoApi[]>([]);
  const [questionarios, setQuestionarios] = useState<QuestionarioApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const possuiSelecao = pacienteIds.length > 0;

  useEffect(() => {
    if (!possuiSelecao || (!podeEnviarMaterial && !podeEnviarFormulario)) return;
    let ativo = true;
    Promise.all([
      podeEnviarMaterial ? listarMateriais() : Promise.resolve([]),
      podeEnviarFormulario ? listarQuestionarios({ limite: 100 }).then((resposta) => resposta.itens) : Promise.resolve([])
    ]).then(([materiaisCarregados, questionariosCarregados]) => {
      if (!ativo) return;
      setMateriais(materiaisCarregados);
      setQuestionarios(questionariosCarregados.filter((questionario) => questionario.status === 'publicado'));
      setErro(null);
    }).catch(() => { if (ativo) setErro('Não foi possível carregar os formulários e materiais.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [possuiSelecao, podeEnviarMaterial, podeEnviarFormulario]);

  if (!podeEnviarMaterial && !podeEnviarFormulario) return null;
  if (!pacienteIds.length) return sucesso ? <AvisoRegiao><Aviso variante="sucesso" mensagem={sucesso} aoFechar={() => setSucesso(null)} /></AvisoRegiao> : null;
  const opcoes = tipo === 'material' ? materiais : questionarios;

  async function enviar() {
    if (!tipo || !itemId || !pacienteIds.length) return;
    setEnviando(true);
    setErro(null);
    try {
      const resultado = tipo === 'material'
        ? await enviarMaterialLote(itemId, pacienteIds)
        : await criarEnviosQuestionarioLote(itemId, pacienteIds);
      setSucesso(`${resultado.total} envio(s) registrado(s). Formulários ficam disponíveis no portal do paciente; esta ação não envia mensagem externa.`);
      setConfirmar(false);
      setItemId('');
      setTipo('');
      aoConcluir();
    } catch {
      setConfirmar(false);
      setErro('Não foi possível registrar o lote. Confira os pacientes e tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-linha bg-superficie p-4">
      <p className="text-sm font-medium">{pacienteIds.length} paciente(s) selecionado(s) nesta página</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">Ação em massa
          <select className="min-h-11 rounded-md border border-linha bg-superficie px-3" value={tipo} onChange={(evento) => { setTipo(evento.target.value as typeof tipo); setItemId(''); }}>
            <option value="">Escolha uma ação</option>
            {podeEnviarMaterial ? <option value="material">Enviar material</option> : null}
            {podeEnviarFormulario ? <option value="formulario">Enviar formulário</option> : null}
          </select>
        </label>
        {tipo ? <label className="grid min-w-52 gap-1 text-sm">{tipo === 'material' ? 'Material para enviar' : 'Formulário para enviar'}
          <select className="min-h-11 rounded-md border border-linha bg-superficie px-3" value={itemId} onChange={(evento) => setItemId(evento.target.value)} disabled={carregando}>
            <option value="">{carregando ? 'Carregando...' : 'Escolha um item'}</option>
            {opcoes.map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}
          </select>
        </label> : null}
        <Botao type="button" onClick={() => setConfirmar(true)} disabled={!itemId || !pacienteIds.length || enviando}>Revisar envio</Botao>
      </div>
      {erro ? <AvisoRegiao><Aviso variante="erro" mensagem={erro} aoFechar={() => setErro(null)} /></AvisoRegiao> : null}
      {sucesso ? <AvisoRegiao><Aviso variante="sucesso" mensagem={sucesso} aoFechar={() => setSucesso(null)} /></AvisoRegiao> : null}
      <ModalConfirmacao aberto={confirmar} titulo="Confirmar envio em massa" mensagem={`Registrar ${tipo === 'material' ? 'material' : 'formulário'} para ${pacienteIds.length} paciente(s) selecionado(s)? Esta ação não envia mensagem externa.`} rotuloConfirmar="Confirmar envio" confirmando={enviando} aoConfirmar={() => void enviar()} aoCancelar={() => setConfirmar(false)} />
    </div>
  );
}
