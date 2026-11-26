import {useState} from 'react';
import {repo} from './data';
import {AUTH_METHODS,authMethodById,DEFAULT_AUTH_METHOD,type AuthMethodId} from './auth-methods';

const USER_RE=/^[A-Za-z0-9._-]{3,64}$/;
const CODE_RE=/^[0-9A-Za-z]{6,16}$/;

/**
 * 两种登录方式各自独立：
 * - 成员：用户名 + 密码
 * - 专家：邀请码
 * 两种表单互不共享状态，切换不清空对方输入，也不触发对方的请求。
 */
export function LoginPage({onDone}:{onDone:()=>void}){
 const params=new URLSearchParams(location.search);
 const legacyInvite=params.get('invite')||'';
 // 专家链接直登：/?code=XXXX-XXXX —— 读参数预填，点一次即可进入
 const urlCode=(params.get('code')||'').replace(/[^0-9A-Za-z]/g,'').toUpperCase().slice(0,16);
 const [method,setMethod]=useState<AuthMethodId>(urlCode?'expert':DEFAULT_AUTH_METHOD);

 const [username,setUsername]=useState(''),[password,setPassword]=useState('');
 const [pwBusy,setPwBusy]=useState(false),[pwErr,setPwErr]=useState('');
 const [code,setCode]=useState(urlCode);
 const [exBusy,setExBusy]=useState(false),[exErr,setExErr]=useState('');

 const current=authMethodById(method);

 async function submitPassword(){
  setPwErr('');
  const name=username.trim();
  if(!USER_RE.test(name)){setPwErr('用户名需为 3–64 位字母、数字、点、下划线或短横线');return;}
  if(password.length<6||password.length>72){setPwErr('密码长度应为 6–72 位');return;}
  setPwBusy(true);
  try{await repo.loginPassword(name,password);onDone();}
  catch(e){setPwErr(e instanceof Error?e.message:'用户名或密码不正确');setPwBusy(false);}
 }

 async function submitExpert(){
  setExErr('');
  const value=code.trim();
  if(!CODE_RE.test(value)){setExErr('邀请码为 6–16 位字母或数字');return;}
  setExBusy(true);
  try{await repo.loginExpertCode(value);onDone();}
  catch(e){setExErr(e instanceof Error?e.message:'邀请码无效或已过期');setExBusy(false);}
 }

 return <div className="boot">
  <div className="brand-seal">耆</div>
  <h1>耆宿说数字工作台</h1>
  <p style={{margin:0}}>选择你的登录方式</p>

  <div className="auth-tabs" role="tablist" aria-label="登录方式">
   {AUTH_METHODS.map(item=><button key={item.id} role="tab" type="button"
     aria-selected={method===item.id} aria-controls={'auth-panel-'+item.id}
     data-auth-method={item.id} data-auth-stage={item.stage}
     className={'auth-tab'+(method===item.id?' active':'')}
     onClick={()=>setMethod(item.id)}>{item.short}</button>)}
  </div>

  {current.id==='password'
   ?<form className="panel login-card" id="auth-panel-password" data-auth-method="password" onSubmit={e=>{e.preventDefault();void submitPassword();}}>
     <h2>成员登录</h2>
     <p className="login-hint">使用管理员分配的用户名与密码。账号由平台侧生成，忘记密码请联系管理员重置。</p>
     <label>用户名
      <input value={username} onChange={e=>{setUsername(e.target.value);setPwErr('');}}
        placeholder="如 jiahao 或 jiahao.li" required autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus/>
     </label>
     <label>密码
      <input type="password" value={password} onChange={e=>{setPassword(e.target.value);setPwErr('');}}
        placeholder="6–72 位" required autoComplete="current-password"/>
     </label>
     {pwErr&&<p className="login-err">{pwErr}</p>}
     <button className="btn primary" type="submit" disabled={pwBusy||!username.trim()||!password}>
      {pwBusy?'正在登录…':'登录'}
     </button>
    </form>
   :<form className="panel login-card" id="auth-panel-expert" data-auth-method="expert" onSubmit={e=>{e.preventDefault();void submitExpert();}}>
     <h2>专家邀请码登录</h2>
     {urlCode
      ?<p className="login-hint">已从链接读取邀请码，点「进入空间」即可。链接有时效，过期请向项目负责人索取新的。</p>
      :<p className="login-hint">输入管理员发给你的邀请码。邀请码有有效期，进入后只能看到授权给你的资料。</p>}
     <label>邀请码
      <input value={code} onChange={e=>{setCode(e.target.value.replace(/[^0-9A-Za-z]/g,'').toUpperCase().slice(0,16));setExErr('');}}
        placeholder="如 QISU8X2K" required autoCapitalize="characters" spellCheck={false} autoComplete="one-time-code" autoFocus/>
     </label>
     {exErr&&<p className="login-err">{exErr}</p>}
     <button className="btn primary" type="submit" disabled={exBusy||!CODE_RE.test(code)}>
      {exBusy?'正在验证…':'进入空间'}
     </button>
     <p className="login-hint">没有邀请码？请联系邀请你的项目负责人。</p>
    </form>}

  {legacyInvite&&<p className="login-msg">邀请链接已改为邀请码登录，请向邀请人索取邀请码。</p>}
  <p style={{margin:0,fontSize:12}}>两种方式相互独立 · 成员账号与专家邀请码均由管理员发放</p>
 </div>;
}
