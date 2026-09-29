'use client';

import { useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Modal } from '@/components/ui/modal';
import { decidirReagendamentoAposFalta } from '@/lib/agenda-api';

export function DecisaoReagendamentoAposFalta({
  consultaId, pacienteNome, aoFechar, aoConcluir
}: {
  consultaId: string | null;
  pacienteNome?: string;
  aoFechar: () => void;
  aoConcluir: (decisao: 'aprovar' | 'reprovar') => void;
}) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(decisao: 'aprovar' | 'reprovar') {
    if (!consultaId) return;
    setProcessando(true);
    setErro(null);
    try {
      await decidirReagendamentoAposFalta(consultaId, decisao);
      aoConcluir(decisao);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível registrar a decisão.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <Modal aberto={Boolean(consultaId)} aoFechar={() => { if (!processando) { setErro(null); aoFechar(); } }} titulo="Contato para reagendamento" descricao={pacienteNome ? `Decida se a clínica deve oferecer novo horário a ${pacienteNome}.` : 'Decida se a clínica deve oferecer um novo horário.'}>
      <div className="grid gap-4">
        <p className="text-sm text-texto-suave">A aprovação autoriza uma única mensagem automática pelo canal permitido, dentro do horário do paciente e até 7 dias após a consulta perdida. O envio depende de canal e modelo específicos configurados. Fechar esta janela mantém a decisão pendente no painel clínico.</p>
        {erro ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao type="button" variante="secundario" disabled={processando} onClick={() => void decidir('reprovar')}>Reprovar contato</Botao>
          <Botao type="button" disabled={processando} onClick={() => void decidir('aprovar')}>{processando ? 'Registrando…' : 'Aprovar contato'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
