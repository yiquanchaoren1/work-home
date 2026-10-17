export const archiveDocumentKinds={history:{title:'历史工作总结',filename:'历史工作总结.md'},profile:{title:'我的个人档案',filename:'我的个人档案.md'}};

export function validateArchiveDocuments(value) {
  if(!Array.isArray(value))throw new Error('档案文档必须为数组');
  const ids=new Set();
  return value.map(item=>{
    if(!item||!Object.hasOwn(archiveDocumentKinds,item.id)||ids.has(item.id))throw new Error('档案文档类型无效或重复');
    ids.add(item.id);
    if(typeof item.title!=='string'||!item.title.trim()||item.title.length>120||typeof item.body!=='string'||!item.body.trim()||item.body.length>50000)throw new Error('档案文档需要标题与正文，正文最多 50000 字');
    if(/(?:^|\n)#{1,6}\s*(?:对话原文|完整对话|输入输出)|(?:^|\n)(?:user|assistant|用户|助手)\s*[:：]/i.test(item.body))throw new Error('档案文档仅收录提炼后的内容，不收录问答原文');
    for(const key of ['createdAt','updatedAt'])if(typeof item[key]!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(item[key])||!Number.isFinite(Date.parse(item[key])))throw new Error('档案文档时间无效');
    return Object.fromEntries(['id','title','body','createdAt','updatedAt'].map(key=>[key,item[key]]));
  });
}
