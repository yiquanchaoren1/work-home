import type {ColumnDef} from '@tanstack/react-table'
import type {DataTableFeatures} from '@/lib/data-table'
import type {Task} from '../data/schema'
import {Checkbox} from '@/components/ui/checkbox'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {DataTableColumnHeader} from './data-table-column-header'
import {useWorkspace} from '@/hub/workspace'
import {statuses,priorities} from '../data/data'
function EditCell({task}:{task:Task}){const w=useWorkspace();return <button className='font-medium hover:underline text-left' onClick={()=>w.setEditTask(task)}>{task.title}</button>}
function StatusCell({task}:{task:Task}){const w=useWorkspace();return <select aria-label={task.title+'的状态'} value={task.status} onChange={e=>w.updateTask({...task,status:e.target.value})}>{statuses.map(s=><option key={s.value}>{s.value}</option>)}</select>}
export const columns:ColumnDef<DataTableFeatures,Task>[]=[
{id:'select',header:({table})=><Checkbox checked={table.getIsAllPageRowsSelected()} indeterminate={table.getIsSomePageRowsSelected()} onCheckedChange={v=>table.toggleAllPageRowsSelected(!!v)} aria-label='全选本页'/>,cell:({row})=><Checkbox checked={row.getIsSelected()} onCheckedChange={v=>row.toggleSelected(!!v)} aria-label={'选择 '+row.original.title}/>,enableSorting:false,enableHiding:false},
{accessorKey:'title',header:({column})=><DataTableColumnHeader column={column} title='事项名称'/>,cell:({row})=><EditCell task={row.original}/>,enableHiding:false},
{accessorKey:'category',header:({column})=><DataTableColumnHeader column={column} title='类型'/>,cell:({row})=><Badge variant='outline'>{row.original.category}</Badge>,filterFn:(row,id,value)=>value.includes(row.getValue(id))},
{accessorKey:'status',header:({column})=><DataTableColumnHeader column={column} title='状态'/>,cell:({row})=><StatusCell task={row.original}/>},
{accessorKey:'priority',header:({column})=><DataTableColumnHeader column={column} title='优先级'/>,cell:({row})=>priorities.find(p=>p.value===row.original.priority)?.label||'普通',filterFn:(row,id,value)=>value.includes(row.getValue(id))},
{accessorKey:'dueDate',header:({column})=><DataTableColumnHeader column={column} title='截止日期'/>,cell:({row})=>row.original.dueDate||'—'},
{accessorKey:'updatedAt',header:({column})=><DataTableColumnHeader column={column} title='最近更新'/>,cell:({row})=>new Date(row.original.updatedAt).toLocaleDateString('zh-CN')},
{id:'actions',cell:({row})=><EditAction task={row.original}/>,enableSorting:false}]
function EditAction({task}:{task:Task}){const w=useWorkspace();return <div className='flex items-center gap-1'><Button variant='ghost' size='sm' onClick={()=>w.setEditTask(task)}>编辑</Button><Button variant='destructive' size='sm' onClick={()=>w.setPendingDeleteTask(task)} aria-label={'删除 '+task.title}>删除</Button></div>}
