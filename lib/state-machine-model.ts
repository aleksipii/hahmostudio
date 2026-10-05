import type { Animation, Keyframe } from './animation-model';

/**
 * State Machine Model v1
 * 
 * Defines animation states, transitions, conditions and parameters.
 * Integrates with Animation model: states reference track keys or animation clips.
 */

export type StateId = string & { readonly __brand: 'StateId' };
export type TransitionId = string & { readonly __brand: 'TransitionId' };
export type ParameterId = string & { readonly __brand: 'ParameterId' };

export const stateId = (key: string): StateId => key as StateId;
export const transitionId = (key: string): TransitionId => key as TransitionId;
export const parameterId = (key: string): ParameterId => key as ParameterId;

/** Condition operators for transition guards */
export type ConditionOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

/** Parameter types: numeric (float), boolean (trigger), or enum (discrete) */
export type ParameterType = 'float' | 'trigger' | 'enum';

/** A condition gate on a transition */
export interface TransitionCondition {
  paramId: ParameterId;
  op: ConditionOp;
  value: number | string;
}

/** Animation state: holds track key(s) or a layer reference */
export interface AnimationState {
  id: StateId;
  name: string;
  /** Track key in animation.tracks, or compound key for blend */
  trackKey: string;
  /** Time offset in seconds */
  timeOffset: number;
  /** Speed multiplier (1.0 = normal) */
  speed: number;
  /** Exit time (in normalized 0-1 duration) to auto-transition on loop */
  exitTime?: number;
  metadata?: { x?: number; y?: number; color?: string };
}

/** Transition between states */
export interface StateTransition {
  id: TransitionId;
  fromState: StateId;
  toState: StateId;
  /** Conditions that must all pass for transition to trigger */
  conditions: TransitionCondition[];
  /** Blend duration in seconds */
  duration: number;
  /** Trigger parameter (optional; if set, transition fires when triggered) */
  trigger?: ParameterId;
  /** Whether transition can interrupt itself */
  canInterruptSelf: boolean;
  metadata?: { offset?: number };
}

/** Blend tree node: can be a state reference or blend of multiple states */
export interface BlendNode {
  type: 'state' | 'blend1d' | 'blend2d';
  /** For state: the state id. For blend: node id (unique within tree) */
  id: string;
  name: string;
  /** For blend nodes: child node ids to blend */
  children?: string[];
  /** Blend parameter(s) */
  blendParam?: ParameterId;
  blendParam2?: ParameterId;
}

/** Runtime parameter for conditions and blending */
export interface Parameter {
  id: ParameterId;
  name: string;
  type: ParameterType;
  defaultValue: number | boolean | string;
}

/** Complete state machine definition */
export interface StateMachine {
  format: 'hahmostudio-state-machine';
  version: 1;
  states: AnimationState[];
  transitions: StateTransition[];
  parameters: Parameter[];
  entryState: StateId;
  blendTree?: BlendNode;
}

/**
 * Create a blank state machine with one default state
 */
export function createStateMachine(entryTrackKey: string): StateMachine {
  const entryId = stateId('entry');
  return {
    format: 'hahmostudio-state-machine',
    version: 1,
    states: [
      {
        id: entryId,
        name: 'Entry',
        trackKey: entryTrackKey,
        timeOffset: 0,
        speed: 1,
      },
    ],
    transitions: [],
    parameters: [],
    entryState: entryId,
  };
}

/**
 * Add a new state to the machine
 */
export function addState(
  machine: StateMachine,
  name: string,
  trackKey: string
): StateMachine {
  const newId = stateId(`state-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return {
    ...machine,
    states: [
      ...machine.states,
      {
        id: newId,
        name,
        trackKey,
        timeOffset: 0,
        speed: 1,
      },
    ],
  };
}

/**
 * Add a transition between two states
 */
export function addTransition(
  machine: StateMachine,
  fromState: StateId,
  toState: StateId,
  duration: number = 0.2
): StateMachine {
  const newId = transitionId(
    `trans-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  return {
    ...machine,
    transitions: [
      ...machine.transitions,
      {
        id: newId,
        fromState,
        toState,
        conditions: [],
        duration,
        canInterruptSelf: false,
      },
    ],
  };
}

/**
 * Add a condition to a transition
 */
export function addCondition(
  machine: StateMachine,
  transitionId: TransitionId,
  paramId: ParameterId,
  op: ConditionOp,
  value: number | string
): StateMachine {
  return {
    ...machine,
    transitions: machine.transitions.map(t =>
      t.id === transitionId
        ? {
            ...t,
            conditions: [
              ...t.conditions,
              { paramId, op, value },
            ],
          }
        : t
    ),
  };
}

/**
 * Add a parameter (for conditions and blending)
 */
export function addParameter(
  machine: StateMachine,
  name: string,
  type: ParameterType,
  defaultValue: number | boolean | string
): StateMachine {
  const newId = parameterId(`param-${name.toLowerCase().replace(/\s+/g, '-')}`);
  return {
    ...machine,
    parameters: [
      ...machine.parameters,
      {
        id: newId,
        name,
        type,
        defaultValue,
      },
    ],
  };
}

/**
 * Evaluate all conditions for a transition
 */
export function evaluateConditions(
  conditions: TransitionCondition[],
  paramValues: Record<string, number | boolean | string>
): boolean {
  return conditions.every(cond => {
    const value = paramValues[cond.paramId];
    if (value === undefined) return false;

    const v = typeof value === 'string' ? parseFloat(value) : value;
    const target = typeof cond.value === 'string' ? parseFloat(cond.value) : cond.value;

    switch (cond.op) {
      case 'eq': return v === target;
      case 'ne': return v !== target;
      case 'gt': return v > target;
      case 'gte': return v >= target;
      case 'lt': return v < target;
      case 'lte': return v <= target;
      default: return false;
    }
  });
}

/**
 * Find applicable transitions from current state
 */
export function getApplicableTransitions(
  machine: StateMachine,
  currentStateId: StateId,
  paramValues: Record<string, number | boolean | string>
): StateTransition[] {
  return machine.transitions.filter(t => 
    t.fromState === currentStateId &&
    evaluateConditions(t.conditions, paramValues)
  );
}

/**
 * Validate state machine integrity
 */
export function validateStateMachine(machine: StateMachine): string[] {
  const errors: string[] = [];

  if (!machine.states.some(s => s.id === machine.entryState)) {
    errors.push('Entry state does not exist in states list.');
  }

  machine.transitions.forEach(t => {
    if (!machine.states.some(s => s.id === t.fromState)) {
      errors.push(`Transition from unknown state: ${t.fromState}`);
    }
    if (!machine.states.some(s => s.id === t.toState)) {
      errors.push(`Transition to unknown state: ${t.toState}`);
    }
    t.conditions.forEach(c => {
      if (!machine.parameters.some(p => p.id === c.paramId)) {
        errors.push(`Condition references unknown parameter: ${c.paramId}`);
      }
    });
  });

  machine.parameters.forEach(p => {
    if (p.type === 'float' && typeof p.defaultValue !== 'number') {
      errors.push(`Float parameter ${p.name} has non-numeric default.`);
    }
    if (p.type === 'trigger' && typeof p.defaultValue !== 'boolean') {
      errors.push(`Trigger parameter ${p.name} has non-boolean default.`);
    }
  });

  return errors;
}

/**
 * Serialize state machine to JSON
 */
export function serializeStateMachine(machine: StateMachine): string {
  return JSON.stringify(machine, null, 2);
}

/**
 * Deserialize state machine from JSON
 */
export function deserializeStateMachine(json: string): StateMachine {
  const parsed = JSON.parse(json);
  if (
    !parsed ||
    parsed.format !== 'hahmostudio-state-machine' ||
    parsed.version !== 1
  ) {
    throw new Error('Invalid state machine format');
  }
  const errors = validateStateMachine(parsed);
  if (errors.length > 0) {
    throw new Error(`State machine validation failed: ${errors.join('; ')}`);
  }
  return parsed;
}
