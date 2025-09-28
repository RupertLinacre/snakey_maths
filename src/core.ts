import {
  NUM_FRUITS,
  PLAY_MAX_X,
  PLAY_MAX_Y,
  PLAY_MIN_X,
  PLAY_MIN_Y,
  START_LIVES,
  TICK_MS,
  WRONG_FLASH_MS,
} from './constants';
import { isCorrect, newProblem, type MathLibProblem } from './math';
import type {
  Dir,
  Fruit,
  GameEvent,
  PauseReason,
  Point,
  Problem,
  ProblemConfig,
  State,
} from './types';

const START_DIR: Dir = 'right';
const UINT32_MAX = 0xffffffff;

const DIR_VECTORS: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function isOpposite(a: Dir, b: Dir): boolean {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  );
}

function isOutOfBounds(point: Point): boolean {
  return (
    point.x < PLAY_MIN_X ||
    point.x > PLAY_MAX_X ||
    point.y < PLAY_MIN_Y ||
    point.y > PLAY_MAX_Y
  );
}

function nextRandom(seed: number): { seed: number; value: number } {
  const nextSeed = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(nextSeed ^ (nextSeed >>> 15), 1 | nextSeed);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  const value = ((t ^ (t >>> 14)) >>> 0) / (UINT32_MAX + 1);
  return { seed: nextSeed, value };
}

function randomInt(seed: number, min: number, max: number): { seed: number; value: number } {
  if (max <= min) {
    throw new Error(`randomInt bounds invalid: min=${min} max=${max}`);
  }
  const { seed: nextSeed, value } = nextRandom(seed);
  const result = Math.floor(value * (max - min)) + min;
  return { seed: nextSeed, value: result };
}

function normaliseProblem(raw: MathLibProblem): Problem {
  return {
    expression: raw.expression,
    expressionShort: raw.expression_short,
    answer: raw.answer,
    formattedAnswer: raw.formattedAnswer,
    type: raw.type,
    yearLevel: raw.yearLevel,
  };
}

function toLibProblem(problem: Problem): MathLibProblem {
  return {
    expression: problem.expression,
    expression_short: problem.expressionShort,
    answer: problem.answer,
    formattedAnswer: problem.formattedAnswer,
    type: problem.type,
    yearLevel: problem.yearLevel,
  };
}

function assertDev(condition: unknown, message: string): asserts condition {
  if (import.meta.env.DEV && !condition) {
    throw new Error(`[dev] ${message}`);
  }
}

function validateState(state: State): State {
  if (!import.meta.env.DEV) {
    return state;
  }

  const snakeKeys = state.snake.map(pointKey);
  assertDev(snakeKeys.length === state.snakeSet.size, 'snakeSet size mismatch');
  assertDev(new Set(snakeKeys).size === snakeKeys.length, 'duplicate snake segments');
  for (const key of snakeKeys) {
    assertDev(state.snakeSet.has(key), `snakeSet missing ${key}`);
  }

  if (state.fruitByKey.size > 0) {
    assertDev(state.fruitByKey.size === NUM_FRUITS, `expected ${NUM_FRUITS} fruits, got ${state.fruitByKey.size}`);
    assertDev(typeof state.correctKey === 'string', 'correctKey missing');
    if (state.correctKey) {
      assertDev(state.fruitByKey.has(state.correctKey), 'correctKey not found in fruitByKey');
      const correctFruit = state.fruitByKey.get(state.correctKey);
      assertDev(correctFruit?.correct === true, 'correct fruit not flagged');
    }
  }

  for (const key of state.fruitByKey.keys()) {
    assertDev(!state.snakeSet.has(key), `fruit overlaps snake at ${key}`);
  }

  return state;
}

function makeDistractors(
  answer: number,
  count: number,
  seed: number,
): { seed: number; values: number[] } {
  const values: number[] = [];
  const used = new Set<number>([answer]);
  let nextSeed = seed;

  while (values.length < count) {
    const span = Math.max(10, Math.abs(answer) * 2 + 1);
    const min = answer - span;
    const max = answer + span + 1;
    const roll = randomInt(nextSeed, min, max);
    nextSeed = roll.seed;
    let candidate = roll.value;
    if (candidate === answer) {
      candidate += candidate >= 0 ? 1 : -1;
    }
    if (used.has(candidate)) {
      continue;
    }
    used.add(candidate);
    values.push(candidate);
  }

  return { seed: nextSeed, values };
}

function pickEmptyCell(seed: number, occupied: Set<string>): { seed: number; point: Point } {
  const playWidth = PLAY_MAX_X - PLAY_MIN_X + 1;
  const playHeight = PLAY_MAX_Y - PLAY_MIN_Y + 1;
  if (occupied.size >= playWidth * playHeight) {
    throw new Error('No empty cells available for fruit placement');
  }

  let nextSeed = seed;
  for (;;) {
    const rollX = randomInt(nextSeed, PLAY_MIN_X, PLAY_MAX_X + 1);
    nextSeed = rollX.seed;
    const rollY = randomInt(nextSeed, PLAY_MIN_Y, PLAY_MAX_Y + 1);
    nextSeed = rollY.seed;
    const point = { x: rollX.value, y: rollY.value };
    const key = pointKey(point);
    if (!occupied.has(key)) {
      return { seed: nextSeed, point };
    }
  }
}

function spawnFruitSet(
  snakeSet: Set<string>,
  seed: number,
  problem: Problem,
): { seed: number; fruitByKey: Map<string, Fruit>; correctKey: string } {
  const occupied = new Set<string>(snakeSet);
  let nextSeed = seed;
  const positions: Point[] = [];

  for (let i = 0; i < NUM_FRUITS; i += 1) {
    const picked = pickEmptyCell(nextSeed, occupied);
    nextSeed = picked.seed;
    positions.push(picked.point);
    occupied.add(pointKey(picked.point));
  }

  const correctIndexRoll = randomInt(nextSeed, 0, positions.length);
  nextSeed = correctIndexRoll.seed;
  const correctIndex = correctIndexRoll.value;

  const distractors = makeDistractors(problem.answer, NUM_FRUITS - 1, nextSeed);
  nextSeed = distractors.seed;

  const fruitByKey = new Map<string, Fruit>();
  let distractorCursor = 0;

  positions.forEach((pos, index) => {
    const key = pointKey(pos);
    if (index === correctIndex) {
      fruitByKey.set(key, {
        pos,
        value: problem.answer,
        label: problem.formattedAnswer ?? String(problem.answer),
        correct: true,
      });
    } else {
      const value = distractors.values[distractorCursor] ?? problem.answer + distractorCursor + 1;
      distractorCursor += 1;
      fruitByKey.set(key, {
        pos,
        value,
        label: String(value),
        correct: false,
      });
    }
  });

  const correctKey = pointKey(positions[correctIndex]);

  return {
    seed: nextSeed,
    fruitByKey,
    correctKey,
  };
}

function spawnAdditionalWrongFruit(
  snakeSet: Set<string>,
  currentFruits: Map<string, Fruit>,
  answer: number,
  seed: number,
): { seed: number; fruitByKey: Map<string, Fruit> } {
  const occupied = new Set<string>(snakeSet);
  for (const key of currentFruits.keys()) {
    occupied.add(key);
  }

  const picked = pickEmptyCell(seed, occupied);
  let nextSeed = picked.seed;
  const distractor = makeDistractors(answer, 1, nextSeed);
  nextSeed = distractor.seed;
  const value = distractor.values[0] ?? answer + 1;

  const fruitByKey = new Map<string, Fruit>(currentFruits);
  fruitByKey.set(pointKey(picked.point), {
    pos: picked.point,
    value,
    label: String(value),
    correct: false,
  });

  return { seed: nextSeed, fruitByKey };
}

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function randomSeed(): number {
  return (Math.random() * UINT32_MAX) >>> 0;
}

export function initState(
  seed?: number,
  config: ProblemConfig = {},
  tickMs: number = TICK_MS,
  options?: { paused?: boolean; lives?: number; pauseReason?: PauseReason },
): State {
  const startPos: Point = {
    x: Math.floor((PLAY_MIN_X + PLAY_MAX_X) / 2),
    y: Math.floor((PLAY_MIN_Y + PLAY_MAX_Y) / 2),
  };

  const snake: Point[] = [startPos];
  const snakeSet = new Set<string>([pointKey(startPos)]);

  let rngSeed = typeof seed === 'number' ? seed >>> 0 : randomSeed();
  const problem = normaliseProblem(newProblem(config));
  const fruitResult = spawnFruitSet(snakeSet, rngSeed, problem);
  rngSeed = fruitResult.seed;

  return validateState({
    mode: options?.paused ? 'paused' : 'running',
    lives: options?.lives ?? START_LIVES,
    snake,
    snakeSet,
    dir: START_DIR,
    dirQueue: [],
    fruitByKey: fruitResult.fruitByKey,
    correctKey: fruitResult.correctKey,
    problem,
    rngSeed,
    config,
    tickMs,
    pauseReason: options?.paused ? options?.pauseReason ?? 'ready' : undefined,
  });
}

export function reduce(state: State, event: GameEvent): State {
  switch (event.type) {
    case 'RESTART':
      return initState(undefined, state.config, state.tickMs, {
        paused: true,
        pauseReason: 'ready',
      });
    case 'TURN': {
      if (state.mode === 'gameover') {
        return state;
      }
      const prevDir = state.dirQueue[state.dirQueue.length - 1] ?? state.dir;
      if (prevDir === event.dir || isOpposite(prevDir, event.dir)) {
        return state;
      }
      const nextQueue = [...state.dirQueue, event.dir];
      return validateState({
        ...state,
        dirQueue: nextQueue,
      });
    }
    case 'SET_CONFIG':
      return validateState({
        ...state,
        config: event.config,
        pauseReason: 'ready',
      });
    case 'SET_SPEED':
      return validateState({
        ...state,
        tickMs: event.tickMs,
        pauseReason: 'ready',
      });
    case 'PAUSE': {
      if (state.mode !== 'running') {
        return state;
      }
      return validateState({
        ...state,
        mode: 'paused',
        resumeAt: undefined,
        pauseReason: event.reason ?? 'ui',
      });
    }
    case 'RESUME': {
      if (state.mode !== 'paused') {
        return state;
      }
      return validateState({
        ...state,
        mode: 'running',
        resumeAt: undefined,
        pauseReason: undefined,
      });
    }
    case 'TICK': {
      if (state.mode === 'paused') {
        return state;
      }

      if (state.mode !== 'running') {
        return state;
      }

      if (state.snake.length === 0) {
        return state;
      }

      let nextDir = state.dir;
      let nextQueue = state.dirQueue;
      if (nextQueue.length > 0) {
        nextDir = nextQueue[0];
        nextQueue = nextQueue.slice(1);
      }

      const head = state.snake[0];
      const delta = DIR_VECTORS[nextDir];
      const nextHead: Point = {
        x: head.x + delta.x,
        y: head.y + delta.y,
      };

      if (isOutOfBounds(nextHead)) {
        const remainingLives = state.lives - 1;
        if (remainingLives <= 0) {
          return validateState({
            ...state,
            mode: 'gameover',
            dir: nextDir,
            dirQueue: [],
            resumeAt: undefined,
            lives: 0,
          });
        }

        return validateState({
          ...state,
          mode: 'paused',
          dir: nextDir,
          dirQueue: [],
          lives: remainingLives,
          pauseReason: 'wall',
          resumeAt: undefined,
          wrongFlashUntil: undefined,
        });
      }

      const nextHeadKey = pointKey(nextHead);
      const tail = state.snake[state.snake.length - 1];
      const tailKey = pointKey(tail);
      const steppingIntoTail = state.snake.length > 1 && nextHeadKey === tailKey;

      if (state.snakeSet.has(nextHeadKey) && !steppingIntoTail) {
        return validateState({
          ...state,
          mode: 'gameover',
          dir: nextDir,
          dirQueue: [],
          resumeAt: undefined,
        });
      }

      let rngSeed = state.rngSeed;
      let fruitByKey = state.fruitByKey;
      let correctKey = state.correctKey;
      let problem = state.problem;
      let lives = state.lives;
      let mode: State['mode'] = 'running';
      let resumeAt = state.resumeAt;
      let wrongFlashUntil = state.wrongFlashUntil;
      let pauseReason = state.pauseReason;

      const fruit = state.fruitByKey.get(nextHeadKey);
      const libProblem = problem ? toLibProblem(problem) : undefined;
      const isCorrectFruit = fruit && libProblem ? isCorrect(libProblem, fruit.value) : Boolean(fruit?.correct);
      const willGrow = Boolean(isCorrectFruit);

      const nextSnakeSet = new Set<string>(state.snakeSet);
      const nextSnake: Point[] = willGrow
        ? [nextHead, ...state.snake]
        : [nextHead, ...state.snake.slice(0, Math.max(state.snake.length - 1, 0))];

      if (willGrow) {
        nextSnakeSet.add(nextHeadKey);
      } else {
        nextSnakeSet.delete(tailKey);
        nextSnakeSet.add(nextHeadKey);
      }

      if (fruit) {
        if (isCorrectFruit) {
          const nextProblem = normaliseProblem(newProblem(state.config));
          problem = nextProblem;
          const spawnResult = spawnFruitSet(nextSnakeSet, rngSeed, nextProblem);
          rngSeed = spawnResult.seed;
          fruitByKey = spawnResult.fruitByKey;
          correctKey = spawnResult.correctKey;
          mode = 'paused';
          resumeAt = undefined;
          nextQueue = [];
          wrongFlashUntil = undefined;
          pauseReason = 'correct';
        } else {
          lives = Math.max(0, lives - 1);
          wrongFlashUntil = event.now + WRONG_FLASH_MS;
          const mutableFruitMap = new Map(fruitByKey);
          mutableFruitMap.delete(nextHeadKey);
          const spawnResult = spawnAdditionalWrongFruit(
            nextSnakeSet,
            mutableFruitMap,
            problem?.answer ?? 0,
            rngSeed,
          );
          rngSeed = spawnResult.seed;
          fruitByKey = spawnResult.fruitByKey;
          if (lives === 0) {
            mode = 'gameover';
            resumeAt = undefined;
            pauseReason = undefined;
          }
        }
      }

      return validateState({
        ...state,
        mode,
        dir: nextDir,
        dirQueue: nextQueue,
        snake: nextSnake,
        snakeSet: nextSnakeSet,
        fruitByKey,
        correctKey,
        problem,
        rngSeed,
        lives,
        resumeAt,
        wrongFlashUntil,
        pauseReason,
      });
    }
    default:
      return state;
  }
}
