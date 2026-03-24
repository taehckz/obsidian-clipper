import { applyFilters } from '../filters';
import { selectorContentToString } from '../shared';
import { debugLog } from '../debug';

/**
 * Resolve a selector and return the raw content (array or string).
 * Used by the renderer for for loops and conditionals.
 */
export async function resolveSelector(tabId: number, selectorExpr: string): Promise<any> {
	console.warn('resolveSelector fallback is unavailable in package mode:', selectorExpr, tabId);
	return undefined;
}

export async function processSelector(tabId: number, match: string, currentUrl: string): Promise<string> {
	const selectorRegex = /{{(selector|selectorHtml):(.*?)(?:\?(.*?))?(?:\|(.*?))?}}/;
	const matches = match.match(selectorRegex);
	if (!matches) {
		console.error('Invalid selector format:', match);
		return match;
	}

	const [, selectorType, rawSelector, attribute, filtersString] = matches;
	const extractHtml = selectorType === 'selectorHtml';

	// Unescape any escaped quotes and normalize whitespace in the selector
	const selector = rawSelector.replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();

	// In package mode this function is only used as a fallback.
	// Primary selector handling is provided by api.ts custom selector processor.
	const contentString = selectorContentToString('');
	debugLog('ContentExtractor', 'Applying filters (fallback mode):', { selector, filterString: filtersString, tabId, attribute, extractHtml });
	return applyFilters(contentString, filtersString, currentUrl);
}
