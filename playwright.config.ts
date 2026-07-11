import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "browser",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:5173" },
  webServer: [
    {
      command: ".venv/bin/uvicorn app.main:app --app-dir services/api --host 127.0.0.1 --port 8000",
      url: "http://127.0.0.1:8000/healthz",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -w @verity/pwa -- --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
    },
  ],
});
