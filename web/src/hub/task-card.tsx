import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVertical,ArrowUpRight} from 'lucide-react'
import {statuses} from './model'
import type {Task} from './model'
export function SortableTask({task,onEdit,onStatus}:{task:Task;onEdit:()=>void;onStatus:(status:string)=>void}) {
 const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:task.id})
 return <article ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition,opacity:isDragging?.55:1,zIndex:isDragging?10:undefined}} className="task-card" data-task-id={task.id}><div className="task-top"><span className="task-type">{task.type}</span><button className="drag-handle" aria-label={`拖动 ${task.title}`} {...attributes} {...listeners}><GripVertical size={17}/></button></div><button className="task-title" onClick={onEdit}>{task.title}</button><p>{task.summary||'为这件事留一点思路。'}</p><div className="tags">{task.tags.map(t=><span key={t}>{t}</span>)}</div><div className="task-bottom"><select aria-label={`${task.title}的状态`} value={task.status} onChange={e=>onStatus(e.target.value)} className={`status status-${statuses.indexOf(task.status)}`}>{statuses.map(s=><option key={s}>{s}</option>)}</select><button className="quiet-icon" onClick={onEdit} aria-label={`编辑 ${task.title}`}><ArrowUpRight size={17}/></button></div></article>
}