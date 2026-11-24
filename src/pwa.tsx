import {useEffect,useState} from 'react';
import {offline} from './data';
import {Icon,SectionTitle,Badge} from './ui';

interface InstallPrompt extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>}
type Status={ready:boolean;waiting:boolean;error:string;prompt:InstallPrompt|null;installed:boolean};
let status:Status={ready:false,waiting:false,error:'',prompt:null,installed:matchMedia('(display-mode: standalone)').matches};
const changes=new EventTarget();
function update(next:Partial<Status>){status={...status,...next};changes.dispatchEvent(new Event('change'));}
window.addEventListener('beforeinstallprompt',event=>{if(offline){event.preventDefault();update({prompt:event as InstallPrompt});}});
window.addEventListener('appinstalled',()=>update({installed:true,prompt:null}));

export async function prepareInstall(){
 if(!offline||window.asteamPreview||location.pathname.endsWith('/preview.html')||location.protocol==='file:')return;
 if(!window.isSecureContext||!('serviceWorker' in navigator))return;
 try{
  const registration=await navigator.serviceWorker.register(new URL('./sw.js',location.href),{scope:'./',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  update({ready:true,waiting:Boolean(registration.waiting)});
  registration.addEventListener('updatefound',()=>{
   registration.installing?.addEventListener('statechange',()=>update({waiting:Boolean(registration.waiting)}));
  });
 }catch{update({error:'离线资源尚未准备好。请联网重新打开；已保存的资料仍在此设备。'});}
}

export function InstallPanel(){
 const [s,setStatus]=useState(status),[persistent,setPersistent]=useState<boolean|null>(null),[requesting,setRequesting]=useState(false);
 useEffect(()=>{const handler=()=>setStatus(status);changes.addEventListener('change',handler);void navigator.storage?.persisted?.().then(setPersistent).catch(()=>{});return()=>changes.removeEventListener('change',handler);},[]);
 async function install(){if(!s.prompt)return;await s.prompt.prompt();await s.prompt.userChoice;update({prompt:null});}
 async function persist(){setRequesting(true);try{setPersistent(await navigator.storage.persist());}catch{update({error:'浏览器暂未允许持久保存。可以继续使用，请定期导出备份。'});}finally{setRequesting(false);}}
 const secure=window.isSecureContext&&'serviceWorker' in navigator;
 return <section className="settings-panel install-panel"><SectionTitle title="把工作台，放在手边" sub="QISU HUB · 电脑与手机均可使用"/>
 {!offline?<><p className="settings-about-copy">当前使用在线空间。独立应用将资料保存在本机，可在断网后继续研究。先在下方导出完整备份，再到独立应用中恢复，即可带上已有资料。</p><a className="btn primary" href="./app.html#settings"><Icon name="ArrowRight" size={16}/>打开独立应用</a></>:<>
 <div className="settings-row"><div className="settings-row-icon"><Icon name="Download" size={21}/></div><div><h3>{s.installed?'已在独立窗口中运行':'安装 QISU HUB'}</h3><p>{s.ready?'离线资源已准备，可以断网后重开工作台。':secure?'正在准备离线资源，首次使用请保持联网。':'安装和断网重开需要 HTTPS 或电脑本机启动器。'}</p></div><Badge tone={s.ready?'green':'neutral'}>{s.ready?'离线就绪':'待准备'}</Badge></div>
 {s.prompt&&<button className="btn primary" onClick={()=>void install()}><Icon name="Download" size={16}/>安装到此设备</button>}
 {!s.installed&&<div className="install-instructions"><p><strong>iPhone / iPad</strong> · 用 Safari 打开 HTTPS 地址，点“分享”→“添加到主屏幕”。</p><p><strong>Android / 电脑</strong> · 用 Chrome 或 Edge，选择浏览器菜单中的“安装应用”；电脑也可使用下载包的启动器。</p></div>}
 {s.error&&<p role="status" className="model-status-copy">{s.error}</p>}
 {s.waiting&&<p role="status" className="model-status-copy">新版本已下载。保存当前编辑并关闭所有 QISU HUB 窗口，再次打开即可更新。</p>}
 <div className="settings-row"><div className="settings-row-icon"><Icon name="ShieldCheck" size={21}/></div><div><h3>本机资料保护</h3><p>{persistent?'浏览器已允许持久存储。清除网站数据仍会移除资料，请保留备份。':'资料存入当前浏览器。设备之间通过备份迁移，不会自动同步。'}</p></div>{!persistent&&typeof navigator.storage?.persist==='function'&&<button className="btn" disabled={requesting} onClick={()=>void persist()}>申请持久保存</button>}</div>
 </>}
 </section>;
}
