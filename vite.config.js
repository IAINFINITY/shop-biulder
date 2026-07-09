import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

function inlineCriticalCss() {
  return {
    name: "inline-critical-css",
    enforce: "post",
    apply: "build",
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      const htmlPath = path.join(distDir, "index.html");
      if (!fs.existsSync(htmlPath)) return;

      let html = fs.readFileSync(htmlPath, "utf-8");
      const cssMatch = html.match(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/);
      if (!cssMatch) return;

      const cssPath = path.join(distDir, cssMatch[1]);
      if (!fs.existsSync(cssPath)) return;

      const css = fs.readFileSync(cssPath, "utf-8");

      // Move all <script> and <link rel="modulepreload"> to end of <body>
      // but keep heavy admin-only chunks out of the initial mobile load.
      const scripts = html.match(/<script[^>]*><\/script>/g) || [];
      const preloads = html.match(/<link rel="modulepreload"[^>]*>/g) || [];
      const retainedPreloads = preloads.filter((tag) => !/\/assets\/(tiptap|pdf|xlsx)-/i.test(tag));

      for (const s of scripts) html = html.replace(s, "");
      for (const p of preloads) html = html.replace(p, "");

      // Replace <link rel="stylesheet"> with inline <style>
      html = html.replace(cssMatch[0], `<style>${css}</style>`);

      // Append scripts before </body>
      const allTags = [...retainedPreloads, ...scripts].join("\n    ");
      html = html.replace("</body>", `${allTags}\n  </body>`);

      fs.writeFileSync(htmlPath, html, "utf-8");
      fs.rmSync(cssPath);
      console.log(`  ✓ Inlined ${cssMatch[1]} into index.html (${(css.length / 1024).toFixed(0)} KB). Scripts moved to end of <body>.`);
    },
  };
}

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), inlineCriticalCss()],
  build: {
    emptyOutDir: true,
    cssCodeSplit: false,
    cssMinify: "esbuild",
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.includes("vite/preload-helper")) return "preload-helper";
          if (normalizedId.includes("node_modules/react") || normalizedId.includes("node_modules/react-dom") || normalizedId.includes("node_modules/scheduler")) {
            return "react-vendor";
          }
          if (normalizedId.includes("node_modules/@tanstack")) return "query-vendor";
          if (normalizedId.includes("node_modules/@supabase")) return "supabase-vendor";
          if (normalizedId.includes("node_modules/lucide-react")) return "icons-vendor";
          if (normalizedId.includes("node_modules/jspdf") || normalizedId.includes("node_modules/jspdf-autotable")) return "pdf";
          if (normalizedId.includes("node_modules/xlsx")) return "xlsx";
          if (normalizedId.includes("node_modules/@tiptap")) return "tiptap";
        },
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
