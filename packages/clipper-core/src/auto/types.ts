import type { ClipResult, DocumentParser, Template } from '../index';

export type AutoStage = 'stageA' | 'stageB';
export const DECISION_TRACE_VERSION = 1;

export interface QualityCheck {
	name: string;
	pass: boolean;
	actual?: number | string | boolean;
	expected?: number | string | boolean;
	message?: string;
}

export interface QualityEvaluation {
	pass: boolean;
	score: number;
	checks: QualityCheck[];
}

export interface AutoThresholds {
	requireTitle?: boolean;
	minContentLength?: number;
	minWordCount?: number;
}

export interface DomainPolicy {
	version: number;
	updatedAt: string;
	forceStageB?: boolean;
	denyStageB?: boolean;
	preferStageBUntil?: string;
	stageASuccessCount?: number;
	stageAFailureCount?: number;
	lastReason?: string;
}

export interface PolicyStore {
	get(host: string): Promise<DomainPolicy | undefined>;
	set(host: string, policy: DomainPolicy): Promise<void>;
	delete?(host: string): Promise<void>;
}

export type RouteSource = 'override' | 'policy' | 'default';

export interface RouteDecision {
	stage: AutoStage;
	reason: string;
	source: RouteSource;
}

export interface PlaywrightOptions {
	headless?: boolean;
	timeoutMs?: number;
	waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
	waitForSelector?: string;
	extraWaitMs?: number;
}

export interface RenderHtmlInput {
	url: string;
	request?: RequestInit;
	playwright?: PlaywrightOptions;
}

export interface RendererAdapter {
	name: string;
	renderHtml(input: RenderHtmlInput): Promise<string>;
}

export interface DecisionTrace {
	traceVersion: number;
	url: string;
	host: string;
	initialRoute: RouteDecision;
	finalStage: AutoStage;
	stageA: {
		attempted: boolean;
		durationMs: number;
		quality?: QualityEvaluation;
		error?: string;
	};
	stageB: {
		attempted: boolean;
		durationMs: number;
		renderer?: string;
		error?: string;
	};
	policyUpdated: boolean;
}

export interface AutoOptions {
	thresholds?: AutoThresholds;
	policyStore?: PolicyStore;
	rendererAdapter?: RendererAdapter;
	playwright?: PlaywrightOptions;
	forceStage?: AutoStage;
	enableTrace?: boolean;
}

export interface ClipFromUrlAutoOptions {
	url: string;
	template: Template;
	fetchOptions?: RequestInit;
	propertyTypes?: Record<string, string>;
	documentParser?: DocumentParser;
	auto?: AutoOptions;
}

export interface AutoPipelineInput {
	url: string;
	host: string;
	template: Template;
	fetchOptions?: RequestInit;
	propertyTypes?: Record<string, string>;
	documentParser?: DocumentParser;
	auto?: AutoOptions;
	fetchHtml: (url: string, request?: RequestInit) => Promise<string>;
	clipFromHtml: (options: {
		html: string;
		url: string;
		template: Template;
		propertyTypes?: Record<string, string>;
		documentParser?: DocumentParser;
	}) => Promise<ClipResult>;
	evaluateQuality: (result: ClipResult, thresholds?: AutoThresholds) => QualityEvaluation;
	decideRoute: (options: {
		host: string;
		policy?: DomainPolicy;
		forceStage?: AutoStage;
		now: Date;
	}) => RouteDecision;
}

export interface AutoPipelineResult {
	result: ClipResult;
	trace?: DecisionTrace;
}

