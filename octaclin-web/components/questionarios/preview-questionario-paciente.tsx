'use client';

import { CheckCircle2, ImagePlus } from 'lucide-react';
import { Campo } from '@/components/ui/campo';
import { criarCampoPreview } from '@/lib/questionarios-preview';
import type { CampoPreview } from '@/lib/questionarios-preview';
import type { PerguntaEditor } from './tipos';

interface PreviewQuestionarioPacienteProps {
  titulo: string;
  descricao?: string;
  perguntas: PerguntaEditor[];
}

function escalaLikert(minimo: number, maximo: number) {
  const tamanho = Math.max(1, maximo - minimo + 1);
  return Array.from({ length: tamanho }, (_item, indice) => minimo + indice);
}

export function PreviewQuestionarioPaciente({ titulo, descricao, perguntas }: PreviewQuestionarioPacienteProps) {
  const campos = [...perguntas]
    .sort((a, b) => a.ordem - b.ordem)
    .map(criarCampoPreview);
  const secoes = campos.reduce<{ nome: string; campos: CampoPreview[] }[]>((grupos, campo) => {
    const existente = grupos.find((grupo) => grupo.nome === campo.secao);
    if (existente) existente.campos.push(campo);
    else grupos.push({ nome: campo.secao, campos: [campo] });
    return grupos;
  }, []);

  return (
    <section className="border border-linha bg-white">
      <div className="border-b border-linha px-4 py-3">
        <p className="text-xs font-semibold uppercase text-[#596273]">Preview do paciente</p>
        <h2 className="mt-1 text-lg font-semibold text-tinta">{titulo || 'Formulario sem titulo'}</h2>
        {descricao ? <p className="mt-1 text-sm text-[#596273]">{descricao}</p> : null}
      </div>

      <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-5">
        {secoes.length ? (
          secoes.map((secao) => (
            <section key={secao.nome} className="grid gap-3">
              <div className="border-b border-linha pb-2">
                <h3 className="text-sm font-semibold text-tinta">{secao.nome}</h3>
              </div>
              {secao.campos.map((campo, indice) => (
                <div key={campo.id} className="grid gap-3 rounded-lg border border-linha bg-[#fbfcfd] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-[#596273]">Pergunta {indice + 1}</p>
                      <h3 className="mt-1 text-base font-semibold text-tinta">{campo.enunciado}</h3>
                    </div>
                    {campo.obrigatoria ? (
                      <span className="shrink-0 rounded-md border border-[#b8dfc1] bg-[#eef7f0] px-2 py-1 text-xs font-medium text-[#245b33]">
                        Obrigatoria
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-[#596273]">{campo.ajuda}</p>

                  {campo.tipoEntrada === 'radio' || campo.tipoEntrada === 'checkbox' ? (
                    <div className="grid gap-2">
                      {campo.opcoes.map((opcao) => (
                        <label
                          key={opcao.valor}
                          className="flex min-h-10 items-center gap-3 rounded-md border border-linha bg-white px-3 py-2 text-sm"
                        >
                          <input type={campo.tipoEntrada} disabled className="h-4 w-4 accent-primaria" />
                          <span>{opcao.rotulo}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {campo.tipoEntrada === 'likert' ? (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between text-xs text-[#596273]">
                        <span>{String(campo.atributos.rotuloMin)}</span>
                        <span>{String(campo.atributos.rotuloMax)}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {escalaLikert(Number(campo.atributos.escalaMin), Number(campo.atributos.escalaMax)).map((valor) => (
                          <button
                            key={valor}
                            type="button"
                            disabled
                            className="h-10 rounded-md border border-linha bg-white text-sm font-semibold text-[#596273]"
                          >
                            {valor}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {campo.tipoEntrada === 'range' ? (
                    <div className="grid gap-2">
                      <input
                        type="range"
                        disabled
                        min={Number(campo.atributos.min)}
                        max={Number(campo.atributos.max)}
                        step={Number(campo.atributos.step)}
                        className="w-full accent-primaria"
                      />
                      <div className="flex justify-between text-xs text-[#596273]">
                        <span>{String(campo.atributos.min)}</span>
                        <span>{String(campo.atributos.max)}</span>
                      </div>
                    </div>
                  ) : null}

                  {campo.tipoEntrada === 'number' ? (
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <Campo
                        type="number"
                        disabled
                        min={Number(campo.atributos.min)}
                        max={Number(campo.atributos.max)}
                        step={Number(campo.atributos.step)}
                        placeholder={`${campo.atributos.min}`}
                      />
                      {campo.atributos.unidade ? (
                        <span className="text-sm font-medium text-[#596273]">{String(campo.atributos.unidade)}</span>
                      ) : null}
                    </div>
                  ) : null}

                  {campo.tipoEntrada === 'textarea' ? (
                    <textarea
                      disabled
                      maxLength={Number(campo.atributos.maxLength)}
                      placeholder={String(campo.atributos.placeholder ?? '')}
                      className="min-h-28 w-full resize-none rounded-md border border-linha bg-white px-3 py-2 text-sm"
                    />
                  ) : null}

                  {campo.tipoEntrada === 'file' ? (
                    <div className="flex min-h-24 items-center justify-center gap-2 rounded-md border border-dashed border-linha bg-white text-sm text-[#596273]">
                      <ImagePlus size={18} />
                      <span>
                        {String(campo.atributos.accept)} - ate {String(campo.atributos.maxArquivos)} arquivo(s)
                      </span>
                    </div>
                  ) : null}

                  {campo.tipoEntrada === 'sim_nao' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" disabled className="h-10 rounded-md border border-linha bg-white text-sm font-medium text-[#596273]">
                        {String(campo.atributos.rotuloSim)}
                      </button>
                      <button type="button" disabled className="h-10 rounded-md border border-linha bg-white text-sm font-medium text-[#596273]">
                        {String(campo.atributos.rotuloNao)}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          ))
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-linha text-sm text-[#596273]">
            Nenhuma pergunta para visualizar.
          </div>
        )}

        <button
          type="button"
          disabled
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primaria px-4 text-sm font-medium text-white"
        >
          <CheckCircle2 size={16} />
          Enviar respostas
        </button>
      </div>
    </section>
  );
}
