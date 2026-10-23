import {useMemo} from 'react'
import type {ReactNode} from 'react'
import {SidebarContext} from '@/contexts/sidebar-config'
import type {SidebarConfig} from '@/contexts/sidebar-config'
import {useWorkspace} from '@/hub/workspace'
export function SidebarConfigProvider({children}:{children:ReactNode}){const w=useWorkspace(),config:SidebarConfig=w.data.settings.ui?.sidebar||{variant:'inset',collapsible:'offcanvas',side:'left'};const value=useMemo(()=>({config,updateConfig:(next:Partial<SidebarConfig>)=>w.save({...w.current.current,settings:{...w.current.current.settings,ui:{...w.current.current.settings.ui,sidebar:{...config,...next}}}},'调整侧栏布局')}),[config,w]);return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>}
