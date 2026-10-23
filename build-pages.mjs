import {cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync,lstatSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url)),web=path.join(root,'web');
const run=(file,args,cwd=root,env={})=>{const winNpm=process.platform==='win32'&&file==='npm';const p=spawnSync(winNpm?process.execPath:file,winNpm?[path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),...args]:args,{cwd,env:{...process.env,...env},stdio:'inherit'});if(p.status!==0)throw Error('Build step failed: '+file+' '+args.join(' '))};
run(process.execPath,['prepare-vendor.mjs']);
const legacy=path.join(web,'public/legacy');mkdirSync(legacy,{recursive:true});
for(const name of ['archive-documents','background-sync','cloud-config','cloud-session','daily-archives','device-session','github-workspace','local-api','markdown','personal','seed','store','task-links'])cpSync(path.join(root,'public',name+'.js'),path.join(legacy,name+'.js'));
for(const name of ['marked.esm.js','purify.esm.js','marked.LICENSE','dompurify.LICENSE','dompurify.LICENSE-MPL']){mkdirSync(path.join(legacy,'vendor'),{recursive:true});cpSync(path.join(root,'public/vendor',name),path.join(legacy,'vendor',name))}
const empty="export const seedData={version:1,settings:{name:'Bing‘ House'},tasks:[],notes:[],links:[],records:[],activity:[]};\n";
writeFileSync(path.join(legacy,'seed.js'),empty);
writeFileSync(path.join(legacy,'cloud-config.js'),'export const cloudConfig={enabled:false};\n');
cpSync(path.join(root,'public/icons'),path.join(web,'public/icons'),{recursive:true});
cpSync(path.join(root,'public/manifest.webmanifest'),path.join(web,'public/manifest.webmanifest'));
run('npm',['test'],web);
run('npm',['run','build'],web,{VITE_BASE:'/work-home/',VITE_WORKSPACE_MODE:'github'});
const out=path.resolve(root,'dist-cloud');
if(path.dirname(out)!==root||path.basename(out)!=='dist-cloud'||(existsSync(out)&&lstatSync(out).isSymbolicLink()))throw Error('Invalid Pages output directory');
// Replace the complete artifact; retired root/classic HTML must not survive a rebuild.
rmSync(out,{recursive:true,force:true});
cpSync(path.join(web,'dist'),out,{recursive:true});
for(const name of readdirSync(path.join(out,'legacy')))if(name.endsWith('.js')){const file=path.join(out,'legacy',name),text=readFileSync(file,'utf8');writeFileSync(file,text.replace(/store\.js\?v=[a-zA-Z0-9-]+/g,'store.js?v=rich-20261023'))}
writeFileSync(path.join(out,'release.json'),JSON.stringify({ui:'shadcnstore',source:process.env.GITHUB_SHA||'local',base:'/work-home/'}));
writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Built current UI only at /work-home/. Private data and retired interfaces excluded.');
