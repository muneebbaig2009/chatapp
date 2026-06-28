// Notification sounds synthesized with the Web Audio API — no audio asset
// files needed. Browsers block audio until the user interacts with the
// page at least once, so we eagerly create (and try to resume) the
// AudioContext on the first click/keydown to minimize the chance the very
// first notification sound gets silently swallowed.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    try {
      getAudioContext();
    } catch {
      // Web Audio unavailable — sounds just won't play.
    }
    window.removeEventListener("click", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("click", unlock);
  window.addEventListener("keydown", unlock);
}

function beep(frequency: number, durationMs: number, startDelaySec = 0, volume = 0.2) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const startTime = ctx.currentTime + startDelaySec;
  const endTime = startTime + durationMs / 1000;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
  oscillator.start(startTime);
  oscillator.stop(endTime);
}

// Two-note "ding" for an incoming chat message.
export function playMessageSound() {
  try {
    beep(880, 120, 0, 0.15);
    beep(1100, 140, 0.12, 0.15);
  } catch {
    // Ignore — e.g. blocked by autoplay policy before any user interaction.
  }
}

let ringTimer: ReturnType<typeof setInterval> | null = null;

function ringOnce() {
  try {
    beep(740, 350, 0, 0.18);
    beep(950, 350, 0.4, 0.18);
  } catch {
    // Ignore.
  }
}

// Loops a two-tone ring until stopRingSound() is called — used for both an
// incoming call and the caller's own ringback while waiting for pickup.
export function startRingSound() {
  if (ringTimer) return; // already ringing
  ringOnce();
  ringTimer = setInterval(ringOnce, 1800);
}

export function stopRingSound() {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
}
