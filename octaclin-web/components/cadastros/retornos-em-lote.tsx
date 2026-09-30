'use client';

import { useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Modal } from '@/components/ui/modal';
import { type ItemRetornoApi, aprovarRetornos, simularRetornos } from '@/lib/retornos-pacientes-api';

const MOTIVOS: Record<string, string> = {
  paciente_indisponivel: 'Paciente fora do seu escopo ou não encontrado',
  paciente_inativo: 'Paciente inativo ou arquivado',
  consulta_futura: 'Já possui consulta futura',
  contato_recente: 'Contato de retorno nos últimos 30 dias',
  contato_ilegivel: 'Contato indisponível',
  fora_horario: 'Fora do horário permitido pelo paciente',
  sem_canal_ou_template_autorizado: 'Sem canal e modelo autorizado',
  condicao_alterada: 'Condição alterada antes do envio'
};

interface Props {
  pacientes: Array<{ id: string; nome: string }>;
  aoConcluir: () => void;
}

export function RetornosEmLote({ pacientes, aoConcluir }: Props) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<ItemRetornoApi[]>([]);
  const [datas, setDatas] = useState<Record<string, string>>({});
  const [loteId, setLoteId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<{ totalEnfileirado: number; resultados: Array<{ pacienteId: string; status: string; motivo?: string }> } | null>(null);
  if (!pacientes.length) return null;

  async function abrir() {
    setOcupado(true);
    setErro('');
    try {
      const resposta = await simularRetornos(pacientes.map((paciente) => paciente.id));
      setItens(resposta.itens);
      setDatas(Object.fromEntries(resposta.itens.map((item) => [item.pacienteId, item.dataSugerida ?? ''])));
      setLoteId(crypto.randomUUID());
      setResultado(null);
      setAberto(true);
    } catch { setErro('Não foi possível simular o contato. Atualize a lista e tente novamente.'); }
    finally { setOcupado(false); }
  }

  async function aprovar() {
    if (!loteId || resultado) return;
    setOcupado(true);
    setErro('');
    try {
      const resposta = await aprovarRetornos(pacientes.map((paciente) => paciente.id), loteId);
      setResultado(resposta);
      aoConcluir();
    } catch { setErro('Não foi possível confirmar o lote. Tente novamente; a mesma aprovação não duplicará envios.'); }
    finally { setOcupado(false); }
  }

  return <>
    <Botao type="button" onClick={() => void abrir()} disabled={ocupado}>Simular contato para retorno</Botao>
    {erro && !aberto ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}
    <Modal aberto={aberto} aoFechar={() => { if (!ocupado) setAberto(false); }} titulo="Revisar contatos de retorno" descricao="Somente pacientes elegíveis receberão o modelo aprovado no canal autorizado. A data é uma referência interna e não será enviada ao paciente." className="max-w-2xl">
      <div className="grid gap-3">
        {itens.map((item) => <div key={item.pacienteId} className="rounded-md border border-linha p-3 text-sm">
          <p className="font-medium">{pacientes.find((paciente) => paciente.id === item.pacienteId)?.nome ?? 'Paciente'}</p>
          <p className={item.elegivel ? 'text-sucesso-forte' : 'text-texto-suave'}>{item.elegivel ? 'Elegível para contato' : MOTIVOS[item.motivo ?? ''] ?? 'Contato indisponível'}</p>
          <p className="text-texto-suave">{item.intervaloDias ? `Intervalo factual: ${item.intervaloDias} dias (mediana de até 3 intervalos)` : 'Histórico insuficiente para sugerir intervalo'}</p>
          <label className="mt-2 grid gap-1">Data de referência interna
            <input type="date" className="min-h-11 rounded-md border border-linha px-3" value={datas[item.pacienteId] ?? ''} onChange={(evento) => setDatas((atuais) => ({ ...atuais, [item.pacienteId]: evento.target.value }))} />
          </label>
        </div>)}
        <p className="text-xs text-texto-suave">A data ajustada vale apenas nesta simulação. Para marcar horário e registrar a consulta, use a <a href="/agenda" className="underline">agenda</a>.</p>
        {itens.some((item) => item.motivo === 'sem_canal_ou_template_autorizado') ? <p className="text-xs text-texto-suave">Para habilitar o e-mail de retorno, configure um canal e instale os modelos iniciais em <a href="/comunicacoes" className="underline">Comunicações</a>. WhatsApp exige modelo aprovado.</p> : null}
        {resultado ? <div role="status" className="rounded-md border border-linha p-3 text-sm">
          <p>{resultado.totalEnfileirado} contato(s) enfileirado(s).</p>
          {resultado.resultados.filter((item) => item.status === 'ignorada').map((item) => <p key={item.pacienteId}>{pacientes.find((paciente) => paciente.id === item.pacienteId)?.nome ?? 'Paciente'}: {MOTIVOS[item.motivo ?? ''] ?? 'Não enviado'}</p>)}
        </div> : null}
        {erro ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={() => setAberto(false)} disabled={ocupado}>Fechar</Botao>
          {!resultado ? <Botao type="button" onClick={() => void aprovar()} disabled={ocupado || !itens.some((item) => item.elegivel)}>{ocupado ? 'Enfileirando...' : 'Aprovar contatos elegíveis'}</Botao> : null}
        </div>
      </div>
    </Modal>
  </>;
}
