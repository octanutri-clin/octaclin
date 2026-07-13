export type StatusAdesaoPaciente = 'novo' | 'aderente' | 'risco' | 'inativo';

export class Paciente {
  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly profissionalResponsavelId: string,
    readonly nomeCriptografado: Buffer,
    readonly contatoCriptografado: Buffer | null,
    readonly dataNascimento: Date | null,
    readonly statusAdesao: StatusAdesaoPaciente,
    readonly scoreRisco: number
  ) {}
}
