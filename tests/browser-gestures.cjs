const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.QISUSHUO_URL||'http://127.0.0.1:8800';
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
 const page=browser.contexts()[0].pages().find(p=>p.url().startsWith(base));const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?gestures=1#graph');
  await page.waitForFunction(()=>window.__qisushuoReady);await page.waitForSelector('.scene-node-label');
  const backend=await page.locator('.fiber-scene').getAttribute('data-backend');
  const before=backend==='svg'?await page.locator('.vector-scene').innerHTML():null;
  let box=await page.locator('.network-canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.25,box.y+box.height*.2);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.43,box.y+box.height*.32,{steps:8});await page.mouse.up();
  if(before)await page.waitForFunction(old=>document.querySelector('.vector-scene')?.innerHTML!==old,before);
  await page.getByRole('button',{name:'重置图谱',exact:true}).click();
  await page.getByRole('button',{name:'木构建筑解读',exact:true}).click();await page.waitForSelector('.building-controls');
  if(backend==='svg')await page.waitForSelector('.building-canvas .vector-scene path');
  box=await page.locator('.building-canvas').boundingBox();
  await page.mouse.click(box.x+box.width*.5,box.y+box.height*.42);
  await page.locator('.part-description h3').filter({hasText:'屋顶与出檐'}).waitFor();
  const modelBefore=backend==='svg'?await page.locator('.vector-scene').innerHTML():null;
  await page.mouse.move(box.x+box.width*.2,box.y+box.height*.2);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.4,box.y+box.height*.32,{steps:8});await page.mouse.up();
  if(modelBefore)await page.waitForFunction(old=>document.querySelector('.vector-scene')?.innerHTML!==old,modelBefore);
  await page.getByRole('button',{name:'重置建筑视角',exact:true}).click();
  assert.deepEqual(errors,[]);
  const report={date:new Date().toISOString(),backend,graphPointerRotation:'passed',buildingPointerSelection:'roof selected via scene raycast',buildingPointerRotation:'passed',errors};
  fs.writeFileSync('tests/gestures-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await page.goto(base+'/?gestures=done#home');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
