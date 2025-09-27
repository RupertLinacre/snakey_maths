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

  const [headSprite, bodySprite, cornerSprite] = await Promise.all([
    loadSprite('/sprites/snake_head.png'),
    loadSprite('/sprites/snake_body.png'),
    loadSprite('/sprites/snake_corner.png'),
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
  const speedSel = document.getElementById('speed') as HTMLSelectElement | null;

  if (!yearSel || !typeSel || !speedSel) {
    throw new Error('Cannot initialise game: controls not found');
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

  type StoredSettings = {
    yearLevel?: string;
    type?: string | null;
    tickMs?: number;
  };

  const SPEED_PRESETS = [
    { label: 'Fast', value: 120 },
    { label: 'Medium', value: 500 },
    { label: 'Slow', value: 1000 },
  ];

  speedSel.replaceChildren(
    ...SPEED_PRESETS.map(({ label, value }) => new Option(label, String(value))),
  );

  const LS_KEY = 'snake-maths:settings';
  const loadSettings = (): StoredSettings => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') ?? {};
    } catch (error) {
      console.warn('snake-maths:settings:load failed', error);
      return {};
    }
  };

  const saveSettings = (settings: StoredSettings) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('snake-maths:settings:save failed', error);
    }
  };

  const stored = loadSettings();

  const defaultYear = stored.yearLevel && YEARS.includes(stored.yearLevel)
    ? stored.yearLevel
    : YEARS[2] ?? YEARS[0] ?? '';
  yearSel.value = defaultYear;

  if (stored.type && TYPES.includes(stored.type)) {
    typeSel.value = stored.type;
  } else {
    typeSel.value = '';
  }

  const defaultTick = (() => {
    const candidates = SPEED_PRESETS.map((preset) => preset.value);
    if (stored.tickMs && candidates.includes(stored.tickMs)) {
      return stored.tickMs;
    }
    return candidates.includes(TICK_MS) ? TICK_MS : SPEED_PRESETS[0].value;
  })();
  speedSel.value = String(defaultTick);

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

    const dirFromDelta = (dx: number, dy: number): { x: number; y: number } => ({ x: Math.sign(dx), y: Math.sign(dy) });

    for (let i = 1; i < segments.length; i += 1) {
      const segment = segments[i];
      const prev = segments[i - 1];
      const next = segments[i + 1] ?? prev;

      const inVec = dirFromDelta(segment.x - prev.x, segment.y - prev.y);
      const outVec = dirFromDelta(next.x - segment.x, next.y - segment.y);

      const center = getCenter(segment);

      const isStraightVertical = inVec.x === 0 && outVec.x === 0;
      const isStraightHorizontal = inVec.y === 0 && outVec.y === 0;

      if (isStraightVertical) {
        const rotation = inVec.y < 0 ? 0 : Math.PI;
        drawSprite(bodySprite, center.x, center.y, rotation);
        continue;
      }

      if (isStraightHorizontal) {
        const rotation = inVec.x < 0 ? Math.PI / 2 : -Math.PI / 2;
        drawSprite(bodySprite, center.x, center.y, rotation);
        continue;
      }

      const angle = (() => {
        const computed = Math.atan2(inVec.y, inVec.x) + Math.PI / 2;
        const normalized = ((computed % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return normalized;
      })();

      const rotatedOut = {
        x: Math.round(Math.cos(angle)),
        y: Math.round(Math.sin(angle)),
      };

      if (rotatedOut.x === outVec.x && rotatedOut.y === outVec.y) {
        drawSprite(cornerSprite, center.x, center.y, angle);
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
          return Math.PI / 2;
        case 'right':
          return -Math.PI / 2;
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
      const message = (() => {
        if (state.dirQueue.length === 0 && state.snake.length <= 1) {
          return 'Ready? Press an arrow to start';
        }
        if (state.lives < START_LIVES) {
          return 'Oops, you hit the wall. Press an arrow key to continue';
        }
        return 'Correct! Press any key to resume';
      })();
      ctx.fillText(message, logicalWidth / 2, gridOffsetY + (logicalHeight - gridOffsetY) / 2);
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

  const getSettings = (): StoredSettings => ({
    yearLevel: yearSel.value || undefined,
    type: typeSel.value || null,
    tickMs: Number(speedSel.value || defaultTick),
  });

  const initialSettings = getSettings();
  saveSettings(initialSettings);

  const currentConfig = (): State['config'] => ({
    yearLevel: yearSel.value || undefined,
    type: typeSel.value || null,
  });

  const getTickMs = () => Number(speedSel.value || defaultTick);

  let state: State = initState(undefined, currentConfig(), getTickMs(), { paused: true });

  const maxStepsPerFrame = 5;
  let stepIntervalMs = state.tickMs;
  let maxAccumulatorMs = stepIntervalMs * maxStepsPerFrame;

  const updateTiming = () => {
    stepIntervalMs = state.tickMs;
    maxAccumulatorMs = stepIntervalMs * maxStepsPerFrame;
  };

  const dispatch = (event: GameEvent) => {
    state = reduce(state, event);
    updateTiming();
  };

  const applyConfig = () => {
    const now = performance.now();
    const cfg = currentConfig();
    const settings = getSettings();
    saveSettings(settings);
    dispatch({ type: 'SET_CONFIG', config: cfg, now });
    dispatch({ type: 'RESTART', now });
  };

  const applySpeed = () => {
    const now = performance.now();
    const settings = getSettings();
    saveSettings(settings);
    dispatch({ type: 'SET_SPEED', tickMs: settings.tickMs ?? state.tickMs, now });
    dispatch({ type: 'RESTART', now });
  };

  yearSel.addEventListener('change', applyConfig, { signal });
  typeSel.addEventListener('change', applyConfig, { signal });
  speedSel.addEventListener('change', applySpeed, { signal });

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
    tickMs: state.tickMs,
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
