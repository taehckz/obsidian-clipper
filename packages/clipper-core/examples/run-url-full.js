const fs = require('node:fs/promises');
const path = require('node:path');
const { ClipperCore } = require('../dist/index.js');

async function main() {
	const core = new ClipperCore();

	const template = {
		id: 'about-npm-full',
		name: 'AboutNpmFull',
		behavior: 'create',
		noteNameFormat: 'about-npm-full',
		path: '',
		noteContentFormat: [
			'# {{title}}',
			'',
			'Source: {{url}}',
			'',
			'{{content}}',
		].join('\n'),
		properties: [
			{ name: 'source', value: '{{url}}', type: 'text' },
			{ name: 'title', value: '{{title}}', type: 'text' },
			{ name: 'site', value: '{{site}}', type: 'text' },
			{ name: 'tags', value: 'clippings, npm-docs', type: 'list' },
		],
	};

	const result = await core.clipFromUrl({
		url: 'https://docs.npmjs.com/about-npm',
		template,
		fetchOptions: {
			headers: {
				'User-Agent': 'clipper-core-local-test/1.0',
				'Accept-Language': 'en-US,en;q=0.9',
			},
		},
	});

	const outDir = path.join(__dirname, 'output');
	await fs.mkdir(outDir, { recursive: true });
	const outPath = path.join(outDir, 'about-npm-full.md');
	await fs.writeFile(outPath, result.fullContent, 'utf-8');

	console.log(`Written full result to: ${outPath}`);
	console.log(`noteName=${result.noteName}`);
	console.log(`contentLength=${result.content.length}`);
	console.log('properties=', JSON.stringify(result.properties, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
