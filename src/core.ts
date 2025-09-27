import { COLS, ROWS, START_LIVES } from './constants';
import type { Dir, Fruit, GameEvent, Point, State } from './types';

const START_DIR: Dir = 'right';

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
    case 'TURN':
    case 'RESUME':
    case 'TICK':
    default:
      return state;
  }
}
