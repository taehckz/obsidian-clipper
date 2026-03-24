const { ClipperCore } = require('../dist/index.js');

async function main() {
	const core = new ClipperCore();

	const template = {
		id: 'about-npm-test',
		name: 'AboutNpmTest',
		behavior: 'create',
		noteNameFormat: 'about-npm-test',
		path: '',
		noteContentFormat: [
			'URL: {{url}}',
			'Title: {{title}}',
			'ContentLen: {{content|length}}',
			'H1: {{selector:h1}}',
			'',
			'--- Content Preview ---',
			'{{content|slice:0,500}}',
		].join('\n'),
		properties: [],
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

	console.log(result.fullContent);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
