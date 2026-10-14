import { Platform, Vibration } from 'react-native';

/**
 * Generates an executive dual-tone acoustic notification chime.
 * Uses Web Audio API on web/PWA and haptic vibration on native devices.
 */
class SoundService {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = true;
  }

  getAudioContext() {
    if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }
    return null;
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled);
  }

  isSoundEnabled() {
    return this.soundEnabled;
  }

  /**
   * Plays a pleasant, professional dual-bell chime (A5 880Hz -> D6 1174.66Hz)
   * with smooth exponential volume decay for grievance alerts.
   */
  playAlertChime() {
    if (!this.soundEnabled) return;

    try {
      // 1. Device Haptic Vibration Pulse
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 180, 80, 220]);
      }

      // 2. Web Audio API Chime Synthesizer
      if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // Tone 1: 880 Hz (A5 - High Clear Bell)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.exponentialRampToValueAtTime(920, now + 0.12);

        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.35);

        // Tone 2: 1174.66 Hz (D6 - Harmonious Chime)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1174.66, now + 0.12);
        osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.45);

        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.setValueAtTime(0.35, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(now + 0.12);
        osc2.stop(now + 0.65);
      }
    } catch (err) {
      console.log('Audio alert fallback notice:', err.message);
    }
  }
}

export const soundService = new SoundService();
export const playGrievanceAlertSound = () => soundService.playAlertChime();
export default soundService;
