import type { AutoStage, DomainPolicy, RouteDecision } from './types';

export function decideAutoRoute(options: {
	host: string;
	policy?: DomainPolicy;
	forceStage?: AutoStage;
	now: Date;
}): RouteDecision {
	const { policy, forceStage, now } = options;

	if (forceStage) {
		return {
			stage: forceStage,
			reason: `forceStage=${forceStage}`,
			source: 'override',
		};
	}

	if (policy?.denyStageB) {
		return {
			stage: 'stageA',
			reason: 'policy denies Stage B fallback',
			source: 'policy',
		};
	}

	if (policy?.forceStageB) {
		return {
			stage: 'stageB',
			reason: 'policy forces Stage B',
			source: 'policy',
		};
	}

	if (policy?.preferStageBUntil) {
		const until = new Date(policy.preferStageBUntil).getTime();
		if (!Number.isNaN(until) && until > now.getTime()) {
			return {
				stage: 'stageB',
				reason: `policy prefers Stage B until ${policy.preferStageBUntil}`,
				source: 'policy',
			};
		}
	}

	return {
		stage: 'stageA',
		reason: 'default route',
		source: 'default',
	};
}

