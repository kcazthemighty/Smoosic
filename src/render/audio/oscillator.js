
var AudioContext = window.AudioContext || window.webkitAudioContext;

// ## suiAudioPitch
// helper class to compute the frequencies of the notes.
class suiAudioPitch {
    // ### _frequencies
    // Compute the equal-temperment frequencies of the notes.
    static get _frequencies() {
        var map={};
        var letter='a';
        const octaves=[1,2,3,4,5,6,7];
        const letters = ["cn","c#", "dn", "d#","en", "fn", "f#","gn","g#","an", "a#","bn"];
        const lindex = [0,1,2,3,4,5,6];

        const just = Math.pow(2,(1.0/12));
        const baseFrequency=(440/16) * Math.pow(just,3);

        var aaccum = baseFrequency;

        octaves.forEach((octave) => {
            var oint = parseInt(octave);
            var base = baseFrequency*Math.pow(2,oint);
            var lix = 0;
            letters.forEach((letter) => {
                var freq = base*Math.pow(just,lix);
                var enharmonics = smoMusic.getEnharmonics(letter);
                enharmonics.forEach((en) => {
                    map[en+octave.toString()] = freq;
                });
                lix += 1;
            });
        });

        return map;
    }

    static get pitchFrequencyMap() {
        suiAudioPitch._pmMap = typeof(suiAudioPitch['_pmMap']) == 'undefined' ? suiAudioPitch._frequencies : suiAudioPitch._pmMap;
        return suiAudioPitch._pmMap;
    }

    static smoPitchToFrequency(smoPitch) {
        var vx = smoPitch.letter.toLowerCase() + smoPitch.accidental + smoPitch.octave.toString();
        return suiAudioPitch.pitchFrequencyMap[vx];
    }
}

class suiAudioPlayer {
    static get playingMode() {
        return {
            note:0,fromStart:1,fromSelection:2,range:3
        }
    }
    static set playing(val) {
        suiAudioPlayer._playing = val;
    }

    static get instanceId() {
        if (typeof(suiAudioPlayer._instanceId) == 'undefined') {
            suiAudioPlayer._instanceId = 0;
        }
        return suiAudioPlayer._instanceId;
    }
    static incrementInstanceId() {
        var id = suiAudioPlayer.instanceId + 1;
        suiAudioPlayer._instanceId = id;
        return id;
    }
    static get playing() {
        if (typeof(suiAudioPlayer._playing) == 'undefined') {
            suiAudioPlayer._playing = false;
        }
        return suiAudioPlayer._playing;
    }

    static pausePlayer() {
        if (suiAudioPlayer._playingInstance) {
            var a = suiAudioPlayer._playingInstance;
            a.paused = true;
        }
        suiAudioPlayer.playing = false;
    }
    static stopPlayer() {
        if (suiAudioPlayer._playingInstance) {
            var a = suiAudioPlayer._playingInstance;
            a.paused = false;
        }
        suiAudioPlayer.playing = false;
    }

    static get playingInstance() {
        if (!suiAudioPlayer._playingInstance) {
            return null;
        }
        return suiAudioPlayer._playingInstance;
    }

    // the oscAr contains an oscillator for each pitch in the chord.
    // each inner oscillator is a promise, the combined promise is resolved when all
    // the beats have completed.
    static _playChord(oscAr) {
        var par = [];
        oscAr.forEach((osc) => {
            par.push(osc.play());
        });

        return Promise.all(par);
    }

    _createOscillatorsFromMusicData(ar) {
        var rv = [];
        ar.forEach((soundData) => {
            soundData.frequencies.forEach((frequency) => {
                var osc = new suiOscillator({frequency:frequency,duration:soundData.duration,gain:soundData.gain});
                rv.push(osc);
            });
        });
        return rv;
    }
    _playArrayRecurse(ix,keys,notesToPlay) {
        if (!suiAudioPlayer.playing ||
          suiAudioPlayer.instanceId != this.instanceId) {
              return;
          }
        var self = this;
        var key = keys[ix];
        var curTime = parseInt(key);
        var proto = notesToPlay[key];
        var oscs = this._createOscillatorsFromMusicData(proto);

        // Follow the top-staff note in this tick for the cursor
        if (proto[0].selector.staff == 0) {
            this.tracker.musicCursor(proto[0].selector.measure,proto[0].selector.tick);
        }
        if (ix < keys.length - 1) {
            var diff = parseInt(keys[ix+1]);
            var delay = (diff - curTime);
            setTimeout(function() {
                self._playArrayRecurse(ix+1,keys,notesToPlay);
            },delay);
        }
        suiAudioPlayer._playChord(oscs);
    }
    _playPlayArray() {
        var startTimes = Object.keys(this.sounds).sort((a,b) => {return a < b;});
        this._playArrayRecurse(0,startTimes,this.sounds);
    }
    _populatePlayArray() {
        var maxGain = 0.5/this.score.staves.length;
        this.sounds = {};
        this.score.staves.forEach((staff)  => {
            var accumulator = 0;
            for (var i = this.startIndex;i<staff.measures.length;++i) {
                var measure=staff.measures[i];
                var voiceIx = 0;
                measure.voices.forEach((voice) => {
                    var prevObj = null;
                    var tick = 0;
                    voice.notes.forEach((note) => {
                        var tempo = measure.getTempo();
                        tempo = tempo ? tempo : new SmoTempoText();
                        var bpm = tempo.bpm;
                        var beats = note.tickCount/4096;
                        var duration = (beats / bpm) * 60000;

                        // adjust if bpm is over something other than 1/4 note
                        duration = duration * (4096/tempo.beatDuration);
                        var frequencies = [];
                        var selector = {staff:measure.measureNumber.staffId,measure:measure.measureNumber.measureIndex,voice:voiceIx,tick:tick}
                        var slurs = staff.modifiers.filter((mod) => {
                            return SmoSelector.sameNote(mod.endSelector,selector);
                        });
                        if (slurs.length && prevObj) {
                            slurs = slurs.filter((slur) => {
                                return SmoSelector.sameNote(prevObj.selector,slur.startSelector);
                            });
                        } else {
                            slurs = [];
                        }

                        note.pitches.forEach((pitch) => {
                            var frequency = suiAudioPitch.smoPitchToFrequency(pitch);
                            if (slurs.length && prevObj.frequencies.indexOf(frequency) >= 0) {
                                prevObj.duration += duration;
                            } else {
                                frequencies.push(frequency);
                             }
                        });

                        if (frequencies.length && note.noteType == 'n') {
                            var obj = {
                                duration:duration,
                                frequencies:frequencies,
                                gain:maxGain/frequencies.length,
                                selector:selector,
                                note:note,
                                measure:measure,
                                staff:staff
                            };
                            prevObj = obj;
                            if (this.sounds[accumulator]) {
                                this.sounds[accumulator].push(obj);
                            } else {
                                this.sounds[accumulator]=[obj];
                            }
                        }
                        accumulator += Math.round(duration);
                        tick += 1;
                    });
                    voiceIx += 1;
                });
            }
        });
    }

    play() {
        if (suiAudioPlayer.playing) {
            return;
        }
        suiAudioPlayer._playingInstance = this;
        this._populatePlayArray();
        suiAudioPlayer.playing = true;
        this._playPlayArray();
    }

    constructor(parameters) {
        this.instanceId = suiAudioPlayer.incrementInstanceId();
        suiAudioPlayer.playing=false;
        this.paused = false;
        this.startIndex = parameters.startIndex;
        this.playIndex = 0;
        this.tracker = parameters.tracker;
        this.score = parameters.score;
        this._populatePlayArray();
    }
}

class suiReverb {
    static get defaults() {
        return {length:0.5,
        decay:2.0 };
    }

    connect(destination) {
        this.output.connect(destination);
    }

    disconnect() {
        this.output.disconnect();
    }


    // credit: https://github.com/nick-thompson
    _buildImpulse() {
        if (suiReverb['impulse']) {
            this.input.buffer = suiReverb['impulse'];
            return;
        }

         var rate = this._context.sampleRate
           , length = rate * this.length
           , decay = this.decay
           , impulse = this._context.createBuffer(2, length, rate)
           , impulseL = impulse.getChannelData(0)
           , impulseR = impulse.getChannelData(1)
           , n, i;

         for (i = 0; i < length; i++) {
           n = this.reverse ? length - i : i;
           impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
           impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
         }
         suiReverb['impulse'] = impulse;

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
class suiOscillator {
    static get defaults() {

        var obj = {
            duration:1000,
            frequency:440,
            attackEnv:0.05,
            decayEnv:0.4,
            sustainEnv:0.65,
            releaseEnv:0.1,
            sustainLevel:0.4,
            releaseLevel:0.1,
            waveform:'triangle',
            gain:0.3
        };

        var wavetable = {
            real:[0,
                0.3,0,0,0,0,
                0.1,0,0,0,0,
                0.05,0,0,0,0,
                0.01,0,0,0,0,
                0.01,0,0,0,0,
                0,0,0,0,0,
                0,0],
            imaginary:[0,
                0,0,0,0,0,
                0,0.01,0,0,0,
                0,0,0,0,0,
                0,0,0,0,0,
                0,0,0,0,0,
                0,0,0,0,0,
                0,0]
        }
        obj.wavetable = wavetable;
        return obj;
    }

    static playSelectionNow(selection,gain) {
        // In the midst of re-rendering...
        if (!selection.note) {
            return;
        }
        setTimeout(function() {
        var ar = suiOscillator.fromNote(selection.measure,selection.note,true,gain);
        ar.forEach((osc) => {
            osc.play();
        });
        },1);
    }

    // AR contains an array of arrays of oscillators.
    // The outer array contains an array for each tick/note in a measure.
    // the inner array contains an oscillator for each note in the chord.
    static playOscillatorArray(ar) {
        function playIx(ix,oscAr) {
            var par = [];
            oscAr.forEach((osc) => {
                par.push(osc.play());
            });
            ix += 1;
            Promise.all(par).then(() => {
                if (ix < ar.length) {
                    playIx(ix,ar[ix]);
                }
            });
        }
        playIx(0,ar[0]);
    }

    static fromNote(measure,note,isSample,gain) {
        var tempo = measure.getTempo();
        tempo = tempo ? tempo : new SmoTempoText();
        var bpm = tempo.bpm;
        var beats = note.tickCount/4096;
        var duration = (beats / bpm) * 60000;

        // adjust if bpm is over something other than 1/4 note
        duration = duration * (4096/tempo.beatDuration);
        if (isSample)
            duration = 250;


        var ar = [];
        gain = gain ? gain : 0.5;
        gain = gain/note.pitches.length
        if (note.noteType == 'r') {
            gain = 0.001;
        }
        note.pitches.forEach((pitch) => {
            var frequency = suiAudioPitch.smoPitchToFrequency(pitch);
            var osc = new suiOscillator({frequency:frequency,duration:duration,gain:gain});
            ar.push(osc);
        });

        return ar;
    }

    static get attributes() {
        return ['duration','frequency','pitch','attackEnv','sustainEnv','decayEnv','releaseEnv','sustainLevel','releaseLevel','waveform','wavetable','gain'];
    }

    static get audio() {
        if (typeof (suiOscillator['_audio']) == 'undefined') {
            suiOscillator._audio = new AudioContext();
        }
        return suiOscillator._audio;
    }

    _playPromise(osc,duration,gain) {
        var audio = suiOscillator.audio;
        var promise = new Promise((resolve) => {
            osc.start(0);

            setTimeout(function() {
               // gain.gain.setTargetAtTime(0, audio.currentTime, 0.015);
                resolve();
            }, duration);


            setTimeout(function() {
               // gain.gain.setTargetAtTime(0, audio.currentTime, 0.015);
                osc.stop(0);
                osc.disconnect(gain);
                gain.disconnect(audio.destination);
            }, duration+500);
        });

        return promise;
    }

    static toFloatArray(ar) {
        var rv = new Float32Array(ar.length);
        for (var i=0;i<ar.length;++i) {
            rv[i] = ar[i];
        }

        return rv;
    }

    play() {

        var audio = suiOscillator.audio;
        var gain = audio.createGain();
        var osc = audio.createOscillator();

        gain.connect(this.reverb.input);
        this.reverb.connect(audio.destination);
        gain.gain.setValueAtTime(0, audio.currentTime);
        var attack = this.attack / 1000;
        var decay = this.decay/1000;
        var sustain = this.sustain/1000;
        var release = this.release/1000;
        gain.gain.exponentialRampToValueAtTime(this.gain, audio.currentTime + attack);
        gain.gain.exponentialRampToValueAtTime(this.sustainLevel*this.gain, audio.currentTime + attack + decay);
        gain.gain.exponentialRampToValueAtTime(this.releaseLevel*this.gain,audio.currentTime + attack + decay + sustain );
        gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime + attack + decay + sustain + release);
        if (this.waveform != 'custom') {
            osc.type = this.waveform;
        } else {
            var wave = audio.createPeriodicWave(suiOscillator.toFloatArray(this.wavetable.real), suiOscillator.toFloatArray(this.wavetable.imaginary),
               {disableNormalization: false});
            osc.setPeriodicWave(wave);
        }
        osc.frequency.value = this.frequency;
        osc.connect(gain);
        gain.connect(audio.destination);
        return this._playPromise(osc,this.duration,gain);
    }


    constructor(parameters) {
        parameters = parameters ? parameters : {};
		smoMusic.serializedMerge(suiOscillator.attributes, suiOscillator.defaults, this);
		smoMusic.serializedMerge(suiOscillator.attributes, parameters, this);
        this.reverb = new suiReverb(suiOscillator.audio);
        this.attack = this.attackEnv*this.duration;
        this.decay = this.decayEnv*this.duration;
        this.sustain = this.sustainEnv*this.duration;
        this.release = this.releaseEnv*this.duration;
        this.frequency = this.frequency/2;  // Overtones below partial

        // Note: having some trouble with FloatArray and wavetable on some browsers, so I'm not using it
        // use built-in instead
        if (parameters.waveform && parameters.waveform != 'custom') {
            this.waveform = parameters.waveform;
        } else {
            this.waveform='custom';
        }
    }
}
