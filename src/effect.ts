import { Dependency, DirtyLevels, IEffect, Link, Subscriber, System } from './system.js';

export function effect(fn: () => void) {
	const e = new Effect(fn);
	e.run();
	return e;
}

export class Effect<T = any> implements IEffect {
	nextNotify: IEffect | undefined = undefined;

	// Dependency
	subs: Link | undefined = undefined;
	subsTail: Link | undefined = undefined;

	// Subscriber
	deps: Link | undefined = undefined;
	depsTail: Link | undefined = undefined;
	trackId = 0;
	dirtyLevel = DirtyLevels.Dirty;
	canPropagate = false;

	constructor(
		public fn: () => T
	) {
		const activeTrackId = System.activeTrackId;
		if (activeTrackId !== 0) {
			Dependency.linkSubscriber(this, System.activeSub!);
			return;
		}
		const activeEffectScopeTrackId = System.activeEffectScopeTrackId;
		if (activeEffectScopeTrackId !== 0) {
			Dependency.linkSubscriber(this, System.activeEffectScope!);
		}
	}

	notify() {
		const dirtyLevel = this.dirtyLevel;
		if (dirtyLevel === DirtyLevels.SideEffectsOnly) {
			this.dirtyLevel = DirtyLevels.None;
			Subscriber.runInnerEffects(this.deps);
		} else {
			if (dirtyLevel === DirtyLevels.MaybeDirty) {
				Subscriber.resolveMaybeDirty(this);
			}
			if (this.dirtyLevel === DirtyLevels.Dirty) {
				this.run();
			} else {
				Subscriber.runInnerEffects(this.deps);
			}
		}
	}

	run() {
		const prevSub = Subscriber.startTrackDependencies(this);
		try {
			return this.fn();
		} finally {
			Subscriber.endTrackDependencies(this, prevSub);
		}
	}

	stop() {
		if (this.deps !== undefined) {
			Subscriber.clearTrack(this.deps);
			this.deps = undefined;
			this.depsTail = undefined;
		}
		this.dirtyLevel = DirtyLevels.Dirty;
	}
}
