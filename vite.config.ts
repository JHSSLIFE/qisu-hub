import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export default defineConfig({base:'./',plugins:[viteSingleFile(),{name:'qisu-distribution',closeBundle(){
 const license=readFileSync('THIRD_PARTY_LICENSES.txt','utf8').replaceAll('-->','--&gt;');
 const raw=readFileSync('dist/index.html','utf8');
 const html=raw.replace('<head>','<head><link rel="manifest" href="./manifest-online.webmanifest"><link rel="apple-touch-icon" href="./icons/icon-192.png">')+'\n<!--\nThird-party license notices\n'+license+'\n-->\n';
 writeFileSync('dist/index.html',html);
 const local=html.replace('<head>','<head><script>window.__QISU_LOCAL__=true;</script>').replace('<link rel="manifest" href="./manifest-online.webmanifest">','<link rel="manifest" href="./manifest.webmanifest">');
 writeFileSync('dist/app.html',local);
 const version=createHash('sha256').update(local).update(readFileSync('public/sw.js')).update(readFileSync('public/manifest.webmanifest')).update(readFileSync('public/icons/icon-192.png')).update(readFileSync('public/icons/icon-512.png')).digest('hex').slice(0,16);
 writeFileSync('dist/sw.js',readFileSync('public/sw.js','utf8').replace('__BUILD__',version));
}}],build:{assetsInlineLimit:10000000,cssCodeSplit:false,chunkSizeWarningLimit:2000},server:{host:'0.0.0.0'}});
