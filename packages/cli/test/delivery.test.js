import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ReviewWorkspace } from '../src/review.js';
import { prepareDelivery, jsonPointer } from '../src/delivery.js';
import { validateOptions } from '../src/options.js';
import { createDeliveryDemo } from '../examples/delivery-server.mjs';
const exec = promisify(execFile);
const contract = JSON.parse(
  await readFile(new URL('../examples/delivery.json', import.meta.url), 'utf8'),
);
async function fixture(mode, fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'shiplens-delivery-'));
  const app = await createDeliveryDemo({ directory: path.join(root, 'app'), mode });
  const options = {
    url: app.url,
    viewport: 'both',
    crawl: false,
    settle: 0,
    timeout: 1000,
    allowRequests: [contract.request],
    output: root,
  };
  const directory = path.join(root, 'reviews');
  const workspace = new ReviewWorkspace({ directory, options });
  try {
    await fn({ app, workspace, directory, root, options });
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
}

test('delivery proves independent persisted records and exercised failure branches on both viewports', () =>
  fixture('healthy', async ({ app, workspace: w, directory }) => {
    const result = await w.verifyDelivery({ contract });
    assert.equal(result.passed, true, JSON.stringify(result.trials));
    assert.equal(result.trials.length, 4);
    assert.equal(new Set(result.trials.map((t) => t.reference)).size, 4);
    assert.equal(app.mutationRequests(), 2); // Fault requests never reach the server.
    assert.equal((await app.records()).length, 2);
    for (const trial of result.trials) {
      assert.equal(trial.before.count, 0);
      assert.equal(trial.network.matched, 1);
      assert.equal(trial.after.count, trial.phase === 'success' ? 1 : 0);
      const proof = await w.readDeliveryEvidence({
        deliveryId: result.deliveryId,
        viewport: trial.viewport,
        phase: trial.phase,
      });
      assert.ok(proof.image.data);
      assert.equal(proof.observation.text, trial.ui.observedText);
      assert.ok(!JSON.stringify(proof.observation).includes(trial.reference));
    }
    assert.deepEqual(await w.getDelivery({ deliveryId: result.deliveryId }), result);
    assert.match(await readFile(path.join(directory, result.report), 'utf8'), /Delivery proof/);
    assert.equal((await w.listRuns()).total, 0); // Delivery results are separate from review-run gates.
    await assert.rejects(
      w.readDeliveryEvidence({ deliveryId: result.deliveryId, viewport: '../', phase: 'success' }),
    );
  }));

test('delivery rejects false success, lost persistence, duplicate records and unexercised mutations', async () => {
  for (const [mode, reason] of [
    ['lost-write', 'persisted-record-mismatch'],
    ['duplicate', 'persisted-record-mismatch'],
    ['false-success', 'false-success-during-injected-failure'],
    ['no-request', 'mutation-not-exercised'],
  ])
    await fixture(mode, async ({ workspace: w }) => {
      const result = await w.verifyDelivery({ contract });
      assert.equal(result.passed, false, mode);
      assert.ok(
        result.trials.some((t) => t.reasons.includes(reason)),
        `${mode}: ${JSON.stringify(result.trials)}`,
      );
      if (mode !== 'false-success')
        assert.ok(
          result.trials.filter((t) => t.phase === 'failure').every((t) => t.status === 'skipped'),
        );
    });
});

test('invalid readback and stale preconditions prevent writes; host policy and correlation inputs fail closed', async () => {
  for (const mode of ['invalid-readback', 'stale'])
    await fixture(mode, async ({ app, workspace: w }) => {
      const result = await w.verifyDelivery({ contract });
      assert.equal(result.passed, false);
      assert.equal(app.mutationRequests(), 0);
    });
  const options = validateOptions({
    url: 'http://localhost:3001',
    allowRequests: [contract.request],
  });
  assert.throws(
    () => prepareDelivery(contract, {}, validateOptions({ url: options.url })),
    /allowRequests/,
  );
  assert.throws(() => prepareDelivery(contract, { reference: 'stale' }, options), /excluding/);
  for (const patch of [
    { page: '//other.test/' },
    { readback: { ...contract.readback, path: '//other.test/api' } },
    { readback: { ...contract.readback, items: '/bad~2pointer' } },
    { referenceInput: 'absent' },
    { success: { selector: '#status', checks: [{ operator: 'excludes', value: 'Error' }] } },
    { steps: [{ action: 'fill', selector: '#reference', value: 'raw' }] },
  ])
    assert.throws(() => prepareDelivery({ ...contract, ...patch }, {}, options));
  assert.equal(jsonPointer({ 'a/b': { '~x': false } }, '/a~1b/~0x'), false);
  assert.equal(jsonPointer({}, '/toString'), undefined);
});

test('delivery CLI executes a portable contract and cancellation releases the shared writer lock', () =>
  fixture('healthy', async ({ workspace: w, root, options }) => {
    const config = path.join(root, 'config.json');
    await writeFile(config, JSON.stringify(options));
    const cli = path.resolve('packages/cli/src/cli.js');
    const completed = JSON.parse(
      (
        await exec(process.execPath, [
          cli,
          'review',
          'delivery',
          '--config',
          config,
          '--plan',
          path.resolve('packages/cli/examples/delivery.json'),
        ])
      ).stdout,
    );
    assert.equal(completed.passed, true);
    const input = path.join(root, 'input.json');
    await writeFile(input, JSON.stringify({ deliveryId: completed.deliveryId }));
    const read = JSON.parse(
      (
        await exec(process.execPath, [
          cli,
          'review',
          'delivery-run',
          '--config',
          config,
          '--input',
          input,
        ])
      ).stdout,
    );
    assert.equal(read.deliveryId, completed.deliveryId);
    const controller = new AbortController();
    await assert.rejects(
      w.verifyDelivery(
        { contract },
        { signal: controller.signal, onProgress: () => controller.abort() },
      ),
      /cancelled/,
    );
    assert.equal(w.getStatus().running, false);
    assert.equal((await w.verifyDelivery({ contract })).passed, true);
  }));

test('missing error component still exposes a false success on its own scope', () =>
  fixture('false-success', async ({ workspace: w }) => {
    const result = await w.verifyDelivery({
      contract: { ...contract, failure: { ...contract.failure, selector: '#missing-error' } },
    });
    assert.equal(result.passed, false);
    const failed = result.trials.find((t) => t.phase === 'failure');
    assert.ok(failed.reasons.includes('false-success-during-injected-failure'));
    assert.ok(failed.reasons.includes('ui-evidence-unavailable'));
    const proof = await w.readDeliveryEvidence({
      deliveryId: result.deliveryId,
      viewport: failed.viewport,
      phase: 'failure',
    });
    assert.equal(proof.observation.text, 'Saved');
    assert.equal(proof.trial.evidence.selector, '#status');
  }));

test('independent readback shares HTTP-only cookies and refuses redirects before mutations', async () => {
  await fixture('cookie', async ({ workspace: w }) =>
    assert.equal((await w.verifyDelivery({ contract })).passed, true),
  );
  await fixture('redirect-readback', async ({ workspace: w, app }) => {
    assert.equal((await w.verifyDelivery({ contract })).passed, false);
    assert.equal(app.mutationRequests(), 0);
  });
});

test('MCP executes delivery and returns native evidence with saved structured state', () =>
  fixture('healthy', async ({ root, options }) => {
    const { Client } = await import('@modelcontextprotocol/client');
    const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');
    const config = path.join(root, 'mcp.json');
    await writeFile(config, JSON.stringify(options));
    const client = new Client({ name: 'delivery-proof-test', version: '1.0.0' });
    try {
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [path.resolve('packages/cli/src/cli.js'), 'mcp', '--config', config],
        }),
      );
      const response = await client.callTool({
        name: 'shiplens_verify_delivery',
        arguments: { contract },
      });
      assert.equal(response.isError, undefined, JSON.stringify(response));
      assert.equal(response.structuredContent.passed, true);
      const proof = await client.callTool({
        name: 'shiplens_read_delivery_evidence',
        arguments: {
          deliveryId: response.structuredContent.deliveryId,
          viewport: 'desktop',
          phase: 'failure',
        },
      });
      assert.equal(proof.isError, undefined);
      assert.equal(proof.content.filter((c) => c.type === 'image').length, 1);
      assert.equal(proof.structuredContent.trial.network.injected, 1);
      assert.equal(proof.structuredContent.trial.after.count, 0);
    } finally {
      await client.close();
    }
  }));
