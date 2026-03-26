const fs = require('node:fs/promises');
const path = require('node:path');
const { ClipperCore, InMemoryPolicyStore } = require('../dist/index.js');

const template = {
	id: 'default',
	name: 'Default',
	behavior: 'create',
	noteNameFormat: '{{title|safe_name}}',
	path: '',
	noteContentFormat: ['# {{title}}', '', 'Source: {{url}}', '', '{{content}}'].join('\n'),
	properties: [],
};

async function main() {
	const url = process.argv[2];
	if (!url) {
		console.error('Usage: node examples/extract.js "<url>" [out-file]');
		process.exit(1);
	}

	const outputPath = process.argv[3] || path.join(__dirname, 'output', 'extract-output.md');
	await fs.mkdir(path.dirname(outputPath), { recursive: true });

	const core = new ClipperCore({ enableAutoTrace: true });
	const out = await core.clipFromUrlAuto({
		url,
		template,
		fetchOptions: {
			headers: {
				'User-Agent': 'clipper-core/1.0',
				'Accept-Language': 'en-US,en;q=0.9',
			},
		},
		auto: {
			policyStore: new InMemoryPolicyStore(),
			thresholds: {
				requireTitle: true,
				minContentLength: 200,
				minWordCount: 60,
			},
			enableTrace: true,
		},
	});

	await fs.writeFile(outputPath, out.result.fullContent, 'utf8');
	console.log(`Saved=${outputPath}`);
	console.log(`Stage=${out.trace?.finalStage || 'stageA'}`);
	console.log(`Title=${out.result.variables['{{title}}'] || ''}`);
	console.log(`ContentLength=${out.result.content.length}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

