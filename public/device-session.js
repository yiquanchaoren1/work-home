// Only connection credentials live here. Never pass workspace data or documents.
export function createDeviceSession(root = new URL('./',import.meta.url)) {
  const name = 'work-hub-device-session:' + root.pathname;
  const scope = new TextEncoder().encode(root.origin + root.pathname);
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  async function open() {
    if (!globalThis.indexedDB || !globalThis.crypto?.subtle) throw new Error('此设备无法保存登录信息，请取消勾选后连接。');
    return new Promise((resolve,reject) => {
      let request,blocked=false;
      try {request=indexedDB.open(name,1);}catch{reject(new Error('此设备无法保存登录信息，请取消勾选后连接。'));return;}
      request.onupgradeneeded = () => request.result.createObjectStore('connection');
      request.onerror = () => reject(new Error('此设备无法读取登录信息，请检查浏览器存储设置。'));
      request.onblocked = () => {blocked=true;reject(new Error('设备登录存储正被占用，请关闭旧页面后重试。'));};
      request.onsuccess = () => { const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>db.close();resolve(db); };
    });
  }
  async function transaction(mode,operation) {
    const db = await open();
    try {
      return await new Promise((resolve,reject) => {
        const tx=db.transaction('connection',mode),request=operation(tx.objectStore('connection'));
        let result;
        request.onsuccess=()=>{result=request.result;};
        tx.oncomplete=()=>resolve(result);
        tx.onerror=tx.onabort=()=>reject(new Error('此设备无法保存或清除登录信息，请检查浏览器存储设置。'));
      });
    }finally{db.close();}
  }
  function clean(value) {
    if (!value || typeof value.owner!=='string' || !/^[A-Za-z0-9-]+$/.test(value.owner) || typeof value.repo!=='string' || !/^[A-Za-z0-9_.-]+$/.test(value.repo) || typeof value.branch!=='string' || /[\u0000-\u0020]/.test(value.branch) || typeof value.token!=='string' || !value.token.trim() || value.token.length>1024) throw new Error('设备登录信息无效，请重新连接。');
    return {owner:value.owner,repo:value.repo,branch:value.branch,token:value.token.trim()};
  }
  return {
    async read() {
      const record=await transaction('readonly',store=>store.get('current'));
      if (!record) return null;
      try {
        if(record.version!==1 || record.key?.extractable!==false)throw new Error();
        const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:scope},record.key,record.ciphertext);
        return clean(JSON.parse(decoder.decode(bytes)));
      }catch{throw new Error('设备登录信息无法读取，请重新连接。');}
    },
    async save(value) {
      const credentials=clean(value),key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:scope},key,encoder.encode(JSON.stringify(credentials)));
      await transaction('readwrite',store=>store.put({version:1,key,iv,ciphertext},'current'));
    },
    async clear() { await transaction('readwrite',store=>store.delete('current')); }
  };
}
