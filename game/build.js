const esbuild=require('esbuild'),fs=require('fs');
esbuild.build({entryPoints:['src/main.js'],bundle:true,minify:true,format:'iife',outdir:'out',loader:{'.json':'json','.css':'css'},logLevel:'warning'}).then(()=>{
 const js=fs.readFileSync('out/main.js','utf8').replace(/<\/script/g,'<\\/script'), css=fs.readFileSync('out/main.css','utf8');
 const html=fs.readFileSync('src/index.html','utf8').replace('/*CSS*/',()=>css).replace('/*JS*/',()=>js);
 fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html',html);fs.cpSync(require('path').resolve(__dirname,'../packs/strasbourg'),'dist/packs/strasbourg',{recursive:true});
 import('./src/version.js').then(({VERSION,CHANGELOG})=>{fs.writeFileSync(require('path').resolve(__dirname,'../CHANGELOG.md'),'# Changelog\n\nSpecial Containment Organization — game versions (MAJOR.MINOR.PATCH). The same entries are shown on the main menu.\n\n'+CHANGELOG.map(c=>`## v${c.v} — ${c.title} (${c.date})\n\n`+c.items.map(i=>'- '+i).join('\n')).join('\n\n')+'\n');console.log('version',VERSION);});console.log('ok',(html.length/1024|0)+'KB');
}).catch(e=>process.exit(1));
