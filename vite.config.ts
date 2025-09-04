import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __WORKER_URL__: JSON.stringify(
      process.env.VITE_WORKER_URL ||
        "https://super-tic-tac-toe-worker.mshik3.workers.dev"
    ),
  },
});
