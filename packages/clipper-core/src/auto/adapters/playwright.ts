import type { RendererAdapter, RenderHtmlInput } from '../types';

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
	if (!headers) return {};
	if (typeof (headers as any).forEach === 'function') {
		const out: Record<string, string> = {};
		(headers as any).forEach((value: string, key: string) => {
			out[key] = value;
		});
		return out;
	}
	if (Array.isArray(headers)) {
		return Object.fromEntries(headers.map(([key, value]) => [key, String(value)]));
	}
	return Object.fromEntries(
		Object.entries(headers as Record<string, string>).map(([key, value]) => [key, String(value)])
	);
}

export class PlaywrightRendererAdapter implements RendererAdapter {
	name = 'playwright';

	async renderHtml(input: RenderHtmlInput): Promise<string> {
		const dynamicImport = new Function('m', 'return import(m)') as (
			moduleName: string
		) => Promise<any>;
		let playwright: any;
		try {
			playwright = await dynamicImport('playwright');
		} catch {
			throw new Error(
				'Stage B fallback requires Playwright. Install it in your app (npm install playwright) or provide a custom rendererAdapter.'
			);
		}

		const chromium = playwright?.chromium ?? playwright?.default?.chromium;
		if (!chromium) {
			throw new Error('Playwright chromium launcher is unavailable.');
		}

		const browser = await chromium.launch({
			headless: input.playwright?.headless ?? true,
		});
		let context: any;

		try {
			const headers = normalizeHeaders(input.request?.headers);
			context = await browser.newContext({
				userAgent: headers['user-agent'] || headers['User-Agent'],
				locale: headers['accept-language'] || headers['Accept-Language'],
				extraHTTPHeaders: headers,
			});
			const page = await context.newPage();
			await page.goto(input.url, {
				waitUntil: input.playwright?.waitUntil ?? 'networkidle',
				timeout: input.playwright?.timeoutMs ?? 30000,
			});
			if (input.playwright?.waitForSelector) {
				await page.waitForSelector(input.playwright.waitForSelector, {
					timeout: input.playwright.timeoutMs ?? 30000,
				});
			}
			if (input.playwright?.extraWaitMs && input.playwright.extraWaitMs > 0) {
				await page.waitForTimeout(input.playwright.extraWaitMs);
			}
			const html = await page.content();
			return html;
		} finally {
			if (context) {
				await context.close().catch(() => undefined);
			}
			await browser.close().catch(() => undefined);
		}
	}
}

export async function checkPlaywrightAvailability(): Promise<{
	available: boolean;
	reason: string;
}> {
	const dynamicImport = new Function('m', 'return import(m)') as (
		moduleName: string
	) => Promise<any>;

	let playwright: any;
	try {
		playwright = await dynamicImport('playwright');
	} catch {
		return {
			available: false,
			reason: 'Playwright package is not installed.',
		};
	}

	const chromium = playwright?.chromium ?? playwright?.default?.chromium;
	if (!chromium) {
		return {
			available: false,
			reason: 'Playwright chromium launcher is unavailable.',
		};
	}

	try {
		// This also surfaces "browser executable missing" in many environments.
		chromium.executablePath();
		return {
			available: true,
			reason: 'Playwright Stage B renderer is available.',
		};
	} catch (error) {
		return {
			available: false,
			reason: `Playwright is installed but Chromium executable is unavailable: ${String((error as any)?.message || error)}`,
		};
	}
}

