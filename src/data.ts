import seed from '../seed.json';
import * as yaml from 'js-yaml';

export type Kind = 'knowledge'|'expert'|'source'|'evidence'|'draft'|'project'|'task'|'note';
export interface Citation {id:string;version:number;title:string;quote:string;stance?:string}
export interface Row {
  id:string;kind:Kind;title:string;body:string;tags:string[];category:string;era:string;place:string;status:string;
  sourceIds:string[];relatedIds:string[];favorite:boolean;created:string;updated:string;version:number;example:boolean;
  archived?:boolean;role?:string;initial?:string;quote?:string;projectId?:string;due?:string;format?:string;path?:string;
  aliases?:string[];citations?:Citation[];unresolvedLinks?:string[];[key:string]:unknown;
}
export interface Answer {text:string;citations:Citation[];mode:'ai'|'extract';notice?:string}
declare global {interface Window {asteamPreview?:{ready:()=>void;fail:(message:string)=>void};__qisushuoReady?:boolean;webkitAudioContext?:typeof AudioContext}}
export const offline = Boolean(window.asteamPreview)||location.protocol==='file:'||location.pathname.endsWith('/preview.html');
export const initialRows = seed as Row[];
export const uid = ()=>'r_'+(typeof crypto.randomUUID==='function'?crypto.randomUUID().replaceAll('-',''):Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''));
export const newRow = (kind:Kind,title:string,extra:Partial<Row>={}):Row=>({id:uid(),kind,title,body:'',tags:[],category:'',era:'',place:'',status:kind==='draft'?'草稿':kind==='evidence'?'待核实':kind==='task'?'待开始':kind==='project'?'进行中':'已整理',sourceIds:[],relatedIds:[],favorite:false,created:new Date().toISOString(),updated:new Date().toISOString(),version:0,example:false,...extra});
type Backup = {format:'qisushuo-backup';schema:1;exported_at:string;records:Row[];revisions:Row[]};
let localState:{records:Row[];revisions:Row[]};
let localDb:IDBDatabase;
async function persist(){
  await new Promise<void>((resolve,reject)=>{const tx=localDb.transaction('workspace','readwrite');tx.objectStore('workspace').put(structuredClone(localState),'state');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('设备存储空间不足，请导出备份后重试'));});
}
async function api(path:string,data?:unknown,method?:string){
  const response=await fetch('/api/'+path,{method:method||(data?'POST':'GET'),credentials:'same-origin',headers:{'Content-Type':'application/json','X-Qisushuo':'workspace'},body:data?JSON.stringify(data):undefined});
  let body;try{body=await response.json();}catch{throw new Error('服务暂时不可用，请稍后重试');}
  if(!response.ok)throw new Error(typeof body.detail==='string'?body.detail:'请检查填写的内容后重试');
  return body;
}
export const repo={
  async boot():Promise<{records:Row[];ai_available:boolean}>{
    if(!offline)return api('bootstrap');
    localDb=await new Promise((resolve,reject)=>{const request=indexedDB.open('qisushuo-personal-research',1);request.onupgradeneeded=()=>request.result.createObjectStore('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('当前浏览器无法保存资料，请允许本地存储后重新打开'));});
    localState=await new Promise(resolve=>{const req=localDb.transaction('workspace').objectStore('workspace').get('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(undefined as never);});
    if(!localState){localState={records:structuredClone(initialRows),revisions:structuredClone(initialRows)};await persist();}
    return {records:structuredClone(localState.records),ai_available:false};
  },
  async save(row:Row):Promise<Row>{
    if(!offline)return api('records',row);
    const old=localState.records.find(r=>r.id===row.id);
    if(old&&old.version!==row.version)throw new Error('此记录已更新，请刷新后再试');
    const saved={...row,version:(old?.version||0)+1,updated:new Date().toISOString()};
    const previous=structuredClone(localState);
    localState.records=old?localState.records.map(r=>r.id===saved.id?saved:r):[...localState.records,saved];
    localState.revisions.push(structuredClone(saved));
    try{await persist();}catch(e){localState=previous;throw e;}
    return structuredClone(saved);
  },
  async batch(rows:Row[]):Promise<Row[]>{
    if(!offline)return (await api('imports',{records:rows})).records;
    const previous=structuredClone(localState);
    const result:Row[]=[];
    try{for(const row of rows){const old=localState.records.find(r=>r.id===row.id);if(old&&row.version!==old.version)throw new Error('资料已更新，请重新预览导入');const saved={...row,version:(old?.version||0)+1,updated:new Date().toISOString()};localState.records=old?localState.records.map(r=>r.id===row.id?saved:r):[...localState.records,saved];localState.revisions.push(structuredClone(saved));result.push(saved);}await persist();return result;}catch(e){localState=previous;throw e;}
  },
  async versions(id:string):Promise<Row[]>{return offline?structuredClone(localState.revisions.filter(r=>r.id===id).sort((a,b)=>b.version-a.version)):api('records/'+encodeURIComponent(id)+'/versions');},
  async backup():Promise<Backup>{return offline?{format:'qisushuo-backup',schema:1,exported_at:new Date().toISOString(),...structuredClone(localState)}:api('export');},
  async restore(data:Backup):Promise<Row[]>{
    if(data.format!=='qisushuo-backup'||data.schema!==1||!Array.isArray(data.records)||data.records.length>2000)throw new Error('请选择有效的耆宿说备份文件');
    if(data.records.some(r=>!r.id||!r.title||!r.kind||typeof r.body!=='string'||!Array.isArray(r.tags)))throw new Error('备份中的资料格式不完整');
    if(!offline)return (await api('restore',data)).records;
    const previous=localState;localState={records:structuredClone(data.records),revisions:structuredClone(data.revisions||data.records)};
    try{await persist();return structuredClone(localState.records);}catch(e){localState=previous;throw e;}
  },
  async ask(question:string,rows:Row[],ids:string[]=[],purpose='answer'):Promise<Answer>{
    if(!offline)return api('assistant',{question,source_ids:ids,purpose});
    const hits=rank(rows.filter(r=>['knowledge','source','expert'].includes(r.kind)&&(!ids.length||ids.includes(r.id))),question,Boolean(ids.length)).slice(0,5);
    const citations=hits.map(r=>({id:r.id,version:r.version,title:r.title,quote:r.body.replace(/[#*>]/g,'').trim().slice(0,280)}));
    return {mode:'extract',citations,text:hits.length?'## 找到的资料线索\n\n'+citations.map((c,i)=>'### '+(i+1)+'. '+c.title+'\n'+c.quote+' ['+(i+1)+']').join('\n\n')+'\n\n## 继续研究\n以上为原文摘录。请结合上下文核对；示例内容不作为正式学术依据。':'当前资料不足以回答这个问题。\n\n试着使用更具体的关键词，或先导入相关笔记。没有找到依据时，我不会补写史实。'};
  }
};
export function rank(rows:Row[],query:string,includeAll=false):Row[]{
  const q=query.trim().toLowerCase();if(!q)return rows;
  const words=(q.match(/[a-z]{2,}|[\u4e00-\u9fff]{2,}/g)||[q]);
  const tokens=new Set(words);words.forEach(w=>{if(w.length>2)for(let i=0;i<w.length-1;i++)tokens.add(w.slice(i,i+2));});
  ['存在','不是','不能','相关','如何','哪些','是否','可以','什么','一个','应该','有关','资料','问题','研究','方法','进行','需要','这个','没有','不到','整理','围绕','请围','一份','文章','清晰','结构','标注','来源','采用'].forEach(t=>tokens.delete(t));
  return rows.filter(r=>!r.archived).map(r=>({r,score:[...tokens].reduce((s,t)=>s+(r.title.toLowerCase().includes(t)?8:0)+(r.tags.join(' ').toLowerCase().includes(t)?5:0)+(r.body.toLowerCase().includes(t)?1:0),0)})).filter(v=>v.score>0||includeAll).sort((a,b)=>b.score-a.score).map(v=>v.r);
}
export function download(name:string,content:string,mime='text/plain;charset=utf-8'){
  const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export function exportMarkdown(r:Row){const cite=(r.citations||[]).map((c,i)=>'['+(i+1)+'] '+c.title+'，版本 '+c.version+'\n> '+c.quote.replaceAll('\n','\n> ')).join('\n\n');download(r.title+'.md','# '+r.title+'\n\n'+r.body+(cite?'\n\n## 参考资料\n\n'+cite:'')+(r.example?'\n\n---\n虚拟示例资料，仅供体验。':''));}
export interface ImportItem {file:string;row?:Row;state:'新增'|'更新'|'跳过'|'失败';message:string;links:string[]}
export async function prepareImport(files:File[],existing:Row[]):Promise<ImportItem[]>{
  if(files.length>500)throw new Error('一次最多导入 500 个文件，请分批操作');
  const items:ImportItem[]=[];
  for(const file of files){
    const path=file.webkitRelativePath||file.name;
    if(!/\.(md|markdown|txt)$/i.test(file.name)){items.push({file:path,state:'跳过',message:'支持 Markdown 或纯文本文件',links:[]});continue;}
    if(file.size>2_000_000){items.push({file:path,state:'失败',message:'文件超过 2MB，请分段导入',links:[]});continue;}
    if(path.split(/[\\/]/).includes('..')){items.push({file:path,state:'失败',message:'文件路径不安全',links:[]});continue;}
    try{
      const raw=await file.text();if(!raw.trim())throw new Error('文件内容为空');
      let body=raw,props:Record<string,unknown>={};const front=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if(front){const parsed=yaml.load(front[1]);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))props=parsed as Record<string,unknown>;body=raw.slice(front[0].length);}
      const title=String(props.title||body.match(/^#\s+(.+)$/m)?.[1]||file.name.replace(/\.[^.]+$/,''));
      const list=(v:unknown)=>Array.isArray(v)?v.map(String):typeof v==='string'?v.split(/[,，\s]+/).filter(Boolean):[];
      const tags=[...new Set([...list(props.tags),...[...body.matchAll(/(?:^|\s)#([^#\s\[\]]+)/g)].map(m=>m[1])])].slice(0,30);
      const old=existing.find(r=>r.path===path&&r.kind==='knowledge');
      if(old?.raw===raw){items.push({file:path,state:'跳过',message:'内容未发生变化',links:[]});continue;}
      const row={...(old||newRow('knowledge',title)),title,body,raw,path,tags,aliases:list(props.aliases),category:String(props.category||'导入笔记'),era:String(props.era||''),place:String(props.place||''),example:false,archived:false};
      const links=[...body.matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1].split('|')[0].split('#')[0].replace(/\.md$/,''));
      const markdownLinks=[...body.matchAll(/\[[^\]]+\]\(([^)]+\.md(?:#[^)]*)?)\)/g)].map(m=>decodeURIComponent(m[1].split('#')[0].replace(/\.md$/,'')));
      items.push({file:path,row,state:old?'更新':'新增',message:'',links:[...new Set([...links,...markdownLinks])].filter(Boolean)});
    }catch(e){items.push({file:path,state:'失败',message:e instanceof Error?e.message:'文件无法读取',links:[]});}
  }
  const pool=[...existing.filter(r=>!items.some(i=>i.row?.id===r.id)),...items.flatMap(i=>i.row?[i.row]:[])];
  const stem=(p:string)=>p.replace(/\.(md|markdown|txt)$/i,'');
  for(const item of items){if(!item.row)continue;const resolved:string[]=[],unresolved:string[]=[];
    for(const link of item.links){
      const folder=stem(item.file).split('/').slice(0,-1).join('/');
      const paths=pool.filter(r=>r.path&&(stem(r.path)===link||stem(r.path)===(folder?folder+'/':'')+link));
      const matches=paths.length?paths:pool.filter(r=>r.title===link||r.aliases?.includes(link)||stem(r.path||'').split('/').pop()===link);
      if(matches.length===1)resolved.push(matches[0].id);else unresolved.push(link);
    }
    item.row.relatedIds=[...new Set([...item.row.relatedIds,...resolved])].filter(id=>id!==item.row?.id);item.row.unresolvedLinks=unresolved;
    item.message='已识别 '+resolved.length+' 条关联'+(unresolved.length?'，'+unresolved.length+' 条链接待补全':'');
  }
  return items;
}
