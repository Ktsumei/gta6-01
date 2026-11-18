// Synthesised sound only: every effect is an oscillator or a burst of filtered noise,
// so the game ships no audio files. The engine hum and the siren are loops whose pitch
// follows the game; everything else is a one-shot. Nothing plays until the player has
// pressed something once (browsers block audio before a gesture), and M mutes it all.

export function createAudio() {
  let context = null;
  let muted = false;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(frequency, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + duration + 0.02);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  function noise(duration, volume, filterFrequency) {
    if (!ensure() || muted) return;
    try {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFrequency;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    /** Call on the first user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    gunshot() {
      noise(0.14, 0.5, 2600);
    },
    enemyShot() {
      noise(0.12, 0.25, 1800);
    },
    punch() {
      noise(0.08, 0.35, 900);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.3, 990);
    },
    cash() {
      blip(880, 0.1, 'sine', 0.3, 1320);
      setTimeout(() => blip(1174, 0.14, 'sine', 0.25, 1568), 90);
    },
    crash() {
      noise(0.25, 0.5, 700);
    },
    explosion() {
      noise(0.6, 0.7, 420);
      blip(70, 0.5, 'sine', 0.5, 38);
    },
    missionDone() {
      blip(523, 0.12, 'triangle', 0.3);
      setTimeout(() => blip(659, 0.12, 'triangle', 0.3), 110);
      setTimeout(() => blip(784, 0.2, 'triangle', 0.35), 220);
    },
    wantedUp() {
      blip(220, 0.18, 'square', 0.18, 165);
    },
    busted() {
      blip(392, 0.25, 'sawtooth', 0.25, 196);
    },
    /** Continuous loops, called every frame: engine pitch follows speed, siren wails near police. */
    update(dt, speed, policeNear) {
      if (!context) return;
      sirenTimer += dt;
      try {
        if (engineGain) engineGain.gain.value = muted ? 0 : Math.min(0.16, Math.abs(speed) / 540 * 0.16);
        if (engineOsc) engineOsc.frequency.value = 52 + Math.abs(speed) * 0.16;
        if (sirenGain) sirenGain.gain.value = muted || !policeNear ? 0 : 0.05;
        if (sirenOsc) sirenOsc.frequency.value = (Math.floor(sirenTimer * 2.4) % 2 === 0) ? 720 : 540;
      } catch {
        // Audio is decoration: never let it break the game.
      }
    },
  };
}
