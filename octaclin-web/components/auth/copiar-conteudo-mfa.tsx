'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { Botao } from '@/components/ui/botao';

type EstadoCopia = 'copiando' | 'sucesso' | 'erro';

interface Props {
  texto: string;
  tipo: 'chave' | 'codigos';
  compacto?: boolean;
}

export function CopiarConteudoMfa({ texto, tipo, compacto = false }: Props) {
  // Identidade opaca por conteúdo: o feedback nunca armazena a chave/códigos.
  // Se o memo for descartado, o feedback anterior apenas deixa de aparecer.
  const contexto = useMemo(() => Symbol(texto.length ? tipo : 'vazio'), [texto, tipo]);
  const [resultado, setResultado] = useState<{ contexto: symbol; estado: EstadoCopia }>();
  const operacaoAtual = useRef<{ contexto: symbol } | null>(null);
  const montado = useRef(true);
  const idStatus = useId();
  const estado = resultado?.contexto === contexto ? resultado.estado : undefined;
  const copiando = estado === 'copiando';

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  async function copiar() {
    if (!texto || operacaoAtual.current?.contexto === contexto) return;
    const operacao = { contexto };
    operacaoAtual.current = operacao;
    setResultado({ contexto, estado: 'copiando' });
    try {
      const areaTransferencia = navigator.clipboard;
      if (typeof areaTransferencia?.writeText !== 'function') throw new Error('Cópia indisponível');
      await areaTransferencia.writeText(texto);
      if (montado.current && operacaoAtual.current === operacao) {
        setResultado({ contexto, estado: 'sucesso' });
      }
    } catch {
      if (montado.current && operacaoAtual.current === operacao) {
        setResultado({ contexto, estado: 'erro' });
      }
    } finally {
      if (operacaoAtual.current === operacao) operacaoAtual.current = null;
    }
  }

  const mensagem = estado === 'copiando'
    ? 'Copiando…'
    : estado === 'sucesso'
      ? tipo === 'chave' ? 'Chave copiada.' : 'Códigos copiados.'
      : estado === 'erro'
        ? `Não foi possível copiar. Selecione e copie manualmente ${tipo === 'chave' ? 'a chave exibida' : 'os códigos exibidos'}.`
        : '';

  return (
    <div className="grid gap-1.5">
      <Botao
        type="button"
        tamanho={compacto ? 'sm' : 'md'}
        variante="secundario"
        disabled={!texto}
        aria-disabled={copiando || undefined}
        aria-busy={copiando || undefined}
        aria-describedby={idStatus}
        onClick={() => void copiar()}
      >
        <Copy size={compacto ? 14 : 16} aria-hidden="true" /> {tipo === 'chave' ? 'Copiar chave' : 'Copiar códigos'}
      </Botao>
      <p id={idStatus} role="status" aria-atomic="true" className="text-sm text-texto-suave">{mensagem}</p>
    </div>
  );
}
