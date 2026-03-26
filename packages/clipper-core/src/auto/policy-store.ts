import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DomainPolicy, PolicyStore } from './types';

const POLICY_SCHEMA_VERSION = 1;

interface JsonPolicyFileV1 {
	version: number;
	updatedAt: string;
	policies: Record<string, DomainPolicy>;
}

function createEmptyFileState(): JsonPolicyFileV1 {
	return {
		version: POLICY_SCHEMA_VERSION,
		updatedAt: new Date().toISOString(),
		policies: {},
	};
}

function normalizePolicy(policy: DomainPolicy): DomainPolicy {
	return {
		version: POLICY_SCHEMA_VERSION,
		updatedAt: policy.updatedAt || new Date().toISOString(),
		forceStageB: Boolean(policy.forceStageB),
		denyStageB: Boolean(policy.denyStageB),
		preferStageBUntil: policy.preferStageBUntil,
		stageASuccessCount: Number(policy.stageASuccessCount || 0),
		stageAFailureCount: Number(policy.stageAFailureCount || 0),
		lastReason: policy.lastReason || '',
	};
}

export function migratePolicyFile(raw: unknown): JsonPolicyFileV1 {
	if (!raw || typeof raw !== 'object') {
		return createEmptyFileState();
	}

	const value = raw as Partial<JsonPolicyFileV1>;
	const maybePolicies = value.policies && typeof value.policies === 'object' ? value.policies : {};
	const normalizedEntries = Object.entries(maybePolicies).map(([host, policy]) => {
		const base = (policy || {}) as Partial<DomainPolicy>;
		return [
			host,
			normalizePolicy({
				version: POLICY_SCHEMA_VERSION,
				updatedAt: base.updatedAt || new Date().toISOString(),
				forceStageB: base.forceStageB,
				denyStageB: base.denyStageB,
				preferStageBUntil: base.preferStageBUntil,
				stageASuccessCount: base.stageASuccessCount,
				stageAFailureCount: base.stageAFailureCount,
				lastReason: base.lastReason,
			}),
		] as const;
	});

	return {
		version: POLICY_SCHEMA_VERSION,
		updatedAt: value.updatedAt || new Date().toISOString(),
		policies: Object.fromEntries(normalizedEntries),
	};
}

export class InMemoryPolicyStore implements PolicyStore {
	private readonly data = new Map<string, DomainPolicy>();

	async get(host: string): Promise<DomainPolicy | undefined> {
		return this.data.get(host);
	}

	async set(host: string, policy: DomainPolicy): Promise<void> {
		this.data.set(host, normalizePolicy(policy));
	}

	async delete(host: string): Promise<void> {
		this.data.delete(host);
	}
}

export class JsonFilePolicyStore implements PolicyStore {
	private readonly filePath: string;
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(filePath: string) {
		this.filePath = path.resolve(filePath);
	}

	async get(host: string): Promise<DomainPolicy | undefined> {
		await this.writeQueue;
		const state = await this.readState();
		return state.policies[host];
	}

	async set(host: string, policy: DomainPolicy): Promise<void> {
		await this.enqueueWrite(async () => {
			const state = await this.readState();
			state.policies[host] = normalizePolicy({
				...policy,
				updatedAt: new Date().toISOString(),
			});
			state.updatedAt = new Date().toISOString();
			await this.writeState(state);
		});
	}

	async delete(host: string): Promise<void> {
		await this.enqueueWrite(async () => {
			const state = await this.readState();
			delete state.policies[host];
			state.updatedAt = new Date().toISOString();
			await this.writeState(state);
		});
	}

	private async readState(): Promise<JsonPolicyFileV1> {
		try {
			const raw = await fs.readFile(this.filePath, 'utf8');
			return migratePolicyFile(JSON.parse(raw));
		} catch (error: any) {
			if (error?.code === 'ENOENT') {
				return createEmptyFileState();
			}
			throw error;
		}
	}

	private async writeState(state: JsonPolicyFileV1): Promise<void> {
		await fs.mkdir(path.dirname(this.filePath), { recursive: true });
		await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf8');
	}

	private async enqueueWrite(task: () => Promise<void>): Promise<void> {
		const run = this.writeQueue.then(task);
		this.writeQueue = run.catch(() => undefined);
		await run;
	}
}

export function updatePolicyFromOutcome(options: {
	existing?: DomainPolicy;
	stageAQualityPass: boolean;
	stageBFallbackUsed: boolean;
	reason: string;
}): DomainPolicy {
	const existing = options.existing;
	const nowIso = new Date().toISOString();
	const next: DomainPolicy = normalizePolicy({
		version: POLICY_SCHEMA_VERSION,
		updatedAt: nowIso,
		forceStageB: existing?.forceStageB,
		denyStageB: existing?.denyStageB,
		preferStageBUntil: existing?.preferStageBUntil,
		stageASuccessCount: existing?.stageASuccessCount,
		stageAFailureCount: existing?.stageAFailureCount,
		lastReason: options.reason,
	});

	if (options.stageAQualityPass) {
		next.stageASuccessCount = (next.stageASuccessCount || 0) + 1;
		next.forceStageB = false;
		return next;
	}

	next.stageAFailureCount = (next.stageAFailureCount || 0) + 1;
	if (options.stageBFallbackUsed) {
		// Prefer Stage B for one day after a quality failure.
		next.preferStageBUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
	}
	return next;
}

export { POLICY_SCHEMA_VERSION };

