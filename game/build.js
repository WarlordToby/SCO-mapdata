const esbuild=require('esbuild'),fs=require('fs');
esbuild.build({entryPoints:['src/main.js'],bundle:true,minify:true,format:'iife',outdir:'out',loader:{'.json':'json','.css':'css'},logLevel:'warning'}).then(()=>{
 const js=fs.readFileSync('out/main.js','utf8').replace(/<\/script/g,'<\\/script'), css=fs.readFileSync('out/main.css','utf8');
 const html=fs.readFileSync('src/index.html','utf8').replace('/*CSS*/',()=>css).replace('/*JS*/',()=>js);
 fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html',html);const P=require('path'),bdir=process.env.SCO_BUNDLES||P.resolve(__dirname,'../bundles'),cities=JSON.parse(fs.readFileSync(P.resolve(__dirname,'../pipeline/cities.json'),'utf8')).cities;
 fs.rmSync('dist/packs',{recursive:true,force:true});fs.mkdirSync('dist/packs',{recursive:true});const idx=[];
 if(fs.existsSync(bdir))for(const f of fs.readdirSync(bdir).filter(f=>f.endsWith('.bin')).sort()){const slug=f.slice(0,-4),c=cities.find(x=>x.slug===slug);if(!c)continue;fs.copyFileSync(P.join(bdir,f),'dist/packs/'+f);idx.push({slug,cc:c.cc,name:c.name,lat:c.lat,lon:c.lon,file:f,bytes:fs.statSync(P.join(bdir,f)).size});}
 fs.writeFileSync('dist/packs/index.json',JSON.stringify(idx));console.log('packs',idx.length,(idx.reduce((a,p)=>a+p.bytes,0)/1e6).toFixed(1)+' MB');
 import('./src/version.js').then(({VERSION,CHANGELOG})=>{fs.writeFileSync(require('path').resolve(__dirname,'../CHANGELOG.md'),'# Changelog\n\nSpecial Containment Organization — game versions (MAJOR.MINOR.PATCH). The same entries are shown on the main menu.\n\n'+CHANGELOG.map(c=>`## v${c.v} — ${c.title} (${c.date})\n\n`+c.items.map(i=>'- '+i).join('\n')).join('\n\n')+'\n');console.log('version',VERSION);});console.log('ok',(html.length/1024|0)+'KB');
}).catch(e=>process.exit(1));
