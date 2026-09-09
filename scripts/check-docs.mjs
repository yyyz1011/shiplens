import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.SHIPLENS_DOCS_URL || 'http://127.0.0.1:4318';
const output = 'artifacts/ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const results = [];
try {
  for (const [device, viewport] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: 'reduce',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(base + '/');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    for (const locale of ['en', 'zh'])
      for (const theme of ['light', 'dark']) {
        await page.goto(base + '/');
        await page.locator('#language-select').selectOption(locale);
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.locator('#theme-toggle').click();
        for (const route of [
          '/',
          '/#/docs/quickstart',
          '/#/docs/cli',
          '/#/docs/configuration',
          '/#/docs/rules',
          '/#/docs/reports',
          '/#/docs/ci',
          '/#/docs/faq',
          '/#/report',
        ]) {
          await page.goto(base + route);
          await page.locator('h1').waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.ok(await page.locator('h1').innerText());
          const bounds = await page.evaluate(() => ({
            content: document.documentElement.scrollWidth,
            width: innerWidth,
          }));
          assert.ok(
            bounds.content <= bounds.width + 1,
            `${device} ${route} overflows: ${JSON.stringify(bounds)}`,
          );
          assert.equal(
            await page.locator('html').getAttribute('lang'),
            locale === 'en' ? 'en' : 'zh-CN',
          );
          assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
          if (locale === 'en') {
            const text = await page.locator('body').innerText();
            assert.ok(
              !/[\u4e00-\u9fff]/.test(text.replaceAll('中文', '')),
              `Untranslated text on ${route}: ${text.match(/[^\n]*[\u4e00-\u9fff][^\n]*/g)}`,
            );
          }
          results.push({ device, route, locale, theme, status: 'pass' });
          if (route === '/' || route === '/#/docs/quickstart' || route === '/#/report')
            await page.screenshot({
              path: `${output}/${device}-${locale}-${theme}-${route === '/' ? 'home' : route.includes('quickstart') ? 'docs' : 'report'}.png`,
              fullPage: true,
              animations: 'disabled',
            });
        }
      }
    await page.locator('#language-select').selectOption('en');
    await page.locator('.nav-actions .search-trigger').click();
    await page.locator('#search-input').fill('exit codes');
    await page.locator('.search-result').filter({ hasText: 'CLI reference' }).click();
    await page.getByRole('heading', { name: 'CLI reference', exact: true }).waitFor();
    await page.locator('#language-select').selectOption('zh');
    await page.goto(base + '/#/report');
    await page.locator('[data-issue="1"]').click();
    assert.equal(await page.locator('.demo-evidence h3').innerText(), '手机布局横向溢出');
    await page.locator('[data-device="desktop"]').click();
    assert.equal(
      await page.locator('[data-device="desktop"]').getAttribute('aria-pressed'),
      'true',
    );
    await page.locator('.demo-footer [data-copy]').click();
    assert.ok(
      (await page.evaluate(() => navigator.clipboard.readText())).includes('horizontal-overflow'),
    );
    await page.locator('.nav-actions .search-trigger').click();
    await page.getByPlaceholder('搜索文档、规则或命令…').fill('退出码');
    await page.locator('.search-result').filter({ hasText: '命令行参考' }).click();
    await page.getByRole('heading', { name: '命令行参考', exact: true }).waitFor();
    assert.equal(await page.locator('h1').innerText(), '命令行参考');
    await page.locator('.copy-button').first().click();
    assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes('shiplens'));
    await page.locator('.nav-actions .search-trigger').click();
    await page.getByPlaceholder('搜索文档、规则或命令…').fill('unlikely-search-0000');
    assert.ok(await page.locator('.search-empty').isVisible());
    await page.keyboard.press('Escape');
    assert.ok(!(await page.locator('#search-dialog').isVisible()));
    if (device === 'mobile') {
      await page.locator('.menu-toggle').click();
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
      await page.locator('.mobile-nav a').filter({ hasText: '概览' }).click();
      await page.locator('.hero').waitFor();
    }
    await page.goto(base + '/example/index.html');
    await page.locator('.finding').first().waitFor();
    await page.locator('[data-filter="warning"]').click();
    assert.equal(await page.locator('.finding[data-severity="error"]:visible').count(), 0);
    assert.ok((await page.locator('.finding[data-severity="warning"]:visible').count()) > 0);
    await page.locator('[data-filter="all"]').click();
    await page
      .locator('details')
      .first()
      .evaluate((el) => (el.open = true));
    const image = page.locator('.finding img').first();
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((img) => img.decode());
    assert.ok(await image.evaluate((img) => img.complete && img.naturalWidth > 0));
    await page.screenshot({
      path: `${output}/${device}-real-report.png`,
      fullPage: false,
      animations: 'disabled',
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        routes: results,
        interactions: [
          'issue selection',
          'device switching',
          'clipboard copy',
          'search navigation',
          'empty search',
          'escape close',
          'mobile menu',
          'real report filters',
          'real screenshot load',
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    `${results.length} route/viewport checks and all interactions passed. Screenshots: ${output}`,
  );
} finally {
  await browser.close();
}
