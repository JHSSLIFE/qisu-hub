// Exercise the same shared browser as the user. No separate browser is launched.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.QISUSHUO_URL||'http://127.0.0.1:8800';
const H={'X-Qisushuo':'workspace'};
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
 const page=browser.contexts()[0].pages().find(p=>p.url().startsWith(base));
 const errors=[],consoleErrors=[],network=[],checks=[];let backup;
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)network.push({status:r.status(),url:r.url()});});
 const record=message=>{checks.push(message);console.log('PASS '+message);};
 const svgDrawing=()=>page.locator('.vector-scene').evaluate(el=>el.innerHTML);
 async function ready(){await page.waitForFunction(()=>window.__qisushuoReady);}
 async function sceneReady(){await page.waitForFunction(()=>{const wrapper=document.querySelector('.fiber-scene');return wrapper?.dataset.backend==='svg'?!!wrapper.querySelector('.vector-scene path'):!!wrapper?.querySelector('canvas');});}
 async function noOverflow(label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' horizontal overflow');}
 try{
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?three=home#home');await ready();
  backup=await (await page.request.get(base+'/api/export')).json();
  await page.getByRole('button',{name:'三维读建筑',exact:true}).click();await page.locator('.building-controls').waitFor();await sceneReady();
  assert.equal(await page.getByRole('button',{name:'木构建筑解读',exact:true}).getAttribute('aria-pressed'),'true');
  const backend=await page.locator('.fiber-scene').getAttribute('data-backend');
  let drawing=backend==='svg'?await svgDrawing():'';
  await page.getByRole('button',{name:'分层拆解',exact:true}).click();
  await page.getByRole('button',{name:'合拢建筑',exact:true}).waitFor();
  if(backend==='svg')await page.waitForFunction(old=>document.querySelector('.vector-scene')?.innerHTML!==old,drawing);
  drawing=backend==='svg'?await svgDrawing():'';
  await page.getByRole('button',{name:'线框模式',exact:true}).click();await page.getByRole('button',{name:'实体模式',exact:true}).waitFor();
  if(backend==='svg')await page.waitForFunction(old=>document.querySelector('.vector-scene')?.innerHTML!==old,drawing);
  await page.getByRole('button',{name:'03 柱网与梁架',exact:true}).click();
  await page.locator('.part-description h3').filter({hasText:'柱网与梁架'}).waitFor();
  await page.getByRole('button',{name:'重置建筑视角',exact:true}).click();
  await page.getByRole('button',{name:'合拢建筑',exact:true}).click();await page.getByRole('button',{name:'实体模式',exact:true}).click();
  record('Home entry → real R3F building → explode, wireframe, component selection and reset');
  await page.getByRole('button',{name:'三维知识图谱',exact:true}).click();await sceneReady();
  await page.getByRole('button',{name:'选择节点 沈知远',exact:true}).click();
  await page.locator('.node-inspector h2').filter({hasText:'沈知远'}).waitFor();
  await page.getByRole('button',{name:'查看资料原文',exact:true}).click();
  await page.locator('.detail-heading h1').filter({hasText:'沈知远'}).waitFor();await page.getByRole('button',{name:'关闭窗口',exact:true}).click();
  await page.getByRole('button',{name:'以此为中心',exact:true}).click();assert.equal(await page.getByLabel('选择图谱中心').inputValue(),'e1');
  await page.getByRole('button',{name:'放大图谱',exact:true}).click();await page.getByRole('button',{name:'缩小图谱',exact:true}).click();await page.getByRole('button',{name:'重置图谱',exact:true}).click();
  await page.getByLabel('搜索图谱节点').fill('龘靐齉齾');await page.getByRole('heading',{name:'没有匹配的知识节点',exact:true}).waitFor();
  await page.getByRole('button',{name:'清除筛选',exact:true}).click();await sceneReady();
  await page.getByRole('button',{name:'专家',exact:true}).click();assert((await page.locator('.network-topline .badge').innerText()).includes('4 /'));
  await page.getByRole('button',{name:'全部节点',exact:true}).click();
  record('3D node selection → persisted source detail, focus, zoom, search empty state and category filter');
  // Verify user-saved graph links, directed source edges, and reload persistence.
  const template=backup.records.find(r=>r.kind==='knowledge');
  const stamp=Date.now();const title='三维验收关联 '+stamp;
  const row={...template,id:'three_test_'+stamp,version:0,title,body:'三维图谱验收用的研究记录。',example:false,sourceIds:['s1'],relatedIds:['e1']};
  const saved=await page.request.post(base+'/api/records',{data:row,headers:H});assert.equal(saved.status(),200);
  await page.reload();await ready();await sceneReady();await page.getByLabel('选择图谱中心').selectOption(row.id);
  await page.locator('.node-inspector h2').filter({hasText:title}).waitFor();
  assert((await page.locator('.node-inspector').innerText()).includes('木构营造读书札记'));
  await page.getByRole('button',{name:'关系列表',exact:true}).click();
  const sourceEdge=page.locator('.relation-table-row').filter({hasText:title}).filter({hasText:'资料依据'});
  assert.equal(await sourceEdge.count(),1);await sourceEdge.getByRole('button',{name:'木构营造读书札记',exact:false}).click();
  await page.locator('.detail-heading h1').filter({hasText:'木构营造读书札记'}).waitFor();await page.getByRole('button',{name:'关闭窗口',exact:true}).click();
  record('Saved source/knowledge links enter the graph; source endpoints open correctly; reload persists');
  for(const width of [1440,1024,768,390,360]){
   await page.setViewportSize({width,height:1000});
   for(const mode of ['三维知识图谱','木构建筑解读','关系列表']){await page.getByRole('button',{name:mode,exact:true}).click();if(mode!=='关系列表')await sceneReady();await noOverflow(width+'/'+mode);}
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'木构建筑解读',exact:true}).click();await sceneReady();await noOverflow('reduced motion');
  record('3 scene modes at 1440/1024/768/390/360px, plus reduced-motion layout');
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(network,[]);
  const report={date:new Date().toISOString(),backend,checks,errors,consoleErrors,network,webglNote:backend==='svg'?'Shared browser has WebGL disabled; same R3F scene verified with SVGRenderer. GPU path not browser-verified here.':'WebGL path verified in shared browser.'};
  fs.writeFileSync('tests/three-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{
  if(backup)await page.request.post(base+'/api/restore',{data:backup,headers:H});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?three=done#home');
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
