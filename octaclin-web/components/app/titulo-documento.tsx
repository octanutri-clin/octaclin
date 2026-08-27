'use client';

import { useEffect } from 'react';

interface TituloDocumentoProps {
  titulo: string;
}

export function TituloDocumento({ titulo }: TituloDocumentoProps) {
  useEffect(() => {
    const tituloCompleto = `${titulo} | OctaClin`;
    document.title = tituloCompleto;

    return () => {
      if (document.title === tituloCompleto) document.title = 'OctaClin';
    };
  }, [titulo]);

  return null;
}
