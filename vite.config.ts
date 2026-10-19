import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  base: "./",
  plugins: [react(), tailwind()],
  server: { port: 48209, strictPort: true },
  build: { target: "es2022" },
});
