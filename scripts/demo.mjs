import { startFixture } from '../packages/cli/test/fixture.js';
import { scan } from '../packages/cli/src/index.js';
import { cp, mkdir, rm } from 'node:fs/promises';
const fixture = await startFixture();
try {
  const r = await scan({
    url: fixture.url,
    maxPages: 4,
    settle: 250,
    exclude: ['/excluded'],
    output: 'artifacts/demo',
    onProgress: ({ url, viewport }) => console.log(viewport, url),
  });
  await mkdir('apps/docs/public/example', { recursive: true });
  await rm('apps/docs/public/example', { recursive: true, force: true });
  await cp(r.runDirectory, 'apps/docs/public/example', { recursive: true });
  console.log(JSON.stringify(r.summary));
  console.log('真实报告已复制到文档站 /example/index.html');
} finally {
  await fixture.close();
}
