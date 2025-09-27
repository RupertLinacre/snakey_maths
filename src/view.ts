import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL,
  COLS,
  HUD_HEIGHT,
  NUM_FRUITS,
  ROWS,
  START_LIVES,
  TICK_MS,
  WRONG_FLASH_MS,
} from './constants';
import { YEAR_LEVELS, PROBLEM_TYPES } from './math';
import { initState, reduce } from './core';
import type { Dir, GameEvent, State } from './types';

const SPRITE_BASE_SIZE = 48;

function loadSprite(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

export async function init(): Promise<void> {
  const ac = new AbortController();
  const { signal } = ac;

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

  const [headSprite, bodySprite] = await Promise.all([
    loadSprite('/sprites/snake_head.png'),
    loadSprite('/sprites/snake_body.png'),
  ]);

  const logicalWidth = CANVAS_WIDTH;
  const logicalHeight = CANVAS_HEIGHT;
  const dpr = Math.max(window.devicePixelRatio ?? 1, 1);
  const pixelWidth = Math.floor(logicalWidth * dpr);
  const pixelHeight = Math.floor(logicalHeight * dpr);

  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', 'Snake. Arrow keys to move. Enter to restart.');
  canvas.addEventListener(
    'pointerdown',
    () => {
      canvas.focus();
    },
    { signal },
  );

  const yearSel = document.getElementById('year') as HTMLSelectElement | null;
  const typeSel = document.getElementById('ptype') as HTMLSelectElement | null;

  if (!yearSel || !typeSel) {
    throw new Error('Cannot initialise game: #year or #ptype control not found');
  }

  const YEARS = Object.values(YEAR_LEVELS);
  const yearOptions = YEARS.map((value) => new Option(value, value));
  yearSel.replaceChildren(...yearOptions);

  const TYPES = Object.values(PROBLEM_TYPES);
  while (typeSel.options.length > 1) {
    typeSel.remove(1);
  }
  for (const value of TYPES) {
    typeSel.add(new Option(value, value));
  }

  const LS_KEY = 'snake-maths:config';
  const loadCfg = (): State['config'] => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') ?? {};
    } catch (error) {
      console.warn('snake-maths:config:load failed', error);
      return {};
    }
  };

  const saveCfg = (config: State['config']) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn('snake-maths:config:save failed', error);
    }
  };

  const defaultCfg = loadCfg();
  const defaultYear = defaultCfg.yearLevel && YEARS.includes(defaultCfg.yearLevel)
    ? defaultCfg.yearLevel
    : YEARS[2] ?? YEARS[0] ?? '';
  if (defaultYear) {
    yearSel.value = defaultYear;
  }

  if (defaultCfg.type && TYPES.includes(defaultCfg.type)) {
    typeSel.value = defaultCfg.type;
  } else {
    typeSel.value = '';
  }

  const hudHeight = HUD_HEIGHT;
  const gridOffsetY = hudHeight;

  const spriteScale = CELL / SPRITE_BASE_SIZE;

  const prepareContext = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
  };

  const drawSprite = (image: HTMLImageElement, centerX: number, centerY: number, rotation: number) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.scale(spriteScale, spriteScale);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();
  };

  const drawBackground = () => {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  };

  const ellipsis = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
    if (context.measureText(text).width <= maxWidth) {
      return text;
    }

    let trimmed = text;
    while (trimmed.length > 0 && context.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }

    return trimmed.length > 0 ? `${trimmed}…` : text;
  };

  const drawHud = () => {
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, logicalWidth, hudHeight);

    ctx.fillStyle = '#f2f2f2';
    ctx.font = '16px "Fira Code", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const expr = state.problem?.expressionShort ?? state.problem?.expression ?? 'Loading…';
    const label = `Problem: ${expr}`;
    const maxLabelWidth = logicalWidth - 140;
    const displayed = ellipsis(ctx, label, maxLabelWidth);
    ctx.fillText(displayed, 16, hudHeight / 2);

    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${state.lives}`, logicalWidth - 16, hudHeight / 2);
  };

  const drawSnake = () => {
    if (state.snake.length === 0) {
      return;
    }

    const segments = state.snake;
    const getCenter = (point: { x: number; y: number }) => ({
      x: point.x * CELL + CELL / 2,
      y: gridOffsetY + point.y * CELL + CELL / 2,
    });

    const fallbackDraw = (point: { x: number; y: number }) => {
      const padding = 3;
      ctx.fillStyle = '#38ef7d';
      ctx.fillRect(
        point.x * CELL + padding,
        gridOffsetY + point.y * CELL + padding,
        CELL - padding * 2,
        CELL - padding * 2,
      );
    };

    for (let i = 1; i < segments.length; i += 1) {
      const segment = segments[i];
      const prev = segments[i - 1];
      const next = segments[i + 1] ?? prev;

      const vertical = prev.x === segment.x && next.x === segment.x;
      const horizontal = prev.y === segment.y && next.y === segment.y;

      const center = getCenter(segment);

      if (vertical) {
        const rotation = prev.y < segment.y ? 0 : Math.PI;
        drawSprite(bodySprite, center.x, center.y, rotation);
      } else if (horizontal) {
        const rotation = prev.x < segment.x ? Math.PI / 2 : -Math.PI / 2;
        drawSprite(bodySprite, center.x, center.y, rotation);
      } else {
        fallbackDraw(segment);
      }
    }

    const head = segments[0];
    const headCenter = getCenter(head);
    const facing = state.dirQueue[0] ?? state.dir;
    const headRotation = (() => {
      switch (facing) {
        case 'up':
          return Math.PI;
        case 'left':
          return -Math.PI / 2;
        case 'right':
          return Math.PI / 2;
        case 'down':
        default:
          return 0;
      }
    })();

    drawSprite(headSprite, headCenter.x, headCenter.y, headRotation);
  };

  const drawFruits = () => {
    if (state.fruitByKey.size === 0) {
      return;
    }

    const radius = CELL / 2 - 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px "Fira Code", monospace';

    for (const fruit of state.fruitByKey.values()) {
      const centerX = fruit.pos.x * CELL + CELL / 2;
      const centerY = gridOffsetY + fruit.pos.y * CELL + CELL / 2;

      ctx.beginPath();
      ctx.fillStyle = '#560197ff';
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffffff';
      ctx.fillText(fruit.label, centerX, centerY + 1);
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
      ctx.fillText('Correct! Press any key to resume', logicalWidth / 2, gridOffsetY + (logicalHeight - gridOffsetY) / 2);
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
    ctx.fillText(
      'Game Over — Press Enter to restart',
      logicalWidth / 2,
      gridOffsetY + (logicalHeight - gridOffsetY) / 2,
    );
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

  const currentConfig = (): State['config'] => ({
    yearLevel: yearSel.value || undefined,
    type: typeSel.value || null,
  });

  saveCfg(currentConfig());

  let state: State = initState(undefined, currentConfig());

  const dispatch = (event: GameEvent) => {
    state = reduce(state, event);
  };

  const applyConfig = () => {
    const cfg = currentConfig();
    saveCfg(cfg);
    const now = performance.now();
    dispatch({ type: 'SET_CONFIG', config: cfg, now });
    dispatch({ type: 'RESTART', now });
  };

  yearSel.addEventListener('change', applyConfig, { signal });
  typeSel.addEventListener('change', applyConfig, { signal });

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
  canvas.focus();
  rafId = requestAnimationFrame(frame);

  const stopLoop = () => {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  signal.addEventListener('abort', stopLoop, { once: true });

  const KEY_TO_DIR: Record<string, Dir> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  };

  const isInteractiveTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el) {
      return false;
    }
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    const now = performance.now();

    if (state.mode === 'paused') {
      const dir = KEY_TO_DIR[event.key];

      if (dir) {
        event.preventDefault();
        dispatch({ type: 'TURN', dir });
        dispatch({ type: 'RESUME', now });
        return;
      }

      dispatch({ type: 'RESUME', now });
      return;
    }

    if (event.key === 'Enter') {
      if (state.mode === 'gameover') {
        event.preventDefault();
        dispatch({ type: 'RESTART', now });
      }
      return;
    }

    const dir = KEY_TO_DIR[event.key];

    if (!dir) {
      return;
    }

    event.preventDefault();
    dispatch({ type: 'TURN', dir });
  };

  window.addEventListener('keydown', handleKeyDown, { passive: false, signal });

  const pauseForUi = () => dispatch({ type: 'PAUSE', reason: 'ui', now: performance.now() });

  yearSel.addEventListener('focusin', pauseForUi, { signal });
  typeSel.addEventListener('focusin', pauseForUi, { signal });

  canvas.addEventListener(
    'focusin',
    () => {
      dispatch({ type: 'RESUME', now: performance.now() });
    },
    { signal },
  );

  window.addEventListener(
    'beforeunload',
    () => {
      ac.abort();
    },
    { once: true },
  );

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      ac.abort();
    });
  }

  console.info('snake-maths:init', {
    CELL,
    COLS,
    ROWS,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    TICK_MS,
    NUM_FRUITS,
    START_LIVES,
    HUD_HEIGHT,
    WRONG_FLASH_MS,
    dpr,
  });

  if (import.meta.env.DEV) {
    console.info('snake-maths:qa-checklist', [
      'Start with 3 lives',
      'Eating correct fruit grows snake, pauses 5s, new problem appears',
      'Eating wrong fruit flashes red, life -1, fruits stay at NUM_FRUITS',
      'Hit wall or self → immediate game over',
      'Press Enter on Game Over to restart',
    ]);
  }
}
