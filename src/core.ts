import {
  COLS,
  NUM_FRUITS,
  PAUSE_MS_AFTER_CORRECT,
  ROWS,
  START_LIVES,
  WRONG_FLASH_MS,
} from './constants';
import { isCorrect, newProblem, type MathLibProblem } from './math';
import type { Dir, Fruit, GameEvent, Point, Problem, State } from './types';

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
  return point.x < 0 || point.x >= COLS || point.y < 0 || point.y >= ROWS;
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
  const totalCells = COLS * ROWS;
  if (occupied.size >= totalCells) {
    throw new Error('No empty cells available for fruit placement');
  }

  let nextSeed = seed;
  for (;;) {
    const roll = randomInt(nextSeed, 0, totalCells);
    nextSeed = roll.seed;
    const index = roll.value;
    const x = index % COLS;
    const y = Math.floor(index / COLS);
    const key = `${x},${y}`;
    if (!occupied.has(key)) {
      return { seed: nextSeed, point: { x, y } };
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

export function initState(seed?: number): State {
  const startPos: Point = {
    x: Math.floor(COLS / 2),
    y: Math.floor(ROWS / 2),
  };

  const snake: Point[] = [startPos];
  const snakeSet = new Set<string>([pointKey(startPos)]);

  let rngSeed = typeof seed === 'number' ? seed >>> 0 : randomSeed();
  const problem = normaliseProblem(newProblem());
  const fruitResult = spawnFruitSet(snakeSet, rngSeed, problem);
  rngSeed = fruitResult.seed;

  return {
    mode: 'running',
    lives: START_LIVES,
    snake,
    snakeSet,
    dir: START_DIR,
    dirQueue: [],
    fruitByKey: fruitResult.fruitByKey,
    correctKey: fruitResult.correctKey,
    problem,
    rngSeed,
  };
}

export function reduce(state: State, event: GameEvent): State {
  switch (event.type) {
    case 'RESTART':
      return initState();
    case 'TURN': {
      if (state.mode !== 'running') {
        return state;
      }
      if (state.dirQueue.length > 0) {
        return state;
      }
      const prevDir = state.dir;
      if (prevDir === event.dir || isOpposite(prevDir, event.dir)) {
        return state;
      }
      return {
        ...state,
        dirQueue: [...state.dirQueue, event.dir],
      };
    }
    case 'RESUME': {
      if (state.mode !== 'paused') {
        return state;
      }
      return {
        ...state,
        mode: 'running',
        resumeAt: undefined,
      };
    }
    case 'TICK': {
      if (state.mode === 'paused') {
        if (state.resumeAt !== undefined && event.now >= state.resumeAt) {
          return {
            ...state,
            mode: 'running',
            resumeAt: undefined,
          };
        }
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
        return {
          ...state,
          mode: 'gameover',
          dir: nextDir,
          dirQueue: [],
          resumeAt: undefined,
        };
      }

      const nextHeadKey = pointKey(nextHead);
      const tail = state.snake[state.snake.length - 1];
      const tailKey = pointKey(tail);
      const steppingIntoTail = state.snake.length > 1 && nextHeadKey === tailKey;

      if (state.snakeSet.has(nextHeadKey) && !steppingIntoTail) {
        return {
          ...state,
          mode: 'gameover',
          dir: nextDir,
          dirQueue: [],
          resumeAt: undefined,
        };
      }

      let rngSeed = state.rngSeed;
      let fruitByKey = state.fruitByKey;
      let correctKey = state.correctKey;
      let problem = state.problem;
      let lives = state.lives;
      let mode: State['mode'] = 'running';
      let resumeAt = state.resumeAt;
      let wrongFlashUntil = state.wrongFlashUntil;

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
          const nextProblem = normaliseProblem(newProblem());
          problem = nextProblem;
          const spawnResult = spawnFruitSet(nextSnakeSet, rngSeed, nextProblem);
          rngSeed = spawnResult.seed;
          fruitByKey = spawnResult.fruitByKey;
          correctKey = spawnResult.correctKey;
          mode = 'paused';
          resumeAt = event.now + PAUSE_MS_AFTER_CORRECT;
          nextQueue = [];
          wrongFlashUntil = undefined;
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
          }
        }
      }

      return {
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
      };
    }
    default:
      return state;
  }
}
