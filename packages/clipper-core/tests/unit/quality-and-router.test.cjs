const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateClipQuality } = require('../../dist/auto/quality.js');
const { decideAutoRoute } = require('../../dist/auto/router.js');

function makeClipResult({ title = 'Sample title', content = 'word '.repeat(80) } = {}) {
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

test('evaluateClipQuality passes with default thresholds for healthy content', () => {
	const result = makeClipResult();
	const evaluation = evaluateClipQuality(result);
	assert.equal(evaluation.pass, true);
	assert.equal(evaluation.score, 100);
	assert.equal(evaluation.checks.length, 3);
});

test('evaluateClipQuality fails when title is missing and content is too short', () => {
	const result = makeClipResult({ title: '', content: 'tiny content' });
	const evaluation = evaluateClipQuality(result, {
		requireTitle: true,
		minContentLength: 200,
		minWordCount: 50,
	});
	assert.equal(evaluation.pass, false);
	assert.ok(evaluation.checks.some((check) => check.name === 'has_title' && !check.pass));
	assert.ok(evaluation.checks.some((check) => check.name === 'content_length' && !check.pass));
});

test('decideAutoRoute honors forceStage override', () => {
	const decision = decideAutoRoute({
		host: 'example.com',
		forceStage: 'stageB',
		now: new Date(),
	});
	assert.equal(decision.stage, 'stageB');
	assert.equal(decision.source, 'override');
});

test('decideAutoRoute uses policy default and falls back to stageA', () => {
	const stageBDecision = decideAutoRoute({
		host: 'example.com',
		policy: {
			version: 1,
			updatedAt: new Date().toISOString(),
			forceStageB: true,
		},
		now: new Date(),
	});
	assert.equal(stageBDecision.stage, 'stageB');
	assert.equal(stageBDecision.source, 'policy');

	const stageADecision = decideAutoRoute({
		host: 'example.com',
		now: new Date(),
	});
	assert.equal(stageADecision.stage, 'stageA');
	assert.equal(stageADecision.source, 'default');
});

