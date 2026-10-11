/** Executa fontes R oficiais em WASM temporário; não copia o código ao produto.
 * Uso: node arquivo.cjs /tmp/webR/package/dist/webr.cjs /tmp/fontes /tmp/evidencias
 * webR0.2.0 / R4.3.0 são ferramentas de pesquisa, sem dependência no package.json.
 */
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
(async()=>{
 const [tool, sources, output]=process.argv.slice(2);
 if (!tool||!sources||!output) throw new Error('Informe ferramentas/fontes/saída de pesquisa locais.');
 const hashes={'who-helper.R':'a5c9889721d1194552c9a07f84aeb01ad2cbf748082320fcdbbec17d96cebd67','anthroplus-zscores.R':'43bfdb016455c057b0ee986c0d4fb0b2a7733e19f0e74821aee9d3d0aece0c41','who2007-bfa.txt':'70ef3260df08e48ce560c28cff4e733db78fb952cbd881eba63c9d3a15f38a6a','who2007-hfa.txt':'9ac02aa4908f8ec3c6ba2362a4c7e1356043408b2873548ca22eedc016c235ad','who2007-wfa.txt':'9234dc640ba54001a9afd42ef15ab675b211a721c8f3c0a07c3431fd9cea0e1c'};
 for (const [name,hash] of Object.entries(hashes)) if (crypto.createHash('sha256').update(fs.readFileSync(path.join(sources,name))).digest('hex')!==hash) throw new Error('Fonte oficial divergente: '+name);
 const {WebR}=require(path.resolve(tool));
 const r=new WebR({baseUrl:path.dirname(path.resolve(tool))+path.sep,interactive:false});
 await r.init();
 try {
  for (const n of ['who-helper.R','anthroplus-zscores.R','who2007-bfa.txt','who2007-hfa.txt','who2007-wfa.txt']) await r.FS.writeFile('/'+n,new Uint8Array(fs.readFileSync(path.join(sources,n))));
  await r.FS.writeFile('/inputs.csv',new Uint8Array(fs.readFileSync(path.join(output,'entradas-oms2007.csv'))));
  await r.evalRVoid(`source('/who-helper.R'); source('/anthroplus-zscores.R')
    anthro_api_compute_zscore_adjusted <- compute_zscore_adjusted
    anthro_api_compute_zscore <- compute_zscore
    bfa_growth_standards <- read.delim('/who2007-bfa.txt')
    hfa_growth_standards <- read.delim('/who2007-hfa.txt')
    wfa_growth_standards <- read.delim('/who2007-wfa.txt')
    d <- read.csv('/inputs.csv'); d$z_oficial <- NA_real_
    for (indicator in c('bfa','hfa','wfa')) {
      selected <- d$indicador == indicator
      fun <- switch(indicator, bfa=zscore_bmi_for_age, hfa=zscore_height_for_age, wfa=zscore_weight_for_age)
      if (indicator == 'hfa') d$z_oficial[selected] <- fun(d$sexo[selected],d$meses[selected],d$medida[selected])
      else d$z_oficial[selected] <- fun(d$sexo[selected],d$meses[selected],rep('n',sum(selected)),d$medida[selected])
    }
    write.csv(d,'/oraculo.csv',row.names=FALSE,na='NA')`);
  fs.writeFileSync(path.join(output,'oraculo-oms2007-oficial.csv'),await r.FS.readFile('/oraculo.csv'));
  console.log(await r.evalRString('R.version.string'));
 } finally {await r.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
