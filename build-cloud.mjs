import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'dist-cloud');
if(path.dirname(out)!==root||path.basename(out)!=='dist-cloud')throw Error('Invalid cloud build destination');
const owner=process.env.WORK_HUB_GITHUB_OWNER||'yiquanchaoren1',repo=process.env.WORK_HUB_GITHUB_DATA_REPO||'work-home-data';
if(!/^[A-Za-z0-9-]+$/.test(owner)||!/^[A-Za-z0-9_.-]+$/.test(repo))throw Error('Invalid GitHub configuration');
rmSync(out,{recursive:true,force:true});mkdirSync(out);cpSync(path.join(root,'public'),out,{recursive:true});
writeFileSync(path.join(out,'cloud-config.js'),'export const cloudConfig = '+JSON.stringify({enabled:true,owner,repo,branch:process.env.WORK_HUB_GITHUB_DATA_BRANCH||''})+';\n');
// Pages is public. Publish UI code and an empty seed, never the local workspace.
writeFileSync(path.join(out,'seed.js'),`export const seedData = {version:1,tasks:[],links:[],notes:[],records:[],activity:[],settings:{name:'Bing‘ House'}};\n`);
writeFileSync(path.join(out,'.nojekyll'),'');
for(const name of readdirSync(out))if(/\.(?:html|js)$/.test(name)&&name!=='seed.js') {
  let text=readFileSync(path.join(out,name),'utf8');
  text=text.replaceAll('本机','云端').replaceAll('本地','云端').replaceAll('云端文件夹','GitHub 私有仓库')
    .replaceAll('请启动服务并重新载入。','请检查仓库访问权限并重新载入。')
    .replaceAll('同一台电脑的不同浏览器使用同一份数据；其他设备需要复制数据文件夹或导入完整备份。','登录同一资料仓库后，电脑和手机使用同一份云端数据，电脑关机也可访问。')
    .replaceAll('工作内容、文档和图片写入此文件夹，不写入浏览器存储。请保留此文件夹；完整备份也包含上传的原文件。','工作内容、文档和图片写入私有仓库，不写入浏览器存储。修改保留 Git 提交历史；完整备份包含原文件。')
    .replaceAll('网站服务运行时才能同步；当前由 Codex 在对话收尾时整理，没有配置每天定时调用 AI。','同步来源是资料仓库的 codex-worklogs 文件夹；Codex 整理后将摘要上传到该目录，再点击同步。电脑无需开机，当前没有定时调用 AI。')
    .replaceAll('LOCAL FIRST','PRIVATE CLOUD')
    .replaceAll('请启用 JavaScript 并启动Bing‘ House云端服务后查看文档。','请启用 JavaScript，并登录你的私有资料仓库。');
  writeFileSync(path.join(out,name),text);
}
console.log('Built Pages frontend in dist-cloud; private data and credentials excluded.');
