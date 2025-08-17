import path from "path";
// import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    // paraglideVitePlugin({
    //   project: "./project.inlang",
    //   outdir: "./src/paraglide",
    //   strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
    //   urlPatterns: [
    //     {
    //       pattern: "/:path(.*)?",
    //       localized: [
    //         ["en", "/en/:path(.*)?"],
    //         ["cs", "/cs/:path(.*)?"],
    //       ],
    //     },
    //   ],
    // }),
    tsConfigPaths(),
    tanstackStart({ target: "vercel" }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
