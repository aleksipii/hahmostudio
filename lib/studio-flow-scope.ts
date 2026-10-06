import type { Workspace } from './workspace.ts';

export type StudioFlowStep = 'script' | 'characters' | 'storyboard' | 'shot' | 'timeline';

export type LibraryTab = 'library' | 'script' | 'layers' | 'episodes';

export const FLOW_PIN_STORAGE_KEY = 'hahmostudio-pinned-flow-step';
export const FLOW_PIN_ENABLED_KEY = 'hahmostudio-flow-pin-enabled';

const stepIds: StudioFlowStep[] = ['script', 'characters', 'storyboard', 'shot', 'timeline'];

export function isStudioFlowStep(value: string): value is StudioFlowStep {
  return (stepIds as string[]).includes(value);
}

export type FlowStepScope = {
  banner: string;
  libraryTabs: LibraryTab[];
  workspaces: Workspace[];
  scriptSourceLocked: boolean;
  hideTimeline: boolean;
};

export const flowStepScopes: Record<StudioFlowStep, FlowStepScope> = {
  script: {
    banner: 'Työvaihe: Käsikirjoitus — muokkaat käsikirjoitustekstiä ja jaot kohtauksiin.',
    libraryTabs: ['script'],
    workspaces: ['animation'],
    scriptSourceLocked: false,
    hideTimeline: true,
  },
  characters: {
    banner: 'Työvaihe: Hahmot — valitse paketit kirjastosta. Käsikirjoitus on lukittu; avaa Työvaihe → Käsikirjoitus.',
    libraryTabs: ['library', 'layers'],
    workspaces: ['character', 'performance'],
    scriptSourceLocked: true,
    hideTimeline: true,
  },
  storyboard: {
    banner: 'Työvaihe: Storyboard — kuvakortit ja järjestys. Käsikirjoituslähde on lukittu.',
    libraryTabs: ['script'],
    workspaces: ['animation'],
    scriptSourceLocked: true,
    hideTimeline: true,
  },
  shot: {
    banner: 'Työvaihe: Kuva — ohjaat valittua kuvaa. Käsikirjoituslähde on lukittu.',
    libraryTabs: ['script'],
    workspaces: ['animation'],
    scriptSourceLocked: true,
    hideTimeline: true,
  },
  timeline: {
    banner: 'Työvaihe: Aikajana — esikatselu ja vienti. Käsikirjoituslähde on lukittu.',
    libraryTabs: ['script', 'episodes'],
    workspaces: ['animation'],
    scriptSourceLocked: true,
    hideTimeline: false,
  },
};

export function readFlowPinEnabled(): boolean {
  try {
    const raw = localStorage.getItem(FLOW_PIN_ENABLED_KEY);
    if (raw === '0') return false;
  } catch {
    /* optional */
  }
  return true;
}

export function writeFlowPinEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(FLOW_PIN_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* optional */
  }
}

export function readPinnedFlowStep(): StudioFlowStep | null {
  if (!readFlowPinEnabled()) return null;
  try {
    const raw = localStorage.getItem(FLOW_PIN_STORAGE_KEY);
    if (raw && isStudioFlowStep(raw)) return raw;
  } catch {
    /* optional */
  }
  return null;
}

export function writePinnedFlowStep(step: StudioFlowStep): void {
  if (!readFlowPinEnabled()) return;
  try {
    localStorage.setItem(FLOW_PIN_STORAGE_KEY, step);
  } catch {
    /* optional */
  }
}

export function clearPinnedFlowStep(): void {
  try {
    localStorage.removeItem(FLOW_PIN_STORAGE_KEY);
  } catch {
    /* optional */
  }
}

export function libraryTabAllowed(step: StudioFlowStep | null, tab: LibraryTab): boolean {
  if (!step) return true;
  return flowStepScopes[step].libraryTabs.includes(tab);
}

export function workspaceAllowed(step: StudioFlowStep | null, workspace: Workspace): boolean {
  if (!step) return true;
  return flowStepScopes[step].workspaces.includes(workspace);
}
