const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
	InMemoryPolicyStore,
	DECISION_TRACE_VERSION,
	JsonFilePolicyStore,
	migratePolicyFile,
} = require('../../dist/index.js');
const { runAutoPipeline } = require('../../dist/auto/pipeline.js');
const { evaluateClipQuality } = require('../../dist/auto/quality.js');
const { decideAutoRoute } = require('../../dist/auto/router.js');

function makeClipResult(content, title = 'Title') {
	return {
		noteName: 'note',
		frontmatter: '',
		content,
		fullContent: content,
		properties: [],
		variables: {
			'{{title}}': title,
		},
	};
}

test('InMemoryPolicyStore contract: set/get roundtrip', async () => {
	const store = new InMemoryPolicyStore();
	await store.set('example.com', {
		version: 1,
		updatedAt: new Date().toISOString(),
		forceStageB: true,
		lastReason: 'test',
	});
	const value = await store.get('example.com');
	assert.equal(value.forceStageB, true);
	assert.equal(value.lastReason, 'test');
});

test('JsonFilePolicyStore contract: persists and reloads policy', async () => {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipper-core-policy-'));
	const filePath = path.join(tempDir, 'policy.json');
	const storeA = new JsonFilePolicyStore(filePath);
	await storeA.set('example.com', {
		version: 1,
		updatedAt: new Date().toISOString(),
		forceStageB: true,
		lastReason: 'persist',
	});

	const storeB = new JsonFilePolicyStore(filePath);
	const value = await storeB.get('example.com');
	assert.equal(value.forceStageB, true);
	assert.equal(typeof value.updatedAt, 'string');
});

test('JsonFilePolicyStore contract: concurrent writes preserve all hosts', async () => {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clipper-core-policy-concurrent-'));
	const filePath = path.join(tempDir, 'policy.json');
	const store = new JsonFilePolicyStore(filePath);

	await Promise.all([
		store.set('a.example.com', {
			version: 1,
			updatedAt: new Date().toISOString(),
			lastReason: 'a',
		}),
		store.set('b.example.com', {
			version: 1,
			updatedAt: new Date().toISOString(),
			lastReason: 'b',
		}),
	]);

	const a = await store.get('a.example.com');
	const b = await store.get('b.example.com');
	assert.equal(a.lastReason, 'a');
	assert.equal(b.lastReason, 'b');
});

test('migratePolicyFile contract: normalizes unknown/missing structure', () => {
	const migrated = migratePolicyFile({
		policies: {
			'example.com': {
				forceStageB: true,
			},
		},
	});
	assert.equal(migrated.version, 1);
	assert.equal(migrated.policies['example.com'].forceStageB, true);
	assert.equal(typeof migrated.policies['example.com'].updatedAt, 'string');
});

test('runAutoPipeline contract: Stage A failure falls back to Stage B and emits trace', async () => {
	let stageAFetched = false;
	let stageBRendered = false;

	const output = await runAutoPipeline({
		url: 'https://example.com/post',
		host: 'example.com',
		template: {
			id: 't',
			name: 'T',
			behavior: 'create',
			noteNameFormat: '{{title}}',
			path: '',
			noteContentFormat: '{{content}}',
			properties: [],
		},
		auto: {
			enableTrace: true,
			thresholds: {
				minContentLength: 100,
				minWordCount: 50,
				requireTitle: true,
			},
			policyStore: new InMemoryPolicyStore(),
			rendererAdapter: {
				name: 'mock-renderer',
				renderHtml: async () => {
					stageBRendered = true;
					return '<html><head><title>Rendered</title></head><body><article>' + 'word '.repeat(120) + '</article></body></html>';
				},
			},
		},
		fetchHtml: async () => {
			stageAFetched = true;
			return '<html><head><title>A</title></head><body>tiny</body></html>';
		},
		clipFromHtml: async ({ html }) => {
			if (html.includes('tiny')) {
				return makeClipResult('tiny text', 'A');
			}
			return makeClipResult('word '.repeat(120), 'Rendered');
		},
		evaluateQuality: evaluateClipQuality,
		decideRoute: decideAutoRoute,
	});

	assert.equal(stageAFetched, true);
	assert.equal(stageBRendered, true);
	assert.equal(output.trace.traceVersion, DECISION_TRACE_VERSION);
	assert.equal(output.trace.finalStage, 'stageB');
	assert.equal(output.trace.stageA.attempted, true);
	assert.equal(output.trace.stageB.attempted, true);
	assert.ok(output.result.content.length > 100);
});

test('runAutoPipeline contract: trace schema includes required top-level fields', async () => {
	const output = await runAutoPipeline({
		url: 'https://example.com/post',
		host: 'example.com',
		template: {
			id: 't',
			name: 'T',
			behavior: 'create',
			noteNameFormat: '{{title}}',
			path: '',
			noteContentFormat: '{{content}}',
			properties: [],
		},
		auto: {
			enableTrace: true,
			thresholds: {
				minContentLength: 10,
				minWordCount: 2,
				requireTitle: true,
			},
			policyStore: new InMemoryPolicyStore(),
		},
		fetchHtml: async () =>
			'<html><head><title>A</title></head><body><article>word word word</article></body></html>',
		clipFromHtml: async () => makeClipResult('word word word', 'A'),
		evaluateQuality: evaluateClipQuality,
		decideRoute: decideAutoRoute,
	});

	assert.ok(output.trace);
	const keys = Object.keys(output.trace).sort();
	assert.deepEqual(keys, [
		'finalStage',
		'host',
		'initialRoute',
		'policyUpdated',
		'stageA',
		'stageB',
		'traceVersion',
		'url',
	]);
	assert.equal(output.trace.traceVersion, DECISION_TRACE_VERSION);
});

