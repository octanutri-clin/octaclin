import { tratarConfigIa318Operacoes } from "@/lib/server/rascunhos318-bff";
type Contexto = { params: Promise<{ id: string }> };
export async function GET(request: Request, contexto: Contexto) {
  return tratarConfigIa318Operacoes(request, (await contexto.params).id, "GET");
}
export async function PATCH(request: Request, contexto: Contexto) {
  return tratarConfigIa318Operacoes(
    request,
    (await contexto.params).id,
    "PATCH",
  );
}
