export type Task = { id: string; title: string; type: string; status: string; summary: string; nextStep: string; tags: string[]; pinned: boolean; linkIds?: string[]; dueDate?:string; priority?:string; createdAt: string; updatedAt: string }
export type Note = { id: string; title: string; category: string; body: string; tags: string[]; taskId: string; pinned: boolean; format?: string; createdAt: string; updatedAt: string; attachment?: {id:string;name:string;type:string;size:number} }
export type Link = {id:string;title:string;url:string;category:string;description:string}
export type Archive = {id?:string;date?:string;title:string;body:string;updatedAt:string}
export type Workspace = {version:number;settings:{name:string;theme?:string;design?:string;ui?:{styles?:Record<string,string>;darkStyles?:Record<string,string>;sidebar?:{side:'left'|'right';variant:'sidebar'|'floating'|'inset';collapsible:'offcanvas'|'icon'|'none'}}};tasks:Task[];notes:Note[];links:Link[];records:unknown[];activity:unknown[];dailyArchives?:Archive[];archiveDocuments?:Archive[];[key:string]:unknown}
export const statuses = ['待开始','进行中','等待反馈','已完成','暂缓','资料归档']
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
