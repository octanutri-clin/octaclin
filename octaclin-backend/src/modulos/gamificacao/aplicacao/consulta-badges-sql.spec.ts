import { DataSource } from "typeorm";
import { BadgeOrm } from "../infraestrutura/badge.orm";
import { TenantConfiguracaoOrm } from "../../tenancy/infraestrutura/tenant-configuracao.orm";
import { ServicoGamificacao } from "./servico-gamificacao";

describe("consulta SQL de conquistas legadas", () => {
  it("gera alias e coluna citados, mantendo filtro tenant e exclusao317", async () => {
    const ds = new DataSource({ type: "postgres", entities: [BadgeOrm] });
    await (
      ds as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();
    const repo = ds.getRepository(BadgeOrm);
    let sql = "";
    let params: unknown[] = [];
    jest.spyOn(repo, "find").mockImplementation(async (options) => {
      const qb = repo.createQueryBuilder("BadgeOrm").setFindOptions(options!);
      [sql, params] = qb.getQueryAndParameters();
      return [];
    });
    const manager = {
      getRepository: (e: unknown) =>
        e === TenantConfiguracaoOrm
          ? {
              findOne: async () => ({
                valor: { metasBadgesHabilitados: true },
              }),
            }
          : repo,
    };
    const executor = {
      executar: async (_t: string, fn: (m: unknown) => unknown) => fn(manager),
    };
    await new ServicoGamificacao(executor as never).listarBadges(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(sql).toContain('"BadgeOrm"."regra_conquista"');
    expect(sql).not.toContain("BadgeOrm.regraConquista");
    expect(sql).toContain('"BadgeOrm"."tenant_id"');
    expect(sql).toContain("->>'modelo'");
    expect(sql).toContain("<>'317'");
    expect(params).toContain("11111111-1111-4111-8111-111111111111");
  });
});
