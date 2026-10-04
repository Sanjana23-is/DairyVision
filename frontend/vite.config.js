import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        port: 3000,
        host: '0.0.0.0'
    },
    build: {
        target: 'es2018',
        cssCodeSplit: true,
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                            return 'vendor-react';
                        }
                        if (id.includes('lucide-react')) {
                            return 'vendor-icons';
                        }
                        if (id.includes('recharts')) {
                            return 'vendor-charts';
                        }
                        if (id.includes('@tanstack/react-query')) {
                            return 'vendor-query';
                        }
                        if (id.includes('axios')) {
                            return 'vendor-axios';
                        }
                    }
                }
            }
        },
    },
    esbuild: {
        drop: ['console', 'debugger'],
    },
});
