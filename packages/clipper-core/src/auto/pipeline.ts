import { decideAutoRoute } from './router';
import { evaluateClipQuality } from './quality';
import { updatePolicyFromOutcome } from './policy-store';
import type {
	AutoPipelineInput,
	AutoPipelineResult,
	AutoStage,
	DecisionTrace,
	DomainPolicy,
	RouteDecision,
} from './types';
import { DECISION_TRACE_VERSION as TRACE_VERSION } from './types';

function nowMs(): number {
	return Date.now();
}

function toErrorMessage(error: unknown): string {
	return String((error as any)?.message || error || 'Unknown error');
}

export async function runAutoPipeline(input: AutoPipelineInput): Promise<AutoPipelineResult> {
	const host = input.host;
	const policyStore = input.auto?.policyStore;
	const policy = policyStore ? await policyStore.get(host) : undefined;
	const route = input.decideRoute({
		host,
		policy,
		forceStage: input.auto?.forceStage,
		now: new Date(),
	});

	const trace: DecisionTrace = {
		traceVersion: TRACE_VERSION,
		url: input.url,
		host,
		initialRoute: route,
		finalStage: 'stageA',
		stageA: { attempted: false, durationMs: 0 },
		stageB: { attempted: false, durationMs: 0 },
		policyUpdated: false,
	};

	const allowStageB = route.stage === 'stageB' || !policy?.denyStageB;
	const shouldStartWithStageB = route.stage === 'stageB';
	let stageAQualityPass = false;
	let stageBFallbackUsed = false;
	let stageAReason = route.reason;
	let currentPolicy: DomainPolicy | undefined = policy;

	const runStageA = async () => {
		const stageAStart = nowMs();
		trace.stageA.attempted = true;
		const html = await input.fetchHtml(input.url, input.fetchOptions);
		const result = await input.clipFromHtml({
			html,
			url: input.url,
			template: input.template,
			propertyTypes: input.propertyTypes,
			documentParser: input.documentParser,
		});
		trace.stageA.durationMs = nowMs() - stageAStart;
		const quality = input.evaluateQuality(result, input.auto?.thresholds);
		trace.stageA.quality = quality;
		stageAQualityPass = quality.pass;
		stageAReason = quality.pass ? 'Stage A quality passed' : 'Stage A quality failed';
		return { result, quality };
	};

	const runStageB = async (reason: string) => {
		const adapter = input.auto?.rendererAdapter;
		if (!adapter) {
			throw new Error(
				`Stage B fallback required but no rendererAdapter is configured. Reason: ${reason}`
			);
		}
		const stageBStart = nowMs();
		trace.stageB.attempted = true;
		trace.stageB.renderer = adapter.name;
		const html = await adapter.renderHtml({
			url: input.url,
			request: input.fetchOptions,
			playwright: input.auto?.playwright,
		});
		const result = await input.clipFromHtml({
			html,
			url: input.url,
			template: input.template,
			propertyTypes: input.propertyTypes,
			documentParser: input.documentParser,
		});
		trace.stageB.durationMs = nowMs() - stageBStart;
		stageBFallbackUsed = true;
		return result;
	};

	let finalStage: AutoStage = 'stageA';
	let finalResult;

	try {
		if (shouldStartWithStageB) {
			finalResult = await runStageB(route.reason);
			finalStage = 'stageB';
		} else {
			const stageA = await runStageA();
			if (stageA.quality.pass || !allowStageB) {
				finalResult = stageA.result;
				finalStage = 'stageA';
			} else {
				finalResult = await runStageB('Stage A quality did not pass thresholds');
				finalStage = 'stageB';
			}
		}
	} catch (error) {
		if (!trace.stageA.attempted) {
			trace.stageA.error = toErrorMessage(error);
		} else if (!trace.stageB.attempted) {
			trace.stageA.error = toErrorMessage(error);
		} else {
			trace.stageB.error = toErrorMessage(error);
		}
		throw error;
	}

	trace.finalStage = finalStage;

	if (policyStore) {
		currentPolicy = updatePolicyFromOutcome({
			existing: currentPolicy,
			stageAQualityPass: trace.stageA.attempted ? stageAQualityPass : true,
			stageBFallbackUsed,
			reason: stageAReason,
		});
		await policyStore.set(host, currentPolicy);
		trace.policyUpdated = true;
	}

	return {
		result: finalResult,
		trace: input.auto?.enableTrace ? trace : undefined,
	};
}

export { decideAutoRoute, evaluateClipQuality };

