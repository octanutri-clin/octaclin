'use client';

import { useEffect, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Modal } from '@/components/ui/modal';
import { PreviewQuestionarioPaciente } from './preview-questionario-paciente';
import type { PerguntaEditor } from './tipos';

interface PreviaResponsivaQuestionarioProps {
  titulo: string;
  descricao?: string;
  perguntas: PerguntaEditor[];
}

export function PreviaResponsivaQuestionario(props: PreviaResponsivaQuestionarioProps) {
  const [aberto, setAberto] = useState(false);
  const [largura, setLargura] = useState<390 | 1024>(390);
  const [larguraEfetiva, setLarguraEfetiva] = useState<number | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto || !areaRef.current) return;
    const area = areaRef.current;
    const observador = new ResizeObserver(() => {
      setLarguraEfetiva(Math.round(area.getBoundingClientRect().width));
    });
    observador.observe(area);
    return () => observador.disconnect();
  }, [aberto]);

  return (
    <div className="grid min-w-0 gap-3">
      <Botao type="button" onClick={() => { setLarguraEfetiva(null); setAberto(true); }}>Ampliar prévia</Botao>
      {!aberto ? <PreviewQuestionarioPaciente {...props} /> : null}
      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Prévia do questionário"
        descricao="Simulação de largura; não emula aparelho ou navegador. Confira também em um aparelho real."
        className="max-w-[1100px]"
      >
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Largura desejada da prévia">
          {([390, 1024] as const).map((valor) => (
            <Botao key={valor} type="button" aria-pressed={largura === valor} onClick={() => setLargura(valor)}>
              {valor === 390 ? 'Celular' : 'Desktop'} — {valor} px
            </Botao>
          ))}
        </div>
        <p role="status" className="mb-3 text-sm text-texto-suave">
          {larguraEfetiva === null ? 'Calculando largura…' : `Largura da prévia: ${larguraEfetiva} px`}
        </p>
        <div ref={areaRef} data-qst-p04-area className="mx-auto max-w-full" style={{ width: largura }}>
          <PreviewQuestionarioPaciente {...props} />
        </div>
      </Modal>
    </div>
  );
}
