const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');

const { ClipperCore, InMemoryPolicyStore } = require('../../dist/index.js');

function createTemplate() {
	return {
		id: 'default',
		name: 'Default',
		behavior: 'create',
		noteNameFormat: '{{title}}',
		path: '',
		noteContentFormat: '{{content}}',
		properties: [],
	};
}

async function startServer(handler) {
	const server = http.createServer(handler);
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;
	return { server, baseUrl };
}

test('E2E: clipFromUrl extracts from local HTTP page', async () => {
	const { server, baseUrl } = await startServer((req, res) => {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(`
      <html>
        <head><title>Local E2E Title</title></head>
        <body><article>${'local content '.repeat(80)}</article></body>
      </html>
    `);
	});

	try {
		const core = new ClipperCore();
		const result = await core.clipFromUrl({
			url: `${baseUrl}/article`,
			template: createTemplate(),
		});
		assert.ok(result.content.length > 50);
		assert.ok((result.variables['{{title}}'] || '').length > 0);
	} finally {
		server.close();
	}
});

test('E2E: clipFromUrlAuto falls back to custom Stage B renderer', async () => {
	const { server, baseUrl } = await startServer((req, res) => {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end('<html><head><title>Short</title></head><body>tiny</body></html>');
	});

	try {
		const core = new ClipperCore({
			enableAutoTrace: true,
		});

		const out = await core.clipFromUrlAuto({
			url: `${baseUrl}/short`,
			template: createTemplate(),
			auto: {
				policyStore: new InMemoryPolicyStore(),
				thresholds: {
					requireTitle: true,
					minContentLength: 240,
					minWordCount: 80,
				},
				rendererAdapter: {
					name: 'e2e-mock-renderer',
					renderHtml: async () =>
						`<html><head><title>Rendered Stage B</title></head><body><article>${'rendered content '.repeat(
							120
						)}</article></body></html>`,
				},
			},
		});

		assert.equal(out.trace.finalStage, 'stageB');
		assert.equal(out.trace.stageA.attempted, true);
		assert.equal(out.trace.stageB.attempted, true);
		assert.ok(out.result.content.length > 240);
	} finally {
		server.close();
	}
});

