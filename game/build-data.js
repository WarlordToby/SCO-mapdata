const fs=require('fs');
const cities=require('all-the-cities');
const wc=require('world-countries');
const topo=require('world-atlas/countries-50m.json');
const parse=f=>fs.readFileSync(f,'utf8').trim().split('\n').slice(1).map(l=>{const m=l.match(/("([^"]*)"|[^,]*)/g).filter((x,i,a)=>true);return l;});
function csv(f){return fs.readFileSync(f,'utf8').trim().split('\n').slice(1).map(l=>{const out=[];let cur='',q=false;for(const ch of l){if(ch=='"'){q=!q}else if(ch==','&&!q){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out;});}
const pop={},gdp={};
for(const [n,c,y,v] of csv('raw/pop.csv')){if(!pop[c]||pop[c].y<+y)pop[c]={y:+y,v:+v}}
for(const [n,c,y,v] of csv('raw/gdp.csv')){if(!gdp[c]||gdp[c].y<+y)gdp[c]={y:+y,v:+v}}
const meta={};
for(const c of wc){ if(!c.ccn3) continue; meta[c.ccn3]={cca2:c.cca2,cca3:c.cca3,name:c.name.common,official:c.name.official,capital:(c.capital||[])[0]||'',region:c.region,sub:c.subregion,flag:c.flag,area:c.area,pop:pop[c.cca3]?.v||0,popYear:pop[c.cca3]?.y||0,gdp:gdp[c.cca3]?.v||0,gdpYear:gdp[c.cca3]?.y||0,demonym:c.demonyms?.eng?.m||''};}
// cities: per country, pop>=40000, at least top 12
const by={};
for(const c of cities){ if(!['PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLC','PPLG','PPLL','PPLS'].includes(c.featureCode))continue; (by[c.country]=by[c.country]||[]).push(c);}
const outC={};let n=0;
for(const k in by){const a=by[k].sort((x,y)=>y.population-x.population);let s=a.filter(c=>c.population>=40000);if(s.length<12)s=a.slice(0,12).filter(c=>c.population>=2000);s=s.slice(0,400);outC[k]=s.map(c=>[c.name,+c.loc.coordinates[0].toFixed(4),+c.loc.coordinates[1].toFixed(4),c.population,c.featureCode==='PPLC'?1:0]);n+=s.length;}
const fr=JSON.parse(fs.readFileSync('raw/fr-regions.geojson'));
const round=a=>Array.isArray(a[0])?a.map(round):[+a[0].toFixed(3),+a[1].toFixed(3)];
fr.features.forEach(f=>f.geometry.coordinates=round(f.geometry.coordinates));
fs.writeFileSync('src/data.json',JSON.stringify({topo,meta,cities:outC,regions:{FR:fr}}));
console.log('cities',n,'size',fs.statSync('src/data.json').size, fr.features.map(f=>f.properties.nom).join('|'));
