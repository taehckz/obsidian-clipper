const fs = require('node:fs/promises');
const path = require('node:path');
const { ClipperCore } = require('../dist/index.js');

function parseArgs(argv) {
	const args = argv.slice(2);
	let url = '';
	let outPath = '';
	let templateFile = '';
	let tag = 'clippings';
	let userAgent = 'clipper-core-local-test/1.0';
	let lang = 'en-US,en;q=0.9';

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg.startsWith('--') && !url) {
			url = arg;
			continue;
		}
		if (arg === '--out') {
			outPath = args[++i] || '';
			continue;
		}
		if (arg === '--template-file') {
			templateFile = args[++i] || '';
			continue;
		}
		if (arg === '--tag') {
			tag = args[++i] || tag;
			continue;
		}
		if (arg === '--user-agent') {
			userAgent = args[++i] || userAgent;
			continue;
		}
		if (arg === '--lang') {
			lang = args[++i] || lang;
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			console.log(
				[
					'Usage:',
					'  npm run example:url:any -- "<url>" [--template-file <path>] [--out <path>] [--tag <name>] [--user-agent <ua>] [--lang <accept-language>]',
				].join('\n')
			);
			process.exit(0);
		}
	}

	if (!url) {
		console.error('Usage: npm run example:url:any -- <url> [--template-file <path>] [--out <path>] [--tag <name>] [--user-agent <ua>] [--lang <accept-language>]');
		process.exit(1);
	}

	return { url, outPath, templateFile, tag, userAgent, lang };
}

function toSafeFileName(input) {
	return input
		.toLowerCase()
		.replace(/^https?:\/\//, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120) || 'clip';
}

function createDefaultTemplate(tag) {
	return {
		id: 'url-any-full',
		name: 'UrlAnyFull',
		behavior: 'create',
		noteNameFormat: '{{title|safe_name}}',
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
			{ name: 'author', value: '{{author}}', type: 'text' },
			{ name: 'published', value: '{{published}}', type: 'date' },
			{ name: 'site', value: '{{site}}', type: 'text' },
			{ name: 'tags', value: tag, type: 'list' },
		],
	};
}

async function loadTemplate(templateFile, tag) {
	if (!templateFile) {
		return createDefaultTemplate(tag);
	}

	const raw = await fs.readFile(path.resolve(templateFile), 'utf-8');
	const template = JSON.parse(raw);

	// Convenience override: if --tag is passed, update existing tags property
	// or append one if missing.
	if (tag) {
		const props = Array.isArray(template.properties) ? template.properties : [];
		const existing = props.find((p) => p && p.name === 'tags');
		if (existing) {
			existing.value = tag;
		} else {
			props.push({ name: 'tags', value: tag, type: 'list' });
		}
		template.properties = props;
	}

	return template;
}

async function main() {
	const { url: targetUrl, outPath, templateFile, tag, userAgent, lang } = parseArgs(process.argv);

	const core = new ClipperCore();
	const template = await loadTemplate(templateFile, tag);

	const result = await core.clipFromUrl({
		url: targetUrl,
		template,
		fetchOptions: {
			headers: {
				'User-Agent': userAgent,
				'Accept-Language': lang,
			},
		},
	});

	const defaultOutDir = path.join(__dirname, 'output');
	await fs.mkdir(defaultOutDir, { recursive: true });
	const finalOutPath = outPath || path.join(defaultOutDir, `${toSafeFileName(targetUrl)}.md`);
	await fs.writeFile(finalOutPath, result.fullContent, 'utf-8');

	console.log(`URL=${targetUrl}`);
	if (templateFile) {
		console.log(`TemplateFile=${path.resolve(templateFile)}`);
	}
	console.log(`Written=${finalOutPath}`);
	console.log(`noteName=${result.noteName}`);
	console.log(`title=${result.variables['{{title}}'] || ''}`);
	console.log(`contentLength=${result.content.length}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
