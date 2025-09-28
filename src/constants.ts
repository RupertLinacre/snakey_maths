export const CELL = 24;
export const TILE = CELL;

export const COLS = 24;
export const ROWS = 18;
export const BORDER = 1;

export const PLAY_MIN_X = BORDER;
export const PLAY_MIN_Y = BORDER;
export const PLAY_MAX_X = COLS - 1 - BORDER;
export const PLAY_MAX_Y = ROWS - 1 - BORDER;

export const CANVAS_WIDTH = COLS * TILE;
export const HUD_HEIGHT = TILE;
export const CANVAS_HEIGHT = ROWS * TILE + HUD_HEIGHT;

export const WALL_COLOR = '#1e90ff';

export const TICK_MS = 1000;
export const PAUSE_MS_AFTER_CORRECT = 5000;
export const WRONG_FLASH_MS = 250;

export const NUM_FRUITS = 4;
export const START_LIVES = 3;
