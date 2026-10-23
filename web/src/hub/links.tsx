import {useState} from 'react'
import {Link2,ArrowUpRight} from 'lucide-react'
import {BaseLayout} from '@/components/layouts/base-layout'
import {Card,CardContent} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Badge} from '@/components/ui/badge'
import {useWorkspace} from './workspace'
export default function Links(){const w=useWorkspace(),[q,setQ]=useState('');return <BaseLayout title='链接收藏' description='常用资料与事项中的关联链接，一处查看。'><div className='px-4 lg:px-6 space-y-5'><Input aria-label='搜索链接' className='max-w-sm' placeholder='搜索链接名称或分类…' value={q} onChange={e=>setQ(e.target.value)}/><div className='grid sm:grid-cols-2 xl:grid-cols-3 gap-4'>{w.data.links.filter(l=>!q||(l.title+l.category+l.description).includes(q)).map(l=><Card key={l.id}><CardContent className='space-y-3'><Link2 className='size-6 text-primary'/><Badge variant='secondary'>{l.category}</Badge><h2 className='text-lg font-semibold'><a href={l.url} target='_blank' rel='noopener noreferrer'>{l.title}<ArrowUpRight className='size-4 inline ml-2'/></a></h2><p className='text-sm text-muted-foreground'>{l.description}</p><p className='text-xs text-muted-foreground'>{new URL(l.url).hostname}</p><p className='text-xs pt-2 border-t'>关联事项：{w.data.tasks.filter(t=>t.linkIds?.includes(l.id)).map(t=>t.title).join('、')||'暂无'}</p></CardContent></Card>)}</div></div></BaseLayout>}
