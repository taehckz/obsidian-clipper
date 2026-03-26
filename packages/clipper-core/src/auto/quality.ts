import type { ClipResult } from '../index';
import type { AutoThresholds, QualityCheck, QualityEvaluation } from './types';

export const DEFAULT_AUTO_THRESHOLDS: Required<AutoThresholds> = {
	requireTitle: true,
	minContentLength: 200,
	minWordCount: 60,
};

function countWords(input: string): number {
	return input
		.trim()
		.split(/\s+/)
		.filter(Boolean).length;
}

export function evaluateClipQuality(
	result: ClipResult,
	thresholds?: AutoThresholds
): QualityEvaluation {
	const merged: Required<AutoThresholds> = {
		...DEFAULT_AUTO_THRESHOLDS,
		...(thresholds ?? {}),
	};

	const title = (result.variables?.['{{title}}'] || '').trim();
	const content = (result.content || '').trim();
	const contentLength = content.length;
	const wordCount = countWords(content);

	const checks: QualityCheck[] = [
		{
			name: 'has_title',
			pass: !merged.requireTitle || title.length > 0,
			actual: title.length > 0,
			expected: merged.requireTitle,
			message: merged.requireTitle ? 'Title is required.' : 'Title check disabled.',
		},
		{
			name: 'content_length',
			pass: contentLength >= merged.minContentLength,
			actual: contentLength,
			expected: merged.minContentLength,
			message: 'Extracted markdown length should be above minimum threshold.',
		},
		{
			name: 'word_count',
			pass: wordCount >= merged.minWordCount,
			actual: wordCount,
			expected: merged.minWordCount,
			message: 'Extracted markdown word count should be above minimum threshold.',
		},
	];

	const passedCount = checks.filter((check) => check.pass).length;
	const score = checks.length > 0 ? Math.round((passedCount / checks.length) * 100) : 100;

	return {
		pass: checks.every((check) => check.pass),
		score,
		checks,
	};
}

