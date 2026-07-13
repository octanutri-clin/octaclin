export type TipoMidiaMobile = 'imagem' | 'audio' | 'video' | 'documento';

export function validarDuracaoMidia(tipo: TipoMidiaMobile, duracaoSegundos?: number): void {
  if (tipo === 'audio' && duracaoSegundos !== undefined && duracaoSegundos > 120) {
    throw new Error('Audio excede o limite de 2 minutos.');
  }

  if (tipo === 'video' && duracaoSegundos !== undefined && duracaoSegundos > 30) {
    throw new Error('Video excede o limite de 30 segundos.');
  }
}
