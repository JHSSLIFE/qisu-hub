import {useEffect,useMemo,useState} from 'react';
import * as THREE from 'three';
import {useApp} from './context';
import {rank} from './data';
import {Icon, Badge} from './ui';
import {Scene} from './scene';

type Part='roof'|'bracket'|'frame'|'base';
const parts:{id:Part;name:string;sub:string;description:string;keyword:string}[]=[
 {id:'roof',name:'屋顶与出檐',sub:'形制与空间',description:'观察屋面轮廓、出檐深度和构架之间的关系。屋顶形式是一条研究线索，具体年代与名称仍须回到测绘及文献核对。',keyword:'屋顶'},
 {id:'bracket',name:'斗拱层',sub:'承托与过渡',description:'斗拱位于柱头与上部构架之间。本模型以简化的斗、拱表现承托关系，便于理解层次，不作为真实斗栱做法或工程受力依据。',keyword:'斗拱'},
 {id:'frame',name:'柱网与梁架',sub:'结构与秩序',description:'柱与梁共同组织建筑的开间和进深。试着旋转模型，观察正面、侧面与内部构架，继续阅读抬梁、穿斗与榫卯相关知识。',keyword:'梁架'},
 {id:'base',name:'台基与踏步',sub:'建筑与场地',description:'台基承托上部建筑，踏步连接地面与室内标高。田野记录应同时保存尺度、材料、维修痕迹与现场照片。',keyword:'田野'}
];

function TimberModel({selected,exploded,wireframe,onSelect}:{selected:Part;exploded:boolean;wireframe:boolean;onSelect:(part:Part)=>void}){
 const roof=useMemo(()=>{
  const a=[-3.1,2.5,2.15],b=[3.1,2.5,2.15],c=[3.1,2.5,-2.15],d=[-3.1,2.5,-2.15],e=[-1.1,3.55,0],f=[1.1,3.55,0];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...f,...a,...f,...e,...b,...c,...f,...c,...d,...e,...c,...e,...f,...d,...a,...e],3));geometry.computeVertexNormals();return geometry;
 },[]);
 useEffect(()=>()=>roof.dispose(),[roof]);
 const color=(part:Part)=>selected===part?'#9d2933':part==='roof'?'#526b73':part==='base'?'#c0c7c3':'#a08059';
 const material=(part:Part)=><meshStandardMaterial color={color(part)} roughness={.8} metalness={.03} wireframe={wireframe}/>;
 return <group position={[0,-.3,0]}>
  <group onClick={e=>{e.stopPropagation();onSelect('base');}}>
   <mesh position={[0,0,0]}><boxGeometry args={[6,.25,4.3]}/>{material('base')}</mesh>
   {[0,1,2].map(i=><mesh key={i} position={[0,-.13-i*.12,2.25+i*.25]}><boxGeometry args={[1.7,.12,.5]}/>{material('base')}</mesh>)}
  </group>
  <group position={[0,exploded?.4:0,0]} onClick={e=>{e.stopPropagation();onSelect('frame');}}>
   {[-2.4,-.8,.8,2.4].flatMap(x=>[-1.5,1.5].map(z=><mesh key={x+':'+z} position={[x,1.05,z]}><cylinderGeometry args={[.105,.14,1.9,12]}/>{material('frame')}</mesh>))}
   {[-1.5,1.5].map(z=><mesh key={z} position={[0,1.93,z]}><boxGeometry args={[5.15,.17,.17]}/>{material('frame')}</mesh>)}
   {[-2.4,-.8,.8,2.4].map(x=><mesh key={x} position={[x,2.05,0]}><boxGeometry args={[.15,.19,3.3]}/>{material('frame')}</mesh>)}
  </group>
  <group position={[0,exploded?1.35:0,0]} onClick={e=>{e.stopPropagation();onSelect('bracket');}}>
   {[-2.4,-.8,.8,2.4].flatMap(x=>[-1.5,1.5].map(z=><group key={x+':'+z} position={[x,2.18,z]}>
    <mesh><boxGeometry args={[.24,.2,.24]}/>{material('bracket')}</mesh>
    {[0,1].map(i=><group key={i} position={[0,.16+i*.17,0]}><mesh><boxGeometry args={[.62+i*.22,.11,.14]}/>{material('bracket')}</mesh><mesh><boxGeometry args={[.14,.11,.62+i*.22]}/>{material('bracket')}</mesh></group>)}
   </group>))}
  </group>
  <group position={[0,exploded?2.5:0,0]} onClick={e=>{e.stopPropagation();onSelect('roof');}}>
   <mesh geometry={roof}><meshStandardMaterial color={color('roof')} roughness={.8} side={THREE.DoubleSide} wireframe={wireframe}/></mesh>
   <mesh position={[0,2.49,0]}><boxGeometry args={[6.2,.1,4.3]}/>{material('roof')}</mesh>
   <mesh position={[0,3.56,0]}><boxGeometry args={[2,.08,.1]}/>{material('roof')}</mesh>
  </group>
 </group>;
}

export function BuildingExplorer(){
 const a=useApp();const [selected,setSelected]=useState<Part>('bracket'),[exploded,setExploded]=useState(false),[wireframe,setWireframe]=useState(false),[reset,setReset]=useState(0),[zoom,setZoom]=useState(1);
 const part=parts.find(p=>p.id===selected)!;
 const related=rank(a.live.filter(r=>r.kind==='knowledge'),part.keyword).slice(0,3);
 return <div className="explorer-layout"><div className="building-workspace"><div className="building-topline"><span>木构建筑 · 教学示意</span><Badge>可旋转与拆解</Badge></div><div className="building-canvas"><Scene reset={reset} zoom={zoom} building><TimberModel selected={selected} exploded={exploded} wireframe={wireframe} onSelect={setSelected}/><gridHelper args={[16,16,'#d8e1df','#e8eeec']} position={[0,-.8,0]}/></Scene></div><div className="building-controls"><button className={'btn '+(exploded?'primary':'')} aria-pressed={exploded} onClick={()=>setExploded(!exploded)}><Icon name="GitBranch" size={16}/>{exploded?'合拢建筑':'分层拆解'}</button><button className="btn" aria-pressed={wireframe} onClick={()=>setWireframe(!wireframe)}><Icon name="Grid2X2" size={16}/>{wireframe?'实体模式':'线框模式'}</button><button className="icon-btn" aria-label="放大建筑" disabled={zoom>=1.6} onClick={()=>setZoom(z=>Math.min(1.6,z+.2))}><Icon name="ZoomIn"/></button><button className="icon-btn" aria-label="缩小建筑" disabled={zoom<=.65} onClick={()=>setZoom(z=>Math.max(.65,z-.2))}><Icon name="ZoomOut"/></button><button className="icon-btn" aria-label="重置建筑视角" onClick={()=>{setReset(r=>r+1);setZoom(1);}}><Icon name="RotateCcw"/></button></div><p className="scene-hint">拖动旋转 · 滚轮缩放 · 点击构件查看解读</p></div><aside className="node-inspector building-inspector"><span className="eyebrow">从形制到知识</span><h2>读懂一座木构建筑</h2><p className="inspector-intro">从构件出发，把空间观察连回知识资料。</p><div className="building-parts">{parts.map((p,i)=><button key={p.id} className={selected===p.id?'selected':''} aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)}><span>0{i+1}</span><strong>{p.name}</strong><Icon name="ChevronRight" size={15}/></button>)}</div><div className="part-description"><Badge>{part.sub}</Badge><h3>{part.name}</h3><p>{part.description}</p></div><h3 className="inspector-subtitle">继续阅读</h3>{related.map(r=><button className="inspector-relation" key={r.id} onClick={()=>a.open(r)}><Icon name="BookOpen" size={17}/><span>{r.title}</span><Icon name="ArrowUpRight" size={14}/></button>)}{!related.length&&<p className="muted">导入相关资料后，即可从这里继续阅读。</p>}<p className="model-disclaimer">原创概念模型，非具体文物复原，尺寸与构件均经简化。</p></aside></div>;
}
