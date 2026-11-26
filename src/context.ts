import {createContext,useContext} from 'react';
import type {Row,Kind,Answer} from './data';
export type View='home'|'library'|'experts'|'graph'|'assistant'|'evidence'|'create'|'projects'|'settings'|'extras'|'trash'|'permissions';
export const viewTitles:Record<View,string>={home:'研究工作台',library:'知识库',experts:'专家档案',graph:'知识图谱',assistant:'智能检索',evidence:'资料考证',create:'内容创作',projects:'研究项目',settings:'空间设置',extras:'文博小憩',trash:'回收站',permissions:'权限设置'};
export interface AppAPI {
  rows:Row[];live:Row[];view:View;busy:boolean;ai:boolean;spaceId:string;user:{id:string;email:string;name:string;role:string}|null;
  navigate:(view:View)=>void;open:(row:Row,version?:number)=>void;edit:(row:Row)=>void;
  create:(kind:Kind,extra?:Partial<Row>)=>void;save:(row:Row,message?:string)=>Promise<Row|undefined>;
  batch:(rows:Row[])=>Promise<Row[]|undefined>;notify:(text:string,error?:boolean)=>void;
  showImport:()=>void;setRows:(rows:Row[])=>void;setSearch:(query:string)=>void;searchQuery:string;
  name:string;setName:(name:string)=>void;sound:boolean;setSound:(sound:boolean)=>void;playSound:()=>void;
  toDraft:(answer:Answer,title:string)=>void;toEvidence:(answer:Answer,title:string)=>void;
}
export const AppContext=createContext<AppAPI>(null as never);
export const useApp=()=>useContext(AppContext);
