import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import { ReviewWorkspace } from '../src/review.js';
import { scan } from '../src/index.js';
import { demoHandler } from '../examples/server.mjs';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

async function fixture(fn) {
  const server = http.createServer((req, res) => {
    if (req.url === '/private') {
      res.setHeader('content-type', 'text/html');
      return res.end(
        '<h1>Review fixture</h1><section id="secret"><b>PRIVATE-SUBTREE</b></section><input type="password" value="SECRET-PASSWORD"><textarea>SECRET-TEXTAREA</textarea><p>Public text</p>',
      );
    }
    if (req.url === '/long') {
      res.setHeader('content-type', 'text/html');
      return res.end('<h1>Long fixture</h1><p>' + 'long '.repeat(2000) + '</p>');
    }
    demoHandler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const directory = await mkdtemp(path.join(tmpdir(), 'shiplens-review-'));
  const options = {
    url: `http://127.0.0.1:${server.address().port}`,
    viewport: 'both',
    settle: 0,
    crawl: false,
    scroll: false,
    timeout: 2000,
  };
  try {
    await fn({ directory, options });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}
const criteria = [
  {
    id: 'details',
    description: 'Opening details shows the itinerary.',
    page: '/',
    flow: 'open',
    step: 1,
  },
];
const flows = [{ name: 'open', page: '/', steps: [{ action: 'click', selector: '#details' }] }];

test('review ledger validates scope, devices and immutable receipts; replays start pending', () =>
  fixture(async ({ directory, options }) => {
    const workspace = new ReviewWorkspace({ directory, options });
    const run = await workspace.collect({ requirements: criteria, flows });
    assert.equal(run.requirements[0].status, 'pending');
    const evidence = run.evidence.filter((e) => e.criterionIds.includes('details'));
    assert.equal(evidence.length, 2);
    assert.ok(evidence.every((e) => e.complete));
    const proof = await workspace.readEvidence({
      runId: run.runId,
      evidenceId: evidence[0].evidenceId,
    });
    assert.match(proof.observation.text, /Three-day itinerary/);
    assert.equal(proof.image.mimeType, 'image/png');
    assert.ok(proof.observation.elements.some((e) => e.selector === '#details'));
    const assessment = {
      runId: run.runId,
      criterionId: 'details',
      status: 'pass',
      evidenceIds: evidence.map((e) => e.evidenceId),
      note: 'The itinerary is visible after opening details in both viewport captures.',
    };
    await assert.rejects(
      workspace.assess({ ...assessment, evidenceIds: [evidence[0].evidenceId] }),
      /every requested viewport/,
    );
    await assert.rejects(
      workspace.assess({
        ...assessment,
        evidenceIds: ['e_not-in-this-criterion'],
      }),
      /requirement scope/,
    );
    await assert.rejects(
      workspace.saveCase({ runId: run.runId, name: 'Unassessed' }),
      /Assess all/,
    );
    await workspace.assess({ ...assessment, status: 'needs-evidence', evidenceIds: [] });
    const passed = await workspace.assess(assessment);
    assert.equal(passed.history.length, 2);
    assert.equal(passed.history[0].status, 'needs-evidence');
    const saved = await workspace.saveCase({ runId: run.runId, name: 'Details review' });
    const reopened = new ReviewWorkspace({ directory, options });
    const next = await reopened.recheck({ caseId: saved.caseId });
    assert.equal(next.requirements[0].status, 'pending');
    assert.equal(next.previousRunId, run.runId);
    assert.equal(next.history.length, 0);
    assert.equal(next.machine.comparison.comparable, true);
    await assert.rejects(reopened.assess({ ...assessment, runId: next.runId }), /this run/);
    await assert.rejects(
      new ReviewWorkspace({ directory, options: { ...options, viewport: 'desktop' } }).recheck({
        caseId: saved.caseId,
      }),
      /configuration differs/,
    );
    await assert.rejects(workspace.getRun('../../etc/passwd'), /Invalid/);
  }));

test('DOM masks exclude descendants and form values; truncation and failed checks cannot pass', () =>
  fixture(async ({ directory, options }) => {
    const workspace = new ReviewWorkspace({
      directory,
      options: {
        ...options,
        url: options.url + '/private',
        viewport: 'desktop',
        mask: ['#secret'],
      },
    });
    const run = await workspace.collect({
      requirements: [{ id: 'privacy', description: 'Public text visible', page: '/private' }],
    });
    const proof = await workspace.readEvidence({
      runId: run.runId,
      evidenceId: run.evidence[0].evidenceId,
    });
    assert.match(proof.observation.text, /Public text/);
    assert.doesNotMatch(
      JSON.stringify(proof.observation),
      /PRIVATE-SUBTREE|SECRET-PASSWORD|SECRET-TEXTAREA/,
    );
    const long = new ReviewWorkspace({
      directory: path.join(directory, 'long'),
      options: { ...options, url: options.url + '/long', viewport: 'desktop' },
    });
    const truncated = await long.collect({
      requirements: [{ id: 'long', description: 'All text reviewed', page: '/long' }],
    });
    await assert.rejects(
      long.assess({
        runId: truncated.runId,
        criterionId: 'long',
        status: 'pass',
        evidenceIds: [truncated.evidence[0].evidenceId],
        note: 'test',
      }),
      /truncated evidence/,
    );
    const broken = new ReviewWorkspace({
      directory: path.join(directory, 'broken'),
      options: { ...options, viewport: 'desktop' },
    });
    const failed = await broken.collect({
      requirements: criteria,
      flows: [{ ...flows[0], steps: [{ action: 'click', selector: '#missing' }] }],
    });
    await assert.rejects(
      broken.assess({
        runId: failed.runId,
        criterionId: 'details',
        status: 'pass',
        evidenceIds: failed.evidence.filter((e) => e.criterionIds.length).map((e) => e.evidenceId),
        note: 'test',
      }),
      /Incomplete/,
    );
    const invalid = await scan({
      ...options,
      url: options.url + '/private',
      viewport: 'desktop',
      output: path.join(directory, 'invalid'),
      captureDom: true,
      mask: ['[invalid'],
    });
    assert.equal(invalid.pages[0].checks[0].observation, undefined);
    assert.ok(invalid.findings.some((f) => f.code === 'evidence-failed'));
  }));

test('saved cases parameterize fill values and restart safely; evidence cannot escape its scan', () =>
  fixture(async ({ directory, options }) => {
    options.viewport = 'desktop';
    const workspace = new ReviewWorkspace({ directory, options });
    const run = await workspace.collect({
      requirements: [
        { id: 'input', description: 'Input can be filled', page: '/', flow: 'fill', step: 1 },
      ],
      flows: [
        {
          name: 'fill',
          page: '/',
          steps: [{ action: 'fill', selector: '#query', value: 'DO-NOT-PERSIST-INPUT' }],
        },
      ],
    });
    const evidence = run.evidence.find((e) => e.criterionIds.length);
    await workspace.assess({
      runId: run.runId,
      criterionId: 'input',
      status: 'pass',
      evidenceIds: [evidence.evidenceId],
      note: 'Visible form after filling.',
    });
    const saved = await workspace.saveCase({ runId: run.runId, name: 'Input case' });
    assert.equal(saved.requiredInputs[0].key, 'input_1');
    for (const dir of ['runs', 'cases', 'scans']) {
      for (const filename of await readdir(path.join(directory, dir), { recursive: true })) {
        if (!filename.endsWith('.json')) continue;
        assert.doesNotMatch(
          await readFile(path.join(directory, dir, filename), 'utf8'),
          /DO-NOT-PERSIST-INPUT/,
        );
      }
    }
    await assert.rejects(workspace.recheck({ caseId: saved.caseId }), /Missing string input/);
    const next = await new ReviewWorkspace({ directory, options }).recheck({
      caseId: saved.caseId,
      inputs: { input_1: 'changed test input' },
    });
    assert.equal(next.requirements[0].status, 'pending');
    assert.equal(next.machine.comparison.comparable, false);
    if (process.platform !== 'win32') {
      const manifest = JSON.parse(
        await readFile(path.join(directory, 'runs', run.runId, 'run.json'), 'utf8'),
      );
      const observation = path.join(directory, manifest.scanDirectory, evidence.observation);
      await rm(observation);
      await symlink(path.join(directory, 'cases', saved.caseId + '.json'), observation);
      await assert.rejects(
        workspace.readEvidence({ runId: run.runId, evidenceId: evidence.evidenceId }),
        /inside its scan/,
      );
    }
  }));

test('MCP stdio works with official legacy and modern clients, including PNG evidence and all six tools', () =>
  fixture(async ({ directory, options }) => {
    const config = path.join(directory, 'shiplens.config.json');
    await writeFile(config, JSON.stringify({ ...options, viewport: 'desktop', output: 'output' }));
    for (const mode of ['legacy', 'auto']) {
      const client = new Client(
        { name: 'review-test', version: '1.0.0' },
        { versionNegotiation: { mode } },
      );
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [path.resolve('packages/cli/src/cli.js'), 'mcp', '--config', config],
        stderr: 'pipe',
      });
      try {
        await client.connect(transport);
        assert.equal(client.getProtocolEra(), mode === 'legacy' ? 'legacy' : 'modern');
        assert.equal((await client.listTools()).tools.length, 6);
        assert.ok(
          (await client.getPrompt({ name: 'review_website' })).messages[0].content.text.includes(
            'untrusted',
          ),
        );
        const call = async (name, args) => {
          const result = await client.callTool({ name: 'shiplens_' + name, arguments: args });
          assert.ok(!result.isError, JSON.stringify(result));
          return result;
        };
        const run = (await call('collect', { requirements: criteria, flows })).structuredContent;
        const evidence = run.evidence.find((e) => e.criterionIds.length);
        const proof = await call('read_evidence', {
          runId: run.runId,
          evidenceId: evidence.evidenceId,
        });
        assert.ok(
          proof.content.some((item) => item.type === 'image' && item.mimeType === 'image/png'),
        );
        await call('assess', {
          runId: run.runId,
          criterionId: 'details',
          status: 'pass',
          evidenceIds: [evidence.evidenceId],
          note: 'Demo itinerary is visible.',
        });
        const saved = (await call('save_case', { runId: run.runId, name: 'MCP details' }))
          .structuredContent;
        const next = (await call('recheck', { caseId: saved.caseId })).structuredContent;
        assert.equal(
          (await call('get_run', { runId: next.runId })).structuredContent.requirements[0].status,
          'pending',
        );
        assert.equal(
          (
            await client.callTool({
              name: 'shiplens_read_evidence',
              arguments: { runId: next.runId, evidenceId: evidence.evidenceId },
            })
          ).isError,
          true,
        );
      } finally {
        await client.close();
      }
    }
  }));
