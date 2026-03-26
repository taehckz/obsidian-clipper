import { parseHTML } from 'linkedom';
import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';
import { PlaywrightRendererAdapter } from './auto/adapters/playwright';
import {
	decideAutoRoute,
	evaluateClipQuality,
	runAutoPipeline,
} from './auto/pipeline';
import { InMemoryPolicyStore } from './auto/policy-store';
import { clip, matchTemplate } from './vendor/api';
import type {
	AutoThresholds,
	ClipFromUrlAutoOptions,
	DecisionTrace,
	PlaywrightOptions,
	PolicyStore,
	RendererAdapter,
} from './auto/types';

export interface DocumentParser {
	parseFromString(html: string, mimeType: string): any;
}

export interface Property {
	id?: string;
	name: string;
	value: string;
	type?: string;
}

export interface Template {
	id: string;
	name: string;
	behavior:
		| 'create'
		| 'append-specific'
		| 'append-daily'
		| 'prepend-specific'
		| 'prepend-daily'
		| 'overwrite';
	noteNameFormat: string;
	path: string;
	noteContentFormat: string;
	properties: Property[];
	triggers?: string[];
	vault?: string;
	context?: string;
}

export interface ClipOptions {
	html: string;
	url: string;
	template: Template;
	documentParser: DocumentParser;
	propertyTypes?: Record<string, string>;
	parsedDocument?: any;
}

export interface ClipResult {
	noteName: string;
	frontmatter: string;
	content: string;
	fullContent: string;
	properties: Property[];
	variables: Record<string, string>;
}

export type TemplateResolver = (context: {
	url: string;
	templates: Template[];
	html?: string;
	schemaOrgData?: any;
}) => Template | undefined | Promise<Template | undefined>;

export type HtmlFetcher = (
	url: string,
	request?: RequestInit
) => Promise<string>;

const MAX_HEADER_SIZE_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 5;

export interface ClipperCoreOptions {
	documentParser?: DocumentParser;
	fetchImpl?: typeof fetch;
	htmlFetcher?: HtmlFetcher;
	templateResolver?: TemplateResolver;
	autoPolicyStore?: PolicyStore;
	autoRendererAdapter?: RendererAdapter;
	autoThresholds?: AutoThresholds;
	playwrightOptions?: PlaywrightOptions;
	enableAutoTrace?: boolean;
}

export interface ClipFromHtmlOptions {
	html: string;
	url: string;
	template: Template;
	propertyTypes?: Record<string, string>;
	parsedDocument?: any;
	documentParser?: DocumentParser;
}

export interface ClipFromUrlOptions {
	url: string;
	template: Template;
	fetchOptions?: RequestInit;
	propertyTypes?: Record<string, string>;
	documentParser?: DocumentParser;
}

export interface ClipFromUrlAutoResult {
	result: ClipResult;
	trace?: DecisionTrace;
}

export interface MatchTemplateForUrlOptions {
	templates: Template[];
	url: string;
	html?: string;
	documentParser?: DocumentParser;
}

export interface ClipFromTemplatesOptions {
	url: string;
	templates: Template[];
	html?: string;
	fetchOptions?: RequestInit;
	propertyTypes?: Record<string, string>;
	documentParser?: DocumentParser;
	templateResolver?: TemplateResolver;
}

export function createLinkedomDocumentParser(): DocumentParser {
	return {
		parseFromString(html: string, _mimeType: string): any {
			return parseHTML(html).document;
		},
	};
}

function ensureRuntimeDomPolyfills(): void {
	const globalObj = globalThis as any;
	if (typeof globalObj.window === 'undefined') {
		globalObj.window = globalObj;
	}

	class LinkedomDOMParser {
		parseFromString(html: string): any {
			return parseHTML(html).document;
		}
	}

	if (!globalObj.DOMParser) {
		globalObj.DOMParser = LinkedomDOMParser;
	}
	if (!globalObj.window.DOMParser) {
		globalObj.window.DOMParser = LinkedomDOMParser;
	}

	if (typeof globalObj.document === 'undefined') {
		globalObj.document = parseHTML('<!doctype html><html><head></head><body></body></html>').document;
	}
	if (!globalObj.document.implementation) {
		globalObj.document.implementation = {};
	}
	if (typeof globalObj.document.implementation.createHTMLDocument !== 'function') {
		globalObj.document.implementation.createHTMLDocument = () => {
			const doc = parseHTML('<!doctype html><html><head></head><body></body></html>').document as any;
			let buffer = '';
			doc.open = () => {
				buffer = '';
			};
			doc.write = (chunk: string) => {
				buffer += chunk || '';
			};
			doc.close = () => {
				if (!doc.body) return;
				doc.body.innerHTML = buffer;
			};
			return doc;
		};
	}

	if (typeof globalObj.getComputedStyle !== 'function') {
		globalObj.getComputedStyle = () => ({
			getPropertyValue: () => '',
		});
	}
}

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

function isHeaderOverflowError(error: unknown): boolean {
	const text = String((error as any)?.message || error || '');
	const code = String((error as any)?.code || (error as any)?.cause?.code || '');
	return (
		text.includes('Headers Overflow') ||
		text.includes('Header overflow') ||
		code === 'UND_ERR_HEADERS_OVERFLOW' ||
		code === 'HPE_HEADER_OVERFLOW'
	);
}

async function fetchHtmlWithNodeRequest(
	url: string,
	request?: RequestInit,
	redirects = 0
): Promise<string> {
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const client = parsed.protocol === 'https:' ? https : http;
		const req = client.request(
			url,
			{
				method: request?.method || 'GET',
				headers: normalizeHeaders(request?.headers),
				maxHeaderSize: MAX_HEADER_SIZE_BYTES,
			},
			(res) => {
				const status = res.statusCode || 0;
				const location = res.headers.location;
				if ([301, 302, 303, 307, 308].includes(status) && location && redirects < MAX_REDIRECTS) {
					const nextUrl = new URL(location, url).toString();
					res.resume();
					fetchHtmlWithNodeRequest(nextUrl, request, redirects + 1).then(resolve).catch(reject);
					return;
				}

				let body = '';
				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					body += chunk;
				});
				res.on('end', () => {
					if (status >= 400) {
						reject(new Error(`Failed to fetch ${url}: ${status}`));
						return;
					}
					resolve(body);
				});
			}
		);
		req.on('error', reject);
		req.end();
	});
}

export class ClipperCore {
	private readonly defaultParser: DocumentParser;
	private readonly defaultFetch?: typeof fetch;
	private readonly defaultHtmlFetcher?: HtmlFetcher;
	private readonly defaultTemplateResolver?: TemplateResolver;
	private readonly defaultAutoPolicyStore: PolicyStore;
	private readonly defaultAutoRendererAdapter: RendererAdapter;
	private readonly defaultAutoThresholds?: AutoThresholds;
	private readonly defaultPlaywrightOptions?: PlaywrightOptions;
	private readonly defaultEnableAutoTrace: boolean;

	constructor(options: ClipperCoreOptions = {}) {
		ensureRuntimeDomPolyfills();
		this.defaultParser = options.documentParser ?? createLinkedomDocumentParser();
		this.defaultFetch = options.fetchImpl;
		this.defaultHtmlFetcher = options.htmlFetcher;
		this.defaultTemplateResolver = options.templateResolver;
		this.defaultAutoPolicyStore = options.autoPolicyStore ?? new InMemoryPolicyStore();
		this.defaultAutoRendererAdapter =
			options.autoRendererAdapter ?? new PlaywrightRendererAdapter();
		this.defaultAutoThresholds = options.autoThresholds;
		this.defaultPlaywrightOptions = options.playwrightOptions;
		this.defaultEnableAutoTrace = Boolean(options.enableAutoTrace);
	}

	async clipFromHtml(options: ClipFromHtmlOptions): Promise<ClipResult> {
		const parser = options.documentParser ?? this.defaultParser;
		const clipOptions: ClipOptions = {
			html: options.html,
			url: options.url,
			template: options.template,
			documentParser: parser,
			propertyTypes: options.propertyTypes,
			parsedDocument: options.parsedDocument,
		};
		return clip(clipOptions);
	}

	async clipFromUrl(options: ClipFromUrlOptions): Promise<ClipResult> {
		const html = await this.fetchHtml(options.url, options.fetchOptions);
		return this.clipFromHtml({
			html,
			url: options.url,
			template: options.template,
			propertyTypes: options.propertyTypes,
			documentParser: options.documentParser,
		});
	}

	async clipFromUrlAuto(options: ClipFromUrlAutoOptions): Promise<ClipFromUrlAutoResult> {
		const host = new URL(options.url).hostname;
		const autoOptions = options.auto ?? {};
		return runAutoPipeline({
			url: options.url,
			host,
			template: options.template,
			fetchOptions: options.fetchOptions,
			propertyTypes: options.propertyTypes,
			documentParser: options.documentParser,
			auto: {
				...autoOptions,
				thresholds: autoOptions.thresholds ?? this.defaultAutoThresholds,
				policyStore: autoOptions.policyStore ?? this.defaultAutoPolicyStore,
				rendererAdapter: autoOptions.rendererAdapter ?? this.defaultAutoRendererAdapter,
				playwright: autoOptions.playwright ?? this.defaultPlaywrightOptions,
				enableTrace: autoOptions.enableTrace ?? this.defaultEnableAutoTrace,
			},
			fetchHtml: this.fetchHtml.bind(this),
			clipFromHtml: this.clipFromHtml.bind(this),
			evaluateQuality: evaluateClipQuality,
			decideRoute: decideAutoRoute,
		});
	}

	async clipFromTemplates(options: ClipFromTemplatesOptions): Promise<ClipResult> {
		const html = options.html ?? (await this.fetchHtml(options.url, options.fetchOptions));
		const template = await this.resolveTemplate({
			url: options.url,
			templates: options.templates,
			html,
			documentParser: options.documentParser,
			templateResolver: options.templateResolver
		});
		if (!template) {
			throw new Error(`No template matched URL ${options.url}`);
		}
		return this.clipFromHtml({
			html,
			url: options.url,
			template,
			propertyTypes: options.propertyTypes,
			documentParser: options.documentParser
		});
	}

	async matchTemplateForUrl(
		options: MatchTemplateForUrlOptions
	): Promise<Template | undefined> {
		let matched = matchTemplate(options.templates, options.url);
		if (matched || !options.html) {
			return matched;
		}

		const hasSchemaTriggers = options.templates.some((template) =>
			template.triggers?.some((trigger: string) => trigger.startsWith('schema:'))
		);
		if (!hasSchemaTriggers) {
			return undefined;
		}

		const parser = options.documentParser ?? this.defaultParser;
		const parsedDocument = parser.parseFromString(options.html, 'text/html');
		const DefuddleClass = (await import('defuddle')).default;
		const defuddle = new DefuddleClass(parsedDocument as unknown as Document, {
			url: options.url,
		});
		const defuddleResult = defuddle.parse();
		matched = matchTemplate(options.templates, options.url, defuddleResult.schemaOrgData);
		return matched;
	}

	private async fetchHtml(url: string, request?: RequestInit): Promise<string> {
		if (this.defaultHtmlFetcher) {
			return this.defaultHtmlFetcher(url, request);
		}

		const fetchImpl = this.defaultFetch ?? globalThis.fetch;
		if (!fetchImpl) {
			return fetchHtmlWithNodeRequest(url, request);
		}

		try {
			const response = await fetchImpl(url, request);
			if (!response.ok) {
				throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
			}
			return response.text();
		} catch (error) {
			if (isHeaderOverflowError(error)) {
				return fetchHtmlWithNodeRequest(url, request);
			}
			throw error;
		}
	}

	private async resolveTemplate(options: {
		url: string;
		templates: Template[];
		html?: string;
		documentParser?: DocumentParser;
		templateResolver?: TemplateResolver;
	}): Promise<Template | undefined> {
		const resolver = options.templateResolver ?? this.defaultTemplateResolver;
		if (resolver) {
			const resolved = await resolver({
				url: options.url,
				templates: options.templates,
				html: options.html,
			});
			if (resolved) {
				return resolved;
			}
		}
		return this.matchTemplateForUrl({
			templates: options.templates,
			url: options.url,
			html: options.html,
			documentParser: options.documentParser
		});
	}
}

const defaultCore = new ClipperCore();

export function clipFromHtml(options: ClipFromHtmlOptions): Promise<ClipResult> {
	return defaultCore.clipFromHtml(options);
}

export function clipFromUrl(options: ClipFromUrlOptions): Promise<ClipResult> {
	return defaultCore.clipFromUrl(options);
}

export function clipFromUrlAuto(
	options: ClipFromUrlAutoOptions
): Promise<ClipFromUrlAutoResult> {
	return defaultCore.clipFromUrlAuto(options);
}

export function matchTemplateForUrl(
	options: MatchTemplateForUrlOptions
): Promise<Template | undefined> {
	return defaultCore.matchTemplateForUrl(options);
}

export function clipFromTemplates(options: ClipFromTemplatesOptions): Promise<ClipResult> {
	return defaultCore.clipFromTemplates(options);
}

export {
	InMemoryPolicyStore,
	JsonFilePolicyStore,
	migratePolicyFile,
	POLICY_SCHEMA_VERSION,
} from './auto/policy-store';
export { PlaywrightRendererAdapter } from './auto/adapters/playwright';
export { clip, matchTemplate };
export type {
	AutoOptions,
	AutoStage,
	AutoThresholds,
	ClipFromUrlAutoOptions,
	DecisionTrace,
	DomainPolicy,
	PlaywrightOptions,
	PolicyStore,
	QualityCheck,
	QualityEvaluation,
	RendererAdapter,
	RouteDecision,
	RouteSource,
} from './auto/types';
