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
import { initState, reduce } from './core';
import type { GameEvent, State } from './types';

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

  const renderBackground = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
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

    renderBackground();

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

  renderBackground();
  rafId = requestAnimationFrame(frame);

  const teardown = () => {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
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
    dpr,
  });
}
