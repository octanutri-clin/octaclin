/** Apenas pesquisa: funções originais WHO, hashes antes de executar, sem runtime. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
(async () => {
  const [tool, sources, output] = process.argv.slice(2);
  if (!tool || !sources || !output) throw new Error('Informe ferramentas/fontes/saída locais.');
  const hashes = {
    'who-helper.R': 'a5c9889721d1194552c9a07f84aeb01ad2cbf748082320fcdbbec17d96cebd67',
    'who-wfl.R': '10bcca5384aaf51ffc43fd5286984ce81c129f2582f91f98f15d91fb8110d4cb',
    'utils.R': 'deb236da3fb7f8445febad61b61a04def980d4b92452d597274025311a6ae249',
    'assertions.R': 'e09b9a0133578adec07e1bf841f9ea3b657bfad1f55fa443f90cea78738a78ab',
  };
  for (const [name, hash] of Object.entries(hashes)) {
    if (crypto.createHash('sha256').update(fs.readFileSync(path.join(sources, name))).digest('hex') !== hash) throw new Error('Fonte divergente: '+name);
  }
  const { WebR } = require(path.resolve(tool));
  const r = new WebR({ baseUrl: path.dirname(path.resolve(tool))+path.sep, interactive: false });
  await r.init();
  try {
    for (const name of Object.keys(hashes)) await r.FS.writeFile('/'+name, new Uint8Array(fs.readFileSync(path.join(sources, name))));
    for (const name of ['parametros-wfl.csv', 'parametros-wfh.csv', 'entradas-oms2006.csv']) await r.FS.writeFile('/'+name, new Uint8Array(fs.readFileSync(path.join(output, name))));
    await r.evalRVoid(`source('/utils.R'); source('/assertions.R'); source('/who-helper.R'); source('/who-wfl.R')
      d <- read.csv('/entradas-oms2006.csv')
      l <- read.csv('/parametros-wfl.csv'); h <- read.csv('/parametros-wfh.csv')
      d$cm_normalizado <- adjust_lenhei(d$dias, d$tecnica, d$cm_original)
      result <- anthro_zscore_weight_for_lenhei(d$peso, d$cm_normalizado, d$tecnica,
        d$dias, d$dias/30.4375, d$sexo, rep('n', nrow(d)), growthstandards_wfl=l, growthstandards_wfh=h)
      d$z_oficial <- result$zwfl
      write.csv(d, '/oraculo.csv', row.names=FALSE, na='NA')`);
    fs.writeFileSync(path.join(output, 'oraculo-oms2006-oficial.csv'), await r.FS.readFile('/oraculo.csv'));
    console.log(await r.evalRString('R.version.string'));
  } finally { await r.close(); }
})().catch(e => { console.error(e.message); process.exitCode=1; });
