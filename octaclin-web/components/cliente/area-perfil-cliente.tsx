'use client';

import { ChangeEventHandler } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Save } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho } from '@/components/ui/cartao';
import { AtualizarPerfilEmpresaClienteEntrada } from '@/lib/cliente-api';
import { formatarData } from './portal-cliente-dominio';
import { PortalClienteController } from './use-portal-cliente';

type Props = { portal: PortalClienteController };

type CampoTextoProps = {
  rotulo: string;
  valor: string;
  aoMudar: ChangeEventHandler<HTMLInputElement>;
  className?: string;
  inputClassName?: string;
  type?: 'email' | 'text';
  required?: boolean;
  maxLength?: number;
};

function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  className,
  inputClassName,
  type = 'text',
  required,
  maxLength
}: CampoTextoProps) {
  return (
    <label className={`grid gap-1 text-xs font-semibold text-texto-suave${className ? ` ${className}` : ''}`}>
      {rotulo}
      <input
        className={`h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta${
          inputClassName ? ` ${inputClassName}` : ''
        }`}
        type={type}
        value={valor}
        onChange={aoMudar}
        required={required}
        maxLength={maxLength}
      />
    </label>
  );
}

export function AreaPerfilCliente({ portal }: Props) {
  const {
    areaAtiva,
    podeGerenciarConfiguracoes,
    carregandoPerfilEmpresa,
    perfilEmpresa,
    erroPerfilEmpresa,
    sucessoPerfilEmpresa,
    formularioPerfilEmpresa,
    setFormularioPerfilEmpresa,
    salvandoPerfilEmpresa,
    salvarPerfilEmpresa
  } = portal;
  if (!podeGerenciarConfiguracoes || areaAtiva !== 'fiscal') return null;

  return (
    <Cartao id="perfil-fiscal" className="scroll-mt-4" aria-busy={carregandoPerfilEmpresa}>
      <CartaoCabecalho>
        <FileText className="h-4 w-4 text-texto-suave" />
        <div>
          <h2 className="text-sm font-semibold">Perfil fiscal</h2>
          <p className="mt-1 text-sm text-texto-suave">
            {perfilEmpresa
              ? `Atualizado em ${formatarData(perfilEmpresa.atualizadoEm)}`
              : 'Carregando dados fiscais da conta'}
          </p>
        </div>
      </CartaoCabecalho>
      <form onSubmit={salvarPerfilEmpresa} className="grid gap-4 p-4">
        {erroPerfilEmpresa ? (
          <div className="flex items-center gap-2 rounded-lg border border-perigo-borda bg-perigo-suave px-4 py-3 text-sm text-perigo">
            <AlertTriangle size={16} />
            {erroPerfilEmpresa}
          </div>
        ) : null}
        {sucessoPerfilEmpresa ? (
          <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
            <CheckCircle2 size={16} />
            {sucessoPerfilEmpresa}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Tipo de pessoa
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={formularioPerfilEmpresa.tipoPessoa}
              onChange={(evento) =>
                setFormularioPerfilEmpresa((atual) => ({
                  ...atual,
                  tipoPessoa: evento.target.value as AtualizarPerfilEmpresaClienteEntrada['tipoPessoa']
                }))
              }
            >
              <option value="pj">Pessoa juridica</option>
              <option value="pf">Pessoa fisica</option>
            </select>
          </label>
          <CampoTexto
            rotulo="Documento fiscal"
            valor={formularioPerfilEmpresa.documento}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({ ...atual, documento: evento.target.value }))
            }
            maxLength={32}
          />
          <CampoTexto
            rotulo="Nome legal"
            valor={formularioPerfilEmpresa.nomeLegal}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({ ...atual, nomeLegal: evento.target.value }))
            }
            required
            maxLength={180}
          />
          <CampoTexto
            rotulo="Nome fantasia"
            valor={formularioPerfilEmpresa.nomeFantasia}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({ ...atual, nomeFantasia: evento.target.value }))
            }
            maxLength={180}
          />
          <CampoTexto
            rotulo="Inscricao estadual"
            valor={formularioPerfilEmpresa.inscricaoEstadual}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({ ...atual, inscricaoEstadual: evento.target.value }))
            }
            maxLength={40}
          />
          <CampoTexto
            rotulo="Inscricao municipal"
            valor={formularioPerfilEmpresa.inscricaoMunicipal}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({ ...atual, inscricaoMunicipal: evento.target.value }))
            }
            maxLength={40}
          />
        </div>

        <div className="grid gap-3 rounded-md border border-linha bg-superficie p-3 md:grid-cols-2">
          <CampoTexto
            rotulo="Responsável"
            valor={formularioPerfilEmpresa.responsavel.nome}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                responsavel: { ...atual.responsavel, nome: evento.target.value }
              }))
            }
            maxLength={120}
          />
          <CampoTexto
            rotulo="Email do responsável"
            type="email"
            valor={formularioPerfilEmpresa.responsavel.email}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                responsavel: { ...atual.responsavel, email: evento.target.value }
              }))
            }
            maxLength={180}
          />
          <CampoTexto
            rotulo="Telefone do responsável"
            valor={formularioPerfilEmpresa.responsavel.telefone}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                responsavel: { ...atual.responsavel, telefone: evento.target.value }
              }))
            }
            maxLength={40}
          />
          <CampoTexto
            rotulo="Cargo"
            valor={formularioPerfilEmpresa.responsavel.cargo}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                responsavel: { ...atual.responsavel, cargo: evento.target.value }
              }))
            }
            maxLength={80}
          />
        </div>

        <div className="grid gap-3 rounded-md border border-linha bg-superficie p-3 md:grid-cols-4">
          <CampoTexto
            rotulo="CEP"
            className="md:col-span-1"
            valor={formularioPerfilEmpresa.endereco.cep}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                endereco: { ...atual.endereco, cep: evento.target.value }
              }))
            }
            maxLength={20}
          />
          <CampoTexto
            rotulo="Logradouro"
            className="md:col-span-2"
            valor={formularioPerfilEmpresa.endereco.logradouro}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                endereco: { ...atual.endereco, logradouro: evento.target.value }
              }))
            }
            maxLength={160}
          />
          <CampoTexto
            rotulo="Número"
            valor={formularioPerfilEmpresa.endereco.numero}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                endereco: { ...atual.endereco, numero: evento.target.value }
              }))
            }
            maxLength={30}
          />
          <CampoTexto
            rotulo="Complemento"
            className="md:col-span-2"
            valor={formularioPerfilEmpresa.endereco.complemento}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                endereco: { ...atual.endereco, complemento: evento.target.value }
              }))
            }
            maxLength={120}
          />
          <CampoTexto
            rotulo="Bairro"
            valor={formularioPerfilEmpresa.endereco.bairro}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                endereco: { ...atual.endereco, bairro: evento.target.value }
              }))
            }
            maxLength={120}
          />
          <CampoTexto
            rotulo="Cidade"
            valor={formularioPerfilEmpresa.endereco.cidade}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                endereco: { ...atual.endereco, cidade: evento.target.value }
              }))
            }
            maxLength={120}
          />
          <CampoTexto
            rotulo="UF"
            inputClassName="uppercase"
            valor={formularioPerfilEmpresa.endereco.uf}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                endereco: { ...atual.endereco, uf: evento.target.value.toUpperCase() }
              }))
            }
            maxLength={2}
          />
          <CampoTexto
            rotulo="Pais"
            inputClassName="uppercase"
            valor={formularioPerfilEmpresa.endereco.pais}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                endereco: { ...atual.endereco, pais: evento.target.value.toUpperCase() }
              }))
            }
            maxLength={2}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <CampoTexto
            rotulo="Email financeiro"
            type="email"
            valor={formularioPerfilEmpresa.contatos.emailFinanceiro}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                contatos: { ...atual.contatos, emailFinanceiro: evento.target.value }
              }))
            }
            maxLength={180}
          />
          <CampoTexto
            rotulo="Telefone financeiro"
            valor={formularioPerfilEmpresa.contatos.telefoneFinanceiro}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                contatos: { ...atual.contatos, telefoneFinanceiro: evento.target.value }
              }))
            }
            maxLength={40}
          />
          <CampoTexto
            rotulo="WhatsApp atendimento"
            valor={formularioPerfilEmpresa.contatos.whatsappAtendimento}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                contatos: { ...atual.contatos, whatsappAtendimento: evento.target.value }
              }))
            }
            maxLength={40}
          />
          <CampoTexto
            rotulo="Email atendimento"
            type="email"
            valor={formularioPerfilEmpresa.contatos.emailAtendimento}
            aoMudar={(evento) =>
              setFormularioPerfilEmpresa((atual) => ({
                ...atual,
                contatos: { ...atual.contatos, emailAtendimento: evento.target.value }
              }))
            }
            maxLength={180}
          />
        </div>

        <div className="grid gap-3 rounded-md border border-linha bg-superficie p-3">
          <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={formularioPerfilEmpresa.fiscal.prepararRecibos}
              onChange={(evento) =>
                setFormularioPerfilEmpresa((atual) => ({
                  ...atual,
                  fiscal: { ...atual.fiscal, prepararRecibos: evento.target.checked }
                }))
              }
            />
            Preparar base para recibos
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Observações fiscais
            <textarea
              className="min-h-24 rounded-md border border-linha bg-white px-3 py-2 text-sm font-normal text-tinta"
              value={formularioPerfilEmpresa.fiscal.observacoes}
              onChange={(evento) =>
                setFormularioPerfilEmpresa((atual) => ({
                  ...atual,
                  fiscal: { ...atual.fiscal, observacoes: evento.target.value }
                }))
              }
              maxLength={500}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <Botao type="submit" variante="primario" disabled={salvandoPerfilEmpresa || carregandoPerfilEmpresa}>
            <Save size={16} />
            {salvandoPerfilEmpresa ? 'Salvando' : 'Salvar perfil fiscal'}
          </Botao>
        </div>
      </form>
    </Cartao>
  );
}
