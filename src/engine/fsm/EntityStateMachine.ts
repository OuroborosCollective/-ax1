/**
 * Echoes of Aurion - Deterministic Finite State Machine (FSM) Engine
 * Formal state transition framework for mobs, bosses, and world NPCs.
 * Replaces manual nested state checks with deterministic, lifecycle-managed states.
 */

export interface IState<TContext> {
  readonly id: string;
  enter(ctx: TContext): void;
  update(ctx: TContext, delta: number): void;
  exit(ctx: TContext): void;
}

export type TransitionCondition<TContext> = (ctx: TContext) => boolean;

export interface StateTransition<TContext> {
  from: string;
  to: string;
  condition?: TransitionCondition<TContext>;
}

export class EntityStateMachine<TContext> {
  private states: Map<string, IState<TContext>> = new Map();
  private transitions: StateTransition<TContext>[] = [];
  private currentState: IState<TContext> | null = null;
  private previousStateId: string | null = null;
  private stateTime: number = 0;

  constructor(public readonly entityId: string) {}

  public registerState(state: IState<TContext>): this {
    this.states.set(state.id, state);
    return this;
  }

  public addTransition(from: string, to: string, condition?: TransitionCondition<TContext>): this {
    this.transitions.push({ from, to, condition });
    return this;
  }

  public getCurrentStateId(): string | null {
    return this.currentState ? this.currentState.id : null;
  }

  public getPreviousStateId(): string | null {
    return this.previousStateId;
  }

  public getStateTime(): number {
    return this.stateTime;
  }

  public setState(stateId: string, ctx: TContext): boolean {
    const nextState = this.states.get(stateId);
    if (!nextState) {
      console.warn(`[FSM:${this.entityId}] Attempted to transition to unregistered state: ${stateId}`);
      return false;
    }

    if (this.currentState?.id === stateId) {
      return false; // Already in target state
    }

    if (this.currentState) {
      this.currentState.exit(ctx);
      this.previousStateId = this.currentState.id;
    }

    this.currentState = nextState;
    this.stateTime = 0;
    this.currentState.enter(ctx);
    return true;
  }

  public update(ctx: TContext, delta: number) {
    if (!this.currentState) return;

    this.stateTime += delta;

    // 1. Evaluate registered transitions for current state
    const currentId = this.currentState.id;
    for (const transition of this.transitions) {
      if (transition.from === currentId || transition.from === '*') {
        if (!transition.condition || transition.condition(ctx)) {
          if (this.setState(transition.to, ctx)) {
            return;
          }
        }
      }
    }

    // 2. Execute active state update tick
    this.currentState.update(ctx, delta);
  }
}
