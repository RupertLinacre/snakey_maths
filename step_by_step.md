

Phase 1 — Files and contracts ✅
	3.	Create minimal files

	•	src/constants.ts, src/types.ts, src/core.ts, src/view.ts
	•	In main.ts, call init() from view.ts.
	•	Verify: compile and a console log from init().

	4.	Define constants

	•	Grid: CELL, COLS, ROWS, canvas size.
	•	Timing: TICK_MS, PAUSE_MS_AFTER_CORRECT.
	•	Game: NUM_FRUITS, START_LIVES.
	•	Verify: import and log values.

	5.	Define types

	•	Point, Dir, GameMode = 'running'|'paused'|'gameover'
	•	Fruit { pos:Point; value:number; correct:boolean }
	•	Problem { expression:string; answer:number }
	•	State { mode, lives, snake:Point[], snakeSet:Set<string>, dir, dirQueue:Dir[], fruitByKey:Map<string,Fruit>, correctKey?:string, problem?:Problem, resumeAt?:number, wrongFlashUntil?:number }
	•	Verify: type-check passes.

Phase 2 — Canvas + DPR
	6.	Canvas setup in view.ts

	•	Create <canvas id="game"> in index.html.
	•	Handle devicePixelRatio. Scale context. Keep logical width/height from constants.
	•	Verify: a background fill renders crisp (no blur).

Phase 3 — Loop and FSM shell
	7.	RAF + fixed timestep

	•	RAF with accumulator. Step at TICK_MS. Cap steps (e.g., 5).
	•	Verify: counters show stable tick rate.

	8.	Reducer skeleton in core.ts

	•	initState(), reduce(state, event) with events: TICK, TURN(dir), RESUME, RESTART.
	•	For now, TICK does nothing.
	•	Verify: reducer returns new state without exceptions.

Phase 4 — Movement and input
	9.	Movement

	•	nextHead(state): Point from dir.
	•	On TICK: unshift head, pop tail.
	•	Maintain snakeSet O(1): add head key, delete popped tail key.
	•	Verify: snake moves right across empty board.

	10.	Input queue

	•	Keydown arrows enqueue at most one dir per tick.
	•	Reject 180° turns.
	•	On TICK, consume one queued dir.
	•	Verify: turning works; reversal blocked.

Phase 5 — Collisions and endings
	11.	Wall collision (Nokia)

	•	If next head is out of bounds → mode='gameover'.
	•	Verify: hitting border ends game.

	12.	Self collision

	•	If next head in snakeSet → mode='gameover'.
	•	Verify: turning into self ends game.

	13.	Unit tests (vitest)

	•	Tests for nextHead, 180° block, wall collision, self collision.
	•	Verify: all green.

Phase 6 — Rendering
	14.	Draw snake

	•	Head and body rectangles. No gridlines.
	•	Verify: smooth movement.

	15.	HUD row reservation

	•	Reserve one top HUD stripe (outside grid) for text.
	•	Adjust snake bounds to exclude HUD.
	•	Verify: snake never overlaps HUD.

	16.	Overlays

	•	Render Game Over when mode='gameover'.
	•	Verify: visible overlay.

Phase 7 — RNG and fruit system (stub problems)
	17.	Seeded RNG injection

	•	Implement small PRNG (mulberry32). Pass rng into spawn functions.
	•	Verify: same seed → same fruit positions.

	18.	Fruit placement

	•	spawnFruits(state, problem, rng):
	•	Choose unique empty cells (not in snakeSet).
	•	Build fruitByKey map of size NUM_FRUITS.
	•	Set exactly one correctKey.
	•	Verify: unique cells; map size == NUM_FRUITS.

	19.	Distractors (integers)

	•	makeDistractors(answer, n, rng):
	•	Unique integers, not equal to answer.
	•	Reasonable range around answer.
	•	Verify: uniqueness and not equal to answer.

	20.	Render fruits

	•	Circles with centered numbers.
	•	Verify: numbers readable at chosen CELL.

Phase 8 — Eating and lives
	21.	Eat detection

	•	On TICK, if head key in fruitByKey:
	•	If correctKey: set flag ateCorrect=true.
	•	Else: ateWrong=true.
	•	Verify: events fire on contact.

	22.	Wrong fruit path

	•	lives -= 1; wrongFlashUntil = now + 250.
	•	Remove that fruit and immediately spawn a new wrong fruit to keep NUM_FRUITS.
	•	If lives == 0 → mode='gameover'.
	•	Verify: life decrements; fruit count stays constant; red flash.

	23.	Correct fruit path

	•	Grow snake: skip tail pop for this tick.
	•	Generate new problem and new fruits.
	•	Set mode='paused', resumeAt = now + PAUSE_MS_AFTER_CORRECT.
	•	Verify: growth by 1; new fruits appear; mode is paused.

	24.	Pause handling

	•	While paused: ignore movement ticks.
	•	Resume on any key (RESUME) or when now >= resumeAt.
	•	Verify: both resume paths work.

	25.	Tests

	•	Correct eat grows + pauses + regenerates fruits.
	•	Wrong eat decrements lives and continues.
	•	Verify: all green.

Phase 9 — Maths library integration
	26.	Adapter

	•	src/math.ts:

import { generateProblem, checkAnswer, YEAR_LEVELS, PROBLEM_TYPES } from 'maths-game-problem-generator';
export function newProblem(opts?) { return generateProblem(opts); }
export function isCorrect(p, v:number) { return checkAnswer(p, v); }
export { YEAR_LEVELS, PROBLEM_TYPES };


	•	Verify: imports resolve.

	27.	Swap stub for real

	•	On correct eat: state.problem = newProblem(opts).
	•	Fruits: correct fruit value = problem.answer; distractors ensure integers. If decimals occur, use formattedAnswer for labels and still compare with checkAnswer.
	•	Verify: problem.expression looks sane; one correct fruit matches.

	28.	HUD problem text

	•	Draw problem.expression in reserved HUD.
	•	Verify: matches the correct fruit value.

Phase 10 — UX polish and HMR
	29.	Visual feedback

	•	Wrong flash (red tint for 200–300 ms). Correct overlay with “Next in 5s or press any key”.
	•	Verify: both visible.

	30.	Restart flow

	•	On gameover, Enter creates fresh state = initState(seed?).
	•	Verify: clean restart.

	31.	HMR safety

	•	Add import.meta.hot.dispose to remove listeners and cancel RAF.
	•	Verify: editing files doesn’t duplicate input handlers.

Phase 11 — Invariants and QA
	32.	Runtime assertions in dev

	•	Fruits unique, snake cells unique, fruitByKey.size === NUM_FRUITS, correctKey exists.
	•	Verify: no assertions triggered during normal play.

	33.	QA checklist

	•	Start with 3 lives.
	•	Wrong fruit: life–1, no pause, count stays NUM_FRUITS.
	•	Correct fruit: grow by 1, new problem + fruits, pause 5s or key.
	•	Hitting wall/self: immediate game over.
	•	Speed and difficulty constant.
	•	Verify: all pass.

Phase 12 — Optional
	34.	Settings

	•	Expose NUM_FRUITS, TICK_MS, YEAR_LEVEL in a small config object.
	•	Verify: changing values reflects in-game.

	35.	Sound (optional)

	•	Add short correct/wrong beeps via AudioContext.
	•	Verify: plays once per event.

This plan keeps the core pure, testable, and small. You can stop after any phase and still have a working build.