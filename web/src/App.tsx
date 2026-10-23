import type {ComponentType} from 'react'
import {createHashRouter,RouterProvider,Navigate} from 'react-router-dom'
import {ConnectionScreen} from '@/hub/connect'
import {WorkspaceProvider,useWorkspace} from '@/hub/workspace'
import {WorkspaceDialogs} from '@/hub/dialogs'
import {ThemeProvider} from '@/components/theme-provider'
import {SidebarConfigProvider} from '@/contexts/sidebar-context'
import {RootLayout,RootFallback} from '@/components/router/root-layout'
import '@/hub/rich.css'
const page=(load:()=>Promise<{default:ComponentType}>)=>async()=>({Component:(await load()).default})
if(location.hash&& !location.hash.startsWith('#/')){const route=location.hash.slice(1),mapped=({home:'dashboard',profile:'archives',daily:'archives',ai:'archives',knowledge:'notes',settings:'settings/data'} as Record<string,string>)[route]||route;history.replaceState(null,'',location.pathname+location.search+'#/'+mapped)}
const router=createHashRouter([{element:<RootLayout/>,HydrateFallback:RootFallback,children:[
{path:'/',element:<Navigate to='/dashboard' replace/>},{path:'/home',element:<Navigate to='/dashboard' replace/>},
{path:'/dashboard',lazy:page(()=>import('@/app/dashboard/page'))},{path:'/tasks',lazy:page(()=>import('@/app/tasks/page'))},
{path:'/calendar',lazy:page(()=>import('@/app/calendar/page'))},{path:'/notes',lazy:page(()=>import('@/hub/library'))},
{path:'/archives',lazy:page(()=>import('@/hub/archives'))},{path:'/links',lazy:page(()=>import('@/hub/links'))},
{path:'/settings/:section?',lazy:page(()=>import('@/hub/settings'))},{path:'/read/:kind/:id',lazy:page(()=>import('@/hub/reader'))},
{path:'*',element:<Navigate to='/dashboard' replace/>}]}])
function Content(){const w=useWorkspace();return w.cloudDeployment&&!w.sync&&!location.hash.startsWith('#/read/')?<ConnectionScreen/>:<><RouterProvider router={router}/><WorkspaceDialogs/></>}
export default function App(){return <WorkspaceProvider><ThemeProvider><SidebarConfigProvider><Content/></SidebarConfigProvider></ThemeProvider></WorkspaceProvider>}
