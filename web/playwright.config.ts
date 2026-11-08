import { defineConfig } from "@playwright/test";
const output = process.env.E2E_OUTPUT ?? "test-results";
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  outputDir: `${output}/artifacts`,
  reporter: [["line"], ["json", { outputFile: `${output}/results.json` }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    browserName: "chromium",
    viewport: { width: 1440, height: 1100 },
    trace: "off",
    screenshot: "only-on-failure",
  },
});
