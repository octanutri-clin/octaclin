import { ServicoPilotoSintetico318 } from "./servico-piloto-sintetico318";
import { contextoSessao318 } from "../dominio/rascunhos-clinicos";
import { RascunhosClinicos1720000001071 } from "../../../infraestrutura/banco-dados/migracoes/1720000001071-RascunhosClinicos";
import { randomUUID } from "crypto";
import { DataSource, DataSourceOptions } from "typeorm";
import { criarOpcoesTypeOrm } from "../../../infraestrutura/banco-dados/opcoes-typeorm";
import { ExecutorTenant } from "../../../infraestrutura/banco-dados/executor-tenant";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
import { UsuarioAutenticado } from "../../auth/dominio/usuario-autenticado";
import { ConteudoRascunhos318, Modelo318 } from "../dominio/rascunhos-clinicos";
import { ContextoRascunhos318 } from "./contexto-rascunhos318";
import { ServicoRascunhosClinicosIa } from "./servico-rascunhos-clinicos";
// CI service only: never use operator DATABASE_URL or an external database.
const executar =
  process.env.CI === "true" && process.env.IA318_PG_DESCARTAVEL === "true";
(executar ? describe : describe.skip)(
  "318 PostgreSQL real / role sem BYPASSRLS",
  () => {
    let owner: DataSource,
      runtime: DataSource,
      base: ContextoRascunhos318,
      service: ServicoRascunhosClinicosIa,
      executor: ExecutorTenant;
    let u: UsuarioAutenticado,
      outro: UsuarioAutenticado,
      gestor: UsuarioAutenticado,
      prof: string,
      outroProf: string,
      paciente: string,
      tenantB: string;
    const modelo: Modelo318 = {
      id: "fixture",
      versao: "fixture-v1",
      nome: "Sintético",
      padrao: true,
      maxOutputTokens: 512,
      precoEntradaMilhaoUsd: 0,
      precoSaidaMilhaoUsd: 0,
      precoEm: "2026-10-13",
    };
    const crypto = new CriptografiaDadosSensiveis(),
      provider = {
        gerar: jest.fn(async () => ({
          itens: [{ texto: "Sem consulta anterior.", refs: ["F1"] }],
          limitacoes: [],
        })),
      };
    const env = process.env.IA_RASCUNHOS_OPERACAO_APROVADA;
    jest.setTimeout(60000);
    beforeAll(async () => {
      const options = {
        ...criarOpcoesTypeOrm(),
        host: "localhost",
        port: 5432,
        username: "octaclin",
        password: "octaclin_local",
        database: "octaclin",
        ssl: false,
        synchronize: false,
        logging: false,
        migrationsRun: false,
      } as DataSourceOptions;
      owner = await new DataSource(options).initialize();
      runtime = await new DataSource({
        ...options,
        username: "octaclin_rls_prova",
        password: "octaclin_rls_prova_ci",
      } as DataSourceOptions).initialize();
      executor = new ExecutorTenant(runtime);
      base = new ContextoRascunhos318(
        executor,
        new ConteudoRascunhos318(crypto),
        true,
        [modelo],
      );
      service = new ServicoRascunhosClinicosIa(base, provider as never, crypto);
      process.env.IA_RASCUNHOS_OPERACAO_APROVADA = "true";
      const [t] = await owner.query(
        "insert into tenants(nome,slug) values('Sintética318',$1) returning id",
        [randomUUID()],
      );
      const [t2] = await owner.query(
        "insert into tenants(nome,slug) values('Outra sintética318',$1) returning id",
        [randomUUID()],
      );
      tenantB = t2.id;
      const user = async (
        role: UsuarioAutenticado["papel"],
        permissoes: UsuarioAutenticado["permissoes"],
      ) => {
        const [r] = await owner.query(
          "insert into usuarios(tenant_id,email_hash,email_criptografado,senha_hash,role) values($1,$2,$3,'sintetica',$4) returning id",
          [t.id, randomUUID(), Buffer.from("fixture"), role],
        );
        return {
          tenantId: t.id,
          usuarioId: r.id,
          papel: role,
          permissoes,
          emailHash: "",
        };
      };
      u = await user("Professional", ["ia.executar", "pacientes.gerenciar"]);
      gestor = await user("Client", ["cliente.configuracoes.gerenciar"]);
      outro = await user("Professional", [
        "ia.executar",
        "pacientes.gerenciar",
      ]);
      const profile = async (id: string) => {
        const [r] = await owner.query(
          "insert into profissionais(tenant_id,usuario_id,nome_criptografado) values($1,$2,$3) returning id",
          [t.id, id, crypto.criptografar("Sintético")],
        );
        return r.id;
      };
      prof = await profile(u.usuarioId);
      outroProf = await profile(outro.usuarioId);
      const [p] = await owner.query(
        "insert into pacientes(tenant_id,profissional_responsavel_id,nome_criptografado,data_nascimento) values($1,$2,$3,'1990-01-01') returning id",
        [t.id, prof, crypto.criptografar("Paciente sintético")],
      );
      paciente = p.id;
      await base.configurar(gestor, {
        contextoSessao: contextoSessao318(gestor),
        habilitada: true,
        versaoEsperada: 0,
      });
      await base.definirCredencial(u, {
        chave: "fixture-segredo",
        contextoSessao: contextoSessao318(u),
        versaoEsperada: 0,
      });
    });
    beforeEach(async () => {
      await owner.query(
        "update comandos_ia318 set criado_em=now()-interval '16 minutes' where tenant_id=$1 and acao='gerar'",
        [u.tenantId],
      );
    });
    afterAll(async () => {
      if (env === undefined) delete process.env.IA_RASCUNHOS_OPERACAO_APROVADA;
      else process.env.IA_RASCUNHOS_OPERACAO_APROVADA = env;
      await runtime?.destroy();
      await owner?.destroy();
    });
    it("piloto sintetico: quota transacional concorrente e RLS sem paciente ficticio", async () => {
      const piloto = new ServicoPilotoSintetico318(base, provider as never, {
        ativo: true,
        direitos: true,
        modelos: [modelo],
      });
      const reserva = (nonce: string) =>
        executor.executar(u.tenantId, async (m) => {
          await m.query(
            "select pg_advisory_xact_lock(hashtextextended($1,0))",
            [`gamificacao317:${u.tenantId}`],
          );
          return piloto.reservar(
            {
              m,
              u,
              profissionalId: prof,
              profissionalVersao: "0",
              usuarioVersao: "0",
              tenantVersao: "0",
            },
            nonce,
          );
        });
      const nonce = randomUUID();
      const r = await Promise.allSettled([reserva(nonce), reserva(nonce)]);
      expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(r.filter((x) => x.status === "rejected")).toHaveLength(1);
      const chave = `ia318_piloto_quota:${u.usuarioId}`;
      const [row] = await executor.executar(u.tenantId, (m) =>
        m.query(
          "select valor from tenant_configuracoes where tenant_id=$1 and chave=$2",
          [u.tenantId, chave],
        ),
      );
      expect(row.valor.comandos).toHaveLength(1);
      expect(
        await executor.executar(tenantB, (m) =>
          m.query("select valor from tenant_configuracoes where chave=$1", [
            chave,
          ]),
        ),
      ).toEqual([]);
      await expect(
        executor.executar(tenantB, (m) =>
          m.query(
            "insert into tenant_configuracoes(tenant_id,chave,valor) values($1,'ia318_piloto_sintetico',$2)",
            [u.tenantId, { habilitada: true }],
          ),
        ),
      ).rejects.toThrow();
      // Quota remains shared across processes even after the cooldown ends.
      await owner.query(
        `update tenant_configuracoes set valor=jsonb_set(valor,'{ocupadoAte}','0') where tenant_id=$1 and chave=$2`,
        [u.tenantId, chave],
      );
      for (let i = 0; i < 4; i++) {
        await reserva(randomUUID());
        await owner.query(
          `update tenant_configuracoes set valor=jsonb_set(valor,'{ocupadoAte}','0') where tenant_id=$1 and chave=$2`,
          [u.tenantId, chave],
        );
      }
      await expect(reserva(randomUUID())).rejects.toThrow("limite");
    });
    it("piloto sintetico: grant, SID, tenant e revogacao revalidados no servico real", async () => {
      const [sessao] = await owner.query(
        "insert into sessoes_usuario(tenant_id,usuario_id,expira_em) values($1,$2,now()+interval '1 hour') returning id",
        [u.tenantId, u.usuarioId],
      );
      const ator = { ...u, sessaoId: sessao.id };
      const permitir = (habilitada: boolean, versao: number) =>
        owner.query(
          "insert into tenant_configuracoes(tenant_id,chave,valor) values($1,'ia318_piloto_sintetico',$2) on conflict(tenant_id,chave) do update set valor=excluded.valor",
          [
            u.tenantId,
            {
              habilitada,
              versao,
              usuarioId: u.usuarioId,
              profissionalId: prof,
            },
          ],
        );
      await permitir(true, 1);
      const externo = {
        gerar: jest.fn(async () => ({
          itens: [{ texto: "Peso sintético", refs: ["F1"] }],
          limitacoes: [],
        })),
      };
      const piloto = new ServicoPilotoSintetico318(base, externo as never, {
        ativo: true,
        direitos: true,
        modelos: [modelo],
      });
      const p = await piloto.previa(ator, {
        casoId: "C06",
        contextoSessao: contextoSessao318(ator),
      });
      expect(p.baseline.itens[0].texto).toContain("70,4 kg");
      expect(externo.gerar).not.toHaveBeenCalled();
      for (const invalido of [
        { ...ator, tenantId: tenantB },
        { ...ator, usuarioId: outro.usuarioId },
        { ...ator, sessaoId: undefined },
      ])
        await expect(piloto.catalogo(invalido)).rejects.toThrow();
      await permitir(false, 2);
      await expect(piloto.catalogo(ator)).rejects.toThrow();
      await permitir(true, 3);
      await expect(
        piloto.gerar(ator, {
          prova: p.prova,
          modeloId: modelo.id,
          modalidade: "pre_consulta",
          aceiteCobranca: true,
        }),
      ).rejects.toThrow("Contexto");
      expect(externo.gerar).not.toHaveBeenCalled();
      await owner.query(
        "update sessoes_usuario set revogado_em=now(),motivo_revogacao='logout' where id=$1",
        [ator.sessaoId],
      );
      await expect(piloto.catalogo(ator)).rejects.toThrow("Sessão");
    });
    const dado = () => ({
      contextoSessao: contextoSessao318(u),
      chaveComando: randomUUID(),
      modeloId: modelo.id,
      selecoes: [{ tipo: "preparacao" as const, id: "resumo" }],
    });
    const confirmar = (provaRevisao: string) => ({
      chaveComando: randomUUID(),
      provaRevisao,
      titulo: "Sintético",
      conteudo: "Texto sintético revisado.",
      confirmado: true,
    });
    it("tenant vazio depois de reset nao expoe linhas nem causa cast UUID", async () => {
      const q = runtime.createQueryRunner();
      await q.connect();
      await q.startTransaction();
      try {
        await q.query("select set_config('app.tenant_id','',true)");
        for (const tabela of [
          "credenciais_ia318",
          "comandos_ia318",
          "proveniencias_ia318",
        ]) {
          const [row] = await q.query(
            `select count(*)::int total from ${tabela}`,
          );
          expect(row.total).toBe(0);
        }
      } finally {
        await q.rollbackTransaction();
        await q.release();
      }
    });
    it("marcador antigo bloqueia fontes geracao e configuracao antes de gravar", async () => {
      provider.gerar.mockClear();
      const nonce = randomUUID();
      await expect(
        service.gerar(
          u,
          paciente,
          { ...dado(), chaveComando: nonce, contextoSessao: "b".repeat(64) },
          "evolucao",
        ),
      ).rejects.toThrow("sessão");
      await expect(service.fontes(u, paciente, "b".repeat(64))).rejects.toThrow(
        "sessão",
      );
      await expect(
        base.configurar(gestor, {
          habilitada: false,
          versaoEsperada: 1,
          contextoSessao: "b".repeat(64),
        }),
      ).rejects.toThrow("sessão");
      expect(provider.gerar).not.toHaveBeenCalled();
      const [row] = await owner.query(
        "select count(*)::int total from comandos_ia318 where chave=$1",
        [nonce],
      );
      expect(row.total).toBe(0);
      expect((await base.configurar(gestor)).versao).toBe(1);
    });
    it("RLS FORCE protege todas as tabelas e nega insert de outro tenant", async () => {
      const flags = await owner.query(
        "select relname,relrowsecurity,relforcerowsecurity from pg_class where relname=any($1)",
        [["credenciais_ia318", "comandos_ia318", "proveniencias_ia318"]],
      );
      expect(flags).toHaveLength(3);
      expect(
        flags.every((r: any) => r.relrowsecurity && r.relforcerowsecurity),
      ).toBe(true);
      const [role] = await runtime.query(
        "select rolsuper,rolbypassrls from pg_roles where rolname=current_user",
      );
      expect(role).toMatchObject({ rolsuper: false, rolbypassrls: false });
      expect(
        await executor.executar(tenantB, (m) =>
          m.query("select * from credenciais_ia318"),
        ),
      ).toEqual([]);
      await expect(
        executor.executar(tenantB, (m) =>
          m.query(
            "insert into credenciais_ia318(tenant_id,profissional_id,usuario_id) values($1,$2,$3)",
            [u.tenantId, prof, u.usuarioId],
          ),
        ),
      ).rejects.toThrow();
    });
    it("A→B→A por SQL invalida monotonicamente previa e retorno do fornecedor", async () => {
      const p = await service.gerar(u, paciente, dado(), "evolucao");
      await owner.query(
        "update pacientes set profissional_responsavel_id=$2 where id=$1",
        [paciente, outroProf],
      );
      await owner.query(
        "update pacientes set profissional_responsavel_id=$2,versao_contexto_ia318=0 where id=$1",
        [paciente, prof],
      );
      const [r] = await owner.query(
        "select versao_contexto_ia318 from pacientes where id=$1",
        [paciente],
      );
      expect(Number(r.versao_contexto_ia318)).toBeGreaterThanOrEqual(2);
      await expect(
        service.confirmar(u, paciente, confirmar(p.provaRevisao)),
      ).rejects.toThrow("Contexto");
      provider.gerar.mockImplementationOnce(async () => {
        await owner.query(
          "update pacientes set profissional_responsavel_id=$2 where id=$1",
          [paciente, outroProf],
        );
        await owner.query(
          "update pacientes set profissional_responsavel_id=$2 where id=$1",
          [paciente, prof],
        );
        return {
          itens: [{ texto: "Sem consulta anterior.", refs: ["F1"] }],
          limitacoes: [],
        };
      });
      await expect(
        service.gerar(u, paciente, dado(), "evolucao"),
      ).rejects.toThrow();
      await owner.query(
        "update pacientes set profissional_responsavel_id=$2 where id=$1",
        [paciente, prof],
      );
    });
    it("duas confirmações concorrentes criam uma única evolução cifrada e proveniência imutável", async () => {
      const p = await service.gerar(u, paciente, dado(), "evolucao"),
        d = confirmar(p.provaRevisao);
      const [a, b] = await Promise.all([
        service.confirmar(u, paciente, d),
        service.confirmar(u, paciente, { ...d, chaveComando: randomUUID() }),
      ]);
      expect(a.id).toBe(b.id);
      const [r] = await owner.query(
        "select snapshot_criptografado from proveniencias_ia318 where evolucao_id=$1",
        [a.id],
      );
      expect(r.snapshot_criptografado.toString()).not.toContain(
        "Texto sintético",
      );
      await expect(
        executor.executar(u.tenantId, (m) =>
          m.query(
            "update proveniencias_ia318 set snapshot_criptografado=$2 where evolucao_id=$1",
            [a.id, Buffer.from("x")],
          ),
        ),
      ).rejects.toThrow("Proveniencia");
      await expect(
        service.confirmar(u, paciente, { ...d, conteudo: "Texto diferente" }),
      ).rejects.toThrow("Comando");
    });
    it("transação falha não preserva evolução parcial", async () => {
      const previa = await service.gerar(u, paciente, dado(), "evolucao"),
        d = confirmar(previa.provaRevisao);
      const before = await owner.query(
        "select id from evolucoes_clinicas where tenant_id=$1 and paciente_id=$2",
        [u.tenantId, paciente],
      );
      const real = executor.executar.bind(executor);
      const spy = jest
        .spyOn(executor, "executar")
        .mockImplementation((tenant, op) =>
          real(tenant, async (m) => {
            const result = await op(m);
            throw new Error("falha sintética após escrita");
            return result;
          }),
        );
      try {
        await expect(service.confirmar(u, paciente, d)).rejects.toThrow();
      } finally {
        spy.mockRestore();
      }
      expect(
        await owner.query(
          "select id from evolucoes_clinicas where tenant_id=$1 and paciente_id=$2",
          [u.tenantId, paciente],
        ),
      ).toEqual(before);
    });
    it("desativação de usuário e gate negam replay antes da resposta clínica", async () => {
      const p = await service.gerar(u, paciente, dado(), "evolucao"),
        d = confirmar(p.provaRevisao);
      await service.confirmar(u, paciente, d);
      await owner.query("update usuarios set ativo=false where id=$1", [
        u.usuarioId,
      ]);
      await expect(service.confirmar(u, paciente, d)).rejects.toThrow();
      await owner.query("update usuarios set ativo=true where id=$1", [
        u.usuarioId,
      ]);
      await base.configurar(gestor, {
        contextoSessao: contextoSessao318(gestor),
        habilitada: false,
        versaoEsperada: 1,
      });
      await expect(service.confirmar(u, paciente, d)).rejects.toThrow();
      await base.configurar(gestor, {
        contextoSessao: contextoSessao318(gestor),
        habilitada: true,
        versaoEsperada: 2,
      });
    });
    it("outro profissional e tenant nao acessam fontes ou confirmam prova", async () => {
      const p = await service.gerar(u, paciente, dado(), "evolucao");
      expect(await base.obterCredencial(outro)).toEqual({
        estado: "ausente",
        versao: 0,
      });
      await expect(
        service.fontes(outro, paciente, contextoSessao318(outro)),
      ).rejects.toThrow();
      await expect(
        service.confirmar(outro, paciente, confirmar(p.provaRevisao)),
      ).rejects.toThrow();
      await expect(
        service.fontes(
          { ...u, tenantId: tenantB },
          paciente,
          contextoSessao318(u),
        ),
      ).rejects.toThrow();
    });
    it("CAS real permite apenas uma substituicao concorrente e invalida previa", async () => {
      const p = await service.gerar(u, paciente, dado(), "evolucao");
      const r = await Promise.allSettled([
        base.definirCredencial(u, {
          chave: "fixture-nova-a",
          contextoSessao: contextoSessao318(u),
          versaoEsperada: 1,
        }),
        base.definirCredencial(u, {
          chave: "fixture-nova-b",
          contextoSessao: contextoSessao318(u),
          versaoEsperada: 1,
        }),
      ]);
      expect(r.filter((v) => v.status === "fulfilled")).toHaveLength(1);
      expect(r.filter((v) => v.status === "rejected")).toHaveLength(1);
      await expect(
        service.confirmar(u, paciente, confirmar(p.provaRevisao)),
      ).rejects.toThrow("Contexto");
    });
    it("quota real bloqueia sexta chamada na janela sem acessar fornecedor", async () => {
      const antes = provider.gerar.mock.calls.length;
      for (let i = 0; i < 5; i++)
        await service.gerar(u, paciente, dado(), "pre_consulta");
      await expect(
        service.gerar(u, paciente, dado(), "pre_consulta"),
      ).rejects.toThrow("Limite");
      expect(provider.gerar.mock.calls.length - antes).toBe(5);
    });

    it("rollback owner com dados recusa DDL e role runtime não ignora RLS", async () => {
      const runner = owner.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await expect(
          new RascunhosClinicos1720000001071().down(runner),
        ).rejects.toThrow("Não reverter");
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
      const limited = runtime.createQueryRunner();
      await limited.connect();
      await limited.startTransaction();
      try {
        await expect(
          new RascunhosClinicos1720000001071().down(limited),
        ).rejects.toThrow("RLS");
      } finally {
        await limited.rollbackTransaction();
        await limited.release();
      }
    });

    it("ciclo de vida e reativacao do tenant nao restauram previa", async () => {
      const p = await service.gerar(u, paciente, dado(), "evolucao");
      await owner.query(
        "update tenants set ciclo_vida_status='suspenso' where id=$1",
        [u.tenantId],
      );
      await expect(
        service.fontes(u, paciente, contextoSessao318(u)),
      ).rejects.toThrow();
      await owner.query(
        "update tenants set ciclo_vida_status='ativo',versao_contexto_ia318=0 where id=$1",
        [u.tenantId],
      );
      await expect(
        service.confirmar(u, paciente, confirmar(p.provaRevisao)),
      ).rejects.toThrow("Contexto");
    });
  },
);
