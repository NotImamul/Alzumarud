"use strict";

/* =========================================================
   AudioManager — a small, dependency-free Web Audio system.

   Everything here is synthesized procedurally with oscillators,
   filters, and a generated noise buffer — there are no external
   .mp3/.wav files to load or ship. If you ever want to layer in
   real recordings later, the graph is standard Web Audio, so a
   sample player would slot in next to _playPad()/playFootstep()
   without disturbing anything else.

   Every tunable value (frequencies, timings, volumes) lives in
   AUDIO_CONFIG below. Nothing else in this file should need to
   change for basic tweaking.
   ========================================================= */

const AUDIO_CONFIG = {
  // ---- master ----
  musicVolume: 0.35,
  sfxVolume: 0.55,

  // ---- ambient pads ----
  padMinInterval: 10,   // seconds between pad chords, minimum
  padMaxInterval: 20,   // seconds between pad chords, maximum
  padAttack: 2.5,        // seconds to fade a chord in
  padHold: 3,             // seconds to hold near peak volume
  padRelease: 5,          // seconds to fade a chord out
  padGain: 0.05,          // peak gain per oscillator voice (chords stack, so this stays low)
  padFilterFreq: 900,     // low-pass cutoff — keeps the pads soft and warm, never harsh
  padChords: [
    // peaceful triads/quads, in Hz — C major / A minor / F major family
    [261.63, 329.63, 392.0],           // C major  (C4 E4 G4)
    [220.0, 261.63, 329.63],           // A minor  (A3 C4 E4)
    [174.61, 220.0, 261.63],           // F major  (F3 A3 C4)
    [196.0, 246.94, 293.66],           // G major-ish, still diatonic-friendly
    [220.0, 261.63, 329.63, 392.0],    // A minor add — slightly fuller voicing
  ],

  // ---- wind ----
  windBaseGain: 0.05,
  windGustDepth: 0.03,    // how much the gain swells during a gust
  windGustSpeed: 0.06,    // Hz — how fast gusts drift in and out
  windFilterFreq: 500,
  windFilterQ: 0.7,

  // ---- footsteps ----
  footstepBaseGain: 0.18,
  footstepPitchJitter: 0.15, // +/- random pitch variance, as a fraction

  // ---- proximity shimmer ----
  shimmerFreq: 880,          // base pitch, Hz
  shimmerMaxDistance: 260,   // px beyond which the shimmer is silent
  shimmerMaxGain: 0.12,
  shimmerPitchRise: 90,      // Hz added at the closest range
  shimmerSmoothing: 0.08,    // seconds — how fast gain/pitch ramps catch up to a new distance
};

class AudioManager {
  constructor(config = AUDIO_CONFIG) {
    this.cfg = config;

    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;

    this.muted = false;
    this._unlocked = false;

    this._padTimer = null;
    this._windNodes = null;   // { source, filter, gainNode, lfo }
    this._shimmer = null;     // { osc, gain } — persistent, always running once created
    this._noiseBufferCache = null;
  }

  /* ---------------------------------------------------------
     Setup / lifecycle
     --------------------------------------------------------- */

  // Call this from inside a real user-gesture handler (click/keydown).
  // Browsers refuse to start audio before one, so this is what actually
  // creates the AudioContext. Safe to call repeatedly — only does
  // anything the first time.
  unlock() {
    if (this._unlocked) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // no Web Audio support in this browser — fail silently, game still works

    this.ctx = new Ctx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.cfg.musicVolume;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.cfg.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this._unlocked = true;
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  // Starts the continuous ambient layer: wind + the recurring pad
  // scheduler. Call this once gameplay actually begins. Safe to call
  // more than once — it won't double-start either layer.
  start() {
    if (!this._unlocked) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (!this._windNodes) this._startWind();
    if (!this._padTimer) this._scheduleNextPad(2); // first pad arrives a little sooner than usual
  }

  // Stops the wind and pad scheduler (e.g. when leaving to the menu).
  // One-shot sounds (footsteps, jumps, etc.) are unaffected — they're
  // fire-and-forget and always clean up after themselves regardless.
  stop() {
    if (this._padTimer) {
      clearTimeout(this._padTimer);
      this._padTimer = null;
    }
    if (this._windNodes) {
      const nodes = this._windNodes;
      this._windNodes = null;
      this._rampGain(nodes.gainNode.gain, 0, 0.6);
      setTimeout(() => {
        try { nodes.source.stop(); } catch (e) { /* already stopped */ }
        try { nodes.lfo.stop(); } catch (e) { /* already stopped */ }
      }, 700);
    }
    if (this._shimmer) {
      this._rampGain(this._shimmer.gain.gain, 0, 0.3);
    }
  }

  /* ---------------------------------------------------------
     Volume controls
     --------------------------------------------------------- */

  setMusicVolume(v) {
    this.cfg.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this._rampGain(this.musicGain.gain, this.cfg.musicVolume, 0.15);
  }

  setSFXVolume(v) {
    this.cfg.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this._rampGain(this.sfxGain.gain, this.cfg.sfxVolume, 0.15);
  }

  // Returns the new muted state, handy for updating a mute-button icon
  // in one line: `btn.textContent = audio.toggleMute() ? "muted" : "on"`.
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) this._rampGain(this.masterGain.gain, muted ? 0 : 1, 0.15);
  }

  /* ---------------------------------------------------------
     Internal helpers
     --------------------------------------------------------- */

  // Smoothly ramps an AudioParam instead of snapping it — this is what
  // keeps every transition (pads, wind, mute) click- and pop-free.
  _rampGain(param, target, duration) {
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + duration);
  }

  // A short loop of white noise, generated once and reused by both the
  // wind layer and the footstep synth (each plays it back differently —
  // looped and filtered for wind, a single short filtered burst for a step).
  _getNoiseBuffer() {
    if (this._noiseBufferCache) return this._noiseBufferCache;
    const length = this.ctx.sampleRate * 2; // 2 seconds, loops cleanly enough at this length
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBufferCache = buffer;
    return buffer;
  }

  /* ---------------------------------------------------------
     Ambient synth pads
     --------------------------------------------------------- */

  _scheduleNextPad(forceDelay) {
    const { padMinInterval, padMaxInterval } = this.cfg;
    const delay =
      forceDelay != null ? forceDelay : padMinInterval + Math.random() * (padMaxInterval - padMinInterval);
    this._padTimer = setTimeout(() => {
      this._playPad();
      this._scheduleNextPad();
    }, delay * 1000);
  }

  _playPad() {
    if (!this._unlocked) return;
    const { padChords, padAttack, padHold, padRelease, padGain, padFilterFreq } = this.cfg;
    const chord = padChords[Math.floor(Math.random() * padChords.length)];
    const now = this.ctx.currentTime;
    const totalDur = padAttack + padHold + padRelease;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = padFilterFreq;
    filter.Q.value = 0.4;

    const chordGain = this.ctx.createGain();
    chordGain.gain.setValueAtTime(0.0001, now);
    chordGain.connect(filter);
    filter.connect(this.musicGain);

    // gentle attack -> hold -> release envelope, ramped rather than
    // stepped so nothing pops or clicks in or out of silence
    chordGain.gain.linearRampToValueAtTime(padGain, now + padAttack);
    chordGain.gain.setValueAtTime(padGain, now + padAttack + padHold);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);

    chord.forEach((freq) => {
      // two slightly detuned voices per note for a warm, chorused pad
      [-1, 1].forEach((sign) => {
        const osc = this.ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq * (1 + sign * 0.003);
        osc.detune.value = (Math.random() - 0.5) * 6;
        osc.connect(chordGain);
        osc.start(now);
        osc.stop(now + totalDur + 0.5);
      });
    });
  }

  /* ---------------------------------------------------------
     Wind
     --------------------------------------------------------- */

  _startWind() {
    const { windBaseGain, windFilterFreq, windFilterQ, windGustSpeed, windGustDepth } = this.cfg;
    const now = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this._getNoiseBuffer();
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = windFilterFreq;
    filter.Q.value = windFilterQ;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(windBaseGain, now + 3); // fade wind in gently rather than snapping to full volume

    // a slow LFO nudges the gain up and down so it reads as gusts
    // drifting through rather than a static hiss
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = windGustSpeed;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = windGustDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);
    lfo.start(now);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxGain);
    source.start(now);

    this._windNodes = { source, filter, gainNode, lfo };
  }

  /* ---------------------------------------------------------
     Footsteps & movement
     --------------------------------------------------------- */

  // variant: "walk" | "sprint" | "land" — anything else falls back to "walk"
  playFootstep(variant = "walk") {
    if (!this._unlocked) return;
    const now = this.ctx.currentTime;
    const { footstepBaseGain, footstepPitchJitter } = this.cfg;

    const jitter = 1 + (Math.random() * 2 - 1) * footstepPitchJitter;
    let pitchMul = jitter;
    let gainMul = 1;
    let dur = 0.09;

    if (variant === "sprint") { pitchMul *= 1.15; gainMul = 1.15; dur = 0.07; }
    if (variant === "land") { pitchMul *= 0.85; gainMul = 1.3; dur = 0.12; }

    // a short filtered noise "tick" reads as a soft footstep transient —
    // no drum samples needed, just noise shaped through a narrow filter
    const source = this.ctx.createBufferSource();
    source.buffer = this._getNoiseBuffer();
    source.playbackRate.value = pitchMul;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900 * pitchMul;
    filter.Q.value = 1.1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(footstepBaseGain * gainMul, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
    source.stop(now + dur + 0.05);
  }

  // pitch-swept blips for the airborne movement moments — same small
  // synth, different sweep direction/timbre for each
  playJump() { this._playTone({ from: 440, to: 660, dur: 0.18, type: "sine", gain: 0.16 }); }
  playDoubleJump() { this._playTone({ from: 550, to: 880, dur: 0.22, type: "triangle", gain: 0.18 }); }
  playDive() { this._playTone({ from: 300, to: 120, dur: 0.3, type: "sawtooth", gain: 0.1, lowpass: 800 }); }
  playLand() { this.playFootstep("land"); }

  _playTone({ from, to, dur, type, gain, lowpass }) {
    if (!this._unlocked) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    let lastNode = osc;
    if (lowpass) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = lowpass;
      osc.connect(filter);
      lastNode = filter;
    }
    lastNode.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  /* ---------------------------------------------------------
     Proximity shimmer
     --------------------------------------------------------- */

  // Call every frame (or whenever convenient) with the player's distance
  // to the nearest glowing item. Beyond shimmerMaxDistance it's silent;
  // closer distances raise both the shimmer's volume and its pitch.
  // The oscillator is created once on first call and just re-targeted
  // after that, so this is cheap to call continuously.
  updateProximityAudio(distance) {
    if (!this._unlocked) return;
    const { shimmerFreq, shimmerMaxDistance, shimmerMaxGain, shimmerPitchRise, shimmerSmoothing } = this.cfg;

    if (!this._shimmer) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = shimmerFreq;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      this._shimmer = { osc, gain };
    }

    const closeness = 1 - Math.min(1, Math.max(0, distance / shimmerMaxDistance));
    const targetGain = closeness * closeness * shimmerMaxGain; // eased so it swells noticeably only once you're actually near
    const targetFreq = shimmerFreq + closeness * shimmerPitchRise;

    const now = this.ctx.currentTime;
    this._shimmer.gain.gain.linearRampToValueAtTime(targetGain, now + shimmerSmoothing);
    this._shimmer.osc.frequency.linearRampToValueAtTime(targetFreq, now + shimmerSmoothing);
  }
}

// Exposed as a global — this file is loaded with a plain <script> tag
// (same as script.js), no bundler or module system involved.
window.AudioManager = AudioManager;
