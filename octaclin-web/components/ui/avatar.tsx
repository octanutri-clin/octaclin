import { cn } from '@/lib/utils';

const PALETA_AVATAR = [
  'bg-primaria-suave text-primaria-forte',
  'bg-sucesso-suave text-sucesso-forte',
  'bg-alerta-suave text-alerta-forte',
  'bg-perigo-suave text-perigo',
  'bg-neutro-200 text-neutro-700'
];

function corPorId(id: string) {
  let hash = 0;
  for (let indice = 0; indice < id.length; indice += 1) {
    hash = (hash * 31 + id.charCodeAt(indice)) >>> 0;
  }
  return PALETA_AVATAR[hash % PALETA_AVATAR.length];
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

interface AvatarProps {
  id: string;
  nome: string;
  tamanho?: 'sm' | 'md';
  className?: string;
}

export function Avatar({ id, nome, tamanho = 'md', className }: AvatarProps) {
  const dimensao = tamanho === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', dimensao, corPorId(id), className)}
    >
      {iniciais(nome)}
    </span>
  );
}
