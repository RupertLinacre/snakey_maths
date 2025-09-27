export type Point = {
  x: number;
  y: number;
};

export type Dir = 'up' | 'down' | 'left' | 'right';

export type GameMode = 'running' | 'paused' | 'gameover';

export type Fruit = {
  pos: Point;
  value: number;
  correct: boolean;
};

export type Problem = {
  expression: string;
  answer: number;
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
  resumeAt?: number;
  wrongFlashUntil?: number;
};
