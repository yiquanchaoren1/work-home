// Three-way reconciliation of JSON snapshots. Never chooses a winner for competing text.
const absent=Symbol('absent');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>a===b||(a!==absent&&b!==absent&&JSON.stringify(a)===JSON.stringify(b));
const clone=value=>value===absent?absent:structuredClone(value);
const collections=new Set(['tasks','links','notes','records','activity','dailyArchives','archiveDocuments','personal.entries','personal.journals']);
const collision=()=>Object.assign(new Error('其他设备已更新资料：同一处内容存在不同修改，或删除与编辑冲突。当前草稿已保留，未覆盖远端；请下载草稿后核对。'),{status:409});

function mergeList(base,local,remote,path){
  const key=path.join('.')==='dailyArchives'?'date':'id';
  const index=items=>{const map=new Map();for(const item of items){if(!object(item)||typeof item[key]!=='string'||map.has(item[key]))throw collision();map.set(item[key],item);}return map;};
  const b=index(base),l=index(local),r=index(remote),merged=new Map();
  for(const id of new Set([...b.keys(),...l.keys(),...r.keys()])){
    const before=b.has(id)?b.get(id):absent,left=l.has(id)?l.get(id):absent,right=r.has(id)?r.get(id):absent;
    if(before===absent&&left!==absent&&right!==absent&&!same(left,right))throw collision();
    const value=merge(before,left,right,[...path,id]);if(value!==absent)merged.set(id,value);
  }
  // Compare the relative order of surviving shared records; additions/deletions are not reorders.
  const shared=new Set([...b.keys()].filter(id=>l.has(id)&&r.has(id)&&merged.has(id)));
  const sequence=items=>items.map(item=>item[key]).filter(id=>shared.has(id));
  const original=sequence(base),left=sequence(local),right=sequence(remote);
  const localMoved=!same(left,original),remoteMoved=!same(right,original);
  if(localMoved&&remoteMoved&&!same(left,right))throw collision();
  const preferred=localMoved?local:remote,other=localMoved?remote:local,result=[];
  for(const item of [...preferred,...other])if(merged.has(item[key])){result.push(merged.get(item[key]));merged.delete(item[key]);}
  return result;
}

function merge(base,local,remote,path){
  if(same(local,base))return clone(remote);
  if(same(remote,base)||same(local,remote))return clone(local);
  if(local===absent||remote===absent)throw collision();
  if(Array.isArray(local)&&Array.isArray(remote)&&collections.has(path.join('.'))&&(base===absent||Array.isArray(base)))return mergeList(base===absent?[]:base,local,remote,path);
  if(object(local)&&object(remote)&&(base===absent||object(base))){
    const before=base===absent?{}:base,entries=[];
    for(const key of new Set([...Object.keys(before),...Object.keys(local),...Object.keys(remote)])){
      const get=value=>Object.hasOwn(value,key)?value[key]:absent;
      const value=merge(get(before),get(local),get(remote),[...path,key]);if(value!==absent)entries.push([key,value]);
    }
    return Object.fromEntries(entries);
  }
  // Modification clocks are derived metadata; independently edited fields above must still agree.
  if(path.at(-1)==='updatedAt'&&[3,4].includes(path.length)&&typeof local==='string'&&typeof remote==='string'&&Number.isFinite(Date.parse(local))&&Number.isFinite(Date.parse(remote)))return Date.parse(local)>=Date.parse(remote)?local:remote;
  throw collision();
}

export function reconcileWorkspace(base,local,remote){return merge(base,local,remote,[]);}
