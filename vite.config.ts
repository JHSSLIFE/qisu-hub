import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import {readFileSync,writeFileSync} from 'node:fs';
export default defineConfig({plugins:[viteSingleFile(),{name:'preserve-license-notices',closeBundle(){const file='dist/index.html';const license=readFileSync('THIRD_PARTY_LICENSES.txt','utf8').replaceAll('-->','--&gt;');writeFileSync(file,readFileSync(file,'utf8')+'\n<!--\nThird-party license notices\n'+license+'\n-->\n');}}],build:{assetsInlineLimit:10000000,cssCodeSplit:false,chunkSizeWarningLimit:2000},server:{host:'0.0.0.0'}});
