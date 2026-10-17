// Legacy links.taskId remains readable; tasks.linkIds allows sharing a link.
export function linksForTask(data,taskId) {
  const ids=new Set(data.tasks.find(task=>task.id===taskId)?.linkIds||[]);
  return data.links.filter(link=>link.taskId===taskId||ids.has(link.id));
}

export function setTaskLinks(data,taskId,selectedIds) {
  const task=data.tasks.find(task=>task.id===taskId);
  if(!task)throw new Error('事项已不存在，请重新载入');
  const selected=new Set(selectedIds);
  if([...selected].some(id=>!data.links.some(link=>link.id===id)))throw new Error('所选链接已不存在，请重新选择');
  task.linkIds=[...selected];
  const now=new Date().toISOString();
  for(const link of data.links)if(link.taskId===taskId&&!selected.has(link.id)){link.taskId='';link.updatedAt=now;}
  task.updatedAt=now;
}

export function removeTaskLink(data,linkId) {
  for(const task of data.tasks)if(task.linkIds?.includes(linkId))task.linkIds=task.linkIds.filter(id=>id!==linkId);
}
