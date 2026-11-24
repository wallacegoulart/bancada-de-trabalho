"use strict";
// File System Access API: arquivos físicos são a fonte oficial. IndexedDB guarda somente o handle da pasta.
const FileStorage = (() => {
  let root = null;
  let queue = Promise.resolve();
  const DB = 'devworkbench_directory_v07';
  function dbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore('settings');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function savedHandle(){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('settings','readonly');const req=tx.objectStore('settings').get('folder');req.onsuccess=()=>{resolve(req.result||null);db.close();};req.onerror=()=>{reject(req.error);db.close();};});}
  async function storeHandle(handle){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(handle,'folder');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
  async function authorized(handle,ask=false){if(!handle)return false;const options={mode:'readwrite'};if((await handle.queryPermission(options))==='granted')return true;return ask&&(await handle.requestPermission(options))==='granted';}
  async function restore(){try{const handle=await savedHandle();if(handle&&await authorized(handle)){root=handle;return true;}root=null;return false;}catch(e){console.warn(e);return false;}}
  async function reconnect(){const handle=await savedHandle();if(handle&&await authorized(handle,true)){root=handle;return true;}return false;}
  async function select(){if(!window.showDirectoryPicker)throw new Error('O Chrome não disponibilizou acesso à pasta. Abra em uma versão compatível do Chrome.');await Promise.resolve();const handle=await window.showDirectoryPicker({mode:'readwrite',id:'devworkbench'});if(!await authorized(handle,true))throw new Error('Permissão de escrita não concedida.');await queue;root=handle;try{await storeHandle(handle);}catch(e){console.warn("Não foi possível memorizar a pasta",e);}return true;}
  function ready(){return !!root;}
  function name(){return root?.name||'Nenhuma pasta conectada';}
  async function directory(path,create){let dir=root;if(!dir)throw new Error('Conecte uma pasta para continuar.');for(const part of path.split('/').filter(Boolean))dir=await dir.getDirectoryHandle(part,{create});return dir;}
  async function read(path,fallback=null){try{const parts=path.split('/');const file=await (await directory(parts.slice(0,-1).join('/'),false)).getFileHandle(parts.at(-1));return await (await file.getFile()).text();}catch(e){if(e.name==='NotFoundError')return fallback;throw e;}}
  async function write(path,text){const parts=path.split('/');const dir=await directory(parts.slice(0,-1).join('/'),true);const file=await dir.getFileHandle(parts.at(-1),{create:true});const stream=await file.createWritable();try{await stream.write(text);await stream.close();}catch(e){await stream.abort().catch(()=>{});throw e;}}
  async function remove(path){const parts=path.split('/');const dir=await directory(parts.slice(0,-1).join('/'),false);await dir.removeEntry(parts.at(-1));}
  async function json(path,fallback){const text=await read(path);if(text===null)return structuredClone(fallback);return JSON.parse(text);}
  // Serializa todas as operações de escrita para impedir sobrescrita por operações simultâneas.
  function enqueue(job){const next=queue.then(job);queue=next.catch(()=>{});return next;}
  return {restore,reconnect,select,ready,name,read,write,remove,json,enqueue};
})();
