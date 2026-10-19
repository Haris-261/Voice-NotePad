import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({ plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['icon.svg'],manifest:{name:'Voice NotePad',short_name:'VoiceNote',theme_color:'#0a0a0a',background_color:'#ffffff',display:'standalone',start_url:'/',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]},workbox:{navigateFallback:'/index.html',runtimeCaching:[{urlPattern:({url})=>url.pathname.startsWith('/api/'),handler:'NetworkOnly'}]}})],server:{port:5173,proxy:{'/api':'http://localhost:3001'}},build:{outDir:'dist'}});
