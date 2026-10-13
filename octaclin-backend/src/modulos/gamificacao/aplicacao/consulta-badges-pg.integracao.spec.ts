import { randomUUID } from "crypto";
import { DataSource, DataSourceOptions } from "typeorm";
import { criarOpcoesTypeOrm } from "../../../infraestrutura/banco-dados/opcoes-typeorm";
import { ExecutorTenant } from "../../../infraestrutura/banco-dados/executor-tenant";
import { ServicoGamificacao } from "./servico-gamificacao";
const executar =
  process.env.CI === "true" && process.env.RLS_PROVA_BANCO_HOST === "localhost";
(executar ? describe : describe.skip)(
  "badges legadas / PostgreSQL descartavel",
  () => {
    let owner: DataSource, runtime: DataSource;
    jest.setTimeout(60000);
    beforeAll(async () => {
      const opts = {
        ...criarOpcoesTypeOrm(),
        host: "localhost",
        port: 5432,
        username: "octaclin",
        password: "octaclin_local",
        database: "octaclin",
        ssl: false,
        synchronize: false,
        migrationsRun: false,
        logging: false,
      } as DataSourceOptions;
      owner = await new DataSource(opts).initialize();
      runtime = await new DataSource({
        ...opts,
        username: "octaclin_rls_prova",
        password: "octaclin_rls_prova_ci",
      } as DataSourceOptions).initialize();
    });
    afterAll(async () => {
      if (runtime?.isInitialized) await runtime.destroy();
      if (owner?.isInitialized) await owner.destroy();
    });
    it("consulta nao falha e exclui outro tenant e modelo317 textual/numerico", async () => {
      const [a] = await owner.query(
        "insert into tenants(nome,slug) values('Fixture badges A',$1) returning id",
        [randomUUID()],
      );
      const [b] = await owner.query(
        "insert into tenants(nome,slug) values('Fixture badges B',$1) returning id",
        [randomUUID()],
      );
      await owner.query(
        "insert into tenant_configuracoes(tenant_id,chave,valor) values($1,'gamificacao',$2)",
        [a.id, { metasBadgesHabilitados: true }],
      );
      for (const [tenant, nome, regra] of [
        [a.id, "Legada", {}],
        [a.id, "Piloto numero", { modelo: 317 }],
        [a.id, "Piloto texto", { modelo: "317" }],
        [b.id, "Outro tenant", {}],
      ]) {
        await owner.query(
          "insert into badges(tenant_id,nome,icone_svg,regra_conquista) values($1,$2,'<svg/>',$3)",
          [tenant, nome, regra],
        );
      }
      const r = await new ServicoGamificacao(
        new ExecutorTenant(runtime),
      ).listarBadges(a.id);
      expect(r.map((x) => x.nome)).toEqual(["Legada"]);
    });
  },
);
