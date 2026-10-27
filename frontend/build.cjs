// AI: сборка исходного дизайна; vendor не менять. WEB proxy вне этого проекта — НЕ ТРОГАТЬ.
const esbuild=require('esbuild');
const fs=require('fs');const path=require('path');const crypto=require('crypto');
(async()=>{
 const root=__dirname,template=path.join(root,'index.template.html');
 if(!fs.existsSync(template))fs.copyFileSync(path.join(root,'index.html'),template);
 let html=fs.readFileSync(template,'utf8');
 const styles=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
 const css=await esbuild.transform(styles.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n'),{loader:'css',minify:true,target:'es2020'});
 const js=await esbuild.build({entryPoints:[path.join(root,'product/app.js')],bundle:true,write:false,minify:true,format:'esm',target:'es2020',legalComments:'none'});
 const assets=path.join(root,'assets');fs.mkdirSync(assets,{recursive:true});
 const digest=text=>crypto.createHash('sha256').update(text).digest('hex').slice(0,12);
 const cssFile='app-'+digest(css.code)+'.css',jsFile='app-'+digest(js.outputFiles[0].contents)+'.js';
 fs.writeFileSync(path.join(assets,cssFile),css.code);fs.writeFileSync(path.join(assets,jsFile),js.outputFiles[0].contents);
 html=html.replace(/\s*<link rel="stylesheet" href="[^"]+">/g,'');
 html=html.replace('</head>',`<link rel="stylesheet" href="/assets/${cssFile}"><link rel="modulepreload" href="/assets/${jsFile}"></head>`);
 html=html.replace('/product/app.js','/assets/'+jsFile);
 fs.writeFileSync(path.join(root,'index.html'),html);
 console.log('Built',jsFile,js.outputFiles[0].contents.length,'bytes;',cssFile,Buffer.byteLength(css.code),'bytes; 2 application assets.');
})().catch(error=>{console.error(error);process.exit(1)});
