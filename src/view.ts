import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL,
  COLS,
  NUM_FRUITS,
  PAUSE_MS_AFTER_CORRECT,
  ROWS,
  START_LIVES,
  TICK_MS,
} from './constants';

export function init(): void {
  const root = document.querySelector<HTMLDivElement>('#app');

  if (!root) {
    throw new Error('Cannot initialise game: #app root not found');
  }

  root.innerHTML = `<div class="placeholder">Snake + Maths coming soon…</div>`;

  console.info('snake-maths:init', {
    CELL,
    COLS,
    ROWS,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    TICK_MS,
    PAUSE_MS_AFTER_CORRECT,
    NUM_FRUITS,
    START_LIVES,
  });
}
