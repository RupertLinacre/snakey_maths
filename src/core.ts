import { COLS, ROWS, START_LIVES } from './constants';
import type { Dir, Fruit, GameEvent, Point, State } from './types';

const START_DIR: Dir = 'right';

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

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

export function initState(): State {
  const startPos: Point = {
    x: Math.floor(COLS / 2),
    y: Math.floor(ROWS / 2),
  };

  const snake: Point[] = [startPos];
  const snakeSet = new Set<string>([pointKey(startPos)]);

  return {
    mode: 'running',
    lives: START_LIVES,
    snake,
    snakeSet,
    dir: START_DIR,
    dirQueue: [],
    fruitByKey: new Map<string, Fruit>(),
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
    case 'RESUME':
      return state;
    case 'TICK': {
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
          dir: nextDir,
          dirQueue: [],
          mode: 'gameover',
        };
      }

      const nextHeadKey = pointKey(nextHead);
      const tail = state.snake[state.snake.length - 1];
      const tailKey = pointKey(tail);
      const steppingIntoTail = state.snake.length > 1 && nextHeadKey === tailKey;

      if (state.snakeSet.has(nextHeadKey) && !steppingIntoTail) {
        return {
          ...state,
          dir: nextDir,
          dirQueue: [],
          mode: 'gameover',
        };
      }

      const nextSnake = [nextHead, ...state.snake.slice(0, Math.max(state.snake.length - 1, 0))];

      const nextSnakeSet = new Set(state.snakeSet);
      nextSnakeSet.delete(tailKey);
      nextSnakeSet.add(nextHeadKey);

      return {
        ...state,
        dir: nextDir,
        dirQueue: nextQueue,
        snake: nextSnake,
        snakeSet: nextSnakeSet,
      };
    }
    default:
      return state;
  }
}
