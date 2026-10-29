export type Task = { id: string; title: string; type: string; status: string; summary: string; nextStep: string; tags: string[]; pinned: boolean; linkIds?: string[]; dueDate?:string; priority?:string; completedAt?:string; createdAt: string; updatedAt: string }
export type Note = { id: string; title: string; category: string; body: string; tags: string[]; taskId: string; pinned: boolean; format?: string; createdAt: string; updatedAt: string; attachment?: {id:string;name:string;type:string;size:number} }
export type Link = {id:string;title:string;url:string;category:string;description:string}
export type Archive = {id?:string;date?:string;title:string;body:string;updatedAt:string}
export type Workspace = {version:number;settings:{name:string;theme?:string;design?:string;ui?:{styles?:Record<string,string>;darkStyles?:Record<string,string>;sidebar?:{side:'left'|'right';variant:'sidebar'|'floating'|'inset';collapsible:'offcanvas'|'icon'|'none'}}};tasks:Task[];notes:Note[];links:Link[];records:unknown[];activity:unknown[];dailyArchives?:Archive[];archiveDocuments?:Archive[];[key:string]:unknown}
export const statuses = ['待开始','进行中','等待反馈','已完成','暂缓','资料归档']
const editableTaskFields=['title','type','status','summary','nextStep','tags','pinned','linkIds','dueDate','priority'] as const
export function reconcileTaskDraft(base:Task|undefined,draft:Task,latest:Task|undefined):Task {
 if(!base){if(latest)throw Error('事项标识已存在，请重新新建；当前输入仍保留。');return draft}
 if(!latest)throw Error('这个事项已在其他窗口删除，当前输入仍保留，请复制后另存。')
 const merged={...latest}
 for(const key of editableTaskFields){
  const value=draft[key],before=base[key],current=latest[key]
  if(JSON.stringify(value)===JSON.stringify(before))continue
  if(JSON.stringify(current)!==JSON.stringify(before)&&JSON.stringify(current)!==JSON.stringify(value))throw Error('同一处事项内容已被其他窗口修改，当前输入仍保留，请先复制并核对。')
  Object.assign(merged,{[key]:value})
 }
 return merged
}
export function reconcileNoteDraft(base:Note|undefined,draft:Note,latest:Note|undefined):Note {
 if(!base){if(latest)throw Error('文档标识已存在，请重新新建；当前输入仍保留。');return draft}
 if(!latest)throw Error('这份文档已在其他窗口删除，当前输入仍保留，请复制后另存。')
 const merged={...latest}
 for(const key of ['title','body','category','tags'] as const){
  if(JSON.stringify(draft[key])===JSON.stringify(base[key]))continue
  if(JSON.stringify(latest[key])!==JSON.stringify(base[key])&&JSON.stringify(latest[key])!==JSON.stringify(draft[key]))throw Error('同一处文档内容已被其他窗口修改，当前输入仍保留，请先复制并核对。')
  Object.assign(merged,{[key]:draft[key]})
 }
 return merged
}
export function taskWithTimes(incoming:Task,previous:Task|undefined,now=new Date().toISOString()):Task {
 if(previous&&editableTaskFields.every(key=>JSON.stringify(incoming[key])===JSON.stringify(previous[key])))return previous
 const saved={...previous,...incoming,createdAt:previous?.createdAt||now,updatedAt:now}
 delete saved.completedAt
 if(incoming.status==='已完成'){
  if(previous?.status!=='已完成'&&!(previous?.status==='资料归档'&&previous.completedAt))saved.completedAt=now
  else if(previous.completedAt)saved.completedAt=previous.completedAt
 }else if(incoming.status==='资料归档'&&previous?.completedAt)saved.completedAt=previous.completedAt
 return saved
}
const taskTimeFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
export function formatTaskTime(value?:string):string {
 if(!value||!Number.isFinite(Date.parse(value)))return '未记录'
 const p=Object.fromEntries(taskTimeFormat.formatToParts(new Date(value)).map(part=>[part.type,part.value]))
 return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}
export function completionTimeText(task:Task){return task.completedAt?formatTaskTime(task.completedAt):['已完成','资料归档'].includes(task.status)?'未记录':'未完成'}
export function visibleTasks(tasks:Task[],status:string,query:string) {
 const q=query.trim().toLocaleLowerCase()
 return tasks.filter(t=>(!status||t.status===status)&&(!q||[t.title,t.summary,...t.tags].join(' ').toLocaleLowerCase().includes(q)))
}
export function reorderTasks(tasks:Task[],visibleIds:string[],active:string,over:string) {
 const from=visibleIds.indexOf(active),to=visibleIds.indexOf(over)
 if(from<0||to<0||from===to)return tasks
 const order=[...visibleIds];order.splice(to,0,order.splice(from,1)[0])
 const ids=new Set(order),byId=new Map(tasks.map(t=>[t.id,t]));let i=0
 return tasks.map(t=>ids.has(t.id)?byId.get(order[i++])!:t)
}
export function replaceTask(data:Workspace,task:Task):Workspace {
 return {...data,tasks:data.tasks.some(t=>t.id===task.id)?data.tasks.map(t=>t.id===task.id?task:t):[...data.tasks,task]}
}
export function removeTask(data:Workspace,id:string):Workspace {
 if(!data.tasks.some(task=>task.id===id))return data
 const detach=<T,>(items:T[])=>items.map(item=>item!==null&&typeof item==='object'&&'taskId'in item&&item.taskId===id?{...item,taskId:''}:item)
 return {...data,tasks:data.tasks.filter(task=>task.id!==id),links:detach(data.links),notes:detach(data.notes),records:detach(data.records)}
}

export type TaskOrder = 'manual'|'completed-desc'|'completed-asc'
export function orderTasks(tasks:Task[],order:TaskOrder):Task[]{
 if(order==='manual')return tasks
 return [...tasks].sort((a,b)=>{const left=Date.parse(a.completedAt||''),right=Date.parse(b.completedAt||'');if(!Number.isFinite(left))return Number.isFinite(right)?1:0;if(!Number.isFinite(right))return -1;return order==='completed-desc'?right-left:left-right})
}
