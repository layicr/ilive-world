import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    // 固定浏览器语言为默认语言，避免 detectBrowserLanguage 将 / 重定向到 /en/
    // Pin the browser locale to the default so detectBrowserLanguage doesn't redirect / to /en/
    locale: 'zh-CN',
    headless: true
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: {
        // 无头环境用 SwiftShader 提供 WebGL，保证首页 3D 场景可渲染
        // Use SwiftShader for WebGL in headless so the home 3D scene still renders
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
      }
    }
  }],
  webServer: {
    command: 'npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180000
  }
});
