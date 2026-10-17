import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validArchiveDate, validateDailyArchives} from './public/daily-archives.js';
import {archiveDocumentKinds, validateArchiveDocuments} from './public/archive-documents.js';

const hash=text=>createHash('sha256').update(text).digest('hex');
export const isLegacyCodexNote=note=>Boolean(note.codex);

// Codex writes the actual synthesis after doing the work. The website only
// synchronizes those summaries; it never turns transcript excerpts into facts.
export async function collectDailySummaries({workspaceRoot,since='',before='',worklogDir=path.join(workspaceRoot,'docs','codex_worklogs')}={}) {
  if(typeof workspaceRoot!=='string')throw new Error('未设置工作区范围');
  if(since&&!validArchiveDate(since))throw new Error('同步起始日期无效');
  if(before&&!validArchiveDate(before))throw new Error('归档截止日期无效');
  let entries;
  try{entries=await fs.readdir(worklogDir,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return {documents:[],archiveDocuments:[],warnings:[],stats:{scanned:0}};throw error;}
  const documents=[],warnings=[];let scanned=0;
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
    if(!entry.isFile()||!/^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name))continue;
    const date=entry.name.slice(0,10);if(!validArchiveDate(date)||(since&&date<since)||(before&&date>=before))continue;
    scanned++;
    try {
      const file=path.join(worklogDir,entry.name),stat=await fs.stat(file);
      if(stat.size>24000)throw new Error('篇幅过长，请由 Codex 合并精简后再同步');
      const body=(await fs.readFile(file,'utf8')).replace(/^\ufeff/,'').replace(/\r\n?/g,'\n').trim()+'\n';
      validateDailyArchives([{date,title:`${date} 工作摘要`,body,createdAt:stat.mtime.toISOString(),updatedAt:stat.mtime.toISOString()}]);
      documents.push({date,title:`${date} 工作摘要`,body});
    }catch(error){warnings.push(`${entry.name}：${error.message}`);}
  }
  const archiveDocuments=[];
  for(const [id,spec] of Object.entries(archiveDocumentKinds)) {
    if(!entries.some(entry=>entry.isFile()&&entry.name===spec.filename))continue;
    try {
      const file=path.join(worklogDir,spec.filename),stat=await fs.stat(file);
      if(stat.size>200000)throw new Error('文档过长，请合并提炼后再同步');
      const body=(await fs.readFile(file,'utf8')).replace(/^\ufeff/,'').replace(/\r\n?/g,'\n').trim()+'\n';
      validateArchiveDocuments([{id,title:spec.title,body,createdAt:stat.mtime.toISOString(),updatedAt:stat.mtime.toISOString()}]);
      archiveDocuments.push({id,title:spec.title,body});
    }catch(error){warnings.push(`${spec.filename}：${error.message}`);}
  }
  return {documents,archiveDocuments,warnings,stats:{scanned}};
}

export function applyArchiveDocuments(data,documents,now=new Date().toISOString()) {
  const stats={added:0,updated:0,unchanged:0};
  for(const doc of documents) {
    const existing=data.archiveDocuments?.find(item=>item.id===doc.id);
    if(existing&&existing.title===doc.title&&existing.body===doc.body){stats.unchanged++;continue;}
    const value={id:doc.id,title:doc.title,body:doc.body,createdAt:existing?.createdAt||now,updatedAt:now};
    validateArchiveDocuments([value]);
    data.archiveDocuments ||= [];
    if(existing){Object.assign(existing,value);stats.updated++;}else{data.archiveDocuments.push(value);stats.added++;}
  }
  return stats;
}

export function applyDailySummaries(data,documents,now=new Date().toISOString()) {
  const stats={added:0,updated:0,unchanged:0};
  const unique=new Set();
  for(const doc of documents) {
    if(unique.has(doc.date))throw new Error('同一天只能有一份工作摘要');unique.add(doc.date);
    const existing=data.dailyArchives?.find(item=>item.date===doc.date);
    if(existing&&hash(existing.body)===hash(doc.body)&&existing.title===doc.title){stats.unchanged++;continue;}
    const value={date:doc.date,title:doc.title,body:doc.body,createdAt:existing?.createdAt||now,updatedAt:now};
    validateDailyArchives([value]);
    data.dailyArchives ||= [];
    if(existing){Object.assign(existing,value);stats.updated++;}else{data.dailyArchives.push(value);stats.added++;}
  }
  return stats;
}
