import {Plus} from 'lucide-react'
import {DatePicker} from './date-picker'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'
interface Props{selectedDate?:Date;onDateSelect?:(d:Date)=>void;onNewEvent?:()=>void;events?:{date:Date;count:number}[];className?:string}
export function CalendarSidebar({selectedDate,onDateSelect,onNewEvent,events=[],className}:Props){return <div className={cn('flex flex-col h-full bg-background',className)}><div className='p-5 border-b'><Button className='w-full' onClick={onNewEvent}><Plus/>安排工作事项</Button></div><DatePicker selectedDate={selectedDate} onDateSelect={onDateSelect} events={events}/><div className='p-5 border-t text-sm space-y-3'><strong>日历来源</strong><p className='flex gap-2 items-center'><i className='size-2 rounded-full bg-blue-500'/>事项截止日期</p><p className='flex gap-2 items-center'><i className='size-2 rounded-full bg-green-500'/>已完成事项</p><p className='flex gap-2 items-center'><i className='size-2 rounded-full bg-purple-500'/>每日工作摘要</p><p className='text-xs text-muted-foreground leading-relaxed pt-3'>选择日期后可安排事项。点击已有事项编辑，点击摘要独立阅读。</p></div></div>}
