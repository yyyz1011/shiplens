import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { ReviewWorkspace } from '../src/review.js';

async function fixture(fn) {
  let fixed = false;
  const server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(
      `<html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checks</title><h1>Checkout</h1><section id="price">${fixed ? '$19' : '$29'}</section><section id="copy">Ready <span class="private">PRIVATE</span></section><div id="long">${'text '.repeat(2000)}</div></html>`,
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const directory = await mkdtemp(path.join(tmpdir(), 'shiplens-checks-'));
  const workspace = new ReviewWorkspace({
    directory,
    options: {
      url: `http://127.0.0.1:${server.address().port}`,
      crawl: false,
      scroll: false,
      settle: 0,
      viewport: 'both',
      mask: ['.private'],
    },
  });
  try {
    await fn({
      workspace,
      directory,
      fix: () => {
        fixed = true;
      },
    });
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await rm(directory, { recursive: true, force: true });
  }
}
const price = {
  id: 'price',
  description: 'Price is $19',
  page: '/',
  selector: '#price',
  checks: [{ operator: 'equals', value: '$19' }],
};

test('configured checks block contradictory manual passes and replay as fresh deterministic evaluations', () =>
  fixture(async ({ workspace: w, fix }) => {
    const before = await w.collect({ requirements: [price] });
    assert.equal(before.requirements[0].status, 'fail');
    await assert.rejects(
      w.assess({
        runId: before.runId,
        criterionId: 'price',
        status: 'pass',
        evidenceIds: before.evidence.map((e) => e.evidenceId),
        note: 'Deliberately false claim',
      }),
      /cannot override/,
    );
    const saved = await w.saveCase({ runId: before.runId, name: 'Price guard' });
    fix();
    const after = await w.recheck({ caseId: saved.caseId });
    assert.equal(after.requirements[0].verification.status, 'pass');
    assert.equal(after.requirements[0].status, 'pending'); // Manual review still owed.
    assert.equal((await w.gate({ runId: after.runId })).passed, false);
    const automatic = await w.collect({ requirements: [{ ...price, evaluation: 'checks' }] });
    assert.equal(automatic.requirements[0].status, 'pass');
    assert.equal(automatic.requirements[0].assessment, null);
    assert.equal(automatic.history.length, 0);
    assert.equal((await w.gate({ runId: automatic.runId })).passed, true);
    await assert.rejects(
      w.assess({
        runId: automatic.runId,
        criterionId: 'price',
        status: 'fail',
        evidenceIds: automatic.evidence.map((e) => e.evidenceId),
        note: 'Cannot overwrite automatic result',
      }),
      /cannot override/,
    );
    const portable = await w.exportCase({
      caseId: (await w.saveCase({ runId: automatic.runId, name: 'Price auto' })).caseId,
    });
    assert.deepEqual(portable.requirements[0].checks, price.checks);
    const imported = await w.importCase({ data: portable });
    const replay = await w.recheck({ caseId: imported.caseId });
    assert.equal(replay.requirements[0].status, 'pass');
    assert.notEqual(replay.evidence[0].evidenceId, automatic.evidence[0].evidenceId);
    const same = await w.compareRuns({ runId: replay.runId, previousRunId: automatic.runId });
    assert.equal(same.criteria[0].transition, 'still-passing');
    const changed = await w.collect({
      requirements: [
        { ...price, evaluation: 'checks', checks: [{ operator: 'contains', value: '$' }] },
      ],
    });
    assert.equal(
      (await w.compareRuns({ runId: changed.runId, previousRunId: automatic.runId })).criteria[0]
        .transition,
      'not-comparable',
    );
  }));

test('check-only evidence can fail then resolve without caller judgments; damaged and truncated proof cannot pass', () =>
  fixture(async ({ workspace: w, fix, directory }) => {
    const before = await w.collect({ requirements: [{ ...price, evaluation: 'checks' }] });
    const saved = await w.saveCase({ runId: before.runId, name: 'Price regression' });
    fix();
    const after = await w.recheck({ caseId: saved.caseId });
    assert.equal(
      (await w.compareRuns({ runId: after.runId, previousRunId: before.runId })).criteria[0]
        .transition,
      'resolved',
    );
    const report = await w.exportReport({ runId: after.runId, previousRunId: before.runId });
    assert.match(
      await readFile(path.join(directory, report.file), 'utf8'),
      /Configured text checks/,
    );
    const manifest = JSON.parse(
      await readFile(path.join(directory, 'runs', after.runId, 'run.json')),
    );
    await rm(path.join(directory, manifest.scanDirectory, after.evidence[0].screenshot));
    assert.equal((await w.getRun(after.runId)).requirements[0].status, 'needs-evidence');
    assert.equal((await w.gate({ runId: after.runId })).passed, false);
    const long = await w.collect({
      requirements: [
        {
          ...price,
          selector: '#long',
          evaluation: 'checks',
          checks: [{ operator: 'excludes', value: 'absent' }],
        },
      ],
    });
    assert.equal(long.requirements[0].status, 'needs-evidence');
    const missing = await w.collect({
      requirements: [{ ...price, selector: '#absent', evaluation: 'checks' }],
    });
    assert.equal(missing.requirements[0].status, 'needs-evidence');
    const masked = await w.collect({
      requirements: [
        {
          ...price,
          selector: '#copy',
          evaluation: 'checks',
          checks: [
            { operator: 'equals', value: '  Ready  ' },
            { operator: 'excludes', value: 'PRIVATE' },
            { operator: 'contains', value: 'Read' },
          ],
        },
      ],
    });
    assert.equal(masked.requirements[0].status, 'pass'); // Explicitly only visible unmasked text.
  }));

test('packets batch native evidence with pagination, explicit byte omissions and attention filtering', () =>
  fixture(async ({ workspace: w, directory }) => {
    const requirements = [
      price,
      { id: 'copy', description: 'Review copy', page: '/', selector: '#copy' },
    ];
    const run = await w.collect({ requirements });
    const packet = await w.reviewPacket({ runId: run.runId });
    assert.equal(packet.total, 4);
    assert.equal(packet.items.length, 4);
    assert.ok(packet.items.every((i) => i.image && i.observation && !i.readSeparately));
    assert.equal(packet.bytes, Buffer.byteLength(JSON.stringify(packet)));
    assert.doesNotMatch(JSON.stringify(packet), /PRIVATE/);
    const first = await w.reviewPacket({ runId: run.runId, limit: 1 });
    const second = await w.reviewPacket({ runId: run.runId, offset: first.nextOffset, limit: 1 });
    assert.notEqual(first.items[0].evidence.evidenceId, second.items[0].evidence.evidenceId);
    const manifest = JSON.parse(
      await readFile(path.join(directory, 'runs', run.runId, 'run.json')),
    );
    const imageFile = path.join(directory, manifest.scanDirectory, run.evidence[0].screenshot);
    const image = await readFile(imageFile);
    await writeFile(imageFile, Buffer.concat([image, Buffer.alloc(20000)]));
    const bounded = await w.reviewPacket({ runId: run.runId, maxBytes: 16384 });
    assert.ok(bounded.bytes <= 16384);
    assert.ok(bounded.items.some((i) => i.omitted.includes('image') && i.readSeparately));
    await writeFile(imageFile, image);
    await w.assess({
      runId: run.runId,
      criterionId: 'copy',
      status: 'pass',
      evidenceIds: run.evidence
        .filter((e) => e.criterionIds.includes('copy'))
        .map((e) => e.evidenceId),
      note: 'Synthetic test review',
    });
    assert.equal((await w.reviewPacket({ runId: run.runId })).total, 2);
    assert.equal((await w.reviewPacket({ runId: run.runId, includePassed: true })).total, 4);
    await assert.rejects(w.reviewPacket({ runId: run.runId, limit: 0 }), /Packet requires/);
  }));

test('invalid and empty check configurations reject before browser execution', () =>
  fixture(async ({ workspace: w }) => {
    for (const patch of [
      { checks: [] },
      { checks: [{ operator: 'regex', value: '(a+)+' }] },
      { checks: [{ operator: 'equals', value: ' ' }] },
      { checks: [{ operator: 'equals', value: 'a', script: 'x' }] },
      { checks: undefined, evaluation: 'checks' },
      { evaluation: 'automatic' },
    ])
      await assert.rejects(w.collect({ requirements: [{ ...price, ...patch }] }));
    assert.equal((await w.listRuns()).total, 0);
  }));
