import { useEffect, useRef } from 'react';

/**
 * useCrashAlarm — plays a wailing siren + vibration when crash is active.
 * Stops automatically when active becomes false or component unmounts.
 */
export function useCrashAlarm(active) {
  const ctxRef       = useRef(null);
  const oscRef       = useRef(null);
  const lfoRef       = useRef(null);
  const vibrateRef   = useRef(null);

  useEffect(() => {
    if (active) {
      startAlarm();
    } else {
      stopAlarm();
    }
    return () => stopAlarm();
  }, [active]);

  function startAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;

      if (ctx.state === 'suspended') {
        const resumeAudio = () => {
          if (ctxRef.current) ctxRef.current.resume();
          document.removeEventListener('click', resumeAudio);
        };
        document.addEventListener('click', resumeAudio);
      }

      // ── Main siren oscillator ──────────────────────────
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';          // harsh, alarming tone
      osc.frequency.value = 660;
      gain.gain.value = 0.35;
      osc.connect(gain);
      gain.connect(ctx.destination);

      // ── LFO: sweeps frequency up+down like a real siren ─
      const lfo     = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 1.5;      // 1.5 sweeps per second
      lfoGain.gain.value = 220;       // ±220 Hz sweep range (440→880)
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency); // modulate the siren pitch

      osc.start();
      lfo.start();
      oscRef.current = osc;
      lfoRef.current = lfo;
    } catch (e) {
      console.warn('[Alarm] Web Audio API not available:', e.message);
    }

    // ── Vibration (mobile) ─────────────────────────────────
    if (navigator.vibrate) {
      const pattern = () => navigator.vibrate([400, 150, 400, 150, 800]);
      pattern();
      vibrateRef.current = setInterval(pattern, 1800);
    }
  }

  function stopAlarm() {
    try { oscRef.current?.stop(); }  catch (_) {}
    try { lfoRef.current?.stop(); }  catch (_) {}
    try { ctxRef.current?.close(); } catch (_) {}
    oscRef.current = null;
    lfoRef.current = null;
    ctxRef.current = null;

    if (vibrateRef.current) clearInterval(vibrateRef.current);
    if (navigator.vibrate) navigator.vibrate(0);
  }
}
