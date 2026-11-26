import {useState,useEffect,useRef} from 'react';
import {useApp} from './context';
import {AUTH_METHODS} from './auth-methods';
import {InstallPanel} from './pwa';
import {repo,offline,download,initialRows,type Row} from './data';
import {Icon,PageHeading,SectionTitle,Empty,Modal,Badge,DateText,RecordMini} from './ui';

const ROLE_LABEL:Record<string,string>={owner:'所有者',admin:'管理员',editor:'编辑',reviewer:'审阅',viewer:'只读'};

function AccountPanel(){
 const a=useApp();
 const [busy,setBusy]=useState(false),[inviteRole,setInviteRole]=useState('editor'),[inviteUrl,setInviteUrl]=useState(''),[members,setMembers]=useState<{email:string;role:string}[]>([]);
 useEffect(()=>{if(!a.spaceId||!a.user)return;repo.me().then(d=>setMembers(d.members)).catch(()=>{});},[a.spaceId,a.user]);
 async function makeInvite(){setBusy(true);try{const r=await repo.invite(inviteRole,72);setInviteUrl(location.origin+r.url);a.notify('邀请链接已生成，72 小时内有效');}catch(e){a.notify(e instanceof Error?e.message:'生成失败',true);}finally{setBusy(false);}}
 async function leave(){setBusy(true);try{await repo.logout();}catch{}location.reload();}
 const copy=()=>{void navigator.clipboard?.writeText(inviteUrl);a.notify('邀请链接已复制');};
 if(!a.user)return <section className="settings-panel"><SectionTitle title="账号与协作" sub="登录后，电脑与手机共用同一个空间"/><p className="model-status-copy">当前未登录，请返回登录页使用管理员分配的账号或专家邀请码进入。</p></section>;
 return <section className="settings-panel"><SectionTitle title="账号与协作" sub="登录后，电脑与手机共用同一个空间"/>
  <div className="settings-row"><div className="settings-row-icon"><Icon name="Users" size={21}/></div><div><h3>{a.user.email.startsWith('expert-')?'外部专家':a.user.email}</h3><p>角色：{ROLE_LABEL[a.user.role]||a.user.role} · 空间 {a.spaceId.slice(0,6)} · 成员 {members.length} 人</p></div><Badge tone="green">已登录</Badge></div>
  {members.length>1&&<p className="model-status-copy">成员：{members.map(m=>m.email.split('@')[0]+'（'+(ROLE_LABEL[m.role]||m.role)+'）').join(' · ')}</p>}
  {(a.user.role==='owner'||a.user.role==='admin')?<div className="settings-row"><div className="settings-row-icon"><Icon name="Users" size={21}/></div><div><h3>生成邀请链接</h3><p>一次性有效，72 小时后过期；对方登录即加入本空间。</p></div><select value={inviteRole} onChange={e=>setInviteRole(e.target.value)} aria-label="邀请角色"><option value="editor">编辑</option><option value="reviewer">审阅</option><option value="viewer">只读</option></select><button className="btn" disabled={busy} onClick={()=>void makeInvite()}>生成</button></div>:null}
  {inviteUrl&&<div className="settings-row"><div className="settings-row-icon"><Icon name="Link2" size={21}/></div><div><h3>邀请链接</h3><p className="invite-url">{inviteUrl}</p></div><button className="text-btn" onClick={copy}>复制</button></div>}
  <div className="settings-row"><div className="settings-row-icon"><Icon name="Settings2" size={21}/></div><div><h3>登录方式</h3><p>{AUTH_METHODS.map(m=>m.short+(m.stage==='active'?'（已启用）':'（待接入）')).join(' · ')}</p></div><Badge tone="muted">仅两种</Badge></div>
  <div className="settings-row"><div className="settings-row-icon"><Icon name="ShieldCheck" size={21}/></div><div><h3>登录设备</h3><p>设备列表与单端踢出待接入；当前可退出登录后重新验证。</p></div><Badge tone="muted">待接入</Badge></div>
  <div className="settings-row"><div className="settings-row-icon"><Icon name="X" size={21}/></div><div><h3>退出登录</h3><p>退出后本设备回到未登录状态，资料仍在服务端。</p></div><button className="text-btn" disabled={busy} onClick={()=>void leave()}>退出</button></div>
 </section>;
}

const ROLE_TEXT:Record<string,string>={owner:'所有者',admin:'管理员',editor:'普通用户',reviewer:'审阅',viewer:'只读',expert:'专家'};
const CODE_STATE:Record<string,{text:string;tone:'green'|'muted'|'warm'}>={active:{text:'生效中',tone:'green'},expired:{text:'已过期',tone:'warm'},revoked:{text:'已撤销',tone:'muted'},none:{text:'未发码',tone:'muted'}};
type Member={user_id:string;name:string;email:string;role:string;grants:number;grant_ids:string[];code?:{state:string;expires:string}};
type AuditRow={action:string;result:string;actor:string;role:string;resource:string;ip:string;detail:string;created:string};

export function PermissionsPage(){
 const a=useApp();
 const [members,setMembers]=useState<Member[]>([]);
 const [records,setRecords]=useState<{id:string;title:string;kind:string}[]>([]);
 const [sel,setSel]=useState(''),[checked,setChecked]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[err,setErr]=useState('');
 const [name,setName]=useState(''),[days,setDays]=useState(30);
 const [issued,setIssued]=useState<{name:string;code:string;expires:string}|null>(null);
 const [events,setEvents]=useState<AuditRow[]>([]);
 const admin=a.user&&(a.user.role==='owner'||a.user.role==='admin');
 function load(){if(!admin)return;repo.adminOverview().then(d=>{setMembers(d.members);setRecords(d.records);}).catch(e=>setErr(e instanceof Error?e.message:'无法读取权限信息'));
   repo.adminAudit(30).then(d=>setEvents(d.events)).catch(()=>{});}
 useEffect(()=>{load();},[admin]);
 if(!admin)return <><PageHeading eyebrow="PERMISSIONS" title="权限设置" text="仅管理员可访问。"/><div className="panel"><Empty title="没有访问权限" text="权限设置仅对空间所有者与管理员开放。"/></div></>;
 const experts=members.filter(m=>m.role==='expert');
 const current=experts.find(m=>m.user_id===sel);
 function pick(userId:string){setSel(userId);setChecked(experts.find(m=>m.user_id===userId)?.grant_ids||[]);}
 async function changeRole(userId:string,role:string){setBusy(true);try{await repo.setMemberRole(userId,role);a.notify('角色已更新');load();}catch(e){a.notify(e instanceof Error?e.message:'修改失败',true);}finally{setBusy(false);}}
 async function saveGrants(){if(!current)return;setBusy(true);try{await repo.setGrants(current.user_id,checked);a.notify('专家可见范围已更新，对方刷新后生效');load();}catch(e){a.notify(e instanceof Error?e.message:'保存失败',true);}finally{setBusy(false);}}
 async function createExpert(){const n=name.trim();if(!n)return;setBusy(true);try{const r=await repo.adminCreateExpert(n,days);setIssued({name:r.name,code:r.code,expires:r.expires});setName('');a.notify('已创建专家并生成专属邀请码');load();}catch(e){a.notify(e instanceof Error?e.message:'创建失败',true);}finally{setBusy(false);}}
 async function resetCode(userId:string){setBusy(true);try{const r=await repo.adminResetExpertCode(userId,days);const who=members.find(m=>m.user_id===userId);setIssued({name:who?.name||'专家',code:r.code,expires:r.expires});a.notify('已重置，旧链接立即失效');load();}catch(e){a.notify(e instanceof Error?e.message:'重置失败',true);}finally{setBusy(false);}}
 async function revokeExpert(userId:string){if(!confirm('撤销后该专家的邀请码与在线会话立即失效，确定？'))return;setBusy(true);try{const r=await repo.adminRevokeExpert(userId);a.notify('已撤销，踢出 '+r.sessions+' 个会话');load();}catch(e){a.notify(e instanceof Error?e.message:'撤销失败',true);}finally{setBusy(false);}}
 const link=issued?location.origin+'/?code='+issued.code:'';
 const copy=()=>{if(!link)return;void navigator.clipboard?.writeText(link);a.notify('链接已复制，可直接发给专家');};

 return <><PageHeading eyebrow="PERMISSIONS" title="权限设置" text="角色决定能做什么，专家授权决定能看到什么。两者都在服务端校验。"/>
  {err&&<p className="model-status-copy">{err}</p>}

  {issued&&<section className="settings-panel"><SectionTitle title="邀请码（只显示这一次）" sub="关闭后无法再查看，只能重置生成新的"/>
   <div className="panel"><div className="settings-row"><div className="settings-row-icon"><Icon name="Link2" size={21}/></div>
    <div><h3 style={{fontFamily:'ui-monospace,monospace',letterSpacing:2,fontSize:18}}>{issued.code}</h3>
     <p>{issued.name} · 有效至 {issued.expires.slice(0,10)} · 可多设备登录，到期或撤销即失效</p>
     <p className="invite-url">{link}</p></div>
    <button className="btn primary" onClick={copy}>复制链接</button></div></div>
  </section>}

  <section className="settings-panel"><SectionTitle title="成员与角色" sub="普通用户看不到本页，也无法调用相关接口"/>
   <div className="panel">{members.map(m=><div className="settings-row" key={m.user_id}><div className="settings-row-icon"><Icon name="Users" size={21}/></div><div><h3>{m.name||m.email}{m.user_id===a.user?.id?'（我）':''}</h3><p>{m.email} · {m.role==='expert'?'可见资料 '+m.grants+' 条':'可查看全部资料'}</p></div>
    {m.user_id===a.user?.id?<Badge tone="green">{ROLE_TEXT[m.role]||m.role}</Badge>:
     <select value={m.role} disabled={busy} onChange={e=>void changeRole(m.user_id,e.target.value)} aria-label={'角色 '+m.email}><option value="admin">管理员</option><option value="editor">普通用户</option><option value="expert">专家</option><option value="viewer">只读</option></select>}
   </div>)}</div>
  </section>

  <section className="settings-panel"><SectionTitle title="专家与邀请码" sub="一位专家一个码：码绑定身份，不同专家的资料互不可见"/>
   <div className="settings-row"><div className="settings-row-icon"><Icon name="Users" size={21}/></div>
    <div><h3>新建专家</h3><p>填姓名即生成专属邀请码，随后在下方为他勾选可见资料</p></div>
    <input value={name} onChange={e=>setName(e.target.value)} placeholder="专家姓名" aria-label="专家姓名" style={{width:130}}/>
    <select value={days} onChange={e=>setDays(Number(e.target.value))} aria-label="有效期"><option value={7}>7 天</option><option value={30}>30 天</option><option value={90}>90 天</option><option value={365}>1 年</option></select>
    <button className="btn primary" disabled={busy||!name.trim()} onClick={()=>void createExpert()}>生成邀请码</button></div>
   {experts.length?experts.map(m=>{const cs=CODE_STATE[m.code?.state||'none']||CODE_STATE.none;return <div className="settings-row" key={m.user_id}>
     <div className="settings-row-icon"><Icon name="ShieldCheck" size={21}/></div>
     <div><h3>{m.name||m.email}</h3><p>可见资料 {m.grants} 条{m.code?.expires?' · 到期 '+m.code.expires.slice(0,10):''}</p></div>
     <Badge tone={cs.tone}>{cs.text}</Badge>
     <button className="text-btn" disabled={busy} onClick={()=>void resetCode(m.user_id)}>重置码</button>
     <button className="text-btn" disabled={busy} onClick={()=>void revokeExpert(m.user_id)}>撤销</button>
    </div>}):<p className="model-status-copy">还没有专家账号。上面填姓名即可创建第一位。</p>}
  </section>

  <section className="settings-panel"><SectionTitle title="专家资料隔离" sub="未勾选的资料，专家在列表、检索、导出中都不可见"/>
   {experts.length?<>
    <div className="settings-row"><div className="settings-row-icon"><Icon name="ShieldCheck" size={21}/></div><div><h3>选择专家</h3><p>按专家逐一分配可见资料</p></div>
     <select value={sel} onChange={e=>pick(e.target.value)} aria-label="选择专家"><option value="">请选择</option>{experts.map(m=><option key={m.user_id} value={m.user_id}>{m.name||m.email}</option>)}</select></div>
    {current&&<div className="panel" style={{maxHeight:340,overflow:'auto'}}>{records.map(r=><label className="grant-row" key={r.id}><input type="checkbox" checked={checked.includes(r.id)} onChange={e=>setChecked(prev=>e.target.checked?[...prev,r.id]:prev.filter(id=>id!==r.id))}/><span>{r.title}</span><small>{r.kind}</small></label>)}</div>}
    {current&&<div className="settings-row"><div><h3>已选 {checked.length} 条</h3><p>保存后立即生效，专家需要重新打开页面</p></div><button className="btn primary" disabled={busy} onClick={()=>void saveGrants()}>保存授权</button></div>}
   </>:<p className="model-status-copy">当前空间还没有专家账号。</p>}
  </section>

  <section className="settings-panel"><SectionTitle title="最近操作（审计）" sub="登录、写入、导出、授权、越权拒绝都会留痕，只读不可改"/>
   {events.length?<div className="panel">{events.slice(0,20).map((e,i)=><div className="grant-row" key={i}>
     <small style={{width:112,flex:'0 0 112px'}}>{e.created.slice(5,16).replace('T',' ')}</small>
     <span>{e.actor}{e.role?'（'+(ROLE_TEXT[e.role]||e.role)+'）':''} · {e.action}{e.detail?' · '+e.detail:''}</span>
     <small style={{color:e.result==='denied'?'#a32d2d':'#8a897f'}}>{e.result==='denied'?'已拒绝':e.result==='ok'?'成功':'—'}</small>
    </div>)}</div>:<p className="model-status-copy">暂无记录。</p>}
  </section>
 </>;
}

export function SettingsPage(){
 const a=useApp();const [name,setName]=useState(a.name),[working,setWorking]=useState(false),[pending,setPending]=useState<Awaited<ReturnType<typeof repo.backup>>|null>(null),[consent,setConsent]=useState(false);const fileRef=useRef<HTMLInputElement>(null);
 async function backup(){setWorking(true);try{const data=await repo.backup();download('耆宿说资料备份-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json');a.notify('完整备份已导出，包含资料与历史版本');}catch(e){a.notify(e instanceof Error?e.message:'导出失败，请重试',true);}finally{setWorking(false);}}
 async function choose(file:File){if(file.size>30_000_000){a.notify('备份超过 30MB，请分批整理资料',true);return;}try{const data=JSON.parse(await file.text());if(data.format!=='qisushuo-backup'||data.schema!==1||!Array.isArray(data.records))throw new Error('请选择耆宿说导出的完整备份');setConsent(false);setPending(data);}catch(e){a.notify(e instanceof Error?e.message:'文件无法读取',true);}}
 async function restore(){if(!pending)return;setWorking(true);try{const data=await repo.restore(pending);a.setRows(data);setPending(null);a.notify('备份已恢复，资料与历史版本可继续查看');}catch(e){a.notify(e instanceof Error?e.message:'恢复未完成，原有资料保留',true);}finally{setWorking(false);}}
 async function restoreExamples(){const missing=initialRows.filter(r=>!a.live.some(x=>x.id===r.id)).map(r=>({...r,archived:false,version:a.rows.find(x=>x.id===r.id)?.version||0}));if(!missing.length){a.notify('所有内置示例都在研究空间中');return;}const result=await a.batch(missing);if(result)a.notify('已补充 '+result.length+' 条内置示例，已有内容保持不变');}
 return <><PageHeading eyebrow="YOUR RESEARCH SPACE" title="让研究空间，更合心意" text="管理个人偏好与资料，让长期积累始终安心。"/><div className="settings-layout"><AccountPanel/><InstallPanel/><section className="settings-panel"><SectionTitle title="个人偏好"/><form className="settings-name" onSubmit={e=>{e.preventDefault();if(name.trim()){a.setName(name.trim().slice(0,20));a.notify('称呼已更新');}}}><label>希望怎么称呼你？<input value={name} onChange={e=>setName(e.target.value)} maxLength={20} required aria-label="研究者称呼"/></label><button className="btn" disabled={!name.trim()} type="submit">保存称呼</button></form><div className="settings-row"><div className="settings-row-icon"><Icon name={a.sound?'Volume2':'VolumeX'} size={21}/></div><div><h3>开启研究的声音</h3><p>首次点击时响起一段轻柔提示音。</p></div><button className="text-btn" onClick={a.playSound}>试听</button><button role="switch" aria-checked={a.sound} aria-label="开启启动声音" className={'switch '+(a.sound?'on':'')} onClick={()=>a.setSound(!a.sound)}><span/></button></div><div className="settings-row"><div className="settings-row-icon"><Icon name="ShieldCheck" size={21}/></div><div><h3>{offline?'资料保存在此设备':'你的独立研究空间'}</h3><p>{offline?'资料保存在当前浏览器；离线就绪后可断网使用，请定期导出备份。':'资料独立保存；同一浏览器再次打开可继续研究。'}</p></div><Badge tone="green">已启用</Badge></div></section><section className="settings-panel"><SectionTitle title="资料与备份" sub="每一份积累，都值得妥善留存"/><div className="settings-row"><div className="settings-row-icon"><Icon name="Download" size={21}/></div><div><h3>导出完整备份</h3><p>包含所有资料、稿件、关系与历史版本。</p></div><button className="btn" disabled={working} onClick={()=>void backup()}><Icon name="Download" size={16}/>导出备份</button></div><div className="settings-row"><div className="settings-row-icon"><Icon name="RotateCcw" size={21}/></div><div><h3>从备份恢复</h3><p>选择此前导出的备份文件，恢复整个研究空间。</p></div><button className="btn" disabled={working} onClick={()=>fileRef.current?.click()}>选择备份</button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void choose(f);e.target.value='';}}/></div><div className="settings-row"><div className="settings-row-icon"><Icon name="Trash2" size={21}/></div><div><h3>回收站</h3><p>{a.rows.filter(r=>r.archived).length} 条已归档资料，仍可恢复。</p></div><button className="text-btn" onClick={()=>a.navigate('trash')}>查看<Icon name="ChevronRight" size={15}/></button></div></section><section className="settings-panel"><SectionTitle title="知识助理"/><div className="settings-row"><div className="settings-row-icon"><Icon name="Sparkles" size={21}/></div><div><h3>{a.ai&&!offline?'模型辅助整理':'资料摘录模式'}</h3><p>{a.ai&&!offline?'已接入服务端模型，仅围绕检索到的资料整理回答。':'直接检索与摘录原文，保留出处，可继续考证与创作。'}</p></div><Badge tone="green">{a.ai&&!offline?'已连接':'可直接使用'}</Badge></div><p className="model-status-copy">{a.ai&&!offline?'与问题相关的资料片段会发送至所配置的模型服务。回答需要结合原文审阅；暂不可用时会保留原文线索。':'当前未启用大模型生成。资料检索、来源引用、手动编辑和导出均可使用，后续可由部署者在服务端接入模型。'}</p></section><section className="settings-panel"><SectionTitle title="关于这份研究空间"/><div className="about-product"><span className="brand-seal">耆</span><div><h3>耆宿说数字工作台 QISU HUB</h3><p>连接文化，传承知识。</p></div></div><p className="settings-about-copy">知识因积累而丰厚，因关联而鲜活。耆宿说陪你把散落的资料整理成有来源、有脉络、可继续生长的研究成果。</p><div className="notice"><Icon name="Info"/><p>内置专家、笔记和项目均为虚拟示例。提问时只将与问题相关的资料片段用于智能整理，回答仍需结合原文核对。</p></div><div className="settings-bottom"><span>当前 {a.live.length} 条记录 · {a.live.filter(r=>!r.example).length} 条自有记录{a.spaceId?' · 空间 '+a.spaceId.slice(0,6):''}</span><button className="text-btn" disabled={a.busy} onClick={()=>void restoreExamples()}>补充缺失的示例<Icon name="RotateCcw" size={14}/></button></div></section></div>{pending&&<Modal title="恢复这份研究备份？" onClose={()=>{if(!working)setPending(null);}} footer={<><button className="btn" disabled={working} onClick={()=>setPending(null)}>取消</button><button className="btn primary" disabled={!consent||working} onClick={()=>void restore()}>{working?'正在恢复':'确认恢复'}</button></>}><p>备份包含 <strong>{pending.records.length}</strong> 条记录，将替换当前空间的资料。</p><p className="muted">建议先导出当前空间的备份，避免丢失未备份的内容。</p><label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>我已了解，恢复后使用这份备份中的资料</label></Modal>}</>;
}
export function TrashPage(){const a=useApp();const rows=a.rows.filter(r=>r.archived);return <><PageHeading eyebrow="KEPT FOR LATER" title="暂时放下的资料，仍有归处" text="移入回收站的资料不会立即删除，旧的引用和历史版本仍保留。" actions={<button className="btn" onClick={()=>a.navigate('settings')}><Icon name="ArrowLeft" size={16}/>返回设置</button>}/><div className="panel trash-list">{rows.map(r=><div className="trash-row" key={r.id}><span className="record-symbol"><Icon name="FileText" size={20}/></span><button onClick={()=>a.open(r)}><strong>{r.title}</strong><small>归档于 <DateText date={r.updated}/></small></button><button className="btn" disabled={a.busy} onClick={()=>void a.save({...r,archived:false},'资料已恢复')}><Icon name="RotateCcw" size={15}/>恢复</button></div>)}{!rows.length&&<Empty title="回收站是空的" text="归档的资料会出现在这里，随时可以恢复。"/>}</div></>;}

export function ExtrasPage(){
 const a=useApp();const [game,setGame]=useState<'memory'|'puzzle'|null>(null);const notes=a.live.filter(r=>r.kind==='note');
 return <><PageHeading eyebrow="A MOMENT BETWEEN RESEARCH" title="研究之余，也留一点闲趣" text="换一个角度认识古建，让思路在小小的停顿中重新生长。"/><div className="extras-grid"><section className="extra-card memory"><div className="memory-illustration">{['斗','卯','梁','瓦','檐','斗'].map((s,i)=><span key={i}>{s}</span>)}</div><div><span className="eyebrow">01 · 记忆配对</span><h2>一眼识古建</h2><p>翻开卡片，找到成对的古建术语。六组线索，考验观察与记忆。</p><button className="btn primary" onClick={()=>setGame('memory')}>开始配对<Icon name="ArrowRight" size={16}/></button></div></section><section className="extra-card puzzle"><div className="puzzle-illustration">{['一','二','三','四','五','六','七','','八'].map((s,i)=><span key={i} className={!s?'blank':''}>{s}</span>)}</div><div><span className="eyebrow">02 · 九宫复原</span><h2>方寸之间</h2><p>移动空格旁的方块，让九宫回到原来的秩序。慢一点，也能找到答案。</p><button className="btn" onClick={()=>setGame('puzzle')}>开始拼图<Icon name="ArrowRight" size={16}/></button></div></section></div><section className="notes-section"><SectionTitle title="研究便笺" sub="还没想透的念头，也先留下来" action={<button className="btn" onClick={()=>a.create('note')}><Icon name="Plus" size={16}/>写一张便笺</button>}/>{notes.length?<div className="notes-grid">{notes.map(r=><button className="note-card" key={r.id} onClick={()=>a.edit(r)}><Icon name="StickyNote" size={19}/><h3>{r.title}</h3><p>{r.body.slice(0,180)}</p><small><DateText date={r.updated}/></small></button>)}</div>:<div className="note-empty"><Icon name="StickyNote" size={25}/><p>一个选题、一句灵感，或一个尚未找到答案的问题。</p><button className="text-btn" onClick={()=>a.create('note')}>记下第一个念头<Icon name="ArrowRight" size={15}/></button></div>}</section>{game&&<Modal title={game==='memory'?'一眼识古建 · 记忆配对':'方寸之间 · 九宫复原'} onClose={()=>setGame(null)}>{game==='memory'?<MemoryGame/>:<PuzzleGame/>}</Modal>}</>;
}
function shuffled<T,>(list:T[]):T[]{const copy=[...list];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
function MemoryGame(){
 const labels=['斗拱','榫卯','梁架','瓦当','屋脊','院落'];const [cards,setCards]=useState(()=>shuffled([...labels,...labels])),[open,setOpen]=useState<number[]>([]),[matched,setMatched]=useState<string[]>([]),[turns,setTurns]=useState(0),[locked,setLocked]=useState(false);const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 function choose(i:number){if(locked||open.includes(i)||matched.includes(cards[i]))return;const next=[...open,i];setOpen(next);if(next.length===2){setTurns(n=>n+1);if(cards[next[0]]===cards[next[1]]){setMatched(m=>[...m,cards[i]]);setOpen([]);}else {setLocked(true);timer.current=setTimeout(()=>{setOpen([]);setLocked(false);},850);}}}
 function reset(){clearTimeout(timer.current);setCards(shuffled([...labels,...labels]));setOpen([]);setMatched([]);setTurns(0);setLocked(false);}
 return <div className="game-content"><p>翻开两张卡片，找出相同的术语。</p><div className="game-meta"><span>已配对 <strong>{matched.length}/6</strong></span><span>翻牌 <strong>{turns}</strong> 次</span></div><div className="memory-board">{cards.map((c,i)=>{const visible=open.includes(i)||matched.includes(c);return <button className={(visible?'flipped ':'')+(matched.includes(c)?'matched':'')} key={i} disabled={matched.includes(c)||locked&&!open.includes(i)} aria-label={visible?c:'翻开第 '+(i+1)+' 张卡片'} onClick={()=>choose(i)}>{visible?c:'耆'}{matched.includes(c)&&<Icon name="Check" size={14}/>}</button>;})}</div>{matched.length===6&&<div className="game-win"><Icon name="CheckCircle2" size={24}/><h3>六组线索，都找到了！</h3><p>你用了 {turns} 次翻牌，记住了六个古建术语。</p></div>}<button className="btn" onClick={reset}><Icon name="RotateCcw" size={16}/>重新开始</button></div>;
}
function legal(board:number[],index:number){const zero=board.indexOf(0);return Math.abs(Math.floor(zero/3)-Math.floor(index/3))+Math.abs(zero%3-index%3)===1;}
function freshPuzzle(){let b=[1,2,3,4,5,6,7,8,0],previous=-1;for(let i=0;i<70;i++){const candidates=b.map((_,j)=>j).filter(j=>legal(b,j)&&j!==previous);const target=candidates[Math.floor(Math.random()*candidates.length)],zero=b.indexOf(0);[b[zero],b[target]]=[b[target],b[zero]];previous=zero;}return b;}
function PuzzleGame(){
 const [board,setBoard]=useState(freshPuzzle),[moves,setMoves]=useState(0);const won=board.every((v,i)=>v===(i+1)%9);
 function move(i:number){if(won||!legal(board,i))return;const next=[...board],zero=next.indexOf(0);[next[zero],next[i]]=[next[i],next[zero]];setBoard(next);setMoves(m=>m+1);}
 useEffect(()=>{function key(e:KeyboardEvent){if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;const zero=board.indexOf(0),target=zero+({ArrowUp:3,ArrowDown:-3,ArrowLeft:1,ArrowRight:-1}[e.key]||0);if(target>=0&&target<9&&legal(board,target)){e.preventDefault();move(target);}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[board,won]);
 return <div className="game-content"><p>点击空格旁的方块，将一至八依次排好。</p><div className="game-meta"><span>已移动 <strong>{moves}</strong> 步</span><span>目标：一至八，空格在右下</span></div><div className="puzzle-board">{board.map((v,i)=>v?<button key={v} disabled={!legal(board,i)||won} onClick={()=>move(i)} aria-label={'移动方块 '+v}>{'一二三四五六七八'[v-1]}<small>{v}</small></button>:<span key="zero" className="puzzle-empty"/> )}</div>{won&&<div className="game-win"><Icon name="CheckCircle2" size={25}/><h3>方寸归序，恰到好处。</h3><p>你用了 {moves} 步完成复原。</p></div>}<button className="btn" onClick={()=>{setBoard(freshPuzzle());setMoves(0);}}><Icon name="RotateCcw" size={16}/>重新开始</button></div>;
}
