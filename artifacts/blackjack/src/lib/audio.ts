const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

export const sounds = {
  chip: () => playTone(800, 'sine', 0.1, 0.05),
  card: () => playTone(200, 'triangle', 0.1, 0.05),
  win: () => {
    playTone(400, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(600, 'sine', 0.2, 0.1), 100);
    setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 200);
  },
  bust: () => {
    playTone(150, 'sawtooth', 0.3, 0.1);
    setTimeout(() => playTone(100, 'sawtooth', 0.4, 0.1), 200);
  }
};
