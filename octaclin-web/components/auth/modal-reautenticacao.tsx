'use client';

import { FormEvent, useState } from 'react';
import { reautenticar } from '@/lib/auth-api';
import { Modal } from '@/components/ui/modal';
import { Botao } from '@/components/ui/botao';
import { CampoSenha } from '@/components/auth/campo-senha';
import { Rotulo } from '@/components/ui/campo';

interface Props {
  aberto: boolean;
  titulo: string;
  descricao: string;
  rotuloConfirmar: string;
  aoCancelar: () => void;
  aoConfirmar: () => Promise<void> | void;
}

export function ModalReautenticacao({ aberto, titulo, descricao, rotuloConfirmar, aoCancelar, aoConfirmar }: Props) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string>();
  const [processando, setProcessando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(undefined);
    setProcessando(true);
    try {
      await reautenticar(senha);
      await aoConfirmar();
      setSenha('');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível confirmar sua identidade.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoCancelar} titulo={titulo} descricao={descricao}>
      <form className="grid gap-4" onSubmit={enviar}>
        <div className="grid gap-1.5">
          <Rotulo htmlFor="senha-reautenticacao">Confirme sua senha</Rotulo>
          <CampoSenha
            id="senha-reautenticacao"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            autoComplete="current-password"
            required
            autoFocus
          />
        </div>
        {erro ? <div role="alert" className="text-sm text-perigo">{erro}</div> : null}
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={aoCancelar} disabled={processando}>Cancelar</Botao>
          <Botao type="submit" variante="perigo" carregando={processando}>{rotuloConfirmar}</Botao>
        </div>
      </form>
    </Modal>
  );
}
