const { ClipperCore } = require('../dist/index.js');

async function main() {
	const core = new ClipperCore();

	const template = {
		id: 'debug',
		name: 'Debug',
		behavior: 'create',
		noteNameFormat: 'debug-note',
		path: '',
		noteContentFormat: 'URL: {{url}}\nTitle: {{title}}\nContentLen: {{content|length}}\n',
		properties: [],
	};

	const html =
		'<!doctype html><html><head><title>Local Test</title></head><body><article><h1>Local Test</h1><p>Hello clipper-core.</p></article></body></html>';

	const result = await core.clipFromHtml({
		html,
		url: 'https://example.com/local-test',
		template,
	});

	console.log('noteName=' + result.noteName);
	console.log('fullContent_start');
	console.log(result.fullContent);
	console.log('fullContent_end');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
