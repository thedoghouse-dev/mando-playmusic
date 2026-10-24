import {defineConfig} from 'vite';
export default defineConfig({server:{cors:{origin:'null'}},optimizeDeps:{include:['music-metadata','milkdrop-preset-converter']},build:{rollupOptions:{input:{main:'index.html',visualizer:'visualizer.html',output:'visualizer-window.html'}}}});
