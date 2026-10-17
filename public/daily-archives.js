export function validArchiveDate(date) {
  return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
}

export function validateDailyArchives(value) {
  if(!Array.isArray(value))throw new Error('每日摘要必须为数组');
  const dates=new Set();
  return value.map(item=>{
    if(!item||!validArchiveDate(item.date)||dates.has(item.date))throw new Error('每日摘要日期无效或重复，同一天只能有一份摘要');
    dates.add(item.date);
    if(typeof item.title!=='string'||!item.title.trim()||typeof item.body!=='string'||!item.body.trim())throw new Error('每日摘要标题与内容不能为空');
    if(item.body.length>6000)throw new Error('每日摘要最多 6000 字，请只保留简要重要内容');
    if(/(?:^|\n)#{1,6}\s*(?:对话原文|完整对话|输入输出|用户提问|Codex答复)|(?:^|\n)#{1,6}\s*\d{2}:\d{2}.*·\s*(?:我|Codex)|(?:^|\n)(?:user|assistant|用户|助手)\s*[:：]/i.test(item.body))throw new Error('请先提炼为工作摘要，不同步输入输出或对话原文');
    for(const key of ['createdAt','updatedAt'])if(typeof item[key]!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(item[key])||!Number.isFinite(Date.parse(item[key])))throw new Error('每日摘要时间无效');
    return Object.fromEntries(['date','title','body','createdAt','updatedAt'].map(key=>[key,item[key]]));
  });
}
