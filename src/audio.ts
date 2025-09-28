const contextState = {
  ctx: undefined as AudioContext | undefined,
  masterGain: undefined as GainNode | undefined,
};

function ensureContext(): AudioContext {
  if (!contextState.ctx) {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(ctx.destination);
    contextState.ctx = ctx;
    contextState.masterGain = gain;
  }
  return contextState.ctx;
}

export async function loadAudioBuffer(url: string): Promise<AudioBuffer> {
  const ctx = ensureContext();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export function playBuffer(buffer: AudioBuffer, options?: { gain?: number }) {
  const ctx = ensureContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = options?.gain ?? 1;
  source.connect(gain);
  gain.connect(contextState.masterGain!);
  source.start();
}

export function createLoopSource(buffer: AudioBuffer, options?: { gain?: number }): AudioBufferSourceNode {
  const ctx = ensureContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = options?.gain ?? 1;
  source.connect(gain);
  gain.connect(contextState.masterGain!);
  return source;
}

export async function ensureRunning(): Promise<void> {
  const ctx = ensureContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

export function setMasterGain(value: number) {
  ensureContext();
  if (contextState.masterGain) {
    contextState.masterGain.gain.value = value;
  }
}

export function stopContext() {
  if (contextState.ctx) {
    contextState.ctx.close();
    contextState.ctx = undefined;
    contextState.masterGain = undefined;
  }
}
