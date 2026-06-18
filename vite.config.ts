import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base:
    process.env.GITHUB_ACTIONS
      ? "/step-up-match/"
      : "/",

  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    allowedHosts: [
      ".trycloudflare.com",
    ],
  },
});
