/* Runs against the existing shared browser; never launches another browser. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.QISUSHUO_URL||'http://127.0.0.1:8800';
const H={'X-Qisushuo':'workspace'};
async function main(){
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
 const context=browser.contexts()[0],page=context.pages().find(p=>p.url().startsWith(base))||await context.newPage();
 const errors=[],consoleErrors=[],badNetwork=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
 page.on('response',r=>{if(r.status()>=400)badNetwork.push({url:r.url(),status:r.status()});});
 let backup,offlineBackup;
 const run=Date.now();const evidenceTitle='验收·斗拱考证 '+run,draftTitle='验收·带引用的创作 '+run;
 let visit=0;
 async function fresh(view='home',offline=false){await page.goto(base+(offline?'/preview.html?verify=':'/?verify=')+(++visit)+'#'+view);await page.waitForFunction(()=>window.__qisushuoReady);}
 async function noOverflow(label){const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *,[role="dialog"] *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&getComputedStyle(el).position!=='fixed';}).slice(0,4).map(el=>el.className)}));assert(overflow.scroll<=overflow.width,label+' overflow: '+JSON.stringify(overflow));}
 try{
   await page.setViewportSize({width:1440,height:1000});await fresh();
   backup=await (await page.request.get(base+'/api/export')).json();
   // Remove only the prior, self-created smoke record from this test workspace.
   const smokeIds=new Set(backup.records.filter(r=>r.title==='功能验收·研究札记').map(r=>r.id));
   backup.records=backup.records.filter(r=>!smokeIds.has(r.id));backup.revisions=backup.revisions.filter(r=>!smokeIds.has(r.id));
   await page.getByRole('button',{name:'导入资料',exact:true}).click();
   const files=[{name:'验收甲.md',mimeType:'text/markdown',buffer:Buffer.from('---\ntitle: 验收甲·木构笔记\ntags: [斗拱, 验收]\naliases: [甲札记]\n---\n# 验收甲·木构笔记\n斗拱研究参考 [[验收乙·来源笔记]]。\n<script>window.__unsafeExecuted=true</script>')},{name:'验收乙.md',mimeType:'text/markdown',buffer:Buffer.from('# 验收乙·来源笔记\n这是引用的原始笔记，保留观察与判断。')}];
   await page.locator('.upload-zone input[accept]').setInputFiles(files);
   await page.getByRole('button',{name:'确认导入 2 条',exact:true}).click();
   await page.getByRole('button',{name:'前往知识库',exact:true}).click();
   await page.getByLabel('搜索知识资料').fill('验收甲');
   await page.getByRole('heading',{name:'验收甲·木构笔记',exact:true}).click();
   assert.equal(await page.evaluate(()=>Boolean(window.__unsafeExecuted)),false);
   await page.getByRole('dialog').getByRole('button',{name:'关联',exact:false}).click();
   await page.getByRole('dialog').getByRole('button',{name:'验收乙·来源笔记',exact:false}).click();
   await page.locator('.detail-heading h1').filter({hasText:'验收乙·来源笔记'}).waitFor();
   await page.getByRole('button',{name:'关闭窗口',exact:true}).click();
   report.push('Markdown frontmatter, tags, aliases, double links, and safe rendering');
   // Identical import is skipped; changed original becomes a new immutable version.
   await page.getByRole('button',{name:'导入资料',exact:true}).click();
   await page.locator('.upload-zone input[accept]').setInputFiles(files);
   await page.getByText('内容未发生变化',{exact:true}).first().waitFor();
   assert.equal(await page.getByRole('button',{name:'确认导入 0 条',exact:true}).isDisabled(),true);
   const updated=[{...files[0],buffer:Buffer.from('# 验收甲·木构笔记\n修改后的斗拱调查资料，参考 [[验收乙·来源笔记]]。')}];
   await page.locator('.upload-zone input[accept]').setInputFiles(updated);
   await page.getByRole('button',{name:'确认导入 1 条',exact:true}).click();
   await page.getByRole('button',{name:'前往知识库',exact:true}).click();
   await page.getByLabel('搜索知识资料').fill('验收甲');
   await page.getByRole('heading',{name:'验收甲·木构笔记',exact:true}).click();
   await page.getByRole('dialog').getByRole('button',{name:'历史',exact:true}).click();
   await page.getByRole('button',{name:/版本 1/}).click();
   await page.getByText('正在查看历史版本 1',{exact:false}).waitFor();
   await page.getByRole('button',{name:'关闭窗口',exact:true}).click();
   report.push('Identical imports skipped; edited originals retain previous snapshots');
   // The offline experience uses the same UI without any network dependencies.
   await fresh('assistant',true);
   offlineBackup=await page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('qisushuo-personal-research',1);req.onsuccess=()=>{const db=req.result;const get=db.transaction('workspace').objectStore('workspace').get('state');get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=reject;};req.onerror=reject;}));
   await page.getByLabel('向知识库提问').fill('斗拱应该从哪些方面观察？');
   await page.getByRole('button',{name:'开始检索',exact:true}).click();
   await page.getByRole('button',{name:'保存为考证',exact:true}).waitFor();
   await page.getByRole('button',{name:'保存为考证',exact:true}).click();
   await page.getByLabel('记录标题',{exact:true}).fill(evidenceTitle);
   await page.getByRole('button',{name:'保存记录',exact:true}).click();
   await page.getByRole('dialog').waitFor({state:'hidden'});
   await page.getByRole('button',{name:'转为创作稿',exact:true}).click();
   await page.getByLabel('记录标题',{exact:true}).fill(draftTitle);
   await page.getByRole('button',{name:'保存记录',exact:true}).click();
   await page.getByRole('dialog').waitFor({state:'hidden'});
   await page.goto(base+'/preview.html#create');
   await page.getByRole('heading',{name:draftTitle,exact:true}).click();
   const downloadPromise=page.waitForEvent('download');
   await page.getByRole('button',{name:'导出',exact:true}).click();
   const dl=await downloadPromise;assert(dl.suggestedFilename().endsWith('.md'));
   await page.getByRole('dialog').getByRole('button',{name:'来源',exact:false}).click();
   assert(await page.locator('.source-citation').count()>0);
   await page.getByRole('button',{name:'定位来源原文',exact:true}).first().click();
   await page.getByRole('dialog').waitFor();
   await page.getByRole('button',{name:'关闭窗口',exact:true}).click();
   await page.reload();await page.waitForFunction(()=>window.__qisushuoReady);
   await page.getByRole('heading',{name:draftTitle,exact:true}).waitFor();
   report.push('Question → cited evidence → cited draft → original version → export → reload');
   await fresh('projects');
   await page.getByRole('button',{name:'进入项目',exact:true}).first().click();
   const before=await page.locator('.task-card.completed').count();
   await page.getByRole('button',{name:/^完成任务 /}).first().click();
   await page.waitForFunction(count=>document.querySelectorAll('.task-card.completed').length===count+1,before);
   await page.getByRole('button',{name:'列表视图',exact:true}).click();
   await page.getByRole('button',{name:'看板视图',exact:true}).click();
   report.push('Project task completion, persisted state and board/list views');
   for(const width of [1440,390,360]){
     await page.setViewportSize({width,height:width===1440?1000:844});
     for(const view of ['home','library','experts','graph','assistant','evidence','create','projects','settings','extras','trash']){
       await fresh(view);await noOverflow(width+'/'+view);
       assert(await page.locator('main h1').count()>0,'missing heading '+view);
     }
   }
   report.push('11 page families at 1440px, 390px and 360px without page overflow');
   await fresh('settings');
   const sound=page.getByRole('switch',{name:'开启启动声音'});const was=await sound.getAttribute('aria-checked');await sound.click();assert.notEqual(await sound.getAttribute('aria-checked'),was);await sound.click();
   await page.getByRole('button',{name:'试听',exact:true}).click();
   const exportPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出备份',exact:true}).click();assert((await exportPromise).suggestedFilename().endsWith('.json'));
   report.push('Startup audio preference, audio preview and complete backup download');
   assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(badNetwork,[]);
   fs.writeFileSync('tests/browser-report.json',JSON.stringify({passed:report,errors,consoleErrors,badNetwork},null,2));
   console.log(JSON.stringify({passed:report,errors,consoleErrors,badNetwork},null,2));
 }finally{
   if(offlineBackup)await page.evaluate(state=>new Promise((resolve,reject)=>{const req=indexedDB.open('qisushuo-personal-research',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put(state,'state');tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=reject;};req.onerror=reject;}),offlineBackup);
   if(backup)await page.request.post(base+'/api/restore',{data:backup,headers:H});
   await page.setViewportSize({width:1440,height:1000});await fresh();
   await browser.close();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
