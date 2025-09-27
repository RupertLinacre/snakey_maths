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

export type ProblemConfig = {
  yearLevel?: string;
  type?: string | null;
};

export type PauseReason = 'ready' | 'correct' | 'wall' | 'ui';

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
  config: ProblemConfig;
  tickMs: number;
  pauseReason?: PauseReason;
};

export type GameEvent =
  | { type: 'TICK'; now: number }
  | { type: 'TURN'; dir: Dir }
  | { type: 'RESUME'; now: number }
  | { type: 'RESTART'; now: number }
  | { type: 'SET_CONFIG'; config: ProblemConfig; now: number }
  | { type: 'SET_SPEED'; tickMs: number; now: number }
  | { type: 'PAUSE'; reason?: PauseReason; now: number };
