import type { ProfissionalResumo } from "@/lib/cadastros-api";
export function IdentificadoresProfissional({
  profissional,
}: {
  profissional: Pick<ProfissionalResumo, "id" | "tenantId" | "usuarioId">;
}) {
  return (
    <details className="mt-2 text-xs text-texto-suave">
      <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria">
        Identificadores para suporte
      </summary>
      <dl className="mt-2 grid gap-2">
        {(
          [
            ["ID do profissional", profissional.id],
            ["ID da clínica", profissional.tenantId],
            ["ID do usuário", profissional.usuarioId],
          ] as const
        ).map(([nome, valor]) => (
          <div key={nome}>
            <dt>{nome}</dt>
            <dd className="break-all font-mono select-all">{valor}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
