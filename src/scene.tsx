import {Component, useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {SVGRenderer} from 'three/addons/renderers/SVGRenderer.js';
import * as THREE from 'three';
import {Icon} from './ui';

type LabelBox={left:number;top:number;right:number;bottom:number};
const labelLayouts=new WeakMap<HTMLElement,{time:number;boxes:LabelBox[]}>();

// A demand-driven scene: no animation loop while the researcher is reading.
function CameraControls({reset, zoom, building=false}:{reset:number;zoom:number;building?:boolean}){
 const {camera,gl,invalidate}=useThree();
 const controls=useRef<OrbitControls|null>(null);
 useEffect(()=>{
  const orbit=new OrbitControls(camera,gl.domElement);
  orbit.enableDamping=false;orbit.enablePan=true;orbit.minDistance=building?5:4;orbit.maxDistance=building?22:25;
  orbit.maxPolarAngle=Math.PI*.89;orbit.target.set(0,building?1.3:0,0);
  const redraw=()=>invalidate();
  orbit.addEventListener('change',redraw);controls.current=orbit;orbit.update();
  return()=>{orbit.removeEventListener('change',redraw);orbit.dispose();controls.current=null;};
 },[camera,gl,invalidate,building]);
 useEffect(()=>{
  if(building)camera.position.set(8,6.2,10);else camera.position.set(0,3,14);
  if(controls.current){controls.current.target.set(0,building?1.3:0,0);controls.current.update();}
  invalidate();
 },[reset,building,camera,invalidate]);
 useEffect(()=>{
  const orbit=controls.current;if(!orbit)return;
  const offset=camera.position.clone().sub(orbit.target).normalize().multiplyScalar((building?13.5:14.3)/zoom);
  camera.position.copy(orbit.target).add(offset);orbit.update();invalidate();
 },[zoom,camera,building,invalidate]);
 return null;
}

class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}

export function Scene({children,reset=0,zoom=1,building=false,onUnavailable}:{children:ReactNode;reset?:number;zoom?:number;building?:boolean;onUnavailable?:()=>void}){
 const [supported]=useState(()=>{
  try{const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2');if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true;}catch{return false;}
 });
 const [lost,setLost]=useState(false);
 const createRenderer=useCallback((props:THREE.WebGLRendererParameters)=>{
  if(supported&&!lost)return new THREE.WebGLRenderer({...props,antialias:true,alpha:true,powerPreference:'low-power'});
  // The official Three.js SVG renderer renders this same R3F scene without WebGL.
  const renderer=new SVGRenderer();renderer.setQuality('high');
  const canvas=props.canvas as HTMLCanvasElement;
  renderer.domElement.classList.add('vector-scene');
  canvas.style.visibility='hidden';canvas.parentElement?.appendChild(renderer.domElement);
  Object.assign(renderer,{dispose(){renderer.domElement.remove();}});
  return renderer as unknown as THREE.WebGLRenderer;
 },[supported,lost]);
 const unavailable=<div className="scene-unavailable"><Icon name="Compass" size={32}/><h3>当前设备暂不支持三维视图</h3><p>资料与关联仍可完整查看。</p>{onUnavailable&&<button className="btn" onClick={onUnavailable}>查看关系列表</button>}</div>;
 return <div className="fiber-scene" data-renderer="react-three-fiber" data-backend={supported&&!lost?'webgl':'svg'}><SceneBoundary fallback={unavailable}><Canvas key={lost?'vector':'initial'} frameloop="demand" dpr={[1,1.5]} camera={{position:building?[8,6.2,10]:[0,3,14],fov:43,near:.1,far:100}} gl={createRenderer} fallback={unavailable} onCreated={({gl})=>{gl.domElement.setAttribute('aria-label',building?'可旋转的木构建筑示意模型':'可旋转的三维知识关系网络');gl.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setLost(true);},{once:true});}}><color attach="background" args={['#f3f6f6']}/><ambientLight intensity={1.8}/><directionalLight position={[5,9,6]} intensity={2.5}/><CameraControls reset={reset} zoom={zoom} building={building}/>{children}</Canvas></SceneBoundary></div>;
}

export function ProjectedLabel({position,children,active=false,onClick}:{position:THREE.Vector3;children:ReactNode;active?:boolean;onClick:()=>void}){
 // Labels are real DOM buttons, projected onto the canvas for keyboard access.
 const {gl}=useThree();const ref=useRef<HTMLButtonElement|null>(null);
 const callback=useRef(onClick);callback.current=onClick;
 useEffect(()=>{
  const host=gl.domElement.parentElement?.parentElement;
  if(!host)return;
  const button=document.createElement('button');button.className='scene-node-label';button.type='button';
  button.addEventListener('click',()=>callback.current());host.appendChild(button);ref.current=button;
  return()=>{button.remove();ref.current=null;};
 },[gl]);
 useEffect(()=>{if(ref.current){ref.current.textContent=String(children);ref.current.title=String(children);ref.current.setAttribute('aria-label','选择节点 '+String(children));ref.current.setAttribute('aria-pressed',String(active));ref.current.classList.toggle('selected',active);}},[children,active]);
 useFrame(({camera,size,clock})=>{
  const button=ref.current;if(!button)return;
  const point=position.clone().project(camera);
  const hidden=point.z>1||point.z< -1||Math.abs(point.x)>1.08||Math.abs(point.y)>1.08;
  button.style.visibility=hidden?'hidden':'visible';if(hidden)return;
  const host=button.parentElement;if(!host)return;
  let layout=labelLayouts.get(host);
  if(!layout||layout.time!==clock.elapsedTime){layout={time:clock.elapsedTime,boxes:[]};labelLayouts.set(host,layout);}
  const width=button.offsetWidth,height=button.offsetHeight;
  const left=Math.max(5,Math.min(size.width-width-5,(point.x*.5+.5)*size.width-width/2));
  const baseline=(-point.y*.5+.5)*size.height+10;
  let box:LabelBox={left,top:baseline,right:left+width,bottom:baseline+height};
  for(let attempt=0;attempt<22;attempt++){
   const shift=attempt===0?0:(attempt%2?1:-1)*Math.ceil(attempt/2)*(height+4);
   const top=Math.max(4,Math.min(size.height-height-4,baseline+shift));
   box={left,top,right:left+width,bottom:top+height};
   if(!layout.boxes.some(other=>box.left<other.right+3&&box.right>other.left-3&&box.top<other.bottom+3&&box.bottom>other.top-3))break;
  }
  layout.boxes.push(box);button.style.transform=`translate(${box.left}px,${box.top}px)`;
 });
 return null;
}
