export type Point = {
  x: number;
  y: number;
};

export type Dir = 'up' | 'down' | 'left' | 'right';

export type GameMode = 'running' | 'paused' | 'gameover';

export type Fruit = {
  pos: Point;
  value: number;
  label: string;
  correct: boolean;
};

export type Problem = {
  expression: string;
  answer: number;
  expressionShort?: string;
  formattedAnswer?: string;
  type?: string;
  yearLevel?: string;
};

export type State = {
  mode: GameMode;
  lives: number;
  snake: Point[];
  snakeSet: Set<string>;
  dir: Dir;
  dirQueue: Dir[];
  fruitByKey: Map<string, Fruit>;
  correctKey?: string;
  problem?: Problem;
  rngSeed: number;
  resumeAt?: number;
  wrongFlashUntil?: number;
};

export type GameEvent =
  | { type: 'TICK'; now: number }
  | { type: 'TURN'; dir: Dir }
  | { type: 'RESUME'; now: number }
  | { type: 'RESTART'; now: number };
