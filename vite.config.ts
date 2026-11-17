import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({plugins:[viteSingleFile()],build:{assetsInlineLimit:10000000,cssCodeSplit:false,chunkSizeWarningLimit:2000},server:{host:'0.0.0.0'}});
