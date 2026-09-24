import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string): string | void {
          if (id.includes('three')) {
            return 'three';
          }
          if (id.includes('gsap')) {
            return 'gsap';
          }
        },
      },
    },
  },
});
