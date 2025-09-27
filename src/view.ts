import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL,
  COLS,
  HUD_HEIGHT,
  NUM_FRUITS,
  PAUSE_MS_AFTER_CORRECT,
  ROWS,
  START_LIVES,
  TICK_MS,
  WRONG_FLASH_MS,
} from './constants';
import { initState, reduce } from './core';
import type { Dir, GameEvent, State } from './types';

export function init(): void {
  const root = document.querySelector<HTMLDivElement>('#app');

  if (!root) {
    throw new Error('Cannot initialise game: #app root not found');
  }

  const canvas = root.querySelector<HTMLCanvasElement>('#game');

  if (!canvas) {
    throw new Error('Cannot initialise game: #game canvas not found');
  }

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Cannot initialise game: 2D context unavailable');
  }

  const logicalWidth = CANVAS_WIDTH;
  const logicalHeight = CANVAS_HEIGHT;
  const dpr = Math.max(window.devicePixelRatio ?? 1, 1);
  const pixelWidth = Math.floor(logicalWidth * dpr);
  const pixelHeight = Math.floor(logicalHeight * dpr);

  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  const hudHeight = HUD_HEIGHT;
  const gridOffsetY = hudHeight;

  const prepareContext = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
  };

  const drawBackground = () => {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  };

  const drawHud = () => {
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, logicalWidth, hudHeight);

    ctx.fillStyle = '#f2f2f2';
    ctx.font = '16px "Fira Code", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const expression = state.problem?.expression ?? 'Loading…';
    ctx.fillText(`Problem: ${expression}`, 16, hudHeight / 2);

    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${state.lives}`, logicalWidth - 16, hudHeight / 2);
  };

  const drawSnake = () => {
    if (state.snake.length === 0) {
      return;
    }

    const head = state.snake[0];
    const body = state.snake.slice(1);
    const padding = 2;

    ctx.fillStyle = '#2ecc71';
    for (const segment of body) {
      const x = segment.x * CELL + padding;
      const y = gridOffsetY + segment.y * CELL + padding;
      ctx.fillRect(x, y, CELL - padding * 2, CELL - padding * 2);
    }

    const headX = head.x * CELL + padding;
    const headY = gridOffsetY + head.y * CELL + padding;
    ctx.fillStyle = '#48ff9b';
    ctx.fillRect(headX, headY, CELL - padding * 2, CELL - padding * 2);
  };

  const drawFruits = () => {
    if (state.fruitByKey.size === 0) {
      return;
    }

    const radius = CELL / 2 - 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Fira Code", monospace';

    for (const fruit of state.fruitByKey.values()) {
      const centerX = fruit.pos.x * CELL + CELL / 2;
      const centerY = gridOffsetY + fruit.pos.y * CELL + CELL / 2;

      ctx.beginPath();
      ctx.fillStyle = '#f39c12';
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#111';
      ctx.fillText(String(fruit.value), centerX, centerY + 1);
    }
  };

  const drawWrongFlash = (now: number) => {
    if (!state.wrongFlashUntil) {
      return;
    }

    const remaining = state.wrongFlashUntil - now;
    if (remaining <= 0) {
      return;
    }

    const alpha = Math.min(0.5, Math.max(0, remaining / WRONG_FLASH_MS));
    ctx.fillStyle = `rgba(255, 80, 80, ${alpha})`;
    ctx.fillRect(0, gridOffsetY, logicalWidth, logicalHeight - gridOffsetY);
  };

  const drawOverlay = () => {
    if (state.mode === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, gridOffsetY, logicalWidth, logicalHeight - gridOffsetY);

      ctx.fillStyle = '#ffffff';
      ctx.font = '20px "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'Correct! Next round in 5s — press any key to resume',
        logicalWidth / 2,
        gridOffsetY + (logicalHeight - gridOffsetY) / 2,
      );
      return;
    }

    if (state.mode !== 'gameover') {
      return;
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, gridOffsetY, logicalWidth, logicalHeight - gridOffsetY);

    ctx.fillStyle = '#ffffff';
    ctx.font = '24px "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game Over', logicalWidth / 2, gridOffsetY + (logicalHeight - gridOffsetY) / 2);
  };

  const render = (now: number) => {
    prepareContext();
    drawBackground();
    drawHud();
    drawSnake();
    drawFruits();
    drawWrongFlash(now);
    drawOverlay();
  };

  let state: State = initState();

  const dispatch = (event: GameEvent) => {
    state = reduce(state, event);
  };

  const stepIntervalMs = TICK_MS;
  const maxStepsPerFrame = 5;
  const maxAccumulatorMs = stepIntervalMs * maxStepsPerFrame;

  let accumulator = 0;
  let lastFrameTs = performance.now();
  let loopLogStart = lastFrameTs;
  let frameCounter = 0;
  let tickCounter = 0;
  let rafId = 0;

  const tick = (now: number) => {
    dispatch({ type: 'TICK', now });
    tickCounter += 1;
  };

  const frame = (now: number) => {
    const delta = now - lastFrameTs;
    lastFrameTs = now;
    accumulator = Math.min(accumulator + delta, maxAccumulatorMs);

    let steps = 0;
    while (accumulator >= stepIntervalMs && steps < maxStepsPerFrame) {
      accumulator -= stepIntervalMs;
      tick(now);
      steps += 1;
    }

    if (steps === maxStepsPerFrame && accumulator >= stepIntervalMs) {
      accumulator = 0;
    }

    render(now);

    frameCounter += 1;
    if (now - loopLogStart >= 1000) {
      console.info('snake-maths:loop', {
        fps: frameCounter,
        ticks: tickCounter,
        mode: state.mode,
      });
      frameCounter = 0;
      tickCounter = 0;
      loopLogStart = now;
    }

    rafId = requestAnimationFrame(frame);
  };

  render(performance.now());
  rafId = requestAnimationFrame(frame);

  const KEY_TO_DIR: Record<string, Dir> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const dir = KEY_TO_DIR[event.key];
    const now = performance.now();

    if (state.mode === 'paused') {
      dispatch({ type: 'RESUME', now });
    }

    if (!dir) {
      return;
    }

    event.preventDefault();
    dispatch({ type: 'TURN', dir });
  };

  window.addEventListener('keydown', handleKeyDown, { passive: false });

  const teardown = () => {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('beforeunload', teardown);
  };

  window.addEventListener('beforeunload', teardown);

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
    HUD_HEIGHT,
    WRONG_FLASH_MS,
    dpr,
  });
}
