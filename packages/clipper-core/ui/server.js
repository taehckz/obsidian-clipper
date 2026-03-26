const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const {
	ClipperCore,
	JsonFilePolicyStore,
	checkPlaywrightAvailability,
} = require('../dist/index.js');

const PORT = Number(process.env.CLIPPER_CORE_UI_PORT || 3040);
const HOST = process.env.CLIPPER_CORE_UI_HOST || '127.0.0.1';
const MAX_REQUEST_BODY_BYTES = 1024 * 1024 * 2;
const policyFile = path.join(__dirname, '.data', 'domain-policy.json');
const staticHtmlPath = path.join(__dirname, 'index.html');

const core = new ClipperCore({
	enableAutoTrace: true,
	autoPolicyStore: new JsonFilePolicyStore(policyFile),
});

const defaultTemplate = {
	id: 'default-ui-template',
	name: 'Default UI Template',
	behavior: 'create',
	noteNameFormat: '{{title|safe_name}}',
	path: '',
	noteContentFormat: ['# {{title}}', '', 'Source: {{url}}', '', '{{content}}'].join('\n'),
	properties: [],
};

function sendJson(res, statusCode, body) {
	res.writeHead(statusCode, {
		'Content-Type': 'application/json; charset=utf-8',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	});
	res.end(JSON.stringify(body));
}

function parseRequestBody(req) {
	return new Promise((resolve, reject) => {
		let body = '';
		let bodyBytes = 0;
		req.on('data', (chunk) => {
			bodyBytes += chunk.length;
			if (bodyBytes > MAX_REQUEST_BODY_BYTES) {
				reject(new Error('Request body too large. Limit is 2MB.'));
				req.destroy();
				return;
			}
			body += chunk;
		});
		req.on('end', () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch (error) {
				reject(new Error('Invalid JSON body'));
			}
		});
		req.on('error', reject);
	});
}

function normalizeTemplate(templateText) {
	if (!templateText) return defaultTemplate;
	const parsed = JSON.parse(templateText);
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Template JSON must be an object.');
	}
	if (!Array.isArray(parsed.properties)) {
		parsed.properties = [];
	}
	return parsed;
}

async function handleExtract(req, res) {
	try {
		const payload = await parseRequestBody(req);
		const url = String(payload.url || '').trim();
		if (!url) {
			sendJson(res, 400, { ok: false, error: 'URL is required.' });
			return;
		}

		const template = normalizeTemplate(payload.templateJson || '');
		const autoEnabled = payload.autoEnabled !== false;
		const minContentLength = Number(payload.minContentLength || 200);
		const minWordCount = Number(payload.minWordCount || 60);
		const requireTitle = payload.requireTitle !== false;

		const startedAt = Date.now();
		let result;
		let trace;
		const capabilities = await getCapabilities();
		if (autoEnabled) {
			const out = await core.clipFromUrlAuto({
				url,
				template,
				fetchOptions: {
					headers: {
						'User-Agent': 'clipper-core-ui/1.0',
						'Accept-Language': 'en-US,en;q=0.9',
					},
				},
				auto: {
					enableTrace: true,
					forceStage: capabilities.stageB.available ? undefined : 'stageA',
					thresholds: {
						minContentLength,
						minWordCount,
						requireTitle,
					},
				},
			});
			result = out.result;
			trace = out.trace;
		} else {
			result = await core.clipFromUrl({
				url,
				template,
				fetchOptions: {
					headers: {
						'User-Agent': 'clipper-core-ui/1.0',
						'Accept-Language': 'en-US,en;q=0.9',
					},
				},
			});
		}

		sendJson(res, 200, {
			ok: true,
			elapsedMs: Date.now() - startedAt,
			capabilities,
			result: {
				url,
				noteName: result.noteName,
				contentLength: result.content.length,
				title: result.variables['{{title}}'] || '',
				variables: result.variables || {},
				properties: result.properties || [],
				fullContent: result.fullContent,
			},
			trace: trace || null,
		});
	} catch (error) {
		sendJson(res, 500, {
			ok: false,
			error: String(error && error.message ? error.message : error),
		});
	}
}

async function getCapabilities() {
	const stageB = await checkPlaywrightAvailability();
	return {
		stageB,
	};
}

const server = http.createServer(async (req, res) => {
	try {
		const method = req.method || 'GET';
		const url = req.url || '/';

		if (method === 'OPTIONS') {
			sendJson(res, 200, { ok: true });
			return;
		}

		if (method === 'GET' && url === '/') {
			const html = await fs.readFile(staticHtmlPath, 'utf8');
			res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
			res.end(html);
			return;
		}

		if (method === 'POST' && url === '/api/extract') {
			await handleExtract(req, res);
			return;
		}

		if (method === 'GET' && url === '/api/capabilities') {
			const capabilities = await getCapabilities();
			sendJson(res, 200, { ok: true, capabilities });
			return;
		}

		sendJson(res, 404, { ok: false, error: 'Not found' });
	} catch (error) {
		if (!res.headersSent) {
			sendJson(res, 500, {
				ok: false,
				error: String(error && error.message ? error.message : error),
			});
		}
	}
});

server.listen(PORT, HOST, () => {
	console.log(`Clipper Core UI running at http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
	if (error && error.code === 'EADDRINUSE') {
		console.error(
			`Port ${PORT} is already in use on ${HOST}. ` +
				`Either stop the existing process or run with CLIPPER_CORE_UI_PORT=<new-port>.`
		);
		process.exitCode = 1;
		return;
	}
	console.error(error);
	process.exitCode = 1;
});

