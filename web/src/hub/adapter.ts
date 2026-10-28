import type { Workspace } from './model'
export const cloudDeployment=import.meta.env.VITE_WORKSPACE_MODE==='github'
const root=import.meta.env.BASE_URL
const moduleAt=(name:string)=>import(/* @vite-ignore */ `${root}legacy/${name}.js?v=tasks-20261028`)
export const core=Promise.all([moduleAt('local-api'),moduleAt('background-sync'),moduleAt('store'),moduleAt('markdown')]).then(([api,sync,store,markdown])=>({api,...sync,...store,...markdown}))
export type Envelope={data:Workspace;revision:string;dataDir:string}
export type Client={label:string;read:()=>Promise<Envelope>;write:(data:Workspace,revision:string)=>Promise<Envelope>;upload:(file:File)=>Promise<unknown>;backup:()=>Promise<unknown>;personal:()=>Promise<string>;attachment:(file:unknown)=>Promise<string>}
export async function localClient():Promise<Client> {
 const {api}=await core
 return {label:'本机独立资料',read:()=>api.readWorkspace({archives:false,fresh:true}),write:(data,revision)=>api.writeWorkspace(data,revision),upload:api.uploadFile,backup:api.readBackup,personal:async()=>{const p=await api.readPersonalDocument();return p.markdown},attachment:api.attachmentUrl}
}
export async function githubClient(owner:string,repo:string,token:string,branch=''):Promise<Client> {
 const {GithubWorkspace}=await moduleAt('github-workspace')
 const workspace=new GithubWorkspace({owner,repo,token,branch})
 await workspace.connect()
 return {label:`${owner}/${repo}`,read:()=>workspace.readWithArchives(),write:(data,revision)=>workspace.save(data,revision),upload:file=>workspace.upload(file),backup:()=>workspace.backup(),personal:async()=>{const p=await workspace.personalDocument();return p.markdown},attachment:async file=>URL.createObjectURL(new Blob([await workspace.attachment(file)],{type:(file as {type:string}).type}))}
}
export async function markdownHtml(body:string) {return (await core).renderMarkdown(body)}
