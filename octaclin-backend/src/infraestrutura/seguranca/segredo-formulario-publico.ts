export function obterSegredoFormularioPublico(): string {
  const segredo = process.env.FORMULARIO_PUBLICO_SEGREDO?.trim();
  if (segredo) {
    if (process.env.NODE_ENV === 'production' && Buffer.byteLength(segredo, 'utf8') < 32) {
      throw new Error('FORMULARIO_PUBLICO_SEGREDO precisa ter pelo menos 32 bytes em producao.');
    }
    return segredo;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FORMULARIO_PUBLICO_SEGREDO e obrigatorio em producao.');
  }
  return 'dev-formulario-publico-secret';
}
