// [Smoosic](https://github.com/AaronDavidNewman/Smoosic)
// Copyright (c) Aaron David Newman 2021.
// ## suiAudioPitch
// helper class to compute the frequencies of the notes.
// eslint-disable-next-line no-unused-vars
class suiAudioPitch {
  // ### _frequencies
  // Compute the equal-temperment frequencies of the notes.
  static get _frequencies() {
    const map = { };
    let lix = 0;
    const octaves = [1, 2, 3, 4, 5, 6, 7];
    const letters = ['cn', 'c#', 'dn', 'd#', 'en', 'fn', 'f#', 'gn', 'g#', 'an', 'a#', 'bn'];

    const just = Math.pow(2, (1.0 / 12));
    const baseFrequency = (440 / 16) * Math.pow(just, 3);

    octaves.forEach((octave) => {
      const oint = parseInt(octave, 10);
      const base = baseFrequency * Math.pow(2, oint - 1);
      lix = 0;
      letters.forEach((letter) => {
        const freq = base * Math.pow(just, lix);
        var enharmonics = smoMusic.getEnharmonics(letter);
        enharmonics.forEach((en) => {
          // Adjust for B4 higher than C4
          const adjOctave = (letter[0] === 'b' && en[0] === 'c') ?
            octave + 1 : octave;
          map[en + adjOctave.toString()] = freq;
        });
        lix += 1;
      });
    });

    return map;
  }

  static get pitchFrequencyMap() {
    suiAudioPitch._pmMap = typeof(suiAudioPitch._pmMap) === 'undefined' ? suiAudioPitch._frequencies : suiAudioPitch._pmMap;
    return suiAudioPitch._pmMap;
  }

  static _rawPitchToFrequency(smoPitch, offset) {
    const npitch = smoMusic.smoIntToPitch(smoMusic.smoPitchToInt(smoPitch) + offset);
    const vx = npitch.letter.toLowerCase() + npitch.accidental + npitch.octave.toString();
    return suiAudioPitch.pitchFrequencyMap[vx];
  }
  // ### smoPitchToFrequency
  // Convert a pitch to a frequency in Hz.
  static smoPitchToFrequency(smoPitch, ix, offset, tones) {
    let pitchInt = 0;
    let rv = suiAudioPitch._rawPitchToFrequency(smoPitch, offset);
    const mt = tones.filter((tt) => tt.pitch === ix);
    if (mt.length) {
      const tone = mt[0];
      const coeff = tone.toPitchCoeff;
      pitchInt = smoMusic.smoPitchToInt(smoPitch);
      pitchInt += (coeff > 0) ? 1 : -1;
      const otherSmo = smoMusic.smoIntToPitch(pitchInt);
      const otherPitch = suiAudioPitch._rawPitchToFrequency(otherSmo, offset);
      rv += Math.abs(rv - otherPitch) * coeff;
    }
    return rv;
  }
}

// eslint-disable-next-line no-unused-vars
class suiReverb {
  static get defaults() {
    return { length: 0.2, decay: 0.5 };
  }

  connect(destination) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }

  // credit: https://github.com/nick-thompson
  _buildImpulse() {
    let n = 0;
    let i = 0;
    if (suiReverb.impulse) {
      this.input.buffer = suiReverb.impulse;
      return;
    }

    const rate = this._context.sampleRate;
    const length = rate * this.length;
    const decay = this.decay;
    const impulse = this._context.createBuffer(2, length, rate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (i = 0; i < length; i++) {
      n = this.reverse ? length - i : i;
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    suiReverb.impulse = impulse;

    this.input.buffer = impulse;
  }

  constructor(context) {
    this.input = this.output = context.createConvolver();
    this.length = suiReverb.defaults.length;
    this.decay = suiReverb.defaults.decay;
    this._context = context;
    this._buildImpulse();
  }
}

// ## suiOscillator
// Simple waveform synthesizer thing that plays notes
// eslint-disable-next-line no-unused-vars
class suiOscillator {
  static get defaults() {
    const obj = {
      duration: 1000,
      frequency: 440,
      attackEnv: 0.05,
      decayEnv: 0.4,
      sustainEnv: 0.4,
      releaseEnv: 0.25,
      sustainLevel: 0.5,
      releaseLevel: 0.01,
      waveform: 'custom',
      gain: 0.2
    };

    const wavetable = {
      real: [0,
        0.3, 0.3, 0, 0, 0,
        0.1, 0, 0, 0, 0,
        0.05, 0, 0, 0, 0,
        0.01, 0, 0, 0, 0,
        0.01, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0],
      imaginary: [0,
        0, 0.05, 0, 0, 0,
        0, 0.01, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0]
    };
    obj.wavetable = wavetable;
    return obj;
  }

  static get sampleFiles() {
    return ['bb4', 'cn4'];
  }
  static get samples() {
    if (typeof(suiOscillator._samples) === 'undefined') {
      suiOscillator._samples = [];
    }
    return suiOscillator._samples;
  }
  static set samples(val) {
    suiOscillator._samples.push(val);
  }

  static playSelectionNow(selection, gain) {
    // In the midst of re-rendering...
    if (!selection.note) {
      return;
    }
    if (selection.note.isRest() || selection.note.isSlash()) {
      return;
    }
    setTimeout(() => {
      const ar = suiOscillator.fromNote(selection.measure, selection.note, true, gain);
      ar.forEach((osc) => {
        osc.play();
      });
    }, 1);
  }

  // ### fromNote
  // Create an areray of oscillators for each pitch in a note
  static fromNote(measure, note, isSample, gain) {
    let frequency = 0;
    let duration = 0;
    let i = 0;
    const tempo = measure.getTempo();

    const bpm = tempo.bpm;
    const beats = note.tickCount / 4096;
    duration = (beats / bpm) * 60000;

    // adjust if bpm is over something other than 1/4 note
    duration = duration * (4096 / tempo.beatDuration);
    if (isSample) {
      duration = 250;
    }

    const ar = [];
    gain = isNaN(gain) ?  0.2 : gain;
    gain = gain / note.pitches.length;
    if (note.noteType === 'r') {
      gain = 0.001;
    }
    i = 0;
    note.pitches.forEach((pitch) => {
      frequency = suiAudioPitch.smoPitchToFrequency(pitch, i, -1 * measure.transposeIndex, note.getMicrotones());
      const osc = new suiSampler({ frequency, duration, gain });
      // var osc = new suiSampler({frequency:frequency,duration:duration,gain:gain});
      ar.push(osc);
      i += 1;
    });

    return ar;
  }

  static get attributes() {
    return ['duration', 'frequency', 'pitch', 'attackEnv', 'sustainEnv', 'decayEnv',
      'releaseEnv', 'sustainLevel', 'releaseLevel', 'waveform', 'wavetable', 'gain'];
  }

  static samplePromise() {
    const rv = new Promise((resolve) => {
      const checkSample = () => {
        setTimeout(() => {
          if (suiOscillator.samples.length < suiOscillator.sampleFiles.length) {
            checkSample();
          } else {
            resolve();
          }
        });
      };
      checkSample();
    }, 100);
    if (suiOscillator.samples.length < suiOscillator.sampleFiles.length) {
      suiOscillator.sampleFiles.forEach((file) => {
        const audio = suiOscillator.audio;
        const media = audio.createMediaElementSource(document.getElementById('sample' + file));
        const req = new XMLHttpRequest();
        req.open('GET', media.mediaElement.src, true);
        req.responseType = 'arraybuffer';
        req.send();
        req.onload = () => {
          const audioData = req.response;
          audio.decodeAudioData(audioData, (decoded) => {
            suiOscillator.samples.push({ sample: decoded, frequency: suiAudioPitch._frequencies[file] });
          });
        };
      });
    }
    return rv;
  }
  static sampleForFrequency(f) {
    let min = 9999;
    let rv = {};
    let i = 0;
    for (i = 0; i < suiOscillator.samples.length; ++i) {
      const sample = suiOscillator.samples[i];
      if (Math.abs(f - sample.frequency) < min) {
        min = Math.abs(f - sample.frequency);
        rv = sample;
      }
    }
    return rv;
  }

  static get audio() {
    if (typeof (suiOscillator._audio) === 'undefined') {
      suiOscillator._audio = new AudioContext();
    }
    return suiOscillator._audio;
  }

  _playPromise(osc, duration, gain) {
    const audio = suiOscillator.audio;
    const promise = new Promise((resolve) => {
      osc.start(0);

      setTimeout(() => {
        resolve();
      }, duration);

      setTimeout(() => {
        osc.stop(0);
        osc.disconnect(gain);
        gain.disconnect(audio.destination);
      }, duration + 500);
    });
    return promise;
  }

  static toFloatArray(ar) {
    const rv = new Float32Array(ar.length);
    let i = 0;
    for (i = 0; i < ar.length; ++i) {
      rv[i] = ar[i];
    }

    return rv;
  }
  // ### play
  // play the audio oscillator for the specified duration.  Return a promise that
  // resolves after the duration.  Also dispose of the audio resources after the play is complete.
  play() {
    const audio = suiOscillator.audio;
    const gain = audio.createGain();
    const osc = audio.createOscillator();

    gain.connect(this.reverb.input);

    this.reverb.connect(audio.destination);
    const attack = this.attack / 1000;
    const decay = this.decay / 1000;
    const sustain = this.sustain / 1000;
    const release = this.release / 1000;
    gain.gain.exponentialRampToValueAtTime(this.gain, audio.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(this.sustainLevel * this.gain, audio.currentTime + attack + decay);
    gain.gain.exponentialRampToValueAtTime(this.releaseLevel * this.gain, audio.currentTime + attack + decay + sustain);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + attack + decay + sustain + release);
    if (this.waveform !== 'custom') {
      osc.type = this.waveform;
    } else {
      const wave = audio.createPeriodicWave(suiOscillator.toFloatArray(this.wavetable.real),
        suiOscillator.toFloatArray(this.wavetable.imaginary),
        { disableNormalization: false });
      osc.setPeriodicWave(wave);
    }
    osc.frequency.value = this.frequency;
    osc.connect(gain);
    gain.connect(audio.destination);
    return this._playPromise(osc, this.duration, gain);
  }

  constructor(parameters) {
    smoSerialize.serializedMerge(suiOscillator.attributes, suiOscillator.defaults, this);
    smoSerialize.serializedMerge(suiOscillator.attributes, parameters, this);
    this.reverb = new suiReverb(suiOscillator.audio);
    this.attack = this.attackEnv * this.duration;
    this.decay = this.decayEnv * this.duration;
    this.sustain = this.sustainEnv * this.duration;
    this.release = this.releaseEnv * this.duration;
    // this.frequency = this.frequency / 2;  // Overtones below partial

    if (parameters.waveform && parameters.waveform !== 'custom') {
      this.waveform = parameters.waveform;
    } else {
      this.waveform = 'custom';
    }
  }
}

// ## suiSampler
// Class that replaces oscillator with a sampler.  This is
// prototype code.  I'll get back to it.
// eslint-disable-next-line no-unused-vars
class suiSampler extends suiOscillator {
  play() {
    const self = this;
    suiOscillator.samplePromise().then(() => {
      self._play();
    });
  }
  _play() {
    const audio = suiOscillator.audio;
    const attack = this.attack / 1000;
    const decay = this.decay / 1000;
    const sustain = this.sustain / 1000;
    const release = this.release / 1000;
    const gain1 = audio.createGain();
    const gp1 = this.gain;
    // const gain2 = audio.createGain();
    // const delay = audio.createDelay(0.5);
    gain1.gain.exponentialRampToValueAtTime(gp1, audio.currentTime + attack);
    gain1.gain.exponentialRampToValueAtTime(this.sustainLevel * gp1, audio.currentTime + attack + decay);
    gain1.gain.exponentialRampToValueAtTime(this.releaseLevel * gp1, audio.currentTime + attack + decay + sustain);
    gain1.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + attack + decay + sustain + release);
    // gain2.gain.exponentialRampToValueAtTime(gp1, audio.currentTime + attack);
    // gain2.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + attack + decay + sustain + release);
    const osc = audio.createBufferSource();
    const sample = suiOscillator.sampleForFrequency(this.frequency);
    osc.buffer = sample.sample;
    const cents = 1200 * (Math.log(this.frequency / sample.frequency))
      / Math.log(2);

    osc.detune.value = cents;
    osc.connect(gain1);
    // osc.connect(this.reverb.input);
    // this.reverb.connect(delay);
    // osc.connect(gain);
    // delay.connect(gain2);
    gain1.connect(audio.destination);
    // gain2.connect(audio.destination);
    return this._playPromise(osc, this.duration);
  }

  _playPromise(osc, duration) {
    const promise = new Promise((resolve) => {
      osc.start(0);
      setTimeout(() => {
        resolve();
      }, duration);
      setTimeout(() => {
        osc.stop(0);
      }, duration + 500);
    });
    return promise;
  }
}
