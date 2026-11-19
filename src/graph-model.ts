import {type Row} from './data';
export interface GraphEdge {from:Row;to:Row;type:'related'|'source'}
export const graphKinds=new Set(['knowledge','expert','source']);
export function buildEdges(rows:Row[]):GraphEdge[]{
 const index=new Map(rows.filter(r=>!r.archived&&graphKinds.has(r.kind)).map(r=>[r.id,r]));
 const seen=new Set<string>(),edges:GraphEdge[]=[];
 for(const from of index.values())for(const [ids,type] of [[from.relatedIds,'related'],[from.sourceIds,'source']] as const){
  for(const id of ids){const to=index.get(id);if(!to||id===from.id)continue;
   // Related knowledge is symmetric; a source reference remains directional.
   const key=type==='related'?type+':'+[from.id,id].sort().join('|'):type+':'+from.id+'|'+id;
   if(seen.has(key))continue;seen.add(key);edges.push({from,to,type});
  }
 }
 return edges;
}
export function neighbors(id:string,edges:GraphEdge[]){return edges.filter(e=>e.from.id===id||e.to.id===id).map(e=>({row:e.from.id===id?e.to:e.from,type:e.type,incoming:e.to.id===id}));}
