import { LucideIcon } from 'lucide-react';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';

interface ModuloPlaceholderProps {
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  itens: string[];
}

export function ModuloPlaceholder({ titulo, descricao, icone: Icone, itens }: ModuloPlaceholderProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Cartao>
        <CartaoConteudo>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primaria-suave text-primaria">
            <Icone size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{titulo}</h2>
            <p className="text-sm text-texto-suave">{descricao}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2">
          {itens.map((item) => (
            <div key={item} className="rounded-md border border-linha bg-fundo px-3 py-2 text-sm">
              {item}
            </div>
          ))}
        </div>
        </CartaoConteudo>
      </Cartao>
      <Cartao>
        <CartaoConteudo>
        <h3 className="text-sm font-semibold">Próximo incremento</h3>
        <p className="mt-2 text-sm text-texto-suave">
          Este módulo já esta posicionado na navegacao. A próxima etapa e conectar a tela aos endpoints do backend e
          substituir estes estados por dados reais.
        </p>
        </CartaoConteudo>
      </Cartao>
    </section>
  );
}
