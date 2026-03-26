const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');

const { PlaywrightRendererAdapter } = require('../../dist/index.js');

const shouldRun = process.env.RUN_PLAYWRIGHT_INTEGRATION === '1';

async function startServer(handler) {
	const server = http.createServer(handler);
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	return {
		server,
		url: `http://127.0.0.1:${address.port}`,
	};
}

test(
	'PlaywrightRendererAdapter integration: renders local page reliably',
	{ skip: !shouldRun },
	async () => {
		const { server, url } = await startServer((req, res) => {
			res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
			res.end(`
        <html>
          <head><title>Integration Title</title></head>
          <body>
            <article id="content">Playwright integration content block.</article>
          </body>
        </html>
      `);
		});

		try {
			const adapter = new PlaywrightRendererAdapter();
			// Run multiple times to guard against lifecycle regressions around page/context close.
			for (let i = 0; i < 3; i++) {
				const html = await adapter.renderHtml({
					url,
					playwright: {
						waitUntil: 'domcontentloaded',
						timeoutMs: 15000,
					},
				});
				assert.ok(html.includes('Integration Title'));
				assert.ok(html.includes('Playwright integration content block.'));
			}
		} finally {
			server.close();
		}
	}
);

