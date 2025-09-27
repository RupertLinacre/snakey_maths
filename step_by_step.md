Add two HTML <select> controls for Year level and Problem type that configure problem generation. Selections persist in localStorage and take effect on the next problem only. Focus rules: when a control is focused the game pauses and arrow keys change the selection; when the canvas is focused it resumes and arrow keys move the snake. The canvas is focusable and gains focus on load. One global keydown handler ignores inputs when the event target is interactive.

0) Prep
	1.	Create a single cleanup handle

	•	In view.ts top of init(): const ac = new AbortController(); const { signal } = ac;
	•	In HMR dispose and beforeunload: call ac.abort() and stop RAF.

Verify: console logs still print, no listener leaks on HMR.

⸻

1) HTML controls
	2.	Add controls markup

	•	Edit index.html, above <canvas>:

<div id="controls" class="controls">
  <label>Year level <select id="year"></select></label>
  <label>Problem type <select id="ptype"><option value="">Any</option></select></label>
</div>

	3.	Optional CSS

	•	In style.css:

#controls{display:flex;gap:.75rem;align-items:center;padding:.5rem}
#controls label{color:#eee;font:14px system-ui}
#controls select{font:14px system-ui}

Verify: controls render above canvas.

⸻

2) Make canvas focusable and default focus
	4.	Focusable canvas

	•	In view.ts after you get canvas:

canvas.tabIndex = 0;
canvas.setAttribute('role','application');
canvas.setAttribute('aria-label','Snake. Arrow keys to move. Enter to restart.');
canvas.addEventListener('pointerdown', () => canvas.focus(), { signal });

	•	After first render(...): canvas.focus();

Verify: page loads with visible focus ring on canvas (depends on UA/CSS). Clicking canvas keeps focus.

⸻

3) State config + events
	5.	Add config type and events

	•	Edit src/types.ts:

export type ProblemConfig = { yearLevel?: string; type?: string | null };

export type State = {
  // existing...
  config: ProblemConfig;
};

export type GameEvent =
  | { type: 'TICK'; now: number }
  | { type: 'TURN'; dir: Dir }
  | { type: 'RESUME'; now: number }
  | { type: 'RESTART'; now: number }
  | { type: 'SET_CONFIG'; config: ProblemConfig; now: number }
  | { type: 'PAUSE'; reason?: 'ui'|'correct'; now: number };

	6.	Wire config through core

	•	Edit src/core.ts:
	•	Import ProblemConfig from ./types.
	•	Change signature:

export function initState(seed?: number, config: ProblemConfig = {}): State


	•	In returned state, add config.
	•	Replace both newProblem() calls with newProblem(config) and newProblem(state.config) respectively.
	•	Add handler in reduce:

case 'SET_CONFIG': return validateState({ ...state, config: event.config });
case 'PAUSE': {
  if (state.mode !== 'running') return state;
  return validateState({ ...state, mode: 'paused' });
}


	•	In the “correct fruit” branch where you mode='paused', also set reason:'correct' only in overlay text (no code change needed). Keep current behavior.

Verify: compiles.

⸻

4) Populate selects and persist config
	7.	Import constants

	•	At top of view.ts:

import { YEAR_LEVELS, PROBLEM_TYPES } from './math';

	8.	Build options and persistence

	•	In init() after canvas setup:

const yearSel = document.getElementById('year') as HTMLSelectElement;
const typeSel = document.getElementById('ptype') as HTMLSelectElement;

const YEARS = Object.values(YEAR_LEVELS); // robust if keys vary
yearSel.replaceChildren(...YEARS.map(v => new Option(v, v)));

const TYPES = Object.values(PROBLEM_TYPES);
for (const v of TYPES) typeSel.add(new Option(v, v));

const LS_KEY = 'snake-maths:config';
const loadCfg = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
};
const saveCfg = (c: State['config']) => localStorage.setItem(LS_KEY, JSON.stringify(c));

const defaultCfg = loadCfg() as State['config'];
if (defaultCfg.yearLevel && YEARS.includes(defaultCfg.yearLevel)) yearSel.value = defaultCfg.yearLevel;
else yearSel.value = YEARS[2] ?? YEARS[0]; // sensible default

typeSel.value = defaultCfg.type ?? '';

	9.	Init state with UI config

	•	Replace current let state: State = initState(); with:

const currentConfig = (): State['config'] => ({
  yearLevel: yearSel.value || undefined,
  type: typeSel.value || null
});
let state: State = initState(undefined, currentConfig());

	10.	Apply on change

const applyConfig = () => {
  const cfg = currentConfig();
  saveCfg(cfg);
  dispatch({ type: 'SET_CONFIG', config: cfg, now: performance.now() });
};
yearSel.addEventListener('change', applyConfig, { signal });
typeSel.addEventListener('change', applyConfig, { signal });

Verify: changing selects doesn’t break game; next generated problem matches selection.

⸻

5) Focus-aware input routing
	11.	Interactive target guard

	•	In view.ts above handlers:

function isInteractiveTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

	12.	Keydown handler update

	•	Replace existing handleKeyDown with:

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (isInteractiveTarget(event.target)) return; // let controls use arrows

  const now = performance.now();
  if (state.mode === 'paused') { dispatch({ type:'RESUME', now }); return; }

  if (event.key === 'Enter') {
    if (state.mode === 'gameover') { event.preventDefault(); dispatch({ type:'RESTART', now }); }
    return;
  }

  const dir = KEY_TO_DIR[event.key];
  if (!dir) return;
  event.preventDefault();
  dispatch({ type:'TURN', dir });
};
window.addEventListener('keydown', handleKeyDown, { passive:false, signal });

Verify: arrows move snake only when canvas or body focused; arrows change <select> when selects focused.
	13.	Pause on UI focus; resume on canvas focus

const pauseForUi = () => dispatch({ type:'PAUSE', reason:'ui', now: performance.now() });
yearSel.addEventListener('focusin', pauseForUi, { signal });
typeSel.addEventListener('focusin', pauseForUi, { signal });

canvas.addEventListener('focusin', () => dispatch({ type:'RESUME', now: performance.now() }), { signal });

Verify: focusing a select pauses; clicking canvas resumes.

⸻

6) HUD robustness
	14.	Truncate long expressions

	•	In view.ts, add helper:

function ellipsis(ctx:CanvasRenderingContext2D, text:string, max:number){
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

	•	In drawHud():

const expr = state.problem?.expressionShort ?? state.problem?.expression ?? 'Loading…';
const maxW = logicalWidth - 140; // leave room for Lives
const shown = ellipsis(ctx, `Problem: ${expr}`, maxW);
ctx.textAlign = 'left'; ctx.fillText(shown, 16, hudHeight/2);

Verify: no overflow when problems are long.

⸻

7) Cleanup and HMR
	15.	AbortController cleanup

	•	Replace previous explicit removes with:

window.addEventListener('beforeunload', () => ac.abort(), { once:true });
if (import.meta.hot) import.meta.hot.dispose(() => ac.abort());

	•	Keep RAF cancel inside dispose as you already had.

Verify: HMR doesn’t duplicate listeners; no console warnings.

⸻

8) QA passes
	16.	Manual checks

	•	Canvas has focus on load. Arrows move snake.
	•	Focus year/type select. Arrows change selection. Game pauses.
	•	Click canvas. Game resumes and arrows control snake.
	•	Change year/type. Next generated problem matches.
	•	State persists after reload via localStorage.
	•	Game over still restarts with Enter.
	•	Wrong flash still works.

Done.