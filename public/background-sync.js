// Session memory only. Acknowledged data and pending edits never share a revision.
const copy=value=>structuredClone(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const conflict=()=>Object.assign(new Error('其他设备已更新资料；当前修改仍在此页面，请先下载草稿并核对，未覆盖云端。'),{status:409});

export class BackgroundSync {
  #write; #read; #validate; #change; #delay;
  #confirmed; #view; #items=[]; #version=0; #running=false; #checking=false; #error;
  #timer; #attempt; #waiters=[]; #outcome='loaded';
  constructor({write,read,validate=value=>copy(value),onChange=()=>{},delay=120}) {
    this.#write=write;this.#read=read;this.#validate=validate;this.#change=onChange;this.#delay=delay;
  }
  get pending(){return this.#items.length;}
  get version(){return this.#version;}
  get active(){return this.#running||this.#checking;}
  get error(){return this.#error;}
  get state(){const {data,...metadata}=this.#confirmed||{};return {data:copy(this.#view),metadata:copy(metadata),revision:this.#confirmed?.revision,version:this.#version,pending:this.pending,active:this.active,outcome:this.#outcome,error:this.#error?{message:this.#error.message,status:this.#error.status}:null,items:copy(this.#items)};}
  initialize(state) {
    if(this.pending||this.active)throw new Error('当前还有待同步修改，不能重新载入。');
    this.#confirmed=copy(state);this.#view=this.#validate(state.data);this.#version++;this.#error=undefined;this.#attempt=undefined;this.#outcome='loaded';this.#emit();
  }
  enqueue(data,label='工作台修改') {
    if(!this.#confirmed)throw new Error('请先读取工作台。');
    this.#view=this.#validate(data);
    this.#items.push({version:++this.#version,label});this.#outcome='pending';this.#emit();this.#schedule();
    return {queued:true,version:this.#version};
  }
  #emit(){this.#change(this.state);this.#settle();}
  #schedule(){
    if(this.#timer||this.active||this.#error||!this.pending)return;
    this.#timer=setTimeout(()=>{this.#timer=undefined;void this.#run();},this.#delay);
  }
  #ack(state,version){
    this.#confirmed=copy(state);this.#items=this.#items.filter(item=>item.version>version);
    if(!this.pending){this.#view=this.#validate(state.data);this.#error=undefined;}
    this.#outcome=this.pending?'pending':'synced';
  }
  async #run(){
    if(this.active||this.#error||!this.pending)return;
    this.#running=true;
    const attempt={data:copy(this.#view),version:this.#version,revision:this.#confirmed.revision};this.#attempt=attempt;this.#emit();
    try {
      const state=await this.#write(attempt.data,attempt.revision);
      this.#ack(state,attempt.version);this.#attempt=undefined;
    }catch(error){this.#error=error;}
    finally{this.#running=false;this.#emit();this.#schedule();}
  }
  #settle(){
    if(!this.#error&&this.pending)return;
    if(this.active)return;
    for(const waiter of this.#waiters.splice(0))this.#error?waiter.reject(this.#error):waiter.resolve(copy(this.#confirmed));
  }
  flush(){
    if(this.#error)return Promise.reject(this.#error);
    if(!this.pending)return Promise.resolve(copy(this.#confirmed));
    const promise=new Promise((resolve,reject)=>this.#waiters.push({resolve,reject}));
    if(this.#timer){clearTimeout(this.#timer);this.#timer=undefined;}
    void this.#run();return promise;
  }
  async retry(){
    if(this.active)return;
    if(!this.pending)return;
    this.#checking=true;this.#emit();
    try {
      // A lost PUT response may already have committed. Read before retrying to avoid duplicates.
      const remote=await this.#read();
      if(this.#confirmed.dataDir&&remote.dataDir!==this.#confirmed.dataDir)throw Object.assign(new Error('连接的资料仓库发生变化，草稿仍保留，未向其他仓库上传。'),{status:409});
      if(remote.revision!==this.#confirmed.revision){
        if(equal(remote.data,this.#view)){this.#ack(remote,this.#version);this.#attempt=undefined;}
        else if(this.#attempt&&equal(remote.data,this.#attempt.data)){this.#ack(remote,this.#attempt.version);this.#attempt=undefined;}
        else throw conflict();
      }
      this.#error=undefined;
    }catch(error){this.#error=error;}
    finally{this.#checking=false;this.#emit();this.#schedule();}
  }
  pause(message='连接已退出，未同步修改仍保留在当前页面。') {
    this.#error=Object.assign(new Error(message),{status:401});
    if(this.#timer){clearTimeout(this.#timer);this.#timer=undefined;}this.#emit();
  }
  async discardAndReload(){
    if(this.active)throw new Error('后台仍在上传，请等待本次请求结束后再处理草稿。');
    // Read successfully before discarding anything. The UI must explicitly confirm this action.
    this.#checking=true;this.#emit();
    try {
      const remote=await this.#read();
      this.#items=[];this.#confirmed=copy(remote);this.#view=this.#validate(remote.data);
      this.#version++;this.#attempt=undefined;this.#error=undefined;
      this.#outcome='discarded';
      if(this.#timer){clearTimeout(this.#timer);this.#timer=undefined;}
    }finally{this.#checking=false;this.#emit();}
  }
  draft(){return {...copy(this.#view),pendingSync:{source:this.#confirmed?.dataDir,revision:this.#confirmed?.revision,items:copy(this.#items),note:'当前页面尚未确认上传的文字修改和附件引用；不含附件原件。'}};}
}
