
VF = Vex.Flow;
Vex.Xform = (typeof(Vex.Xform) == 'undefined' ? {}
	 : Vex.Xform);
VX = Vex.Xform;

// ## smoMusic
// Helper functions that build on the VX music theory routines, and other
// utilities I wish were in VF.Music but aren't
// ### Note on pitch and duration format
// We use some VEX music theory routines and frequently need to convert
// formats from SMO format.
//
// `Smo` uses pitch JSON:
// ``javascript``
//  {note:'c',accidental:'#',octave:4}
// `Vex` usually uses a canonical string:
//  'c#/4'
//  Depending on the operation, the octave might be omitted
//
// `Smo` uses a JSON for duration always:
// ``javascript``
// {numerator:4096,denominator:1,remainder:0}
//
// `VexFlow` uses a letter duration ('4' for 1/4 note) and 'd' for dot.
// I try to indicate whether I am using vex or smo notation
// ## smoMusic static methods:
// ---
class smoMusic {

	// ### vexToCannonical
	// return Vex canonical note enharmonic - e.g. Bb to A#
	// Get the canonical form
	static vexToCannonical(vexKey) {
		vexKey = smoMusic.stripVexOctave(vexKey);
		return VF.Music.canonical_notes[VF.Music.noteValues[vexKey].int_val];
	}

	// ### circleOfFifths
	// A note array in key-signature order
	static get circleOfFifths() {
		return [{
				letter: 'c',
				accidental: 'n'
			}, {
				letter: 'g',
				accidental: 'n'
			}, {
				letter: 'd',
				accidental: 'n'
			}, {
				letter: 'a',
				accidental: 'n'
			}, {
				letter: 'e',
				accidental: 'n'
			}, {
				letter: 'b',
				accidental: 'n'
			}, {
				letter: 'f',
				accidental: '#'
			}, {
				letter: 'c',
				accidental: '#'
			}, {
				letter: 'a',
				accidental: 'b'
			}, {
				letter: 'e',
				accidental: 'b'
			}, {
				letter: 'b',
				accidental: 'b'
			}, {
				letter: 'f',
				accidental: 'n'
			}
		];
	}

	// ### circleOfFifthsIndex
	// gives the index into circle-of-fifths array for a pitch, considering enharmonics.
	static circleOfFifthsIndex(smoPitch) {
		var en1 = smoMusic.vexToSmoPitch(smoMusic.getEnharmonic(smoMusic.pitchToVexKey(smoPitch)));
		var en2 = smoMusic.vexToSmoPitch(smoMusic.getEnharmonic(smoMusic.getEnharmonic(smoMusic.pitchToVexKey(smoPitch))));
		var ix = smoMusic.circleOfFifths.findIndex((el) => {
				return (el.letter === smoPitch.letter && el.accidental == smoPitch.accidental) ||
				(el.letter == en1.letter && el.accidental == en1.accidental) ||
				(el.letter == en2.letter && el.accidental == en2.accidental);
			});
		return ix;
	}

	// ### addSharp
	// Get pitch to the right in circle of fifths
	static addSharp(smoPitch) {
		var rv = smoMusic.circleOfFifths[
				(smoMusic.circleOfFifthsIndex(smoPitch) + 1) % smoMusic.circleOfFifths.length];
		rv = JSON.parse(JSON.stringify(rv));
		rv.octave = smoPitch.octave;
		return rv;
	}

	// ### addFlat
	// Get pitch to the left in circle of fifths
	static addFlat(smoPitch) {
		var rv = smoMusic.circleOfFifths[
				((smoMusic.circleOfFifths.length - 1) + smoMusic.circleOfFifthsIndex(smoPitch)) % smoMusic.circleOfFifths.length];
		rv = JSON.parse(JSON.stringify(rv));
		rv.octave = smoPitch.octave;
		return rv;
	}

	// ### addSharps
	// Add *distance* sharps/flats to given key
	static addSharps(smoPitch, distance) {
		if (distance == 0) {
			return JSON.parse(JSON.stringify(smoPitch));
		}
		var rv = smoMusic.addSharp(smoPitch);
		for (var i = 1; i < distance; ++i) {
			rv = smoMusic.addSharp(rv);
		}
		var octaveAdj = smoMusic.letterPitchIndex[smoPitch.letter] > smoMusic.letterPitchIndex[rv.letter] ? 1 : 0;
		rv.octave += octaveAdj;
		return rv;
	}

	// ### addFlats
	// Add *distance* sharps/flats to given key
	static addFlats(smoPitch, distance) {
		if (distance == 0) {
			return JSON.parse(JSON.stringify(smoPitch));
		}
		var rv = smoMusic.addFlat(smoPitch);
		for (var i = 1; i < distance; ++i) {
			rv = smoMusic.addFlat(rv);
		}
		var octaveAdj = smoMusic.letterPitchIndex[smoPitch.letter] > smoMusic.letterPitchIndex[rv.letter] ? 1 : 0;
		rv.octave += octaveAdj;
		return rv;
	}

	// ### smoPitchesToVexKeys
	// Transpose and convert from SMO to VEX format so we can use the VexFlow tables and methods
	static smoPitchesToVexKeys(pitchAr, keyOffset) {
		var noopFunc = keyOffset > 0 ? 'addSharps' : 'addFlats';

		var rv = [];
		pitchAr.forEach((pitch) => {
			rv.push(smoMusic.pitchToVexKey(smoMusic[noopFunc](pitch, keyOffset)));
		});
		return rv;
	}

	static get scaleIntervals() {
		return {
			up: [2, 2, 1, 2, 2, 2, 1],
			down: [1, 2, 2, 2, 1, 2, 2]
		};
	}

	// ### smoScalePitchMatch
	// return true if the pitches match, but maybe not in same octave
	static smoScalePitchMatch(p1, p2) {
		var pp1 = JSON.parse(JSON.stringify(p1));
		var pp2 = JSON.parse(JSON.stringify(p2));
		pp1.octave = 0;
		pp2.octave = 0;

		return smoMusic.smoPitchToInt(pp1) == smoMusic.smoPitchToInt(pp2);
	}

	static smoPitchToInt(pitch) {
		var intVal = VF.Music.noteValues[
				smoMusic.stripVexOctave(smoMusic.pitchToVexKey(pitch))].int_val;
		return pitch.octave * 12 + intVal;
	}

	static smoIntToPitch(intValue) {
		var letterInt = intValue % 12;
		var noteKey = Object.keys(VF.Music.noteValues).find((key) => {
				return VF.Music.noteValues[key].int_val === letterInt;
			});
		var octave = Math.floor(intValue / 12);
		return {
			letter: noteKey[0],
			accidental: noteKey.substring(1, noteKey.length),
			octave: octave
		};
	}

	// ### get enharmonics
	// return a map of enharmonics for choosing or cycling.  notes are in vexKey form.
	static get enharmonics() {
		var rv = {};
		var keys = Object.keys(VF.Music.noteValues);
		for (var i = 0; i < keys.length; ++i) {
			var key = keys[i];
			var int_val = VF.Music.noteValues[key].int_val;
			if (typeof(rv[int_val.toString()]) == 'undefined') {
				rv[int_val.toString()] = [];
			}
			// only consider natural note 1 time.  It is in the list twice for some reason.
			if (key.indexOf('n') == -1) {
				rv[int_val.toString()].push(key);
			}
		}
		return rv;
	}

	static getEnharmonics(vexKey) {
		var proto = smoMusic.stripVexOctave(vexKey);
		var rv = [];
		var ne = smoMusic.getEnharmonic(vexKey);
		rv.push(proto);
		while (ne[0] != proto[0]) {
			rv.push(ne);
			ne = smoMusic.getEnharmonic(ne);
		}
		return rv;
	}
	static closestTonic(smoPitch, vexKey, direction) {
		direction = Math.sign(direction) < 0 ? -1 : 1;
		var tonic = smoMusic.vexToSmoPitch(vexKey);
		tonic.octave=smoPitch.octave;
		var iix = smoMusic.smoPitchToInt(smoPitch);
		var smint=smoMusic.smoPitchToInt(tonic);
		if (Math.sign(smint - iix) != direction) {
			tonic.octave += direction
		}
		return tonic;
	}

	static getEnharmonicInKey(smoPitch, keySignature) {
		var ar = smoMusic.getEnharmonics(smoMusic.pitchToVexKey(smoPitch));
		var rv = smoMusic.stripVexOctave(smoMusic.pitchToVexKey(smoPitch));
		var scaleMap = new VF.Music().createScaleMap(keySignature);
		ar.forEach((vexKey) => {
			if (vexKey.length === 1) {
				vexKey += 'n';
			}
			if (vexKey === scaleMap[vexKey[0]]) {
				rv = vexKey;
			}
		});
		var smoRv = smoMusic.vexToSmoPitch(rv);
		smoRv.octave = smoPitch.octave;
		var rvi = smoMusic.smoPitchToInt(smoRv);
		var ori = smoMusic.smoPitchToInt(smoPitch);
		// handle the case of c0 < b0, pitch-wise
		smoRv.octave += Math.sign(ori - rvi);
		return smoRv;
	}
	
	// ### getIntervalInKey
	// give a pitch and a key signature, return another pitch at the given
	// diatonic interval.  Similar to getKeyOffset but diatonic.
	static getIntervalInKey(pitch, keySignature, interval) {
		if (interval === 0)
			return JSON.parse(JSON.stringify(pitch));

		var delta = interval > 0 ? 1 : -1;
		var inv = -1 * delta;
		var tonic = smoMusic.closestTonic(pitch, keySignature, inv);
		var intervals = delta > 0 ? smoMusic.scaleIntervals.up : smoMusic.scaleIntervals.down;
		var pitchInt = smoMusic.smoPitchToInt(pitch);
		var scaleIx = 0;
		var diatonicIx=0;

		var nkey = tonic;
		var nkeyInt = smoMusic.smoPitchToInt(nkey);
		while (Math.sign(nkeyInt - pitchInt) != delta && Math.sign(nkeyInt - pitchInt) != 0) {
			nkey = smoMusic.smoIntToPitch(smoMusic.smoPitchToInt(nkey) + delta * intervals[scaleIx]);
			scaleIx = (scaleIx + 1) % 7;
			nkeyInt = smoMusic.smoPitchToInt(nkey);
		}
		while (diatonicIx != interval) {
			nkey = smoMusic.smoIntToPitch(smoMusic.smoPitchToInt(nkey) + delta * intervals[scaleIx]);
			scaleIx = (scaleIx + 1) % 7;
			diatonicIx += delta;
		}
		return smoMusic.getEnharmonicInKey(nkey,keySignature);
	}

	static vexKeySignatureTranspose(key, transposeIndex) {
		var key = smoMusic.vexToSmoPitch(key);
		key = smoMusic.smoPitchesToVexKeys([key], transposeIndex)[0];
		key = smoMusic.stripVexOctave(key);
		key = key[0].toUpperCase() + key.substring(1, key.length);
		if (key.length > 1 && key[1] === 'n') {
			key = key[0];
		}
		return key;
	}

	// ### get letterPitchIndex
	// Used to adjust octave when transposing.
	// Pitches are measured from c, so that b0 is higher than c0, c1 is 1 note higher etc.
	static get letterPitchIndex() {
		return {
			'c': 0,
			'd': 1,
			'e': 2,
			'f': 3,
			'g': 4,
			'a': 5,
			'b': 6
		};
	}

	// ### letterChangedOctave
	// Indicate if a change from letter note 'one' to 'two' needs us to adjust the
	// octave due to the `smoMusic.letterPitchIndex` (b0 is higher than c0)
	static letterChangedOctave(one, two) {
		var p1 = smoMusic.letterPitchIndex[one];
		var p2 = smoMusic.letterPitchIndex[two];
		if (p1 < p2 && p2 - p1 > 2)
			return -1;
		if (p1 > p2 && p1 - p2 > 2)
			return 1;
		return 0;

	}

	// ### vexToSmoPitch
	// #### Example:
	// 'f#' => {letter:'f',accidental:'#'}
	static vexToSmoPitch(vexPitch) {
		var accidental = vexPitch.length < 2 ? 'n' : vexPitch.substring(1, vexPitch.length);
		return {
			letter: vexPitch[0].toLowerCase(),
			accidental: accidental
		};
	}

	static stripVexOctave(vexKey) {
		if (vexKey.indexOf('/') > 0) {
			vexKey = vexKey.substring(0, vexKey.indexOf('/'))
		}
		return vexKey;
	}

	// ### pitchToVexKey
	// convert from SMO to VEX format so we can use the VexFlow tables and methods
	// example:
	// 	`{letter,octave,accidental}` object to vexKey string `'f#'`
	static pitchToVexKey(smoPitch) {
		// Convert to vex keys, where f# is a string like 'f#'.
		var vexKey = smoPitch.letter.toLowerCase();
		if (smoPitch.accidental.length === 0) {
			vexKey = vexKey + 'n';
		} else {
			vexKey = vexKey + smoPitch.accidental;
		}
		if (smoPitch['octave']) {
			vexKey = vexKey + '/' + smoPitch.octave;
		}
		return vexKey;
	}

	// ### getKeyOffset
	// Given a vex noteProp and an offset, offset that number
	// of 1/2 steps.
	// #### Input:  smoPitch
	// #### Output:  smoPitch offset, not key-adjusted.
	static getKeyOffset(pitch, offset) {
		var canon = VF.Music.canonical_notes;

		// Convert to vex keys, where f# is a string like 'f#'.
		var vexKey = smoMusic.pitchToVexKey(pitch);
		vexKey = smoMusic.vexToCannonical(vexKey);
		var rootIndex = canon.indexOf(vexKey);
		var index = (rootIndex + canon.length + offset) % canon.length;
		var octave = pitch.octave;
		if (Math.abs(offset) >= 12) {
			var octaveOffset = Math.sign(offset) * Math.floor(Math.abs(offset) / 12);
			octave += octaveOffset;
			offset = offset % 12;
		}
		if (rootIndex + offset >= canon.length) {
			octave += 1;
		}
		if (rootIndex + offset < 0) {
			octave -= 1;
		}
		var rv = JSON.parse(JSON.stringify(pitch));
		vexKey = canon[index];
		if (vexKey.length > 1) {
			rv.accidental = vexKey.substring(1);
			vexKey = vexKey[0];
		} else {
			rv.accidental = '';
		}
		rv.letter = vexKey;
		rv.octave = octave;
		return rv;
	}

	// ### keySignatureLength
	// return the number of sharp/flat in a key signature for sizing guess.
	static get keySignatureLength() {
		return {
			'C': 0,
			'B': 5,
			'A': 3,
			'F#': 6,
			'Bb': 2,
			'Ab': 4,
			'Gg': 6,
			'G': 1,
			'F': 1,
			'Eb': 3,
			'Db': 5,
			'Cb': 7,
			'C#': 7,
			'F#': 6,
			'E': 4,
			'D': 2
		};
	}
	
	static getSharpsInKeySignature(key) {
		var sharpKeys = ['B','G','D','A','E','B','F#','C#'];
		if (sharpKeys.indexOf[key] < 0) {
			return 0;
		}
		return smoMusic.keySignatureLength[key];
	}

	static getFlatsInKeySignature(key) {
		var flatKeys = ['F','Bb','Eb','Ab','Db','Gb','Cb'];
		if (flatKeys.indexOf[key] < 0) {
			return 0;
		}
		return smoMusic.keySignatureLength[key];
	}
    
    static timeSignatureToTicks(timeSignature) {
        var nd = timeSignature.split('/');
        var num = parseInt(nd[0]);
        var den = parseInt(nd[1]);
        
        var base = 2048*(8/den);
        return base*num;
    }
    static smoTicksToVexDots(ticks) {
        var vd = smoMusic.ticksToDuration[ticks];
        var dots = (vd.match(/d/g) || []).length;
        return dots;
    }
	// ## closestVexDuration
	// ## Description:
	// return the closest vex duration >= to the actual number of ticks. Used in beaming
	// triplets which have fewer ticks then their stem would normally indicate.
	static closestVexDuration(ticks) {
		var stemTicks = VF.RESOLUTION;

		// The stem value is the type on the non-tuplet note, e.g. 1/8 note
		// for a triplet.
		while (ticks <= stemTicks) {
			stemTicks = stemTicks / 2;
		}

		stemTicks = stemTicks * 2;
		return smoMusic.ticksToDuration[stemTicks];
		var ix = Object.keys(smoMusic.ticksToDuration).findIndex((x) => {
				return x >= ticks
			});
		return smoMusic.ticksToDuration[durations[ix]];
	}

	// ### getKeySignatureKey
	// given a letter pitch (a,b,c etc.), and a key signature, return the actual note
	// that you get without accidentals
	// ### Usage:
	//   smoMusic.getKeySignatureKey('F','G'); // returns f#
	static getKeySignatureKey(letter, keySignature) {
		var km = new VF.KeyManager(keySignature);
		return km.scaleMap[letter];
	}

	// ### Description:
	// Get ticks for this note with an added dot.  Return
	// identity if that is not a supported value.
	static getNextDottedLevel(ticks) {
		var ttd = smoMusic.ticksToDuration;
		var vals = Object.values(ttd);

		var ix = vals.indexOf(ttd[ticks]);
		if (ix >= 0 && ix < vals.length && vals[ix][0] == vals[ix + 1][0]) {
			return smoMusic.durationToTicks(vals[ix + 1]);
		}
		return ticks;
	}

	// ### Description:
	// Get ticks for this note with one fewer dot.  Return
	// identity if that is not a supported value.
	static getPreviousDottedLevel(ticks) {
		var ttd = smoMusic.ticksToDuration;
		var vals = Object.values(ttd);
		var ix = vals.indexOf(ttd[ticks]);
		if (ix > 0 && vals[ix][0] == vals[ix - 1][0]) {
			return smoMusic.durationToTicks(vals[ix - 1]);
		}
		return ticks;
	}
    

	// ### ticksToDuration
	// Frequently we double/halve a note duration, and we want to find the vex tick duration that goes with that.
	static get ticksToDuration() {
		var durations = ["1/2", "1", "2", "4", "8", "16", "32", "64", "128", "256"];
		smoMusic._ticksToDuration = smoMusic['_ticksToDuration'] ? smoMusic._ticksToDuration : null;
		var _ticksToDurationsF = function () {
            var ticksToDuration = smoMusic._ticksToDuration = {};
			for (var i = 0; i < durations.length - 1; ++i) {
				var dots = '';
				var ticks = 0;

				// We support up to 4 'dots'
				for (var j = 0; j <= 4 && j + i < durations.length; ++j) {
					ticks += VF.durationToTicks.durations[durations[i + j]];
					ticksToDuration[ticks.toString()] = durations[i] + dots;
					dots += 'd'
				}
			}
			return ticksToDuration;
		}
        if (!smoMusic._ticksToDuration) {           
		   _ticksToDurationsF();
        }
		return smoMusic._ticksToDuration;
	};

	// ### durationToTicks
	// Uses VF.durationToTicks, but handles dots.
	static durationToTicks(duration) {
		var dots = duration.indexOf('d');
		if (dots < 0) {
			return VF.durationToTicks(duration);
		} else {
			var vfDuration = VF.durationToTicks(duration.substring(0, dots));
			dots = duration.length - dots; // number of dots
			var split = vfDuration / 2;
			for (var i = 0; i < dots; ++i) {
				vfDuration += split;
				split = split / 2;
			}

			return vfDuration;
		}
	}


	// ### getEnharmonic(noteProp)
	// cycle through the enharmonics for a note.
	static getEnharmonic(vexKey) {
		vexKey = smoMusic.stripVexOctave(vexKey);
		var intVal = VF.Music.noteValues[vexKey.toLowerCase()].int_val;
		var ar = smoMusic.enharmonics[intVal.toString()];
		var len = ar.length;
		// 'n' for natural in key but not in value
		vexKey = vexKey.length > 1 && vexKey[1] === 'n' ? vexKey[0] : vexKey;
		var ix = ar.indexOf(vexKey);
		vexKey = ar[(ix + 1) % len];
		return vexKey;
	}
	// ### getKeyFriendlyEnharmonic
	// fix the enharmonic to match the key, if possible
	// `getKeyFriendlyEnharmonic('b','eb');  => returns 'bb'
	static getKeyFriendlyEnharmonic(letter, keySignature) {
		var rv = letter;
		var muse = new VF.Music();
		var scale = Object.values(muse.createScaleMap(keySignature));
		var prop = smoMusic.getEnharmonic(letter.toLowerCase());
		while (prop.toLowerCase() != letter.toLowerCase()) {
			for (var i = 0; i < scale.length; ++i) {
				var skey = scale[i];
				if ((skey[0] == prop && skey[1] == 'n') ||
					(skey.toLowerCase() == prop.toLowerCase())) {
					rv = skey;
					break;
				}
			}
			prop = (prop[1] == 'n' ? prop[0] : prop);
			prop = smoMusic.getEnharmonic(prop);
		}
		return rv;
	}

	// ### filteredMerge
	// Like vexMerge, but only for specific attributes.
	static filteredMerge(attrs, src, dest) {
		attrs.forEach(function (attr) {
			if (typeof(src[attr]) != 'undefined') {
				dest[attr] = src[attr];
			}
		});
	}
	// ### serializedMerge
	// serialization-friendly, so merged, copied objects are deep-copied
	static serializedMerge(attrs, src, dest) {
		attrs.forEach(function (attr) {
			if (typeof(src[attr]) != 'undefined') {
				// copy the number 0
				if (typeof(src[attr]) === 'number' ||
					typeof(src[attr]) === 'boolean') {
					dest[attr] = src[attr];
					// copy the empty array
				} else if (Array.isArray(src[attr])) {
					dest[attr] = JSON.parse(JSON.stringify(src[attr]));
				} else {
					// but don't copy empty/null objects
					if (src[attr]) {
						if (typeof(src[attr]) == 'object') {
							dest[attr] = JSON.parse(JSON.stringify(src[attr]));
						} else {
							dest[attr] = src[attr];
						}
					}
				}
			}
		});
	}

	static stringifyAttrs(attrs, obj) {
		var rv = '';
		attrs.forEach((attr) => {
			if (obj[attr]) {
				rv += attr + ':' + obj[attr] + ', ';
			} else {
				rv += attr + ': null,';
			}
		});
		return rv;
	}
}
;

// ## svgHelpers
// Mostly utilities for converting coordinate spaces based on transforms, etc.
// ### static class methods:
// ---
class svgHelpers {
	// ### unionRect
	// grow the bounding box two objects to include both.
	static unionRect(b1, b2) {
		var x = Math.min(b1.x, b2.x);
		var y = Math.min(b1.y, b2.y);
		var width = Math.max(b1.x + b1.width, b2.x + b2.width) - x;
		var height = Math.max(b1.y + b1.height, b2.y + b2.height) - y;
		return {
			x: x,
			y: y,
			width: width,
			height: height
		};
	}

	static get namespace() {
		return "http://www.w3.org/2000/svg";
	}

	static buildSvg(el) {

		var smoSvgBuilder = function (el) {
			var ns = svgHelpers.namespace;
			this.e = document.createElementNS(ns, el);
			var self = this;
			this.classes = function (cl) {
				self.e.setAttributeNS('', 'class', cl);
				return self;
			}
			this.attr = function (name, value) {
				self.e.setAttributeNS('', name, value);
				return self;
			}
			
			this.text = function (x, y, classes, text) {
				x = typeof(x) == 'string' ? x : x.toString();
				y = typeof(y) == 'string' ? y : y.toString();
				this.e.setAttributeNS('', 'class', classes);
				this.e.setAttributeNS('', 'x', x);
				this.e.setAttributeNS('', 'y', y);
				
				this.e.textContent = text;
				return this;
			}
			this.rect = function (x, y, width, height, classes) {
				x = typeof(x) == 'string' ? x : x.toString();
				y = typeof(y) == 'string' ? y : y.toString();
				width = typeof(width) == 'string' ? width : width.toString();
				height = typeof(height) == 'string' ? height : height.toString();
				this.e.setAttributeNS('', 'x', x);
				this.e.setAttributeNS('', 'y', y);
				this.e.setAttributeNS('', 'width', width);
				this.e.setAttributeNS('', 'height', height);
				if (classes) {
					this.e.setAttributeNS('', 'class', classes);
				}
				return this;
			}
			this.line = function (x1, y1, x2, y2, classes) {
				x1 = typeof(x1) == 'string' ? x1 : x1.toString();
				y1 = typeof(y1) == 'string' ? y1 : y1.toString();
				x2 = typeof(x2) == 'string' ? x2 : x2.toString();
				y2 = typeof(y2) == 'string' ? y2 : y2.toString();

				this.e.setAttributeNS('', 'x1', x1);
				this.e.setAttributeNS('', 'y1', y1);
				this.e.setAttributeNS('', 'x2', x2);
				this.e.setAttributeNS('', 'y2', y2);
				if (classes) {
					this.e.setAttributeNS('', 'class', classes);
				}
				return this;
			}
			this.append = function (el) {
				self.e.appendChild(el.e);
				return self;
			}
			this.dom = function () {
				return self.e;
			}
			return this;
		}
		return new smoSvgBuilder(el);
	}
	
	// ### boxNote
	// update the note geometry based on current viewbox conditions.
	// This may not be the appropriate place for this...maybe in layout
	static updateArtifactBox(svg,element,artifact) {
		
		artifact.renderedBox = svgHelpers.smoBox(element.getBoundingClientRect());
		artifact.logicalBox = svgHelpers.clientToLogical(svg,
			artifact.renderedBox);
	}
    static rect(svg,box,attrs,classes) {
        var rect = document.createELementNS(svgHelpers.namespace,'rect');
        attrs.forEach((attr) => {
            var key = Object.keys(attr)[0];
            key = (key == 'strokewidth') ? 'stroke-width' : key;
            var val = attr[key];
            rect.setAttributeNS('', key, val);            
        });
        if (classes) {
            rect.setAttributeNS('','class',classes);
        }
        svg.appendChild(rect);
    }
    
    static textOutlineRect(svg,textElement, color, classes) {
        var box = textElement.getBBox();
        var attrs = [{width:box.width+5,height:box.height+5,stroke:color,strokewidth:'2',fill:'none',x:box.x-5,y:box.y-5}];
        svgHelpers.rect(svg,box,attrs,classes);
    }
	// ### getTextBox
	// Get the logical bounding box of the text for placement.
	static getTextBox(svg,attributes,classes,text) {
		var el = svgHelpers.placeSvgText(svg,attributes,classes,text);
		var box = el.getBBox();
		svg.removeChild(el);
		return box;
	}

	static debugBox(svg, box, classes, voffset) {
		voffset = voffset ? voffset : 0;
		classes = classes ? classes : '';
		classes += ' svg-debug-box';
		var b = svgHelpers.buildSvg;
		var mid = box.x + box.width / 2;
		var xtext = 'x1: ' + Math.round(box.x);
		var wtext = 'x2: ' + Math.round(box.width+box.x);
		var ytext = 'y1: ' + Math.round(box.y);
		var htext = 'y2: ' + Math.round(box.height+box.y);
		var ytextp = Math.round(box.y+box.height);
		var ytextp2 = Math.round(box.y+box.height-30);

		var r = b('g').classes(classes)
			.append(
				b('text').text(box.x + 20, box.y - 14+voffset, 'svg-debug-text', xtext))
			.append(
				b('text').text(mid - 20, box.y - 14+voffset, 'svg-debug-text', wtext))
			.append(
				b('line').line(box.x, box.y - 2, box.x + box.width, box.y - 2))
			.append(
				b('line').line(box.x, box.y - 8, box.x, box.y + 5))
			.append(
				b('line').line(box.x + box.width, box.y - 8, box.x + box.width, box.y + 5))
			.append(
				b('text').text(Math.round(box.x-14+voffset), ytextp, 'svg-vdebug-text', ytext)
				  .attr('transform','rotate(-90,'+Math.round(box.x-14+voffset)+','+ytextp+')'));
		if (box.height > 2) {
			r.append(
				b('text').text(Math.round(box.x-14+voffset), ytextp2, 'svg-vdebug-text', htext)
				  .attr('transform','rotate(-90,'+Math.round(box.x-14+voffset)+','+(ytextp2)+')'))
				  .append(
				b('line').line(Math.round(box.x-2), Math.round(box.y +box.height),box.x-2,box.y))
				  .append(
				b('line').line(Math.round(box.x-8), Math.round(box.y +box.height),box.x+6,Math.round(box.y+box.height)))
				  .append(
				b('line').line(Math.round(box.x-8), Math.round(box.y),Math.round(box.x+6),Math.round(box.y)));				  
		}
		svg.appendChild(r.dom());
	}
    
    static fontIntoToSvgAttributes(fontInfo) {
        var rv = [];
        var fkeys = Object.keys(fontInfo);
		fkeys.forEach((key) => {
			var n='{"font-'+key+'":"'+fontInfo[key]+'"}';
			rv.push(JSON.parse(n));
		});
        return rv;
    }
		
	static placeSvgText(svg,attributes,classes,text) {
		var ns = svgHelpers.namespace;
		var e = document.createElementNS(ns, 'text');
		attributes.forEach((attr) => {
			var key = Object.keys(attr)[0];
		    e.setAttributeNS('', key, attr[key]);
		})
		if (classes) {
			e.setAttributeNS('', 'class', classes);
		}
		e.textContent = text;
		svg.appendChild(e);	
		return e;
	}

	// ### findIntersectionArtifact
	// find all object that intersect with the rectangle
	static findIntersectingArtifact(clientBox, objects) {
		var box = svgHelpers.smoBox(clientBox); //svgHelpers.untransformSvgPoint(this.context.svg,clientBox);

		// box.y = box.y - this.renderElement.offsetTop;
		// box.x = box.x - this.renderElement.offsetLeft;
		var rv = [];
		if (typeof(objects['forEach']) != 'function') {
			console.log('corrupt objects in findIntersectingArtifact');
		}
		objects.forEach((object) => {
			// Measure has been updated, but not drawn.
			if (!object.box) {
				// console.log('there is no box');
			} else {
				var obox = svgHelpers.smoBox(object.box);
				var i1 = box.x - obox.x; // handle edge not believe in x and y
				var i2 = box.y - obox.y;
				if (i1 > 0 && i1 < object.box.width && i2 > 0 && i2 < object.box.height) {
					rv.push(object);
				}
			}
		});

		return rv;
	}
	static findSmallestIntersection(clientBox, objects) {
		var ar = svgHelpers.findIntersectingArtifact(clientBox, objects);
		if (!ar.length) {
			return null;
		}
		var rv = ar[0];
		var min = ar[0].box.width * ar[0].box.height;
		ar.forEach((obj) => {
			var tst = obj.box.width * obj.box.height;
			if (tst < min) {
				rv = obj;
				min = tst;
			}
		});
		return rv;
	}

	// ### measureBBox
	// Return the bounding box of the measure
	static measureBBox(b1, measure, staff) {
		if (measure.renderedBox) {
			if (b1['width']) {
				return svgHelpers.unionRect(b1, measure.renderedBox);
			} else {
				return measure.renderedBox;
			}
		} else {
			var mbox = {
				x: measure.staffX,
				y: staff.staffY,
				width: measure.staffWidth,
				height: staff.staffHeight
			};
			if (b1['width']) {
				return mbox;
			}
			return svgHelpers.unionRect(b1, mbox);
		}
	}
    // ### measurePerInch
    // Supported font units
    static get unitsPerInch() {
        var rv = {};
        
        rv['pt']=72.0;
        rv['px']=96.0;
        rv['em']=6.0;
        return rv;
    }
    
    // ### getFontSize
    // Given '1em' return {size:1.0,unit:em}
    static getFontSize(fs) {
        var size=parseFloat(fs);
        var measure = fs.substr(fs.length-2,2);
        return {size:size,unit:measure};
    }
    
    static convertFont(size,o,n) {
        return size*(svgHelpers.unitsPerInch[o]/svgHelpers.unitsPerInch[n]);
    }

	static stringify(box) {
		if (box['width']) {

			return JSON.stringify({
				x: box.x,
				y: box.y,
				width: box.width,
				height: box.height
			}, null, ' ');
		} else {
			return JSON.stringify({
				x: box.x,
				y: box.y
			}, null, ' ');
		}
	}

	static log(box) {
		if (box['width']) {
			console.log(JSON.stringify({
					x: box.x,
					y: box.y,
					width: box.width,
					height: box.height
				}, null, ' '));
		} else {
			console.log('{}');
		}
	}

	// ### pointBox
	// return a point-sized box at the given coordinate
	static pointBox(x, y) {
		return {
			x: x,
			y: y,
			width: 0,
			height: 0
		};
	}

	// ### smoBox:
	// return a simple box object that can be serialized, copied
	// (from svg DOM box)
	static smoBox(box) {
        var x = typeof(box.x) == 'undefined' ? box.left : box.x;
        var y = typeof(box.y) == 'undefined' ? box.top : box.y;
		return ({
			x: x,
			y: y,
			width: box.width,
			height: box.height
		});
	}

	static boxPoints(x, y, w, h) {
		return ({
			x: x,
			y: y,
			width: w,
			height: h
		});
	}

	static copyBox(box) {
        box = svgHelpers.smoBox(box);
		return {
			x: box.x,
			y: box.y,
			width: box.width,
			height: box.height
		};
	}

	// ### svgViewport
	// set `svg` element to `width`,`height` and viewport `scale`
	static svgViewport(svg, width, height, scale) {
		svg.setAttributeNS('', 'width', '' + width);
		svg.setAttributeNS('', 'height', '' + height);
		svg.setAttributeNS('', 'viewBox', '0 0 ' + Math.round(width / scale) + ' ' +
			Math.round(height / scale));
	}

	// ### logicalToClient
	// Convert a point from logical (pixels) to actual screen dimensions based on current
	// zoom, aspect ratio
	/* static logicalToClient(svg, logicalPoint) {
	var rect = svg.getBoundingClientRect();
	var rv = svgHelpers.copyBox(logicalPoint);
	rv.x += rect.x;
	rv.y += rect.y;
	return rv;
	}   */

	// ### clientToLogical
	// return a box or point in svg coordintes from screen coordinates
	static clientToLogical(svg, point) {
		var pt = svg.createSVGPoint();
        var x = typeof(point.x) != 'undefined' ? point.x : point.left;
        var y = typeof(point.y) != 'undefined' ? point.y : point.top;
		pt.x = x;
		pt.y = y;
		var sp = pt.matrixTransform(svg.getScreenCTM().inverse());
		if (!point['width']) {
			return {
				x: sp.x,
				y: sp.y
			};
		}

		var endPt = svg.createSVGPoint();
		endPt.x = pt.x + point.width;
		endPt.y = pt.y + point.height;
		var ep = endPt.matrixTransform(svg.getScreenCTM().inverse());
		return {
			x: sp.x,
			y: sp.y,
			width: ep.x - sp.x,
			height: ep.y - sp.y
		};
	}

	// ### logicalToClient
	// return a box or point in screen coordinates from svg coordinates
	static logicalToClient(svg, point) {
		var pt = svg.createSVGPoint();
		pt.x = point.x;
		pt.y = point.y;
		var sp = pt.matrixTransform(svg.getScreenCTM());
		if (!point['width']) {
			return {
				x: sp.x,
				y: sp.y
			};
		}
		var endPt = svg.createSVGPoint();
		endPt.x = pt.x + point.width;
		endPt.y = pt.y + point.height;
		var ep = endPt.matrixTransform(svg.getScreenCTM());
		return {
			x: sp.x,
			y: sp.y,
			width: ep.x - sp.x,
			height: ep.y - sp.y
		};
	}
}
;
var smoDomBuilder = function (el) {}

// # htmlHelpers
// # Description:
//  Helper functions for buildling UI elements
class htmlHelpers {
	// ## buildDom
	// ## Description:
	// returns an object that  lets you build a DOM in a somewhat readable way.
	// ## Usage:
	// var b = htmlHelpers.buildDom;
	//  var r =
	// b('tr').classes('jsSharingMember').data('entitykey', key).data('name', name).data('entitytype', entityType).append(
	// b('td').classes('noSideBorderRight').append(
	// ...
	// $(parent).append(r.dom());
	//
	// Don't forget the '.dom()' !  That is the actual jquery element object
	static buildDom(el) {
		var smoDomBuilder = function (el) {
			this.e = $('<' + el + '/>');
			var self = this;
			this.classes = function (cl) {
				$(self.e).addClass(cl);
				return self;
			}
			this.data = function (name, value) {
				$(self.e).attr('data-' + name, value);
				return self;
			}
			this.attr = function (name, value) {
				$(self.e).attr(name, value);
				return self;
			}
			this.css = function (name, value) {
				$(self.e).css(name, value);
				return self;
			}
			this.append = function (el) {
				$(self.e).append(el.e);
				return self;
			}
			this.text = function (tx) {
				$(self.e).append(document.createTextNode(tx));
				return self;
			}
			this.dom = function () {
				return self.e;
			}
			return this;
		}
		return new smoDomBuilder(el);
	}
	static draggable(parameters) {
		return new draggable(parameters);
	}

	static get focusableElements() {
		return ['a', 'input', 'select', 'textarea', 'button', 'li[tabindex]', 'div[tabindex]'];
	}
    static addFileLink(filename,txt,parent) {        
        var anchor = $('<a></a>');
        var url = URL.createObjectURL(new Blob([txt],{type:'application/octet-stream'}));
        $(anchor).attr('href',url);
        $(anchor).attr('download',filename);
        $(anchor).text('save');
        $(parent).html('');
        $(parent).append(anchor);    
    }
    
	static inputTrapper(selector) {
		var trapper = function () {
			this.parent = $(selector);
			this.id = $(this.parent).attr('id');
			this.parentId = $(this.parent).parent().attr('id');
			var idstr = Math.round(Math.random() * (999999 - 1) + 1);
			if (!this.id) {
				$(this.parent).attr('id', idstr + '-element');
				this.id = $(this.parent).attr('id');
			}
			if (!this.parentId) {
				$(this.parent).parent().attr('id', idstr + '-parent');
				this.parentId = $(this.parent).parent().attr('id');
			}
			this.modalInputs = [];
			this.disabledInputs = [];
			this.siblingInputs = [];

			// aria-hide peers of dialog and peers of parent that are not the parent.
			var peers = $(this.parent).parent().children().toArray();

			peers.forEach((node) => {
				var ptag = $(node)[0].tagName;
				if (ptag === 'SCRIPT' || ptag === 'LINK' || ptag === 'STYLE') { ;
				} else if ($(node).attr('id') === this.parentId ||
					$(node).attr('id') === this.id) { ;
				} else {
					var hidden = $(node).attr('aria-hidden');
					if (!hidden || hidden != 'true') {
						$(node).attr('aria-hidden', 'true');
						this.siblingInputs.push(node);
					}
				}
			});
			htmlHelpers.focusableElements.forEach((etype) => {
				var elements = $(etype).toArray();

				elements.forEach((element) => {
					var tagName = $(element)[0].tagName;
					if ($(element).attr('id') === this.id) { ;
					} else if ($(element).prop('disabled')) { ;
					} else if ($(element).hasClass('hide')) { ;
					} else if ($(element).closest(selector).length) {
						// inside
						this.modalInputs.push(element);
					} else if ((tagName === 'A' || tagName === 'DIV' || tagName === 'LI') && $(element).attr('tabIndex') === '-1') { ;
					} else {
						this.disabledInputs.push(element);
						if (tagName === 'A' || tagName === 'DIV' || tagName === 'LI') {
							$(element).attr('tabIndex', '-1');
						} else {
							$(element).prop('disabled', true);
						}
					}
				});
			});

			this.close = function () {
				this.disabledInputs.forEach(function (element) {
					var tagName = $(element)[0].tagName;
					if (tagName === 'A' || tagName === 'DIV' || tagName === 'LI') {
						$(element).attr('tabIndex', '0');
					} else {
						$(element).prop('disabled', false);
					}
				});
				this.siblingInputs.forEach((el) => {
					$(el).removeAttr('aria-hidden');
				});
			}
		}

		return new trapper(selector);
	}

	static closeDialogPromise() {
		return new Promise((resolve, reject) => {
			$('body').off('dialogDismiss').on('dialogDismiss', function () {
				resolve();
			});
		});
	}
}

class draggable {

	constructor(parameters) {

		this.parent = parameters.parent;
		this.handle = parameters.handle;
        this.animeClass = parameters.animateDiv;
        this.dragParent = parameters.dragParent;
        
		this.svg=parameters['svg'];
		this.width = $(this.parent).outerWidth();
		this.height = $(this.parent).outerHeight();
		this.lastX = $(this.handle).offset().left;
		this.lastY = $(this.handle).offset().top;
		this.cb = parameters.cb;
		this.moveParent = parameters.moveParent;

		var self = this;

		// $('.itemMenu input[name="itemTitle"]').css('width','60%');
		$(this.handle)
		.off('mousedown').on('mousedown',
			function (e) {
			self.mousedown(e);
		});
		$(document)
		.on('mousemove',
			function (e) {
			self.mousemove(e);

		})
		.on('mouseup',
			function (e) {
			self.mouseup(e);
		});
	}
    disconnect() {
        $(this.handle).off('mousedown');
        $(this.document).off('mousemove');
        $(this.handle).off('mouseup');
    }
	_animate(e) {
		this.lastX = e.clientX;
		this.lastY = e.clientY;
		$(this.animeClass).css('left', this.lastX);
		$(this.animeClass).css('top', this.lastY);
        
        if (this.dragParent) {
            $(this.parent).css('left', this.lastX + 'px');
			$(this.parent).css('top', this.lastY + 'px');
        }
	}
	mousedown(e) {
		if (!this.dragging) {
			$(this.animeClass).removeClass('hide');

			$(this.animeClass).css('width', this.width);
			$(this.animeClass).css('height', this.height);
		}

		this.dragging = true;
		this._animate(e);
	}
	enddrag(e) {

		if (this.moveParent) {
			$(this.parent).css('left', this.lastX + 'px');
			$(this.parent).css('top', this.lastY + 'px');
		}
		$(this.animeClass).addClass('hide');
		this.cb(this.lastX, this.lastY);
	}

	mouseup(e) {
		// stop resizing
		if (this.dragging) {
			this.dragging = false;
			this.lastX = e.clientX;
			this.lastY = e.clientY;

			this.enddrag();
		}
	}
	mousemove(e) {
		// we don't want to do anything if we aren't resizing.
		if (!this.dragging)
			return;
		this._animate(e);
	}
}
;// ## SmoNote
// ## Description:
// Data for a musical note.  THe most-contained-thing, except there can be note modifiers
// Basic note information.  Leaf node of the SMO dependency tree (so far)
// ## SmoNote Methods
// ---
class SmoNote {
    // ### Description:
    // see defaults for params format.
    constructor(params) {
        Vex.Merge(this, SmoNote.defaults);
        smoMusic.serializedMerge(SmoNote.parameterArray, params, this);

        // this.keys=JSON.parse(JSON.stringify(this.keys));

        if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: 'SmoNote'
            };
        } else {
            // inherit attrs id for deserialized
        }
    }
    static get flagStates() {
        return {auto:0,up:1,down:2};
    }
    static get parameterArray() {
        return ['ticks', 'pitches', 'noteType', 'tuplet', 'attrs', 'clef', 'endBeam','beamBeats','flagState'];
    }
    
    toggleFlagState() {
        this.flagState = (this.flagState + 1) % 3;
    }
    
    toVexStemDirection() {
        this.flagState = SmoNote.flagStates.up ? VF.Stem.UP : VF.Stem.DOWN;
    }
    get id() {
        return this.attrs.id;
    }

    get dots() {
        if (this.isTuplet) {
            return 0;
        }
        var vexDuration = smoMusic.ticksToDuration[this.tickCount];
        return vexDuration.split('d').length - 1;
    }

    set dots(value) {
        // ignore - dots are a function of duration only.
    }

    // ### _addModifier
    // ### Description
    // add or remove sFz, mp, etc.
    _addModifier(dynamic, toAdd) {
        var tms = [];
        this.textModifiers.forEach((tm) => {
            if (tm.attrs.type != dynamic.attrs.type) {
                tms.push(tm);
            }
        });
        if (toAdd) {
            tms.push(dynamic);
        }
        this.textModifiers = tms;
    }

    _addArticulation(articulation, toAdd) {
        var tms = [];
        this.articulations.forEach((tm) => {
            if (tm.articulation != articulation.articulation) {
                tms.push(tm);
            }
        });
        if (toAdd) {
            tms.push(articulation);
        }
        this.articulations = tms;
    }

    addModifier(dynamic) {
        this._addModifier(dynamic, true);
    }
    removeModifier(dynamic) {
        this._addModifier(dynamic, false);
    }
    getModifiers(type) {
        var ms = this.textModifiers.filter((mod)=> {
            return mod.attrs.type === type;
        });
        return ms;
    }
    
    addLyric(lyric) {
        var tms = this.textModifiers.filter((mod) => {
            return mod.attrs.type != 'SmoLyric' || mod.verse != lyric.verse;
        });
        tms.push(lyric);
        this.textModifiers = tms;
    }
    
    
    removeLyric(lyric) {
        var tms = this.textModifiers.filter((mod) => {
            return mod.attrs.type != 'SmoLyric' || mod.verse != lyric.verse;
        });
        this.textModifiers = tms;
    }

    toggleArticulation(articulation) {
        if (this.articulations.findIndex((a) => {
                return a.articulation === articulation.articulation;
            }) < 0) {
            this._addArticulation(articulation, true);
        } else {
            this._addArticulation(articulation, false);
        }
    }

    _sortPitches() {
        var canon = VF.Music.canonical_notes;
        var keyIndex = ((pitch) => {
            return canon.indexOf(pitch.letter) + pitch.octave * 12;
        });
        this.pitches.sort((a, b) => {
            return keyIndex(a) - keyIndex(b);
        });
    }
    addPitchOffset(offset) {
        if (this.pitches.length == 0) {
            return this;
        }
        this.noteType = 'n';
        var pitch = this.pitches[0];
        this.pitches.push(smoMusic.getKeyOffset(pitch, offset));

        this._sortPitches();
    }

    makeRest() {
        this.noteType = (this.noteType == 'r' ? 'n' : 'r');
    }

    makeNote() {
        this.noteType = 'n';
    }

    get isTuplet() {
        return this['tuplet'] && this.tuplet['id'];
    }

    transpose(pitchArray, offset, keySignature) {
        var pitches = [];
        this.noteType = 'n';
        if (pitchArray.length == 0) {
            this.pitches.forEach((m) => {
                pitchArray.push(this.pitches.indexOf(m));
            });
        }
        for (var j = 0; j < pitchArray.length; ++j) {
            var index = pitchArray[j];
            if (index + 1 > this.pitches.length) {
                this.addPitchOffset(offset);
            } else {
                var pitch = smoMusic.getKeyOffset(this.pitches[index], offset);
                if (keySignature) {
                    var letterKey = pitch.letter + pitch.accidental;
                    letterKey = smoMusic.getKeyFriendlyEnharmonic(letterKey, keySignature);
                    pitch.letter = letterKey[0];
                    if (letterKey.length < 2) {
                        pitch.accidental = 'n';
                    } else {
                        pitch.accidental = letterKey.substring(1);
                    }
                }
                this.pitches[index] = pitch;
            }
        }
        this._sortPitches();
        return this;
    }
    get tickCount() {
        return this.ticks.numerator / this.ticks.denominator + this.ticks.remainder;
    }

    describe() {
        return this.id + ' ' + this.tickCount;
    }

    static clone(note) {
        var rv = SmoNote.deserialize(note.serialize());

        // make sure id is unique
        rv.attrs = {
            id: VF.Element.newID(),
            type: 'SmoNote'
        };
        return rv;
    }

    // ## Description:
    // Clone the note, but use the different duration.  Changes the length
    // of the note but nothing else.
    static cloneWithDuration(note, ticks) {
        var rv = SmoNote.clone(note);

        rv.ticks = ticks;

        return rv;
    }

    _serializeModifiers() {
        return JSON.parse(JSON.stringify(this.textModifiers));
    }
    serialize() {
        var params = {};
        smoMusic.serializedMerge(SmoNote.parameterArray, this, params);
        params.ticks = JSON.parse(JSON.stringify(params.ticks));
        params.noteModifiers = this._serializeModifiers();
        return params;
    }

    static get defaults() {
        return {
            noteType: 'n',
            textModifiers: [],
            articulations: [],
            endBeam: false,
            beamBeats:4096,
            flagState:SmoNote.flagStates.auto,
            ticks: {
                numerator: 4096,
                denominator: 1,
                remainder: 0
            },
            pitches: [{
                    letter: 'b',
                    octave: 4,
                    accidental: ''
                }
            ],
        }
    }
    static deserialize(jsonObj) {
        var note = new SmoNote(jsonObj);
        note.attrs.id = jsonObj.attrs.id;
        jsonObj.noteModifiers.forEach((mod) => {
            note.textModifiers.push(SmoNoteModifierBase.deserialize(mod));
        });
        return note;
    }
}
class SmoTuplet {
    constructor(params) {
        this.notes = params.notes;
        Vex.Merge(this, SmoTuplet.defaults);
        Vex.Merge(this, params);
        if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: 'SmoTuplet'
            };
        } else {
            console.log('inherit attrs');
        }
        this._adjustTicks();
    }
	
	static get longestTuplet() {
		return 8192;
	}

    get clonedParams() {
        var paramAr = ['stemTicks', 'ticks', 'totalTicks', 'durationMap']
        var rv = {};
        smoMusic.serializedMerge(paramAr, this, rv);
        return rv;

    }
	
	static calculateStemTicks(totalTicks,numNotes) {
        var stemValue = totalTicks / numNotes;
        var stemTicks = SmoTuplet.longestTuplet;

        // The stem value is the type on the non-tuplet note, e.g. 1/8 note
        // for a triplet.
        while (stemValue < stemTicks) {
            stemTicks = stemTicks / 2;
        }
		return stemTicks * 2;
	}

    static cloneTuplet(tuplet) {
        var noteAr = tuplet.notes;
        var durationMap = JSON.parse(JSON.stringify(tuplet.durationMap)); // deep copy array

		// Add any remainders for oddlets
		var totalTicks = noteAr.map((nn) => nn.ticks.numerator+nn.ticks.remainder).reduce((acc, nn) => acc+nn);
		
        var numNotes = tuplet.numNotes;
        var stemValue = totalTicks / numNotes;
        var stemTicks = SmoTuplet.calculateStemTicks(totalTicks,numNotes);

        var tupletNotes = [];

        var i = 0;
        noteAr.forEach((note) => {
            var textModifiers = note.textModifiers;
            note = SmoNote.cloneWithDuration(note, {
                    numerator: stemTicks*tuplet.durationMap[i],
                    denominator: 1,
                    remainder: 0
                });

            // Don't clone modifiers, except for first one.
            if (i === 0) {
                var ntmAr = [];
                textModifiers.forEach((tm) => {
                    ntm = SmoNoteModifierBase.deserialize(JSON.stringify(tm));
                    ntmAr.push(ntm);
                });
                note.textModifiers = ntmAr;
            }
            i += 1;

            tupletNotes.push(note);
        });
        var rv = new SmoTuplet({
                notes: tupletNotes,
                stemTicks: stemTicks,
                totalTicks: totalTicks,
                ratioed: false,
                bracketed: true,
                startIndex: tuplet.startIndex,
                durationMap: durationMap
            });
        return rv;
    }

    _adjustTicks() {
        var sum = this.durationSum;
        for (var i = 0; i < this.notes.length; ++i) {
            var note = this.notes[i];
            var normTicks = smoMusic.durationToTicks(smoMusic.ticksToDuration[this.stemTicks]);
            // TODO:  notes_occupied needs to consider vex duration
            var tupletBase = normTicks * this.note_ticks_occupied;
            note.ticks.denominator = 1;
            note.ticks.numerator = Math.floor((this.totalTicks * this.durationMap[i]) / sum);

            note.tuplet = this.attrs;
        }
		
		// put all the remainder in the first note of the tuplet
		var noteTicks = this.notes.map((nn) => {return nn.tickCount;}).reduce((acc,dd) => {return acc+dd;});
		this.notes[0].ticks.remainder = this.totalTicks-noteTicks;

    }
    getIndexOfNote(note) {
        var rv = -1;
        for (var i = 0; i < this.notes.length; ++i) {
            var tn = this.notes[i];
            if (note.id === tn.id) {
                rv = i;
            }
        }
        return rv;
    }
    split(combineIndex) {
        var multiplier = 0.5;
        var nnotes = [];
        var nmap = [];

        for (var i = 0; i < this.notes.length; ++i) {
            var note = this.notes[i];
            if (i === combineIndex) {
                nmap.push(this.durationMap[i] * multiplier);
                nmap.push(this.durationMap[i] * multiplier);
                note.ticks.numerator *= multiplier;

                var onote = SmoNote.clone(note);
				// remainder is for the whole tuplet, so don't duplicate that.
				onote.ticks.remainder=0;
                nnotes.push(note);
                nnotes.push(onote);
            } else {
                nmap.push(this.durationMap[i]);
                nnotes.push(note);
            }
        }
        this.notes = nnotes;
        this.durationMap = nmap;
    }
    combine(startIndex, endIndex) {
        // can't combine in this way, too many notes
        if (this.notes.length <= endIndex || startIndex >= endIndex) {
            return this;
        }
        var acc = 0.0;
        var i;
        var base = 0.0;
        for (i = startIndex; i <= endIndex; ++i) {
            acc += this.durationMap[i];
            if (i == startIndex) {
                base = this.durationMap[i];
            } else if (this.durationMap[i] != base) {
                // Can't combine non-equal tuplet notes
                return this;
            }
        }
        // how much each combined value will be multiplied by
        var multiplier = acc / base;

        var nmap = [];
        var nnotes = [];
        // adjust the duration map
        for (i = 0; i < this.notes.length; ++i) {
            var note = this.notes[i];
            // notes that don't change are unchanged
            if (i < startIndex || i > endIndex) {
                nmap.push(this.durationMap[i]);
                nnotes.push(note);
            }
            // changed note with combined duration
            if (i == startIndex) {
                note.ticks.numerator = note.ticks.numerator * multiplier;
                nmap.push(acc);
                nnotes.push(note);
            }
            // other notes after startIndex are removed from the map.
        }
        this.notes = nnotes;
        this.durationMap = nmap;
    }
    get durationSum() {
        var acc = 0;
        for (var i = 0; i < this.durationMap.length; ++i) {
            acc += this.durationMap[i];
        }
        return Math.round(acc);
    }
    get num_notes() {
        return this.durationSum;
    }
    get notes_occupied() {
        return Math.floor(this.totalTicks / this.stemTicks);
    }
    get note_ticks_occupied() {
        return this.totalTicks / this.stemTicks;
    }
    get tickCount() {
        var rv = 0;
        for (var i = 0; i < this.notes.length; ++i) {
            var note = this.notes[i];
            rv += (note.ticks.numerator / note.ticks.denominator) + note.ticks.remainder;
        }
        return rv;
    }

    static get defaults() {
        return {
            numNotes: 3,
            totalTicks: 4096, // how many ticks this tuple takes up
            stemTicks: 2048, // the stem ticks, for drawing purposes.  >16th, draw as 8th etc.
            durationMap: [1.0, 1.0, 1.0],
            bracketed: true,
            ratioed: false
        }
    }
}

class SmoBeamGroup {
    constructor(params) {
        this.notes = params.notes;
        Vex.Merge(this, params);

        if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: 'SmoBeamGroup'
            };
        } else {
            console.log('inherit attrs');
        }
        for (var i = 0; i < this.notes.length; ++i) {
            var note = this.notes[i];
            if (note.tickCount < 4096)
                note.beam_group = this.attrs;
        }
    }
}
;
class SmoNoteModifierBase {
	constructor(ctor) {
		this.ctor = ctor;
	}
	static deserialize(jsonObj) {
		var ctor = eval(jsonObj.ctor);
		var rv = new ctor(jsonObj);
		rv.attrs.id = jsonObj.attrs.id;
		rv.attrs.type = jsonObj.attrs.type;
		return rv;
	}
}

class SmoArticulation extends SmoNoteModifierBase {
	static get articulations() {
		return {
			accent: 'accent',
			staccato: 'staccato',
			marcato: 'marcato',
			tenuto: 'tenuto',
			upStroke: 'upStroke',
			downStroke: 'downStroke',
			pizzicato: 'pizzicato',
			fermata: 'fermata'
		};
	}
	static get positions() {
		return {
			above: 'above',
			below: 'below'
		};
	}
	static get articulationToVex() {
		return {
			accent: 'a>',
			staccato: 'a.',
			marcato: 'a^',
			tenuto: 'a-',
			upStroke: 'a|',
			downStroke: 'am',
			pizzicato: 'ao',
			fermata: 'a@a'
		};
	}

	static get vexToArticulation() {
		return {
			"a>": "accent",
			"a.": "staccato",
			"a^": "marcato",
			"a-": "tenuto",
			"a|": "upStroke",
			"am": "downStroke",
			"ao": "pizzicato",
			'a@a': "fermata"
		};
	}
	static get attrArray() {
		return ['position', 'articulation'];
	}

	static get positionToVex() {
		return {
			'above': 3,
			'below': 4
		};
	}
	static get defaults() {
		return {
			position: SmoArticulation.positions.above,
			articulation: SmoArticulation.articulations.accent
		};

	}
	constructor(parameters) {
		super('SmoArticulation');
		Vex.Merge(this, SmoArticulation.defaults);
		smoMusic.filteredMerge(SmoArticulation.attrArray, parameters, this);
		this.selector = parameters.selector;

		if (!this['attrs']) {
			this.attrs = {
				id: VF.Element.newID(),
				type: 'SmoArticulation'
			};
		} else {
			console.log('inherit attrs');
		}
	}
	get id() {
		return this.attrs.id;
	}
	set id(ignore) {}
	get type() {
		return this.attrs.type;
	}
	set type(ignore) {}
}

class SmoLyric extends SmoNoteModifierBase {
	static get defaults() {
		return {
            text:'',
            endChar:'',
            verse:0,
			fontInfo: {
				size: 10,
				family: 'times',
				style: 'normal',
				weight: 'normal'
			},
            fill:'black',
			rotate:0,
			classes:'score-text',
			scaleX:1.0,
			scaleY:1.0,
			translateX:0,
			translateY:0,
		};
	}
    
    static get attributes() {
        return ['text','endChar','fontInfo','classes','verse',
		    'fill','scaleX','scaleY','translateX','translateY'];
    }
    
    constructor(parameters) {
		super('SmoLyric');
		smoMusic.serializedMerge(SmoLyric.attributes, SmoLyric.defaults,this);
		smoMusic.serializedMerge(SmoLyric.attributes, parameters, this);
		this.adjY=0;

		if (!this['attrs']) {
			this.attrs = {
				id: VF.Element.newID(),
				type: 'SmoLyric'
			};
		} else {
			console.log('inherit attrs');
		}
	}
}

// ## SmoDynamicText
// ## Description:
// standard dynamics text
class SmoDynamicText extends SmoNoteModifierBase {
	static get defaults() {
		return {
			xOffset: 0,
			fontSize: 38,
			yOffsetLine: 11,
			yOffsetPixels: 0,
			text: SmoDynamicText.dynamics.MP,
		};
	}

	static get dynamics() {
		// matches VF.modifier
		return {
			PP: 'pp',
			P: 'p',
			MP: 'mp',
			MF: 'mf',
			F: 'f',
			FF: 'ff',
			SFZ: 'sfz'
		};
	}

	constructor(parameters) {
		super('SmoDynamicText');
		Vex.Merge(this, SmoDynamicText.defaults);
		smoMusic.filteredMerge(SmoDynamicText.attrArray, parameters, this);
		this.selector = parameters.selector;

		if (!this['attrs']) {
			this.attrs = {
				id: VF.Element.newID(),
				type: 'SmoDynamicText'
			};
		} else {
			console.log('inherit attrs');
		}
	}
	get id() {
		return this.attrs.id;
	}
	set id(ignore) {}
	get type() {
		return this.attrs.type;
	}
	set type(ignore) {}
	static get attrArray() {
		return ['xOffset', 'fontSize', 'yOffsetLine', 'yOffsetPixels', 'text'];
	}
	backupOriginal() {
		if (!this['original']) {
			this.original = {};
			smoMusic.filteredMerge(
				SmoDynamicText.attrArray,
				this, this.original);
		}
	}
	restoreOriginal() {
		if (this['original']) {
			smoMusic.filteredMerge(
				SmoDynamicText.attrArray,
				this.original, this);
			this.original = null;
		}
	}
}
;
// ## SmoMeasure - data for a measure of music
// Many rules of musical engraving are enforced at a measure level, e.g. the duration of
// notes, accidentals, etc.
// ### See Also:
// Measures contain *notes*, *tuplets*, and *beam groups*.  So see `SmoNote`, etc.
// Measures are contained in staves, see also `SystemStaff.js`
// ## SmoMeasure Methods:
class SmoMeasure {
	constructor(params) {
		this.tuplets = [];
		this.beamGroups = [];
		this.modifiers = [];
		this.changed = true;
        this.timestamp=0;
        this.prevY = 0;
        this.prevX = 0;
        this.prevFrame=0;
		var defaults = SmoMeasure.defaults;

		smoMusic.serializedMerge(SmoMeasure.defaultAttributes, defaults, this);
		smoMusic.serializedMerge(SmoMeasure.defaultAttributes, params, this);
		this.voices = params.voices ? params.voices : [];
		this.tuplets = params.tuplets ? params.tuplets : [];
		this.modifiers = params.modifiers ? params.modifiers : defaults.modifiers;
		this.adjY = 0;

		if (!this['attrs']) {
			this.attrs = {
				id: VF.Element.newID(),
				type: 'SmoMeasure'
			};
		} else {
			// inherit attrs id for deserialized
		}
	}
	get notes() {
		return this.voices[this.activeVoice].notes;
	}

	// ### getRenderedNote
	// The renderer puts a mapping between rendered svg groups and
	// the logical notes in SMO.  The UI needs this mapping to be interactive,
	// figure out where a note is rendered, what its bounding box is, etc.
	getRenderedNote(id) {
		for (var j = 0; j < this.voices.length; ++j) {
			var voice = this.voices[j];
			for (var i = 0; i < voice.notes.length; ++i) {
				var note = voice.notes[i];
				if (note.renderId === id) {
					return {
						smoNote: note,
						voice: j,
						tick: i
					};
				}
			}
		}
		return null;
	}

	set notes(val) {
		this.voices[this.activeVoice].notes = val;
	}
	get stemDirection() {
		return this.activeVoice % 2 ? -1 : 1;
	}

	// ### defaultAttributes
	// attributes that are to be serialized for a measure.
	static get defaultAttributes() {
		return [
			'timeSignature', 'keySignature', 'staffX', 'staffY',
			'measureNumber', 'staffWidth',
			'activeVoice', 'clef', 'transposeIndex', 'activeVoice', 'adjX','adjRight', 'padRight', 'rightMargin'];
	}

	// ### serialize
	// Convert this measure object to a JSON object, recursively serializing all the notes,
	// note modifiers, etc.
	serialize() {
		var params = {};
		smoMusic.serializedMerge(SmoMeasure.defaultAttributes, this, params);
		params.tuplets = [];
		params.beamGroups = [];
		params.voices = [];
		params.modifiers=[];

		this.tuplets.forEach((tuplet) => {
			params.tuplets.push(JSON.parse(JSON.stringify(tuplet)));
		});

		this.beamGroups.forEach((beam) => {
			params.beamGroups.push(JSON.parse(JSON.stringify(beam)));
		});

		this.voices.forEach((voice) => {
			var obj = {
				notes: []
			};
			voice.notes.forEach((note) => {
				obj.notes.push(note.serialize());
			});
			params.voices.push(obj);
		});
		
		this.modifiers.forEach((modifier) => {
			params.modifiers.push(modifier.serialize());
		});
		return params;
	}

	// ### deserialize
	// restore a serialized measure object.  Usually called as part of deserializing a score,
	// but can also be used to restore a measure due to an undo operation.
	static deserialize(jsonObj) {
		var voices = [];
		for (var j = 0; j < jsonObj.voices.length; ++j) {
			var voice = jsonObj.voices[j];
			var notes = [];
			voices.push({
				notes: notes
			});
			for (var i = 0; i < voice.notes.length; ++i) {
				var noteParams = voice.notes[i];
				var smoNote = SmoNote.deserialize(noteParams);
				notes.push(smoNote);
			}
		}

		var tuplets = [];
		for (j = 0; j < jsonObj.tuplets.length; ++j) {
			var tuplet = new SmoTuplet(jsonObj.tuplets[j]);
			tuplets.push(tuplet);
		}

		var beamGroups = [];
		for (j = 0; j < jsonObj.beamGroups.length; ++j) {
			var smoBeam = new SmoBeamGroup(jsonObj.beamGroups[j]);
			beamGroups.push(smoBeam);
		}
		
		var modifiers = [];
		jsonObj.modifiers.forEach((modParams) => {
			var ctor = eval(modParams.ctor);
			var modifier = new ctor(modParams);
			modifiers.push(modifier);
		});
		

		var params = {
			voices: voices,
			tuplets: tuplets,
			beamGroups: beamGroups,
			modifiers:modifiers
		};

		smoMusic.serializedMerge(SmoMeasure.defaultAttributes, jsonObj, params);

		return new SmoMeasure(params);
	}

	// ### defaultPitchForClef
	// Accessor for clef objects, which are set at a measure level.
	// #### TODO: learn what all these clefs are
	static get defaultPitchForClef() {
		return {
			'treble': {
				letter: 'b',
				accidental: 'n',
				octave: 4
			},
			'bass': {
				letter: 'd',
				accidental: 'n',
				octave: 3
			},
			'tenor': {
				letter: 'a',
				accidental: 'n',
				octave: 3
			},
			'alto': {
				letter: 'c',
				accidental: 'n',
				octave: 4
			},
			'soprano': {
				letter: 'b',
				accidental: 'n',
				octave: 4
			},
			'percussion': {
				letter: 'b',
				accidental: 'n',
				octave: 4
			},
			'mezzo-soprano': {
				letter: 'b',
				accidental: 'n',
				octave: 4
			},
			'baritone-c': {
				letter: 'b',
				accidental: 'n',
				octave: 3
			},
			'baritone-f': {
				letter: 'e',
				accidental: 'n',
				octave: 3
			},
			'subbass': {
				letter: 'd',
				accidental: '',
				octave: 2
			},
			'french': {
				letter: 'b',
				accidental: '',
				octave: 4
			} // no idea
		}
	}
	// ### getDefaultNotes
	// Get a measure full of default notes for a given timeSignature/clef.
	// returns 8th notes for triple-time meters, etc.
	static getDefaultNotes(params) {
		if (params == null) {
			params = {};
		}
		params.timeSignature = params.timeSignature ? params.timeSignature : '4/4';
		params.clef = params.clef ? params.clef : 'treble';
		var meterNumbers = params.timeSignature.split('/').map(number => parseInt(number, 10));
		var ticks = {
			numerator: 4096,
			denominator: 1,
			remainder: 0
		};
        var beamBeats = ticks.numerator;
		if (meterNumbers[1]  == 8) {
			ticks = {
				numerator: 2048,
				denominator: 1,
				remainder: 0
			};
            beamBeats = 2048*3;
		}
		var pitches = SmoMeasure.defaultPitchForClef[params.clef];
		var rv = [];

		for (var i = 0; i < meterNumbers[0]; ++i) {
			var note = new SmoNote({
					clef: params.clef,
					pitches: [pitches],
					ticks: ticks,
					timeSignature: params.timeSignature,
                    beamBeats:beamBeats
				});
			rv.push(note);
		}
		return rv;
	}

	// ### getDefaultMeasure
	// For create the initial or new measure, get a measure with notes.
	static getDefaultMeasure(params) {
		var obj = {};
		smoMusic.serializedMerge(SmoMeasure.defaultAttributes, SmoMeasure.defaults, obj);
		smoMusic.serializedMerge(SmoMeasure.defaultAttributes, params, obj);
		return new SmoMeasure(obj);
	}

	// ### SmoMeasure.getDefaultMeasureWithNotes
	// Get a new measure with the appropriate notes for the supplied clef, instrument
	static getDefaultMeasureWithNotes(params) {
		var measure = SmoMeasure.getDefaultMeasure(params);
		measure.voices.push({
			notes: SmoMeasure.getDefaultNotes(params)
		});
		return measure;
	}
        
	
	static get defaultVoice44() {
		return SmoMeasure.getDefaultNotes({
			clef: 'treble',
			timeSignature: '4/4'
		});
	}
	static get defaults() {
		// var noteDefault = SmoMeasure.defaultVoice44;
		const modifiers = [];
		modifiers.push(new SmoBarline({
				position: SmoBarline.positions.start,
				barline: SmoBarline.barlines.singleBar
			}));
		modifiers.push(new SmoBarline({
				position: SmoBarline.positions.end,
				barline: SmoBarline.barlines.singleBar
			}));
		modifiers.push(new SmoRepeatSymbol({
				position: SmoRepeatSymbol.positions.start,
				symbol: SmoRepeatSymbol.symbols.None
			}));
		// modifiers.push(new SmoRepeatSymbol({symbol:SmoRepeatSymbol.symbols.None});
		return {
			timeSignature: '4/4',
			keySignature: "C",
			canceledKeySignature: null,
			staffX: 10,
			adjX: 0,
			adjRight:0,
			padRight: 10,
			transposeIndex: 0,
			modifiers: modifiers,
			rightMargin: 2,
			staffY: 40,
			// bars: [1, 1], // follows enumeration in VF.Barline
			measureNumber: {
				localIndex: 0,
				systemIndex: 0,
				measureNumber: 0,
				staffId: 0
			},
			staffWidth: 200,
			clef: 'treble',
			changed: true,
			forceClef: false,
			forceKeySignature: false,
			forceTimeSignature: false,
			voices: [],
			activeVoice: 0
		};
	}
	tickmap() {
		return VX.TICKMAP(this);
	}    

	// ### getDynamicMap
	// ### Description:
	// returns the dynamic text for each tick index.  If
	// there are no dynamics, the empty array is returned.
	getDynamicMap() {
		var rv = [];
		var hasDynamic = false;
		this.voices.forEach((voice) => {
			voice.notes.forEach((note) => {
				if (note.dynamicText) {
					rv.push({
						note: note,
						text: note.dynamicText
					});
					hasDynamic = true;
				} else {
					rv.push({
						note: note,
						text: ''
					});
				}
			});
		});

		if (hasDynamic) {
			return rv;
		}
		return [];
	}

	clearBeamGroups() {
		this.beamGroups = [];
	}

	tupletNotes(tuplet) {
		var notes = [];
		for (var j = 0; j < this.voices.length; ++j) {
			var notes = this.voices[j].notes;
			for (var i = 0; i < notes.length; ++i) {
				if (notes[i]['tuplet'] && notes[i].tuplet.id === tuplet.attrs.id) {
					notes.push(notes[i]);
				}
			}
		}
		return notes;
	}
	tupletIndex(tuplet) {
		for (var j = 0; j < this.voices.length; ++j) {
			var notes = this.voices[j].notes;
			for (var i = 0; i < notes.length; ++i) {
				if (notes[i]['tuplet'] && notes[i].tuplet.id === tuplet.attrs.id) {
					return i;
				}
			}
		}
		return -1;
	}
    
    _addSingletonModifier(name,parameters) {
        var ctor = eval(name);
        var ar= this.modifiers.filter(obj => obj.attrs.type != name);
        this.modifiers=ar;
        this.modifiers.push(new ctor(parameters));
    }
    _removeSingletonModifier(name) {
        var ar= this.modifiers.filter(obj => obj.attrs.type != name);
        this.modifiers=ar;
    }
    
    _getSingletonModifier(name) {
        return this.modifiers.find(obj => obj.attrs.type == name);
    }
    
    addRehearsalMark(parameters) {
        this._addSingletonModifier('SmoRehearsalMark',parameters);
    }
	removeRehearsalMark() {
        this._removeSingletonModifier('SmoRehearsalMark');
    }
    getRehearsalMark() {
        return this._getSingletonModifier('SmoRehearsalMark');
    }
    
    addTempo(params) {
        this._addSingletonModifier('SmoTempoText',params);
    }
    removeTempo(params) {
        this._removeSingletonModifier('SmoTempoText',params);
    }
    getTempo() {
        return this._getSingletonModifier('SmoTempoText');
    }
	addMeasureText(mod) {
		var added = false;
		var exist = this.modifiers.filter((mm) => {
			return mm.attrs.id === mod.attrs.id;
		});
		if (exist.length) {
			this.setChanged(); // already added but set changed===true to re-justify
			return;
		}
		this.modifiers.push(mod);
		this.setChanged();
	}
	
	getMeasureText() {
		return this.modifiers.filter(obj => obj.ctor === 'SmoMeasureText');
	}
	
	removeMeasureText(id) {
		var ar= this.modifiers.filter(obj => obj.attrs.id != id);
		this.modifiers=ar;
		this.setChanged();
	}
	
	setRepeatSymbol(rs) {
		var ar = [];
		var toAdd = true;
		var exSymbol = this.getRepeatSymbol();
		if (exSymbol && exSymbol.symbol === rs.symbol) {
			toAdd = false;
		}
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoRepeatSymbol') {
				ar.push(modifier);
			}
		});
		this.modifiers = ar;
		if (toAdd) {
			ar.push(rs);
		}
	}
	getRepeatSymbol() {
		var rv = this.modifiers.filter(obj => obj.ctor === 'SmoRepeatSymbol');
		return rv.length ? rv[0] : null;
	}
	clearRepeatSymbols() {
		var ar = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoRepeatSymbol') {
				ar.push(modifier);
			}
		});
		this.modifiers = ar;
	}
	setBarline(barline) {
		var ar = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoBarline' || modifier.position != barline.position) {
				ar.push(modifier);
			}
		});
		this.modifiers = ar;
		ar.push(barline);
	}

	_getBarline(pos) {
		var rv = null;
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor === 'SmoBarline' && modifier.position === pos) {
				rv = modifier;
			}
		});
		return rv;
	}
	getEndBarline() {
		return this._getBarline(SmoBarline.positions.end);
	}
	getStartBarline() {
		return this._getBarline(SmoBarline.positions.start);
	}

	addNthEnding(ending) {
		var mods = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoVolta' || modifier.startBar != ending.startBar || modifier.endBar != ending.endBar) {
				mods.push(modifier);
			}
		});
		mods.push(ending);
		this.modifiers = mods;
	}

	removeNthEnding(number) {
		var mods = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor != 'SmoVolta' || modifier.number != number) {
				mods.push(modifier);
			}
		});
		this.modifiers = mods;
	}

	getNthEndings() {
		var rv = [];
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor === 'SmoVolta') {
				rv.push(modifier);
			}
		});
		return rv;
	}
	getEndEndings() {
		var rv = null;
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor === 'SmoVolta' && modifier.endBar === this.measureNumber.systemIndex
				 && modifier.startBar != this.measureNumber.systemIdnex) {
				rv.push(modifier);
			}
		});
		return rv;
	}
	getMidEndings() {
		var rv = null;
		this.modifiers.forEach((modifier) => {
			if (modifier.ctor === 'SmoVolta' && modifier.endBar > this.measureNumber.systemIndex
				 && modifier.startBar < this.measureNumber.systemIndex) {
				rv.push(modifier);
			}
		});
		return rv;
	}

	getTupletForNote(note) {
		if (!note.isTuplet) {
			return null;
		}
		for (var i = 0; i < this.tuplets.length; ++i) {
			var tuplet = this.tuplets[i];
			if (tuplet.attrs.id === note.tuplet.id) {
				return tuplet;
			}
		}
		return null;
	}
	removeTupletForNote(note) {
		var tuplets = [];
		for (var i = 0; i < this.tuplets.length; ++i) {
			var tuplet = this.tuplets[i];
			if (note.tuplet.id !== tuplet.attrs.id) {
				tuplets.push(tuplet);
			}
		}
		this.tuplets = tuplets;
	}
	
	get numBeats() {
		return this.timeSignature.split('/').map(number => parseInt(number, 10))[0];
	}
	setKeySignature(sig) {
		this.keySignature = sig;
		this.setChanged();
		this.voices.forEach((voice) => {
			voice.notes.forEach((note) => {
				note.keySignature = sig;
			});
		});
	}
    setChanged() {
        this.changed = true;
        this.prevFrame=0;
        this.timestamp = Date.now();
    }
	get beatValue() {
		return this.timeSignature.split('/').map(number => parseInt(number, 10))[1];
	}

	setMeasureNumber(num) {
		this.measureNumber = num;
	}

	getBeamGroupForNote(note) {
		for (var i = 0; i < this.beamGroups.length; ++i) {
			var bg = this.beamGroups[i];
			for (var j = 0; j < bg.notes.length; ++j) {
				if (bg.notes[j].attrs.id === note.attrs.id) {
					return bg;
				}
			}
		}
		return null;
	}
}
;
// ## Measure modifiers are elements that are attached to the bar itself, like barlines or measure-specific text,
// repeats - lots of stuff
class SmoMeasureModifierBase {
    constructor(ctor) {
        this.ctor = ctor;
		 if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: ctor
            };
        } else {
            console.log('inherit attrs');
        }
    }
    static deserialize(jsonObj) {
        var ctor = eval(jsonObj.ctor);
        var rv = new ctor(jsonObj);
        rv.attrs.id = jsonObj.attrs.id;
        rv.attrs.type = jsonObj.attrs.type;
    }
}

class SmoBarline extends SmoMeasureModifierBase {
    static get positions() {
        return {
            start: 0,
            end: 1
        }
    };

    static get barlines() {
        return {
            singleBar: 0,
            doubleBar: 1,
            endBar: 2,
            startRepeat: 3,
            endRepeat: 4,
            noBar: 5
        }
    }
	
	static get _barlineToString() {
		return  ['singleBar','doubleBar','endBar','startRepeat','endRepeat','noBar'];		
	}
	static barlineString(inst) {
		return SmoBarline._barlineToString[inst.barline];
	}

    static get defaults() {
        return {
            position: SmoBarline.positions.end,
            barline: SmoBarline.barlines.singleBar
        };
    }

    static get attributes() {
        return ['position', 'barline'];
    }
	serialize() {
        var params = {};
        smoMusic.filteredMerge(SmoBarline.attributes, this, params);
        params.ctor = 'SmoBarline';
        return params;    
	}

    constructor(parameters) {
        super('SmoBarline');
        parameters = parameters ? parameters : {};
        smoMusic.serializedMerge(SmoBarline.attributes, SmoBarline.defaults, this);
        smoMusic.serializedMerge(SmoBarline.attributes, parameters, this);       
    }

    static get toVexBarline() {
        return [VF.Barline.type.SINGLE, VF.Barline.type.DOUBLE, VF.Barline.type.END,
            VF.Barline.type.REPEAT_BEGIN, VF.Barline.type.REPEAT_END, VF.Barline.type.NONE];

    }
    static get toVexPosition() {
        return [VF.StaveModifier.BEGIN, VF.StaveModifier.END];
    }

    toVexBarline() {
        return SmoBarline.toVexBarline[this.barline];
    }
    toVexPosition() {
        return SmoBarline.toVexPosition[this.position];
    }
}

class SmoRepeatSymbol extends SmoMeasureModifierBase {
    static get symbols() {
        return {
            None: 0,
            Coda: 1,
            Segno: 2,
            Dc: 3,
			ToCoda:1,
            DcAlCoda: 4,
            DcAlFine: 5,
            Ds: 6,
            DsAlCoda: 7,
            DsAlFine: 8,
            Fine: 9
        };
    }
	
	static get defaultXOffset() {
		return [0,0,0,-20,-60,-60,-50,-60,-50,-40];
	}
    static get positions() {
        return {
            start: 0,
            end: 1
        }
    };
    static get defaults() {
        return {
            symbol: SmoRepeatSymbol.Coda,
            xOffset: 0,
            yOffset: 30,
            position: SmoRepeatSymbol.positions.end
        }
    }
    static get toVexSymbol() {
        return [VF.Repetition.type.NONE, VF.Repetition.type.CODA_LEFT, VF.Repetition.type.SEGNO_LEFT, VF.Repetition.type.DC,
            VF.Repetition.type.DC_AL_CODA, VF.Repetition.type.DC_AL_FINE, VF.Repetition.type.DS, VF.Repetition.type.DS_AL_CODA, VF.Repetition.type.DS_AL_FINE, VF.Repetition.type.FINE];
    }
    static get attributes() {
        return ['symbol', 'xOffset', 'yOffset', 'position'];
    }
    toVexSymbol() {
        return SmoRepeatSymbol.toVexSymbol[this.symbol];
    }
	serialize() {
        var params = {};
        smoMusic.filteredMerge(SmoRepeatSymbol.attributes, this, params);
        params.ctor = 'SmoRepeatSymbol';
        return params;    
	}
    constructor(parameters) {
        super('SmoRepeatSymbol');
        smoMusic.serializedMerge(SmoRepeatSymbol.attributes, SmoRepeatSymbol.defaults, this);
		this.xOffset = SmoRepeatSymbol.defaultXOffset[parameters.symbol];
        smoMusic.serializedMerge(SmoRepeatSymbol.attributes, parameters, this);
    }
}

class SmoVolta extends SmoMeasureModifierBase {
    constructor(parameters) {
        super('SmoVolta');
		this.original={};

		if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: 'SmoVolta'
            };
        } else {
            console.log('inherit attrs');
        }
        smoMusic.serializedMerge(SmoVolta.attributes, SmoVolta.defaults, this);
		smoMusic.serializedMerge(SmoVolta.attributes, parameters, this);
    }
	get id() {
		return this.attrs.id;		
	}
	
	get type() {
		return this.attrs.type;
	}
    static get attributes() {
        return ['startBar', 'endBar', 'endingId','startSelector','endSelector','xOffsetStart', 'xOffsetEnd', 'yOffset', 'number'];
    }
	static get editableAttributes() {
		return ['xOffsetStart','xOffsetEnd','yOffset','number'];	
	}
	
	serialize() {
        var params = {};
        smoMusic.filteredMerge(SmoVolta.attributes, this, params);
        params.ctor = 'SmoVolta';
        return params;    
	}
	
    static get defaults() {
        return {
            startBar: 1,
            endBar: 1,
            xOffsetStart: 0,
            xOffsetEnd: 0,
            yOffset: 20,
            number: 1
        }
    }
	
	 backupOriginal() {
        if (!this['original']) {
            this.original = {};
            smoMusic.filteredMerge(
                SmoVolta.attributes,
                this, this.original);
        }
    }
    restoreOriginal() {
        if (this['original']) {
            smoMusic.filteredMerge(
                SmoVolta.attributes,
                this.original, this);
            this.original = null;
        }
    }
	
	toVexVolta(measureNumber) {
		if (this.startBar === measureNumber && this.startBar === this.endBar) {
			return VF.Volta.type.BEGIN_END;
		}
		if (this.startBar === measureNumber) {
			return VF.Volta.type.BEGIN;
		} 
		if (this.endBar === measureNumber) {
			return VF.Volta.type.END;
		}
		if (this.startBar < measureNumber && this.endBar > measureNumber) {
			return VF.Volta.type.MID;
		}
		return VF.Volta.type.NONE;
	}		
}

class SmoMeasureText extends SmoMeasureModifierBase {
	static get positions() {
		return {above:0,below:1,left:2,right:3};
	}
	
	static get justifications() {
		return {left:0,right:1,center:2}
	}
	
	static get _positionToString() {
		return ['above','below','left','right'];
	}
	
	static get toVexPosition() {
		return [VF.Modifier.Position.ABOVE,VF.Modifier.Position.BELOW,VF.Modifier.Position.LEFT,VF.Modifier.Position.RIGHT];
	}
	static get toVexJustification() {
		return [VF.TextNote.LEFT,VF.TextNote.RIGHT,VF.TextNote.CENTER];
	}
	
	toVexJustification() {
		return SmoMeasureText.toVexJustification[this.justification];
	}
	toVexPosition() {
		return SmoMeasureText.toVexPosition[this.position];
	}
	static get attributes() {
		return ['position','fontInfo','text','adjustX','adjustY','justification'];
	}
	
	static get defaults() {
		return {
			position:SmoMeasureText.positions.above,
			fontInfo: {
				size: '9',
				family:'times',
				style:'normal',
				weight:'normal'
			},
			text:'Smo',
			adjustX:0,
			adjustY:0,
			justification:SmoMeasureText.justifications.center
		};
	}
	serialize() {
        var params = {};
        smoMusic.filteredMerge(SmoMeasureText.attributes, this, params);
        params.ctor = 'SmoMeasureText';
        return params;
	}
	
	constructor(parameters) {
		super('SmoMeasureText');
        parameters = parameters ? parameters : {};
        smoMusic.serializedMerge(SmoMeasureText.attributes, SmoMeasureText.defaults, this);
        smoMusic.serializedMerge(SmoMeasureText.attributes, parameters, this);
		
		// right-justify left text and left-justify right text by default
		if (!parameters['justification']) {
			this.justification = (this.position === SmoMeasureText.positions.left) ? SmoMeasureText.justifications.right : 
			     (this.position === SmoMeasureText.positions.right ? SmoMeasureText.justifications.left : this.justification);
		}
	}
}

class SmoRehearsalMark extends SmoMeasureModifierBase {
	
	static get cardinalities() {
		return {capitals:'capitals',lowerCase:'lowerCase',numbers:'numbers'};
	}
	static get positions() {
		return {above:0,below:1,left:2,right:3};
	}
	static get _positionToString() {
		return ['above','below','left','right'];
	}
	
	// TODO: positions don't work.
	static get defaults() {
		return {
			position:SmoRehearsalMark.positions.above,
			cardinality:SmoRehearsalMark.cardinalities.capitals,
			symbol:'A',
            increment:true
		}
	}
	static get attributes() {
		return ['cardinality','symbol','position','increment'];
	}
	getIncrement() {
		if (!this.cardinality != 'number') {
			var code = this.symbol.charCodeAt(0);
			code += 1;
			var symbol=String.fromCharCode(code);
			return symbol;
		} else {
            return parseInt(symbol)+1;
        }
	}
    getInitial() {
        return this.cardinality == SmoRehearsalMark.cardinalities.capitals ? 'A' : 
            (this.cardinality == SmoRehearsalMark.cardinalities.lowerCase ? 'a' : '1');
    }
	serialize() {
        var params = {};
        smoMusic.filteredMerge(SmoRehearsalMark.attributes, this, params);
        params.ctor = 'SmoRehearsalMark';
        return params;
	}
	constructor(parameters) {
		super('SmoRehearsalMark');
        parameters = parameters ? parameters : {};
        smoMusic.serializedMerge(SmoRehearsalMark.attributes, SmoRehearsalMark.defaults, this);
        smoMusic.serializedMerge(SmoRehearsalMark.attributes, parameters, this);
        if (!parameters.symbol) {
            this.symbol=this.getInitial();
        }
	}
}


class SmoTempoText extends SmoMeasureModifierBase {
	static get tempoModes() {
		return {
			durationMode: 'duration',
			textMode: 'text',
			customMode: 'custom'
		};
	}

	static get tempoTexts() {
		return {
			larghissimo: 'Larghissimo',
			grave: 'Grave',
			lento: 'Lento',
			largo: 'Largo',
			larghetto: 'Larghetto',
			adagio: 'Adagio',
			adagietto: 'Adagietto',
			andante_moderato: 'Andante moderato',
			andante: 'Andante',
			andantino: 'Andantino',
			moderator: 'Moderato',
			allegretto: 'Allegretto', 
			allegro: 'Allegro',
			vivace: 'Vivace',
			presto: 'Presto',
			prestissimo: 'Prestissimo'
		};
	}

	static get defaults() {
		return {
			tempoMode: SmoTempoText.tempoModes.durationMode,
			bpm: 120,
			beatDuration: 4096,
			tempoText: SmoTempoText.tempoTexts.allegro,
            yOffset:0,
		};
	}
	static get attributes() {
		return ['tempoMode', 'bpm', 'tempoMode', 'beatDuration', 'tempoText','yOffset'];
	}
    _toVexTextTempo() {
        return {name:this.tempoText};
    }
    
    _toVexDurationTempo() {
        var vd = smoMusic.ticksToDuration[this.beatDuration];
        var dots = (vd.match(/d/g) || []).length;
        vd=vd.replace(/d/g,'');
        return {duration: vd, dots: dots, bpm: this.bpm };
    }
    toVexTempo() {
        if (this.tempoMode ==  SmoTempoText.tempoModes.durationMode) {
            return this._toVexDurationTempo();
        }
        return this._toVexTextTempo();
    }
    serialize() {
        var params = {};
        smoMusic.filteredMerge(SmoTempoText.attributes, this, params);
        params.ctor = 'SmoTempoText';
        return params;
	}
	constructor(parameters) {
		super('SmoTempoText');
		smoMusic.serializedMerge(SmoTempoText.attributes, SmoTempoText.defaults, this);
		smoMusic.serializedMerge(SmoTempoText.attributes, parameters, this);
	}
}
;

// ## SmoSystemStaff
// ## Description:
// A staff is a line of music that can span multiple measures.
class SmoSystemStaff {
    constructor(params) {
        this.measures = [];
        Vex.Merge(this, SmoSystemStaff.defaults);
        Vex.Merge(this, params);
        if (this.measures.length) {
            this.numberMeasures();
        }
        if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: 'SmoSystemStaff'
            };
        } else {
            // inherit attrs id for deserialized

        }
    }
	
	static get defaultParameters() {
		return [
		'staffId','staffX','staffY','adjY','staffWidth','staffHeight','startIndex',
            'renumberingMap','keySignatureMap','instrumentInfo'];
	}
	
    static get defaults() {
        return {
            staffX: 10,
            staffY: 40,
            adjY: 0,
            staffWidth: 1600,
            staffHeight: 90,
            startIndex: 0,
			staffId:0,
            renumberingMap: {},
            keySignatureMap: {},
            instrumentInfo: {
                instrumentName: 'Treble Instrument',
                keyOffset: '0',
                clef: 'treble'
            },
            measures: [],
            modifiers: []
        };
    }
	
	serialize() {
		var params={};
		smoMusic.serializedMerge(SmoSystemStaff.defaultParameters,this,params);
		params.modifiers=[];
		params.measures=[];
		
		
		this.measures.forEach((measure) => {
			params.measures.push(measure.serialize());
		});
		
		this.modifiers.forEach((modifier) => {
			params.modifiers.push(modifier.serialize());
		});
		
		return params;
	}

    static deserialize(jsonObj) {
        var params = {};
        smoMusic.serializedMerge(
            ['staffId','staffX', 'staffY', 'staffWidth', 'startIndex', 'renumberingMap', 'renumberIndex', 'instrumentInfo'],
            jsonObj, params);
        params.measures = [];
        jsonObj.measures.forEach(function (measureObj) {
            var measure = SmoMeasure.deserialize(measureObj);
            params.measures.push(measure);
        });

        var rv = new SmoSystemStaff(params);

        if (jsonObj.modifiers) {
            jsonObj.modifiers.forEach((params) => {
                var mod = StaffModifierBase.deserialize(params);
                rv.modifiers.push(mod);
            });
        }
		return rv;
    }

    addStaffModifier(modifier) {
        this.removeStaffModifier(modifier);
        this.modifiers.push(modifier);
    }

    removeStaffModifier(modifier) {
        var mods = [];
        this.modifiers.forEach((mod) => {
            if (mod.id != modifier.id) {
                mods.push(mod);
            }
        });
        this.modifiers = mods;
    }
	
	getModifiesrAt(selector) {
		var rv = [];
		this.modifiers.forEach((mod) => {
			if (SmoSelector.sameNote(mod.startSelector,selector)) {
				rv.push(mod);
			}
		});
		return rv;
	}

    getModifierMeasures(modifier) {
        return {
            startMeasure: this.measures.find((measure) => measure.attrs.id === modifier.startMeasure),
            endMeasure: this.measures.find((measure) => measure.attrs.id === modifier.endMeasure),
        }
    }

    applyBeams() {
        for (var i = 0; i < this.measures.length; ++i) {
            var measure = this.measures[i];
            smoBeamerFactory.applyBeams(measure);
        }
    }

    getRenderedNote(id) {
        for (var i = 0; i < this.measures.length; ++i) {
            var measure = this.measures[i];
            var note = measure.getRenderedNote(id);
            if (note)
                return {
                    smoMeasure: measure,
                    smoNote: note.smoNote,
                    smoSystem: this,
                    selection: {
                        measureIndex: measure.measureNumber.measureIndex,
                        voice: measure.activeVoice,
                        tick: note.tick,
                        maxTickIndex: measure.notes.length,
                        maxMeasureIndex: this.measures.length
                    },
                    type: note.smoNote.attrs.type,
                    id: note.smoNote.id
                };
        }
        return null;
    }
    
    addRehearsalMark(index,parameters) {
        var mark = new SmoRehearsalMark(parameters);
        if (!mark.increment) {            
            this.measures[index].addRehearsalMark(mark);
            return;
        }
        
        var symbol = mark.symbol;
        for (var i=0;i<this.measures.length;++i) {
            var mm = this.measures[i];
            if (i < index) {
                var rm = mm.getRehearsalMark();
                if (rm && rm.cardinality==mark.cardinality && rm.increment) {
                   symbol = rm.getIncrement();                   
                   mark.symbol=symbol;
                }
            } 
            if (i === index) {
                mm.addRehearsalMark(mark);
                symbol = mark.getIncrement();
            }
            if (i > index) {
                var rm = mm.getRehearsalMark();
                if (rm && rm.cardinality==mark.cardinality && rm.increment) {
                    rm.symbol = symbol;
                    symbol = rm.getIncrement();
                }
            }
        }
    }
    
    removeTempo(index) {
        this.measures[index].removeTempo();        
    }
    
    addTempo(tempo,index) {
        this.measures[index].addTempo(tempo);
    }
    
    removeRehearsalMark(index) {
        var ix = 0;
        var symbol=null;
        var card = null;
        this.measures.forEach((measure) => {
            if (ix == index) {
                var mark = measure.getRehearsalMark();
                if (mark) {
                    symbol = mark.symbol;
                    card = mark.cardinality;
                }
                measure.removeRehearsalMark();
            }
            if (ix > index && symbol && card) {
                var mark = measure.getRehearsalMark();
                if (mark && mark.increment) {
                    mark.symbol = symbol;
                    symbol = mark.getIncrement();
                }
            }
            
            ix += 1;
        });
    }
	
	deleteMeasure(index) {
		if (this.measures.length < 2) {
			return; // don't delete last measure.
		}
		var nm=[];
		this.measures.forEach((measure) => {
			if (measure.measureNumber.measureIndex != index) {
				nm.push(measure);
			}
		});
		var sm=[];
		this.modifiers.forEach((mod)=> {
            // Bug: if we are deleting a measure before the selector, change the measure number.
			if (mod.startSelector.measure != index && mod.endSelector.measure != index) {
                if (index < mod.startSelector.measure) {
                    mod.startSelector.measure -= 1;
                }
                if (index < mod.endSelector.measure) {
                    mod.endSelector.measure -= 1;
                }
				sm.push(mod);
			}
		});
		this.measures=nm;
		this.modifiers=sm;
		this.numberMeasures();
	}

    getMaxTicksMeasure(measure) {
        if (this.measures.length < measure) {
            return 0;
        }
        return this.measures[measure].notes.length;
    }
    addKeySignature(measureIndex, key) {
        this.keySignatureMap[measureIndex] = key;
		var target = this.measures[measureIndex];
		target.keySignature = key;		
        // this._updateKeySignatures();
    }
    removeKeySignature(measureIndex) {
        var keys = Object.keys(this.keySignatureMap);
        var nmap = {};
        keys.forEach((key) => {
            if (key !== measureIndex) {
                nmap[key] = this.keySignatureMap[key];
            }
        });
        this.keySignatureMap = nmap;
        this._updateKeySignatures();
    }
    _updateKeySignatures() {
        var currentSig = this.measures[0].keySignature;

        for (var i = 0; i < this.measures.length; ++i) {
            var measure = this.measures[i];

            var nextSig = this.keySignatureMap[i] ? this.keySignatureMap[i] : currentSig;
            measure.setKeySignature(nextSig);
        }
    }
    numberMeasures() {
        this.renumberIndex = this.startIndex;

        for (var i = 0; i < this.measures.length; ++i) {
            var measure = this.measures[i];

            this.renumberIndex = this.renumberingMap[i] ? this.renumberingMap[i].startIndex : this.renumberIndex;
            var localIndex = this.renumberIndex + i;
            var numberObj = {
                measureNumber: localIndex,
                measureIndex: i + this.startIndex,
                systemIndex: i,
				staffId:this.staffId
            }
            measure.setMeasureNumber(numberObj);
			// If we are renumbering measures, we assume we want to redo the layout so set measures to changed.
			measure.changed=true;
        }
    }
    getSelection(measureNumber, voice, tick, pitches) {
        for (var i = 0; i < this.measures.length; ++i) {
            var measure = this.measures[i];
            if (measure.measureNumber.measureNumber === measureNumber) {
                var target = this.measures[i].getSelection(voice, tick, pitches);
                if (!target) {
                    return null;
                }
                return ({
                    measure: measure,
                    note: target.note,
                    selection: target.selection
                });
            }
        }
        return null;
    }

    addDefaultMeasure(index, params) {
        var measure = SmoMeasure.getDefaultMeasure(params);
        this.addMeasure(index, measure);
    }

    // ## addMeasure
    // ## Description:
    // Add the measure at the specified index, splicing the array as required.
    addMeasure(index, measure) {

        if (index === 0 && this.measures.length) {
            measure.setMeasureNumber(this.measures[0].measureNumber);
        }
        if (index >= this.measures.length) {
            this.measures.push(measure);
        } else {
            this.measures.splice(index, 0, measure);
        }

        this.numberMeasures();
    }
}
;
// ## SmoScore
// ## Description:
// The whole score.
// ## Score methods:
// ---
class SmoScore {
    constructor(params) {
        Vex.Merge(this, SmoScore.defaults);
        Vex.Merge(this, params);
        if (this.staves.length) {
            this._numberStaves();
        }
    }
	static get zoomModes() {
		return {fitWidth:0,wholePage:1,zoomScale:2}
	}
    static get defaults() {
        return {
			layout :{
				leftMargin:30,
				rightMargin:30,
				topMargin:40,
				bottomMargin:40,
				pageWidth: 8 * 96 + 48,
				pageHeight: 11 * 96,
				orientation:SmoScore.orientations.portrait,
				interGap: 30,
				intraGap:10,
				svgScale: 1.0,
				zoomScale: 2.0,
				zoomMode:SmoScore.zoomModes.zoomScale
			},
            staffWidth: 1600,
            startIndex: 0,
            renumberingMap: {},
            keySignatureMap: {},
            measureTickmap: [],
            staves: [],
            activeStaff: 0,
			scoreText:[]
        };
    }
	static get pageSizes() {
		return ['letter','tabloid','A4','custom'];
	}
	static get pageDimensions() {
		return {
			'letter':{width:8*96+48,height:11*96},			
			'tabloid':{width:1056,height:1632},
			'A4':{width:794,height:1122},
			'custom':{width:1,height:1}
		}
	}
    
	static get orientationLabels() {
		return ['portrait','landscape'];
	}
	static get orientations() {
		return {'portrait':0,'landscape':1};
	}
	
    static get defaultAttributes() {
        return ['layout' ,'startIndex',  'renumberingMap', 'renumberIndex'];
    }

    // ### serialize
    // ### Serialize the score.  The resulting JSON string will contain all the staves, measures, etc.
    serialize() {
        var params = {};
        smoMusic.serializedMerge(SmoScore.defaultAttributes, this, params);
        var obj = {
            score: params,
            staves: [],
			scoreText:[]
        };
        this.staves.forEach((staff) => {
            obj.staves.push(staff.serialize());
        });
		
		this.scoreText.forEach((tt) => {
			obj.scoreText.push(tt.serialize());
		});
        return obj;
    }
    // ### deserialize
    // ### Restore an earlier JSON string.  Unlike other deserialize methods, this one expects the string.
    static deserialize(jsonString) {
        var jsonObj = JSON.parse(jsonString);
        var params = {};
        var staves = [];
        smoMusic.serializedMerge(
            SmoScore.defaultAttributes,
            jsonObj.score, params);
        jsonObj.staves.forEach((staffObj) => {
            var staff = SmoSystemStaff.deserialize(staffObj);
            staves.push(staff);
        });
		var scoreText=[];
		jsonObj.scoreText.forEach((tt) => {
			scoreText.push(SmoScoreText.deserialize(tt));
		});
        params.staves = staves;

        let score = new SmoScore(params);
		score.scoreText=scoreText;
		return score;
    }

    // ### getDefaultScore
    // ### Description:
    // Gets a score consisting of a single measure with all the defaults.
    static getDefaultScore(scoreDefaults, measureDefaults) {
        scoreDefaults = (scoreDefaults != null ? scoreDefaults : SmoScore.defaults);
        measureDefaults = (measureDefaults != null ? measureDefaults : SmoMeasure.defaults);
        var score = new SmoScore(scoreDefaults);
        score.addStaff({measureDefaults:measureDefaults});
        var measure = SmoMeasure.getDefaultMeasure(measureDefaults);
        score.addMeasure(0, measure);
        measure.voices.push({
            notes: SmoMeasure.getDefaultNotes(measureDefaults)
        });
        return score;
    }

    // ### getEmptyScore
    // ### Description:
    // Create a score object, but don't populate it with anything.
    static getEmptyScore(scoreDefaults) {
        var score = new SmoScore(scoreDefaults);
        score.addStaff();
        return score;
    }

    // ### _numberStaves
    // recursively renumber staffs and measures.
    _numberStaves() {
        for (var i = 0; i < this.staves.length; ++i) {
            var stave = this.staves[i];
			stave.staffId=i;
            stave.numberMeasures();
        }
    }

    // ### addDefaultMeasureWithNotes
    // ### Description:
    // Add a measure to the score with the supplied parameters at the supplied index.
    // The defaults per staff may be different depending on the clef, key of the staff.
    addDefaultMeasureWithNotes(measureIndex, parameters) {
        this.staves.forEach((staff) => {
            var defaultMeasure =
                SmoMeasure.getDefaultMeasureWithNotes(parameters);
            staff.addMeasure(measureIndex, defaultMeasure);
        });
    }

    // ### deleteMeasure
    // Delete the measure at the supplied index in all the staves.
    deleteMeasure(measureIndex) {
        this.staves.forEach((staff) => {
            staff.deleteMeasure(measureIndex);
        });

    }

    // ### addMeasure
    // Give a measure prototype, create a new measure and add it to each staff, with the
    // correct settings for current time signature/clef.
    addMeasure(measureIndex, measure) {

        for (var i = 0; i < this.staves.length; ++i) {
            var protomeasure = measure;
            var staff = this.staves[i];
            // Since this staff may already have instrument settings, use the
            // immediately preceeding or post-ceding measure if it exists.
            if (measureIndex < staff.measures.length) {
                protomeasure = staff.measures[measureIndex];
            } else if (staff.measures.length) {
                protomeasure = staff.measures[staff.measure.length - 1];
            }
            var nmeasure = SmoMeasure.getDefaultMeasureWithNotes(protomeasure);
            staff.addMeasure(measureIndex, nmeasure);
        }
        this._numberStaves();
    }

    // ### replaceMeasure
    // Replace the measure at the given location.  Probably due to an undo operation or paste.
    replaceMeasure(selector, measure) {
        var staff = this.staves[selector.staff];
        staff.measures[selector.measure] = measure;
    }

    // ### addScoreText 
    // 
	
    // ### replace staff
	// Probably due to an undo operation, replace the staff at the given index.
    replaceStaff(index, staff) {
        var staves = [];
        for (var i = 0; i < this.staves.length; ++i) {
            if (i != index) {
                staves.push(this.staves[i]);
            } else {
                staves.push(staff);
            }
        }
        this.staves = staves;
    }
    // ### addKeySignature
    // Add a key signature at the specified index in all staves.
    addKeySignature(measureIndex, key) {
        this.staves.forEach((staff) => {
            staff.addKeySignature(measureIndex, key);
        });
    }

    // ### addInstrument
    // add a new staff (instrument) to the score
    addStaff(parameters) {
        if (this.staves.length == 0) {
            this.staves.push(new SmoSystemStaff(parameters));
            this.activeStaff = 0;
            return;
        }
        if (!parameters) {
            parameters = SmoSystemStaff.defaults;
        }
        var proto = this.staves[0];
        var measures = [];
        for (var i = 0; i < proto.measures.length; ++i) {
            var newParams = {};
            var measure = proto.measures[i];
            smoMusic.serializedMerge(SmoMeasure.defaultAttributes, measure, newParams);
            newParams.clef = parameters.instrumentInfo.clef;
            newParams.transposeIndex = parameters.instrumentInfo.keyOffset;
            var newMeasure = SmoMeasure.getDefaultMeasureWithNotes(newParams);
            newMeasure.measureNumber = measure.measureNumber;
			newMeasure.modifiers=[];
			measure.modifiers.forEach((modifier) => {
				var ctor = eval(modifier.ctor);
                var nmod = new ctor(modifier);
				newMeasure.modifiers.push(nmod);
			});
            measures.push(newMeasure);
        }
        parameters.measures = measures;
        var staff = new SmoSystemStaff(parameters);
        this.staves.push(staff);
        this.activeStaff = this.staves.length - 1;
		this._numberStaves();
    }

    // ### removeStaff
	// Remove stave at the given index
    removeStaff(index) {
        var staves = [];
        var ix = 0;
        this.staves.forEach((staff) => {
            if (ix != index) {
                staves.push(staff);
            }
            ix += 1;
        });
        this.staves = staves;
        this._numberStaves();
    }
	
	_updateScoreText(textObject,toAdd) {
		var texts=[];
		this.scoreText.forEach((tt) => {
			if (textObject.attrs.id !=  tt.attrs.id) {
				texts.push(tt);
			}
		});
	    if (toAdd) {
			texts.push(textObject);
		}
		this.scoreText = texts;
	}
	
	addScoreText(textObject) {
		this._updateScoreText(textObject,true);
	}
	
	getScoreText(id) {
		if (!this.scoreText.length) {
			return null;
		}
		var ar = this.scoreText.filter((tt) => {
			return tt.attrs.id=id;
		});
		if(ar.length) {
			return ar[0];
		}
		return null;
	}
	
	removeScoreText(textObject) {
		this._updateScoreText(textObject,false);
	}	

    getMaxTicksMeasure(measure) {
        return this.staves[this.activeStaff].getMaxTicksMeasure(measure);
    }
    get measures() {
        if (this.staves.length === 0)
            return [];
        return this.staves[this.activeStaff].measures;
    }
    incrementActiveStaff(offset) {
        if (offset < 0)
            offset = (-1 * offset) + this.staves.length;
        var nextStaff = (this.activeStaff + offset) % this.staves.length;
        if (nextStaff >= 0 && nextStaff < this.staves.length) {
            this.activeStaff = nextStaff;
        }
        return this.activeStaff;
    }

    setActiveStaff(index) {
        this.activeStaff = index <= this.staves.length ? index : this.activeStaff;
    }

    getRenderedNote(id) {
        for (var i = 0; i < this.staves.length; ++i) {
            var stave = this.staves[i];
            var note = stave.getRenderedNote(id);
            if (note) {
                note.selection.staffIndex = i;
                return note;
            }
        }
        return null;
    }
}
;
// ## StaffModifiers
// ## Description:
// This file contains modifiers that might take up multiple measures, and are thus associated
// with the staff.
// ## Staff Modifier Classes:
// ---
// ## StaffModifierBase
// ## Description:
// Base class that mostly standardizes the interface and deals with serialization.
class StaffModifierBase {
    constructor(ctor) {
        this.ctor = ctor;
    }
    static deserialize(params) {
        var ctor = eval(params.attrs.type);
        var rv = new ctor(params);
        rv.attrs.id = params.attrs.id;
        rv.attrs.type = params.attrs.type;
		return rv;
    }
}
// ## SmoStaffHairpin
// ## Descpription:
// crescendo/decrescendo
class SmoStaffHairpin extends StaffModifierBase {
    constructor(params) {
        super('SmoStaffHairpin');
        Vex.Merge(this, SmoStaffHairpin.defaults);
        smoMusic.filteredMerge(['position', 'xOffset', 'yOffset', 'hairpinType', 'height'], params, this);
        this.startSelector = params.startSelector;
        this.endSelector = params.endSelector;

        if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: 'SmoStaffHairpin'
            };
        } else {
            console.log('inherit attrs');
        }
    }
	static get editableAttributes() {
		return ['xOffsetLeft', 'xOffsetRight', 'yOffset', 'height'];
	}
    serialize() {
        var params = {};
        smoMusic.filteredMerge(['position', 'startSelector','endSelector','attrs','xOffset', 'yOffset', 'hairpinType', 'height'], this, params);
        params.ctor = 'SmoStaffHairpin';
        return params;
    }
    get id() {
        return this.attrs.id;
    }
    get type() {
        return this.attrs.type;
    }

    backupOriginal() {
        if (!this['original']) {
            this.original = {};
            smoMusic.filteredMerge(
                ['xOffsetLeft', 'xOffsetRight', 'yOffset', 'height', 'position', 'hairpinType'],
                this, this.original);
        }
    }
    restoreOriginal() {
        if (this['original']) {
            smoMusic.filteredMerge(
                ['xOffsetLeft', 'xOffsetRight', 'yOffset', 'height', 'position', 'hairpinType'],
                this.original, this);
            this.original = null;
        }
    }
    static get defaults() {
        return {
            xOffsetLeft: -2,
            xOffsetRight: 0,
            yOffset: -50,
            height: 10,
            position: SmoStaffHairpin.positions.BELOW,
            hairpinType: SmoStaffHairpin.types.CRESCENDO

        };
    }
    static get positions() {
        // matches VF.modifier
        return {
            LEFT: 1,
            RIGHT: 2,
            ABOVE: 3,
            BELOW: 4,
        };
    }
    static get types() {
        return {
            CRESCENDO: 1,
            DECRESCENDO: 2
        };
    }
}

// ## SmoSlur
// ## Description:
// slur staff modifier
// ## SmoSlur Methods:
// ---
class SmoSlur extends StaffModifierBase {
    static get defaults() {
        return {
            spacing: 2,
            thickness: 2,
            xOffset: 0,
            yOffset: 10,			
            position: SmoSlur.positions.HEAD,
            position_end: SmoSlur.positions.HEAD,
            invert: false,
            cp1x: 0,
            cp1y: 40,
            cp2x: 0,
            cp2y: 40
        };
    }

    // matches VF curve
    static get positions() {
        return {
            HEAD: 1,
            TOP: 2
        };
    }
    static get parameterArray() {
        return ['startSelector','endSelector','spacing', 'xOffset', 'yOffset', 'position', 'position_end', 'invert',
            'cp1x', 'cp1y', 'cp2x', 'cp2y','attrs','thickness'];
    }

    serialize() {
        var params = {};
        smoMusic.filteredMerge(SmoSlur.parameterArray, this, params);
        params.ctor = 'SmoSlur';
        return params;
    }

    backupOriginal() {
        if (!this['original']) {
            this.original = {};
            smoMusic.filteredMerge(
                SmoSlur.parameterArray,
                this, this.original);
        }
    }
    restoreOriginal() {
        if (this['original']) {
            smoMusic.filteredMerge(
                SmoSlur.parameterArray,
                this.original, this);
            this.original = null;
        }
    }
    get controlPoints() {
        var ar = [{
                x: this.cp1x,
                y: this.cp1y
            }, {
                x: this.cp2x,
                y: this.cp2y
            }
        ];
        return ar;
    }
		
    get type() {
        return this.attrs.type;
    }
    get id() {
        return this.attrs.id;
    }

    constructor(params) {
        super('SmoSlur');
        smoMusic.serializedMerge(SmoSlur.parameterArray,SmoSlur.defaults,this);
		Vex.Merge(this,SmoSlur.defaults);
		smoMusic.filteredMerge(SmoSlur.parameterArray,params,this);
        smoMusic.serializedMerge(SmoSlur.parameterArray, params, this);
        this.startSelector = params.startSelector;
        this.endSelector = params.endSelector;
        if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: 'SmoSlur'
            };
        }
    }
}
;
class SmoScoreModifierBase {
    constructor(ctor) {
        this.ctor = ctor;
		 if (!this['attrs']) {
            this.attrs = {
                id: VF.Element.newID(),
                type: ctor
            };
        } else {
            console.log('inherit attrs');
        }
    }
    static deserialize(jsonObj) {
        var ctor = eval(jsonObj.ctor);
        var rv = new ctor(jsonObj);
        rv.attrs.id = jsonObj.attrs.id;
        rv.attrs.type = jsonObj.attrs.type;
        return rv;
    }
}

// ## SmoScoreText
// Identify some text in the score, not associated with any musical element, like page 
// decorations, titles etc.
class SmoScoreText extends SmoScoreModifierBase {	

    static get paginations() {
		return {every:'every',even:'even',odd:'odd',once:'once'}
	}
	static get positions() {
		return {title:'title',copyright:'copyright',footer:'footer',header:'header',custom:'custom'};
	}
	static get justifications() {
		return {left:'left',right:'right',center:'center'};
	}
    static get fontFamilies() {
        return {serif:'serif',sansSerif:'sans-serif',monospace:'monospace',cursive:'cursive',
           times:'Times New Roman',arial:'Arial',helvitica:'Helvitica'};
        
    }
	// If box model is 'none', the font and location determine the size.  
	// spacing and spacingGlyph fit the box into a container based on the svg policy
	static get boxModels() {
		return {none:'none',spacing:'spacing',spacingAndGlyphs:'spacingAndGlyphs',wrap:'wrap'};
	}
    static get defaults() {
        return {
            x:15,
			y:15,
			width:0,
			height:0,
            text: 'Smoosic',
			fontInfo: {
				size: '1em',
				family:SmoScoreText.fontFamilies.times,
				style:'normal',
				weight:'normal'
			},
			fill:'black',
			rotate:0,
			justification:SmoScoreText.justifications.left,
			classes:'score-text',
			boxModel:'none',
			scaleX:1.0,
			scaleY:1.0,
			translateX:0,
			translateY:0,
			pagination:'every',
			position:'custom',
			autoLayout:false // set to true if one of the pre-canned positions are used.
        };
    }
	static toSvgAttributes(inst) {
		var rv=[];
		var fkeys = Object.keys(inst.fontInfo);
		fkeys.forEach((key) => {
			var n='{"font-'+key+'":"'+inst.fontInfo[key]+'"}';
			rv.push(JSON.parse(n));
		});
		var attrs = SmoScoreText.attributes.filter((x) => {return x != 'fontInfo' && x != 'boxModel'});
		rv.push({fill:inst.fill});
		rv.push({x:inst.x});
		rv.push({y:inst.y});
		if (inst.boxModel != 'none' && inst.width) {
			var len = ''+inst.width+'px';
			rv.push({textLength:len});
			// rv.push({lengthAdjust:inst.boxModel});
		}
		rv.push({transform:'translate ('+inst.translateX+' '+inst.translateY+') scale ('+
		    inst.scaleX+' '+inst.scaleY+')'});
		return rv;
	}
	
	toSvgAttributes() {
		return SmoScoreText.toSvgAttributes(this);
	}
	
	// ### backupParams
	// For animation or estimation, create a copy of the attributes that can be modified without affecting settings.
	backupParams() {
		this.backup={};
		smoMusic.serializedMerge(SmoScoreText.attributes, this, this.backup);
		return this.backup;
	}
    
    restoreParams() {
        smoMusic.serializedMerge(SmoScoreText.attributes, this.backup, this);
    }
    
	serialize() {
		var params = JSON.parse(JSON.stringify(this));
        params.ctor = 'SmoScoreText';
        return params;    
	}
    static get attributes() {
        return ['x','y','text','pagination','position','fontInfo','classes',
		    'boxModel','justification','fill','width','height','scaleX','scaleY','translateX','translateY','autoLayout'];
    }
	// scale the text without moving it.
	scaleInPlace(factor) {		
		this.scaleX = this.scaleX*factor;
		this.scaleY = this.scaleY*factor;
		var deltax = this.x - this.x*this.scaleX;
		var deltay = this.y - this.y*this.scaleY;
		this.translateX = deltax;
		this.translateY = deltay;		
	}
    scaleXInPlace(factor) {
		this.scaleX = factor;
		var deltax = this.x - this.x*this.scaleX;
		this.translateX = deltax;
    }
    scaleYInPlace(factor) {
		this.scaleY = factor;
		var deltay = this.y - this.y*this.scaleY;
		this.translateY = deltay;		
    }
    constructor(parameters) {
        super('SmoScoreText');
        parameters = parameters ? parameters : {};
        this.backup={};
        this.edited = false; // indicate to UI that the actual text has not been edited.
		
		smoMusic.serializedMerge(SmoScoreText.attributes, SmoScoreText.defaults, this);
        smoMusic.serializedMerge(SmoScoreText.attributes, parameters, this);
		if (!this.classes) {
			this.classes='';
		}
        if (this.classes.indexOf(this.attrs.id) < 0) {
            this.classes += ' '+this.attrs.id;
        }
		if (!parameters.pagination) {
			this.pagination = this.position==SmoScoreText.positions.custom || this.position==SmoScoreText.positions.title ? 
              SmoScoreText.paginations.every : 	SmoScoreText.paginations.once;
		}
		if (this.boxModel === SmoScoreText.boxModels.wrap) {
			this.width = parameters.width ? this.width : 200;
			this.height = parameters.height ? this.height : 150;
			if (!parameters.justification) {
				this.justification = this.position === SmoScoreText.positions.copyright 
						? SmoScoreText.justifications.right : SmoScoreText.justifications.center;

			}
		}
		if (this.position != SmoScoreText.positions.custom && !parameters['autoLayout']) {
			this.autoLayout = true;
			if (this.position == SmoScoreText.positions.title) {
				this.fontInfo.size='1.8em';
			} else {
				this.fontInfo.size='.6em';				
			}
		}
    }  
}
	

;
VF = Vex.Flow;
Vex.Xform = (typeof(Vex.Xform) == 'undefined' ? {}
     : Vex.Xform);
VX = Vex.Xform;

// ## smoTickIterator
// This file implements over the notes in a single measure.
// This is useful when redrawing the notes to transform them into something else.
// E.g. changing the duration of a note in a measure.  It keeps track of accidentals,
// ticks used etc.
// ### Usage:
// ``javascript``
// `var iterator=new smoTickIterator(measure)
// `iterator.iterate (actor)`
// where actor is a function that is called at each tick in the voice.
//
// ### iterator format:
//   iterator: {
//      notes:[note1,note2...],
//      delta: tick value of this note
//      totalDuration: ticks up until this point
//      note: current note,
//      index: running index
//
// ### Tickmap format
// `VX.TICKMAP(measure)`
// Iterate through all notes and creates information about the notes, like
// tuplet ticks, index-to-tick map.  The tickmap is useful for finding things out like how much
// time is left in a measure at a given note index (tickIndex).
//
//     tickmap = {
//        totalDuration: 16384,
//        accidentalMap:[{'F':'#','G':'b'},....
//        durationMap:[2048,4096,..],  // A running total
//        deltaMap:[2048,2048...], a map of deltas
//        tupletMap: {
//          noteId1:
//          {startIndex:1,endIndex:3,numNotes:3,startTick:4096,endTick:8196,durations:[1365,...],smallestDuration:2048}
//
//
// ## method documentation follows
// ---
class smoTickIterator {

    constructor(measure, options) {
        this.notes = measure.notes;
        this.keySignature = measure.keySignature;
        this.index = 0;
        this.startIndex = 0;
        this.endIndex = this.notes.length;

        Vex.Merge(this, options);

        // so a client can tell if the iterator's been run or not
        var states = ['CREATED', 'RUNNING', 'COMPLETE'];
        this.state = 'CREATED';

        // ticks as we iterate.
        // duration is duration of the current range
        this.duration = 0;
        // duration is the accumulated duraition over all the notes
        this.totalDuration = 0;
        // delta is the tick contribution of this note
        this.delta = 0;
        // the tick start location of notes[x]
        this.durationMap = [];
        this.deltaMap = [];

        this.tupletMap = {};
        this.accidentalMap = [];

        this.hasRun = false;
        this.beattime = 4096;
        if (this.voice)
            this.beattime = this.voice.time.resolution / this.voice.time.num_beats;

    }

    // empty function for a default iterator (tickmap)
    static nullActor() {}

    // ### _getAccidentalsForKey
    // Update `map` with the correct accidental based on the key signature.
    static _getAccidentalsForKey(keySignature, map) {
        var music = new VF.Music();
        var keys = music.createScaleMap(keySignature);
        var keyKeys = Object.keys(keys);
        keyKeys.forEach((keyKey) => {
            var vexKey = keys[keyKey];
            if (vexKey.length > 1 && (vexKey[1] === 'b' || vexKey[1] === '#')) {
                map[vexKey[0]] = {
                    letter: vexKey[0],
                    accidental: vexKey[1]
                };
            }
        });
    }
	
	// ### updateAccidentalMap
	// Keep a running tally of the accidentals based on the key and previous accidentals.
    static updateAccidentalMap(note, iterator, keySignature, accidentalMap) {
        var sigObj = {};
        var newObj = {};
        if (iterator.index === 0) {
            smoTickIterator._getAccidentalsForKey(keySignature, newObj);
            sigObj = newObj;
        } else {
            sigObj = accidentalMap[iterator.index - 1];
        }
        for (var i = 0; i < note.pitches.length; ++i) {
            var pitch = note.pitches[i];
            var letter = pitch.letter.toLowerCase();
            var sigLetter = letter + pitch.accidental;
            var sigKey = smoMusic.getKeySignatureKey(letter, keySignature);

            if (sigObj && sigObj[letter]) {
                var currentVal = sigObj[letter].key + sigObj[letter].accidental;
                if (sigLetter != currentVal) {
                    newObj[letter] = pitch;
                }
            } else {
                if (sigLetter != sigKey) {
                    newObj[letter] = pitch;
                }
            }
        }
        accidentalMap.push(newObj);
    }

	// ### getActiveAccidental
	// return the active accidental for the given note
    getActiveAccidental(pitch, iteratorIndex, keySignature) {
		var defaultAccidental = smoMusic.getKeySignatureKey(pitch.letter, keySignature);
		defaultAccidental = defaultAccidental.length > 1 ? defaultAccidental[1] : 'n';
        if (iteratorIndex === 0)
            return defaultAccidental;
        var accidental = pitch.accidental.length > 0 ? pitch.accidental : 'n';
		var letter = pitch.letter;

        // Back up the accidental map until we have a match, or until we run out
        for (var i = iteratorIndex; i > 0; --i) {
            var map = this.accidentalMap[i - 1];
            var mapKeys = Object.keys(map);
            for (var j = 0; j < mapKeys.length; ++j) {
                var mapKey = mapKeys[j];
                // The letter name + accidental in the map
                var mapLetter = map[mapKey];
                var mapAcc = mapLetter.accidental ? mapLetter.accidental : 'n';

                // if the letters match and the accidental...
                if (mapLetter.letter.toLowerCase() === letter) {
                    return mapAcc;
                }
            }
        }
        return defaultAccidental;
    }
    getTupletInfo(index) {
        var tuplets = Object.keys(this.tupletMap);
        for (var i = 0; i < tuplets.length; ++i) {
            var tupletInfo = this.tupletMap[tuplets[i]];
            if (tupletInfo.startIndex <= index && tupletInfo.endIndex >= index) {
                return tupletInfo;
            }
        }
        return {};
    }

    // ### _iterate
    // Internal callback for iterator.
    _iterate(actor) {
        this.state = 'RUNNING';
        for (this.index = this.startIndex; this.index < this.endIndex; ++this.index) {
            var note = this.notes[this.index];

            // save the starting point, tickwise
            this.durationMap.push(this.totalDuration);

            // the number of ticks for this note
            this.delta = (note.ticks.numerator / note.ticks.denominator) + note.ticks.remainder;
            this.deltaMap.push(this.delta);

            if (note['tuplet'] && note.tuplet['attrs']) {
                var normalizedTicks = VF.durationToTicks(note.duration);
                if (typeof(this.tupletMap[note.tuplet.attrs.id]) == 'undefined') {
                    this.tupletMap[note.tuplet.attrs.id] = {
                        startIndex: this.index,
                        tupletIndex: 0,
                        startTick: this.totalDuration,
                        smallestDuration: normalizedTicks,
                        num_notes: note.tuplet.num_notes,
                        durations: [this.delta]
                    };
                } else {
                    var entry = this.tupletMap[note.tuplet.attrs.id];

                    entry.endIndex = this.index;
                    entry.endTick = this.totalDuration + this.delta;
                    entry.smallestDuration = ((normalizedTicks < entry.smallestDuration) ? normalizedTicks : entry.smallestDuration);
                    entry.durations.push(this.delta);
                }
            }

            // update the tick count for the current range.
            this.duration += this.delta;

            // update the tick count for the whole array/measure
            this.totalDuration += this.delta;

            smoTickIterator.updateAccidentalMap(note, this, this.keySignature, this.accidentalMap);

            var rv = actor(this, note, this.accidentalMap);
            if (rv === false) {
                break;
            }
        }
        this.state = 'COMPLETE';
    }

    // ### iterate
    // Call `actor` for each iterator tick
    iterate(actor) {
        // todo add promise
        this._iterate(actor);
    }

    // ### getTickIndex
    // get the index into notes array that takes up
    // duration of ticks */
    getTickIndex(index, duration) {
        if (index == 0)
            return 0;
        var initial = this.durationMap[index];
        var delta = 0;
        while (index < this.notes.length && delta < duration) {
            index += 1;
            delta += this.durationMap[index] - this.durationMap[index - 1];
        }
        return index;
    }
    // ### skipNext
    // skip some number of notes in the iteration, because we want to skip over them.
    skipNext(skipCount) {
        var rv = [];
        var startRange = this.index;
        // var tuplen = note.tupletStack[0].notes.length;
        var endRange = this.index + skipCount;
        rv = this.notes.slice(startRange, endRange);
        this.index = endRange;
        // this.startRange = this.index;
        return rv;
    }
}

class smoMeasureIterator {
    constructor(system, options) {
        this.measures = system.measures;
        this.index = this.startIndex = 0;
        this.endIndex = this.measures.length;
        Vex.Merge(this, options);
    }

    iterate(actor) {
        for (this.index = this.startIndex; this.index < this.endIndex; this.index += 1) {
            var measure = this.measures[this.index];
            actor(this, measure);
        }
    }
}

/* iterate over a set of notes, creating a map of notes to ticks */
VX.TICKMAP = (measure) => {
    var iterator = new smoTickIterator(measure);
    iterator.iterate(smoTickIterator.nullActor, measure);
    return iterator;
}
;
class BeamModifierBase {
    constructor() {}
    beamNote(note, iterator, accidentalMap) {}
}

class smoBeamerFactory {
    static applyBeams(measure) {
        var beamer = new smoBeamModifier(measure);
        var apply = new smoBeamerIterator(measure, [beamer]);
        apply.run();
    }
}

class smoBeamerIterator {
    constructor(measure, actors) {
        this.actors = actors;
        this.measure = measure;
    }

    get iterator() {
        return this._iterator;
    }

    //  ### run
    //  ###  Description:  start the iteration on this set of notes
    run() {
        var self = this;
        var iterator = new smoTickIterator(this.measure);
        iterator.iterate((iterator, note, accidentalMap) => {
            for (var i = 0; i < self.actors.length; ++i) {
                self.actors[i].beamNote(iterator, note, accidentalMap);
            }
        });
    }
}

class smoBeamModifier extends BeamModifierBase {
    constructor(measure) {
        super();
        this.measure = measure;
        this.measure.beamGroups = [];
        this.duration = 0;
        this.timeSignature = measure.timeSignature;
        this.meterNumbers = this.timeSignature.split('/').map(number => parseInt(number, 10));

        this.duration = 0;
        // beam on 1/4 notes in most meter, triple time dotted quarter
        this.beamBeats = 2 * 2048;
        if (this.meterNumbers[0] % 3 == 0) {
            this.beamBeats = 3 * 2048;
        }
        this.skipNext = 0;
        this.currentGroup = [];
    }

    get beamGroups() {
        return this.measure.beamGroups;
    }

    _completeGroup() {
        // don't beam groups of 1
        if (this.currentGroup.length > 1) {
            this.measure.beamGroups.push(new SmoBeamGroup({
                    notes: this.currentGroup
                }));
        }
    }

    _advanceGroup() {
        this.currentGroup = [];
        this.duration = 0;
    }
    beamNote(iterator, note, accidentalMap) {
        this.beamBeats = note.beamBeats;

        this.duration += iterator.delta;

        // beam tuplets
        if (note.isTuplet) {
            var tuplet = this.measure.getTupletForNote(note);
            var ult = tuplet.notes[tuplet.notes.length - 1];
            var first = tuplet.notes[0];

            if (first.endBeam) {
                this._advanceGroup();
                return note;
            }

            // is this beamable length-wise
            var vexDuration = smoMusic.closestVexDuration(note.tickCount);
            var stemTicks = VF.durationToTicks.durations[vexDuration];
            if (stemTicks < 4096) {
                this.currentGroup.push(note);
            }
            // Ultimate note in tuplet
            if (ult.attrs.id === note.attrs.id) {
                this._completeGroup();
                this._advanceGroup();
            }
            return note;
        }

        // don't beam > 1/4 note in 4/4 time
        if (iterator.delta >= 4096) {
			this._completeGroup();
            this._advanceGroup();
            return note;
        }

        this.currentGroup.push(note);
        if (note.endBeam) {
            this._completeGroup();
            this._advanceGroup();
        }

        if (this.duration == this.beamBeats) {
            this._completeGroup();
            this._advanceGroup();
            return note;
        }

        // If this does not align on a beat, don't beam it
        if (this.duration > this.beamBeats) {
			// ||            ((iterator.totalDuration - this.duration) % this.beamBeats != 0)) {
            this._advanceGroup()
            return note;
        }
    }
}
;VF = Vex.Flow;
Vex.Xform = (typeof(Vex.Xform) == 'undefined' ? {}
     : Vex.Xform);
VX = Vex.Xform;

// this file contains utilities that change the duration of notes in a measure.

// ## SmoTickTransformer
//  Base class for duration transformations.  I call them transformations because this can
//  create and delete notes, as opposed to modifiers which act on existing notes.
class SmoTickTransformer {
    constructor(measure, actors, options) {
        this.notes = measure.notes;
        this.measure = measure;
        this.vxNotes = [];
        this.actors = actors ? actors : [];
        this.keySignature = 'C';
        this.accidentalMap = [];
        Vex.Merge(this, options);
    }
    static nullActor(note) {
        return note;
    }
	// ## applyTransform
	// create a transform with the given actors and run it against the supplied measure
	static applyTransform(measure,actors) {
		var actAr = (Array.isArray(actors)) ? actors : [actors];
		measure.clearBeamGroups();
        var transformer = new SmoTickTransformer(measure, actAr);
        transformer.run();
        measure.notes = transformer.notes;
	}
    // ## transformNote
    // call the actors for each note, and put the result in the note array.
    // The note from the original array is copied and sent to each actor.
    //
    // Because the resulting array can have a different number of notes than the existing
    // array, the actors communicate with the transformer in the following, jquery-ish
    // but somewhat unintuitive way:
    //
    // 1. if the actor returns null, the next actor is called and the results of that actor are used
    // 2. if all the actors return null, the copy is used.
    // 3. if a note object is returned, that is used for the current tick and no more actors are called.
    // 4. if an array of notes is returned, it is concatenated to the existing note array and no more actors are called.
    //     Note that *return note;* and *return [note];* produce the same result.
    // 5. if an empty array [] is returned, that copy is not added to the result.  The note is effectively deleted.
    transformTick(iterator, note) {
        var self = this;
       
        for (var i = 0; i < this.actors.length; ++i) {
			var actor=this.actors[i];
            var newNote = actor.transformTick(note, iterator, iterator.accidentalMap);
            if (newNote == null) {
				this.vxNotes.push(note); // no change
                continue;
            }
            if (Array.isArray(newNote)) {
                if (newNote.length === 0) {
                    return;
                }
                this.vxNotes = this.vxNotes.concat(newNote);
                return;
            }
            this.vxNotes.push(newNote);
            return;
        }
    }

    run() {
        var self = this;
        var iterator = new smoTickIterator(this.measure);
        iterator.iterate((iterator, note, accidentalMap) => {
            self.transformTick(iterator, note, accidentalMap);
        });

        this.notes = this.vxNotes;
        return this.vxNotes;
    }
}

// ## A note transformer is just a function that modifies a note in some way.
// Any number of transformers can be applied to a note.
class TickTransformBase {
    constructor() {}
    transformTick(note, iterator, accidentalMap) {
        return note;
    }
}
// ## VxContractActor
// Contract the duration of a note, filling in the space with another note
// or rest.
//
class SmoContractNoteActor extends TickTransformBase {
    constructor(params) {
        super();
        Vex.Merge(this, params);
    }
    transformTick(note, iterator, accidentalMap) {
        if (iterator.index == this.startIndex) {
            var notes = [];
            var noteCount = Math.floor(note.ticks.numerator / this.newTicks);
            var notes = [];
			var remainder = note.ticks.numerator;
            /**
             *  Replace 1 note with noteCOunt notes of newTIcks duration
             *      old map:
             *     d  .  d  .  .
             *     new map:
             *     d  d  d  .  .
             */
            for (var i = 0; i < noteCount; ++i) {
                notes.push(new SmoNote({
                        clef: note.clef,
                        pitches: JSON.parse(JSON.stringify(note.pitches)),
                        ticks: {numerator:this.newTicks,denominator:1,remainder:0},
                        beamBeats:note.beamBeats
                    }));
				remainder = remainder - this.newTicks;
            }
			
            // make sure remnainder is not too short            
			if (remainder > 0) {
                if (remainder < 128) {
                    return null;
                }
				notes.push(new SmoNote({
                        clef: note.clef,
                        pitches: JSON.parse(JSON.stringify(note.pitches)),
                        ticks: {numerator:remainder,denominator:1,remainder:0},
                        beamBeats:note.beamBeats
                    }));
			}
            return notes;
        }

        return null;
    }
}

// ## VxStretchTupletActor
// Stretch a note in a tuplet, removing or shortening other notes in the tuplet
// ## Parameters:
//   {changeIndex:changeIndex, multiplier:multiplier,measure:measure}
//
class SmoStretchTupletActor extends TickTransformBase {
    constructor(params) {
        super();
        Vex.Merge(this, params);
        this.tuplet = this.measure.getTupletForNote(this.measure.notes[this.changeIndex]);
        this.oldLength = this.tuplet.notes.length;
        this.tupletIndex = this.measure.tupletIndex(this.tuplet);

        this.tuplet.combine(this.startIndex, this.endIndex);
        this.durationMap = this.tuplet.durationMap;
    }
    transformTick(note, iterator, accidentalMap) {

        /*
        ## Strategy:
        Before A, after C, leave alone
        At A, send all notes of the tuplet
        Between A+1 and C, return empty array for removed note

        5
        ---------
        | | | | |
        n n n n n
        A | B | C
         */

        if (iterator.index < this.tupletIndex)
            return note;
        if (iterator.index >= this.tupletIndex + this.oldLength)
            return note;
        if (iterator.index === this.tupletIndex) {
            return this.tuplet.notes;
        }
        return [];

    }

}

// ## VxContractActor
// Contract the duration of a note in a tuplet by duplicate
// notes of fractional length
//
class SmoContractTupletActor extends TickTransformBase {
    constructor(params) {
        super();
        Vex.Merge(this, params);
        this.tuplet = this.measure.getTupletForNote(this.measure.notes[this.changeIndex]);
        this.oldLength = this.tuplet.notes.length;
        this.tupletIndex = this.measure.tupletIndex(this.tuplet);
        this.splitIndex = this.changeIndex - this.tupletIndex;
        this.tuplet.split(this.splitIndex);
    }
    transformTick(note, iterator, accidentalMap) {
        if (iterator.index < this.tupletIndex)
            return note;
        if (iterator.index >= this.tupletIndex + this.oldLength)
            return note;
        if (iterator.index == this.changeIndex) {
            return this.tuplet.notes;
        }
        return [];
    }
}

// ## VxUnmakeTupletActor
// Turn a tuplet into a non-tuplet of the same length
// ## Parameters:
// startIndex: start index of tuplet
// endIndex: end index of tuplet
// measure: Smo measure that the tuplet is contained in.
class SmoUnmakeTupletActor extends TickTransformBase {
    constructor(parameters) {
        super();
        Vex.Merge(this, parameters);
    }
    transformTick(note, iterator, accidentalMap) {
        if (iterator.index < this.startIndex || iterator.index > this.endIndex) {
            return null;
        }
        if (iterator.index == this.startIndex) {
            var tuplet = this.measure.getTupletForNote(note);
            var ticks = tuplet.totalTicks;
            var nn = SmoNote.cloneWithDuration(note, {numerator:ticks,denominator:1,remainder:0});
            nn.tuplet = {};
            this.measure.removeTupletForNote(note);
            return [nn];
        }
        return [];
    }
}

// ## VxUnmakeTupletActor
// Turn a tuplet into a non-tuplet of the same length
// parameters:
//  {tickmap:tickmap,ticks:ticks,
class SmoMakeTupletActor extends TickTransformBase {
    constructor(params) {
        super();
        Vex.Merge(this, params);
        this.durationMap = [];
        var sum = 0.0; // 819.2
        for (var i = 0; i < this.numNotes; ++i) {
            this.durationMap.push(1.0);
            sum += 1.0;
        }
		/* 
		var stemValue = this.totalTicks / this.numNotes;
        var stemTicks = 8192;

        // The stem value is the type on the non-tuplet note, e.g. 1/8 note
        // for a triplet.
        while (stemValue < stemTicks) {
            stemTicks = stemTicks / 2;
        }

        this.stemTicks = stemTicks * 2;   
		*/
        this.stemTicks = SmoTuplet.calculateStemTicks(this.totalTicks ,this.numNotes);
       
        this.rangeToSkip = this._rangeToSkip();

        // special case - is this right?  this is needed for tuplets in 6/8
        /* if (this.rangeToSkip[1] > this.rangeToSkip[0]) {
            this.stemTicks = stemTicks;
        } else {
            this.stemTicks = stemTicks * 2;
        }  */

        this.vexDuration = smoMusic.ticksToDuration[this.stemTicks];
        this.tuplet = [];
        // skip notes in the original array if we are taking up
        // multiple notes

    }
    _rangeToSkip() {
        var ticks = this.measure.tickmap();
        var accum = 0;
        var rv = [];
        rv.push(this.index);
        for (var i = 0; i < ticks.deltaMap.length; ++i) {
            if (i >= this.index) {
                accum += ticks.deltaMap[i];
            }
            if (accum >= this.totalTicks) {
                rv.push(i);
                break;
            }
        }
        return rv;
    }
    transformTick(note, iterator, accidentalMap) {
        // if our tuplet replaces this note, make sure we make it go away.
        if (iterator.index > this.index && iterator.index <= this.rangeToSkip[1]) {
            return [];
        }
        if (iterator.index != this.index) {
            return null;
        }
        for (var i = 0; i < this.numNotes; ++i) {
            note = SmoNote.cloneWithDuration(note, {numerator:this.stemTicks,denominator:1,remainder:0});
			
			// Don't clone modifiers, except for first one.
			note.textModifiers = i===0 ? note.textModifiers : [];

            this.tuplet.push(note);
        }
        var tuplet = new SmoTuplet({
                notes: this.tuplet,
                stemTicks: this.stemTicks,
                totalTicks: this.totalTicks,
                ratioed: false,
                bracketed: true,
                startIndex: iterator.index,
                durationMap: this.durationMap,
                location: 1
            });
        this.measure.tuplets.push(tuplet);
        return this.tuplet;
    }
}

class SmoStretchNoteActor extends TickTransformBase {
    constructor(parameters) {
        super();
        Vex.Merge(this, parameters);
        this.startTick = this.tickmap.durationMap[this.startIndex];
		var currentTicks = this.tickmap.deltaMap[this.startIndex];

        var endTick = this.tickmap.durationMap[this.startIndex] + this.newTicks;
        this.divisor = -1;
        this.durationMap = [];
        this.skipFromStart = this.startIndex + 1;
        this.skipFromEnd = this.startIndex + 1;
        this.durationMap.push(this.newTicks);

        var mapIx = this.tickmap.durationMap.indexOf(endTick);

        var remaining = this.tickmap.deltaMap.slice(this.startIndex, this.tickmap.durationMap.length).reduce((accum, x) => x + accum);
        if (remaining === this.newTicks) {
            mapIx = this.tickmap.deltaMap.length;
        }

        // If there is no tickable at the end point, try to split the next note
        /**
         *      old map:
         *     d  . d  .
         *     split map:
         *     d  .  d  d
         *     new map:
         *     d .   .  d
         */
        if (mapIx < 0) {
            var npos = this.tickmap.durationMap[this.startIndex + 1];
            var ndelta = this.tickmap.deltaMap[this.startIndex + 1];
			var needed = this.newTicks - currentTicks;
			var exp = ndelta/needed;
									
			// Next tick does not divide evenly into this, or next tick is shorter than this
			if (Math.round(ndelta/exp)-ndelta/exp != 0 || currentTicks>ndelta) {
				this.durationMap = [];
			}
            else if (ndelta / exp + this.startTick + this.newTicks <= this.tickmap.totalDuration) {
                this.durationMap.push(ndelta - (ndelta / exp));
            } else {
                // there is no way to do this...
				this.durationMap = [];                
            }
        } else {
            // If this note now takes up the space of other notes, remove those notes
            for (var i = this.startIndex + 1; i < mapIx; ++i) {
                this.durationMap.push(0);
            }
        }
    }
    transformTick(note, iterator, accidentalMap) {
        if (this.durationMap.length == 0) {
            return null;
        }
        if (iterator.index >= this.startIndex && iterator.index < this.startIndex + this.durationMap.length) {
            var mapIndex = iterator.index - this.startIndex;
            var ticks = this.durationMap[mapIndex];
            if (ticks == 0) {
                return [];
            }
            var vexDuration = smoMusic.ticksToDuration[ticks];
            var note = SmoNote.cloneWithDuration(note, {numerator:ticks,denominator:1,remainder:0});
            return [note];
        }
        return null;
    }
}
;/////////////////
// # selections.js
// Editing operations are performed on selections.  A selection can be different things, from a single pitch
// to many notes.  These classes standardize some standard selection operations.
//
//
// ## SmoSelector
// ## Description:
// There are 2 parts to a selection: the actual musical bits that are selected, and the
// indices that define what was selected.  This is the latter.  The actual object does not
// have any methods so there is no constructor.
class SmoSelector {
	// TODO:  tick in selector s/b tickIndex
	static sameNote(sel1, sel2) {
		return (sel1.staff == sel2.staff && sel1.measure == sel2.measure && sel1.voice == sel2.voice
			 && sel1.tick == sel2.tick);
	}
	static sameMeasure(sel1, sel2) {
		return (sel1.staff == sel2.staff && sel1.measure == sel2.measure);
	}

	static sameStaff(sel1, sel2) {
		return sel1.staff === sel2.staff;
	}

	// ## return true if sel1 > sel2.
	static gt(sel1, sel2) {
		// Note: voice is not considered b/c it's more of a vertical component
		return sel1.staff > sel2.staff ||
		(sel1.staff == sel2.staff && sel1.measure > sel2.measure) ||
		(sel1.staff == sel2.staff && sel1.measure == sel2.measure && sel1.tick > sel2.tick);
	}

	static eq(sel1, sel2) {
		return (sel1.staff == sel2.staff && sel1.measure == sel2.measure && sel1.tick == sel2.tick);
	}
	static neq(sel1,sel2) {
		return !(SmoSelector.eq(sel1,sel2));
	}

	static lt(sel1, sel2) {
		return SmoSelector.gt(sel2, sel1);
	}

	static gteq(sel1, sel2) {
		return SmoSelector.gt(sel1, sel2) || SmoSelector.eq(sel1, sel2);
	}
	static lteq(sel1, sel2) {
		return SmoSelector.lt(sel1, sel2) || SmoSelector.eq(sel1, sel2);
	}

	// ## applyOffset
	// ### Description:
	// offset 'selector' the difference between src and target, return the result
	static applyOffset(src, target, selector) {
		var rv = JSON.parse(JSON.stringify(selector));
		rv.staff += target.staff - src.staff;
		rv.measure += target.measure - src.measure;
		rv.voice += target.voice - src.voice;
		rv.note += target.staff - src.staff;
		return rv;
	}

	// return true if testSel is contained in the selStart to selEnd range.
	static contains(testSel, selStart, selEnd) {
		var geStart =
			selStart.measure < testSel.measure ||
			(selStart.measure === testSel.measure && selStart.tick <= testSel.tick);
		var leEnd =
			selEnd.measure > testSel.measure ||
			(selEnd.measure === testSel.measure && testSel.tick <= selEnd.tick);

		return geStart && leEnd;
	}

	// create a hashmap key for a single note, used to organize modifiers
	static selectorNoteKey(selector) {
		return 'staff-' + selector.staff + '-measure-' + selector.measure + '-voice-' + selector.voice + '-tick-' + selector.tick;
	}
}

// ## SmoSelection
// ## Description:
// A selection is a selector and a set of references to musical elements, like measure etc.
// The staff and measure are always a part of the selection, and possible a voice and note,
// and one or more pitches.  Selections can also be made from the UI by clicking on an element
// or navigating to an element with the keyboard.
class SmoSelection {

	// ### measureSelection
	// A selection that does not contain a specific note
	static measureSelection(score, staffIndex, measureIndex) {
		staffIndex = staffIndex != null ? staffIndex : score.activeStaff;
		var selector = {
			staff: staffIndex,
			measure: measureIndex
		};
		if (score.staves.length <= staffIndex) {
			return null;
		}
		var staff = score.staves[staffIndex];
		if (staff.measures.length <= measureIndex) {
			return null;
		}
		var measure = staff.measures[measureIndex];

		return new SmoSelection
		({
			selector: selector,
			_staff: staff,
			_measure: measure,
			type: 'measure'
		});
	}

	static noteFromSelection(score, selection) {
		return SmoSelection(score, selection.staffIndex, selection.measureIndex, selection.voiceIndex, selection.tickIndex);
	}

	// ### noteSelection
	// a selection that specifies a note in the score
	static noteSelection(score, staffIndex, measureIndex, voiceIndex, tickIndex) {
		staffIndex = staffIndex != null ? staffIndex : score.activeStaff;
		measureIndex = measureIndex ? measureIndex : 0;
		voiceIndex = voiceIndex ? voiceIndex : 0;
		var staff = score.staves[staffIndex];
		var measure = staff.measures[measureIndex];
		var note = measure.voices[voiceIndex].notes[tickIndex];
		var selector = {
			staff: staffIndex,
			measure: measureIndex,
			voice: voiceIndex,
			tick: tickIndex
		};
		return new SmoSelection({
			selector: selector,
			_staff: staff,
			_measure: measure,
			_note: note,
			_pitches: [],
			type: 'note'
		});
	}

	// ### renderedNoteSelection
	// this is a special selection that we associated with all he rendered notes, so that we
	// can map from a place in the display to a place in the score.
	static renderedNoteSelection(score, nel, box) {
		var elementId = nel.getAttribute('id');
		for (var i = 0; i < score.staves.length; ++i) {
			var staff = score.staves[i];
			for (var j = 0; j < staff.measures.length; ++j) {
				var measure = staff.measures[j];
				for (var k = 0; k < measure.voices.length; ++k) {
					var voice = measure.voices[k];
					for (var m = 0; m < voice.notes.length; ++m) {
						var note = voice.notes[m];
						if (note.renderId === elementId) {
							var selector = {
								staff: i,
								measure: j,
								voice: k,
								tick: m,
								pitches: []
							};
							// var box = document.getElementById(nel.id).getBBox();
							var rv = new SmoSelection({
									selector: selector,
									_staff: staff,
									_measure: measure,
									_note: note,
									_pitches: [],
									box: box,
									type: 'rendered'
								});

							return rv;
						}
					}
				}
			}
		}
		return null;
	}

	static pitchSelection(score, staffIndex, measureIndex, voiceIndex, tickIndex, pitches) {
		staffIndex = staffIndex != null ? staffIndex : score.activeStaff;
		measureIndex = measureIndex ? measureIndex : 0;
		voiceIndex = voiceIndex ? voiceIndex : 0;
		var staff = score.staves[staffIndex];
		var measure = staff.measures[measureIndex];
		var note = measure.voices[voiceIndex].notes[tickIndex];
		pitches = pitches ? pitches : [];
		var pa = [];
		pitches.forEach((ix) => {
			pa.push(JSON.parse(JSON.stringify(note.pitches[ix])));
		});
		var selector = {
			staff: staffIndex,
			measure: measureIndex,
			voice: voiceIndex,
			tick: tickIndex,
			pitches: pitches
		};
		return new SmoSelection({
			selector: selector,
			_staff: staff,
			_measure: measure,
			_note: note,
			_pitches: pa,
			type: 'pitches'
		});
	}

	// ## nextNoteSelection
	// ## Description:
	// Return the next note in this measure, or the first note of the next measure, if it exists.
	static nextNoteSelection(score, staffIndex, measureIndex, voiceIndex, tickIndex) {
		var nextTick = tickIndex + 1;
		var nextMeasure = measureIndex + 1;
		var staff = score.staves[staffIndex];
		var measure = staff.measures[measureIndex];
		if (measure.voices[voiceIndex].notes.length > nextTick) {
			return SmoSelection.noteSelection(score, staffIndex, measureIndex, voiceIndex, nextTick);
		}
		if (staff.measures.length > nextMeasure) {
			return SmoSelection.noteSelection(score, staffIndex, nextMeasure, voiceIndex, 0);
		}
		return null;
	}
	
	// ### getMeasureList
	// Gets the list of measures in an array from the selections
	static getMeasureList(selections) {
		var rv = [];
		if (!selections.length) {
			return rv;
		}
		var cur = selections;
		rv.push(cur.measure);
		for (var i=1;i<selections.length;++i) {
			var sel = selections[i];
			if (sel.selector.measure != cur.selector.measure) {
				rv.push(sel.measure);
				cur=sel;
			}
		}
		return rv;
	}

	static lastNoteSelection(score, staffIndex, measureIndex, voiceIndex, tickIndex) {
		var lastTick = tickIndex - 1;
		var lastMeasure = measureIndex - 1;
		var staff = score.staves[staffIndex];
		var measure = staff.measures[measureIndex];
		if (tickIndex > 0) {
			return SmoSelection.noteSelection(score, staffIndex, measureIndex, voiceIndex, lastTick);
		}
		if (measureIndex > 0) {
			measure = staff.measures[lastMeasure];
			var noteIndex = staff.measures[lastMeasure].voices[voiceIndex].notes.length - 1;
			return SmoSelection.noteSelection(score, staffIndex, lastMeasure, voiceIndex, noteIndex);
		}
		return null;
	}

	// ### selectionsSameMeasure
	// Return true if the selections are all in the same measure.  Used to determine what
	// type of undo we need.
	static selectionsSameMeasure(selections) {
		if (selections.length < 2) {
			return true;
		}
		var sel1 = selections[0].selector;
		for (var i = 1; i < selections.length; ++i) {
			if (!SmoSelector.sameMeasure(sel1, selections[i].selector)) {
				return false;
			}
		}
		return true;
	}

	static selectionsSameStaff(selections) {
		if (selections.length < 2) {
			return true;
		}
		var sel1 = selections[0].selector;
		for (var i = 1; i < selections.length; ++i) {
			if (!SmoSelector.sameStaff(sel1, selections[i].selector)) {
				return false;
			}
		}
		return true;
	}

	constructor(params) {
		this.selector = {
			staff: 0,
			measure: 0,
			voice: 0,
			note: 0,
			pitches: []
		}
		this._staff = null;
		this._measure = null;
		this._note = null;
		this._pitches = [];
		this._box = svgHelpers.pointBox(0, 0);

		this.selectionGroup = {
			id: VF.Element.newID(),
			type: 'SmoSelection'
		};
		Vex.Merge(this, params);
	}

	get staff() {
		return this._staff;
	}
	get measure() {
		return this._measure;
	}

	get note() {
		return this._note;
	}
	get pitches() {
		if (this._pitches.length) {
			return this._pitches;
		} else if (this._note) {
			this._pitches = JSON.parse(JSON.stringify(this.note.pitches));
			return this._pitches;
		}
		return [];
	}
}
;
// An operation works on a selection or set of selections to edit the music
class SmoOperation {

	static addKeySignature(score, selection, keySignature) {
		score.addKeySignature(selection.selector.measure, keySignature);
	}

	static deleteMeasure(score, selection) {
		var measureIndex = selection.selector.measure;

		score.deleteMeasure(measureIndex);
	}

	static toggleBeamGroup(noteSelection) {
		noteSelection.measure.setChanged();
		noteSelection.note.endBeam = !(noteSelection.note.endBeam);
	}
    
    static setTimeSignature(score,selections,timeSignature) {
        var selectors = [];
        selections.forEach((selection) => {
            for (var i=0;i<score.staves.length;++i) {
                var measureSel = {
                    staff: i,
                    measure: selection.selector.measure
                };
                selectors.push(measureSel);
            }
        });
        var tsTicks = smoMusic.timeSignatureToTicks(timeSignature);
        
        selectors.forEach((selector) => {
            var params={};
            var attrs = SmoMeasure.defaultAttributes.filter((aa) => aa != 'timeSignature');
            var proto = SmoSelection.measureSelection(score,selector.staff,selector.measure).measure;
            smoMusic.serializedMerge(attrs,proto,params);
            params.timeSignature = timeSignature;
            var nm = SmoMeasure.getDefaultMeasure(params);
            var spareNotes = SmoMeasure.getDefaultNotes(params);
            var ticks = 0;
            var voices = [];
            proto.voices.forEach((voice) => {
                var nvoice=[];
                for (var i=0;i<voice.notes.length;++i) {
                    var pnote = voice.notes[i];
                    var nnote = SmoNote.deserialize(pnote.serialize());
                    if (ticks + pnote.tickCount <= tsTicks) {
                        nnote.ticks = JSON.parse(JSON.stringify(pnote.ticks))
                        nvoice.push(nnote);
                        ticks += nnote.tickCount;
                    } else {
                        var remain = (ticks + pnote.tickCount)-tsTicks;
                        nnote.ticks = {numerator:remain,denominator:1,remainder:0};
                        nvoice.push(nnote);
                        ticks += nnote.tickCount;
                    }
                    if (ticks >= tsTicks) {
                        break;
                    }
                }
                if (ticks < tsTicks) {
                    var adjNote = nvoice[nvoice.length - 1];
                    adjNote.ticks.numerator += tsTicks-ticks;
                }
                voices.push({notes:nvoice});            
                
            });
            nm.voices=voices;
            score.replaceMeasure(selector,nm);
        });
    }

	static batchSelectionOperation(score, selections, operation) {
		var measureTicks = [];
		selections.forEach((selection) => {
			var measureSel = {
				staff: selection.selector.staff,
				measure: selection.selector.measure,
				voice: selection.selector.voice
			};
			selection.measure.setChanged();
			if (!measureTicks[measureSel]) {
				var tm = selection.measure.tickmap();
				var tickOffset = tm.durationMap[selection.selector.tick];
				var selector = JSON.parse(JSON.stringify(selection.selector));
				measureTicks.push({
					selector: selector,
					tickOffset: tickOffset
				});
			}
		});
		measureTicks.forEach((measureTick) => {
			var selection = SmoSelection.measureSelection(score, measureTick.selector.staff, measureTick.selector.measure);
			var tickmap = selection.measure.tickmap();
			var ix = tickmap.durationMap.indexOf(measureTick.tickOffset);
			if (ix >= 0) {
				var nsel = SmoSelection.noteSelection(score, measureTick.selector.staff, measureTick.selector.measure,
						measureTick.selector.voice, ix);
				SmoOperation[operation](nsel);
			}
		});
	}
	// ## doubleDuration
	// ## Description
	// double the duration of a note in a measure, at the expense of the following
	// note, if possible.  Works on tuplets also.
	static doubleDuration(selection) {
		var note = selection.note;
		var measure = selection.measure;
		var tuplet = measure.getTupletForNote(note);
		if (!tuplet) {
			/* if (selection.note.dots > 0) {
				return;
			} */
			var nticks = note.tickCount * 2;
			var actor = new SmoStretchNoteActor({
					startIndex: selection.selector.tick,
					tickmap: measure.tickmap(),
					newTicks: nticks
				});
			SmoTickTransformer.applyTransform(measure, actor);
		} else {
			var startIndex = tuplet.getIndexOfNote(note);
			var endIndex = startIndex + 1;
			if (endIndex >= tuplet.notes.length) {
				return;
			}
			var actor = new SmoStretchTupletActor({
					changeIndex: measure.tupletIndex(tuplet),
					startIndex: startIndex,
					endIndex: endIndex,
					measure: measure
				});
			SmoTickTransformer.applyTransform(measure, actor);
		}
		selection.measure.setChanged();
		return true;
	}

	// ## halveDuration
	// ## Description
	// Replace the note with 2 notes of 1/2 duration, if possible
	// Works on tuplets also.
	static halveDuration(selection) {
		var note = selection.note;
		var measure = selection.measure;
		var tuplet = measure.getTupletForNote(note);
		var divisor = 2;
		if (measure.numBeats % 3 === 0 && selection.note.tickCount === 6144) {
			// special behavior, if this is dotted 1/4 in 6/8, split to 3
			divisor = 3;
		}
		if (!tuplet) {
			var nticks = note.tickCount / divisor;
			if (!smoMusic.ticksToDuration[nticks]) {
				return;
			}
			var actor = new SmoContractNoteActor({
					startIndex: selection.selector.tick,
					tickmap: measure.tickmap(),
					newTicks: nticks
				});
			SmoTickTransformer.applyTransform(measure, actor);

		} else {
			var startIndex = measure.tupletIndex(tuplet) + tuplet.getIndexOfNote(note);
			var actor = new SmoContractTupletActor({
					changeIndex: startIndex,
					measure: measure
				});
			SmoTickTransformer.applyTransform(measure, actor);
		}
		selection.measure.setChanged();
	}

	// ## makeTuplet
	// ## Description
	// Makes a non-tuplet into a tuplet of equal value.
	static makeTuplet(selection, numNotes) {
		var note = selection.note;
		var measure = selection.measure;
		if (measure.getTupletForNote(note))
			return;
		var nticks = note.tickCount;

		var actor = new SmoMakeTupletActor({
				index: selection.selector.tick,
				totalTicks: nticks,
				numNotes: numNotes,
				measure: measure
			});
		SmoTickTransformer.applyTransform(measure, actor);
		selection.measure.setChanged();

		return true;
	}
    
    static removeStaffModifier(selection,modifier) {
        selection.staff.removeStaffModifier(modifier);
    }

	static makeRest(selection) {
		selection.measure.setChanged();
		selection.note.makeRest();
	}
	static makeNote(selection) {
		selection.measure.setChanged();
		selection.note.makeNote();
	}

	// ## unmakeTuplet
	// ## Description
	// Makes a tuplet into a single with the duration of the whole tuplet
	static unmakeTuplet(selection) {
		var note = selection.note;
		var measure = selection.measure;
		if (!measure.getTupletForNote(note))
			return;
		var tuplet = measure.getTupletForNote(note);
		if (tuplet === null)
			return;
		var startIndex = measure.tupletIndex(tuplet);
		var endIndex = tuplet.notes.length + startIndex - 1;

		var actor = new SmoUnmakeTupletActor({
				startIndex: startIndex,
				endIndex: endIndex,
				measure: measure
			});
		SmoTickTransformer.applyTransform(measure, actor);
		measure.setChanged();
		return true;
	}

	// ## dotDuration
	// ## Description
	// Add a dot to a note, if possible, and make the note ahead of it shorter
	// to compensate.
	static dotDuration(selection) {

		var note = selection.note;
		var measure = selection.measure;
		var nticks = smoMusic.getNextDottedLevel(note.tickCount);
		if (nticks == note.tickCount) {
			return;
		}
        
        // Don't dot if the thing on the right of the . is too small
        var dotCount = smoMusic.smoTicksToVexDots(nticks);
        var multiplier = Math.pow(2,dotCount);
        var baseDot = VF.durationToTicks(smoMusic.closestVexDuration(nticks))/(multiplier*2);
        if (baseDot <= 128) {
            return;
        }
        
		// If this is the ultimate note in the measure, we can't increase the length
		if (selection.selector.tick + 1 === selection.measure.notes.length) {
			return;
		}
		if (selection.measure.notes[selection.selector.tick + 1].tickCount > selection.note.tickCount) {
			console.log('too long');
			return;
		}
		// is dot too short?
		if (!smoMusic.ticksToDuration[selection.measure.notes[selection.selector.tick + 1].tickCount/2]) {
			return;
		}
		var actor = new SmoStretchNoteActor({
				startIndex: selection.selector.tick,
				tickmap: measure.tickmap(),
				newTicks: nticks
			});
		SmoTickTransformer.applyTransform(measure, actor);
		measure.setChanged();
		return true;
	}

	// ## undotDuration
	// ## Description
	// Add the value of the last dot to the note, increasing length and
	// reducing the number of dots.
	static undotDuration(selection) {
		var note = selection.note;
		var measure = selection.measure;
		var nticks = smoMusic.getPreviousDottedLevel(note.tickCount);
		if (nticks == note.tickCount) {
			return;
		}
		var actor = new SmoContractNoteActor({
				startIndex: selection.selector.tick,
				tickmap: measure.tickmap(),
				newTicks: nticks
			});
		SmoTickTransformer.applyTransform(measure, actor);
		selection.measure.setChanged();
		return true;
	}

	// ## transpose
	// ## Description
	// Transpose the selected note, trying to find a key-signature friendly value
	static transpose(selection, offset) {
		var measure = selection.measure;
		var note = selection.note;
		if (measure && note) {
			note.transpose(selection.selector.pitches, offset, measure.keySignature);
			measure.setChanged();
			return true;
		}
		return false;
	}

	// ## setPitch
	// ## Description:
	// pitches can be either an array, a single pitch, or a letter.  In the latter case,
	// the letter value appropriate for the key signature is used, e.g. c in A major becomes
	// c#
	static setPitch(selection, pitches) {
		var measure = selection.measure;
		var note = selection.note;
		measure.setChanged();
		// TODO allow hint for octave
		var octave = note.pitches[0].octave;
		note.pitches = [];
		if (!Array.isArray(pitches)) {
			pitches = [pitches];
		}
		pitches.forEach((pitch) => {
			var letter = pitch;
			if (typeof(pitch) === 'string') {
				var letter = smoMusic.getKeySignatureKey(pitch[0], measure.keySignature);
				pitch = {
					letter: letter[0],
					accidental: letter.length > 1 ? letter.substring(1) : '',
					octave: octave
				};
			}

			note.pitches.push(pitch);
		});
		return true;
	}

	// ## addPitch
	// add a pitch to a note chord, avoiding duplicates.
	static addPitch(selection, pitches) {
		var toAdd = [];
		pitches.forEach((pitch) => {
			var found = false;
			toAdd.forEach((np) => {
				if (np.accidental === pitch.accidental && np.letter === pitch.letter && np.octave === pitch.octave) {
					found = true;
				}
			});
			if (!found) {
				toAdd.push(pitch);
			}
		});
		toAdd.sort(function (a, b) {
			return smoMusic.smoPitchToInt(a) -
			smoMusic.smoPitchToInt(b);
		});
		selection.note.pitches = JSON.parse(JSON.stringify(toAdd));
		selection.measure.setChanged();
	}

	static toggleCourtesyAccidental(selection) {
		var toBe = false;
		var i = 0;
		if (!selection.selector['pitches'] || selection.selector.pitches.length === 0) {
			var ps = [];
			selection.note.pitches.forEach((pitch) => {
				var p = JSON.parse(JSON.stringify(pitch));
				ps.push(p);
				p.cautionary = !(pitch.cautionary);
			});
			selection.note.pitches = ps;
		} else {
			toBe = !(selection.note.pitches[selection.selector.pitches[0]].cautionary);
		}

		SmoOperation.courtesyAccidental(selection, toBe);
		selection.measure.setChanged();
	}

	static courtesyAccidental(pitchSelection, toBe) {
		pitchSelection.selector.pitches.forEach((pitchIx) => {
			pitchSelection.note.pitches[pitchIx].cautionary = toBe;
		});
		pitchSelection.measure.setChanged();
	}

	static toggleEnharmonic(pitchSelection) {
		if (pitchSelection.selector.pitches.length === 0) {
			pitchSelection.selector.pitches.push(0);
		}
		var pitch = pitchSelection.note.pitches[pitchSelection.selector.pitches[0]];
		var lastLetter = pitch.letter;
		var vexPitch = smoMusic.stripVexOctave(smoMusic.pitchToVexKey(pitch));
		vexPitch = smoMusic.getEnharmonic(vexPitch);

		pitch.letter = vexPitch[0];
		pitch.accidental = vexPitch.length > 1 ?
			vexPitch.substring(1, vexPitch.length) : 'n';
		pitch.octave += smoMusic.letterChangedOctave(lastLetter, pitch.letter);
		pitchSelection.measure.setChanged();
	}

	static addDynamic(selection, dynamic) {
		selection.note.addModifier(dynamic);
		selection.measure.setChanged();
	}
    
    static beamSelections(selections) {
        var start = selections[0].selector;
        var cur = selections[0].selector;
        var beamGroup = [];
        var ticks = 0;
        selections.forEach((selection) => {
            if (SmoSelector.sameNote(start,selection.selector) || 
                (SmoSelector.sameMeasure(selection.selector,cur) &&
                 cur.tick == selection.selector.tick-1)) {
                ticks += selection.note.tickCount;
                cur = selection.selector;
                beamGroup.push(selection.note);
            }
        });
        if (beamGroup.length) {
            beamGroup.forEach((note) => {
                note.beamBeats=ticks;
                note.endBeam=false;
            });
            beamGroup[beamGroup.length - 1].endBeam=true;
        }
    }
    
    static toggleBeamDirection(selections) {
        selections[0].note.toggleFlagState();               
        selections.forEach((selection) => {
            selection.note.flagState = selections[0].note.flagState;
        });
    }

	static toggleArticulation(selection, articulation) {
		selection.note.toggleArticulation(articulation);
		selection.measure.setChanged();
	}

	static addEnding(score, parameters) {
		var startMeasure = parameters.startBar;
		var endMeasure = parameters.endBar;
		var s = 0;
		
		// Ending ID ties all the instances of an ending across staves
		parameters.endingId=VF.Element.newID();
		score.staves.forEach((staff) => {
			var m = 0;
			staff.measures.forEach((measure) => {
				if (m === startMeasure) {
					var pp = JSON.parse(JSON.stringify(parameters));
					pp.startSelector = {
						staff: s,
						measure: startMeasure
					};
					pp.endSelector = {
						staff: s,
						measure: endMeasure
					};
					var ending = new SmoVolta(pp);
					measure.addNthEnding(ending);
				}
				measure.setChanged();
				m += 1;
			});
			s += 1;
		});
	}
	
	static addScoreText(score,scoreText) {
		score.addScoreText(scoreText);
	}
	static removeScoreText(score,scoreText) {
		score.removeScoreText(scoreText);
	}
	
	static addMeasureText(score,selection,measureText) {
		selection.measure.addMeasureText(measureText);
	}
	
	static removeMeasureText(score,selection,mt) {
		selection.measure.removeMeasureText(mt.attrs.id);
	}
	
	static addSystemText(score,selection,measureText) {
		var mm = selection.selector.measure;
		score.staves.forEach((staff) => {
			var mt = new SmoMeasureText(measureText.serialize());
			staff.measures[mm].addMeasureText(mt);
		});
	}
	
	static addRehearsalMark(score,selection,rehearsalMark) {
		var mm = selection.selector.measure;
		score.staves.forEach((staff) => {
			var mt = new SmoRehearsalMark(rehearsalMark.serialize());
            staff.addRehearsalMark(selection.selector.measure,mt);
		});
	}
    
    static addLyric(score,selection,lyric) {
        selection.note.addLyric(lyric);
    }
    
    static removeLyric(score,selection,lyric) {
        selection.note.removeLyric(lyric);
    }
    
    static addTempo(score,selection,tempo) {
		score.staves.forEach((staff) => {
            staff.addTempo(tempo,selection.selector.measure);
		});
    }
    
    static removeTempo(score,selection) {
		score.staves.forEach((staff) => {
            staff.removeTempo();
		});
    }

    
    static removeRehearsalMark(score,selection,rehearsalMark) {
		score.staves.forEach((staff) => {
            staff.removeRehearsalMark(selection.selector.measure);
		});
	}

	static setMeasureBarline(score, selection, barline) {
		var mm = selection.selector.measure;
		var ix = 0;
		score.staves.forEach((staff) => {
			var s2 = SmoSelection.measureSelection(score, ix, mm);
			s2.measure.setBarline(barline);
			s2.measure.setChanged();
			ix += 1;
		});
	}

	static setRepeatSymbol(score, selection, sym) {
		var mm = selection.selector.measure;
		var ix = 0;
		score.staves.forEach((staff) => {
			var s2 = SmoSelection.measureSelection(score, ix, mm);
			s2.measure.setRepeatSymbol(sym);
			s2.measure.setChanged();
			ix += 1;
		});
	}

	// ## interval
	// ## Description:
	// Add a pitch at the specified interval to the chord in the selection.
	static interval(selection, interval) {
		var measure = selection.measure;
		var note = selection.note;
		selection.measure.setChanged();

		// TODO: figure out which pitch is selected
		var pitch = note.pitches[0];
		if (interval > 0) {
			pitch = note.pitches[note.pitches.length - 1];
		}
		var pitch = smoMusic.getIntervalInKey(pitch, measure.keySignature, interval);
		if (pitch) {
			note.pitches.push(pitch);
			note.pitches.sort((x, y) => {
				return smoMusic.smoPitchToInt(x) - smoMusic.smoPitchToInt(y);
			});
			return true;
		}
		return false;
	}

	static crescendo(fromSelection, toSelection) {
		var fromSelector = JSON.parse(JSON.stringify(fromSelection.selector));
		var toSelector = JSON.parse(JSON.stringify(toSelection.selector));
		var modifier = new SmoStaffHairpin({
				startSelector: fromSelector,
				endSelector: toSelector,
				hairpinType: SmoStaffHairpin.types.CRESCENDO,
				position: SmoStaffHairpin.positions.BELOW
			});
		fromSelection.staff.addStaffModifier(modifier);
	}

	static decrescendo(fromSelection, toSelection) {
		var fromSelector = JSON.parse(JSON.stringify(fromSelection.selector));
		var toSelector = JSON.parse(JSON.stringify(toSelection.selector));
		var modifier = new SmoStaffHairpin({
				startSelector: fromSelector,
				endSelector: toSelector,
				hairpinType: SmoStaffHairpin.types.DECRESCENDO,
				position: SmoStaffHairpin.positions.BELOW
			});
		fromSelection.staff.addStaffModifier(modifier);
	}

	static slur(fromSelection, toSelection) {
		var fromSelector = JSON.parse(JSON.stringify(fromSelection.selector));
		var toSelector = JSON.parse(JSON.stringify(toSelection.selector));
		var modifier = new SmoSlur({
				startSelector: fromSelector,
				endSelector: toSelector,
				position: SmoStaffHairpin.positions.BELOW
			});
		fromSelection.staff.addStaffModifier(modifier);
		fromSelection.measure.setChanged();
		toSelection.measure.setChanged();
	}

	static addStaff(score, parameters) {
		score.addStaff(parameters);
	}
	static removeStaff(score, index) {
		score.removeStaff(index);
	}
	static changeInstrument(score, instrument, selections) {
		var measureHash = {};
		selections.forEach((selection) => {
			if (!measureHash[selection.selector.measure]) {
				measureHash[selection.selector.measure] = 1;
				selection.measure.clef = instrument.clef;
				selection.measure.setChanged();
				selection.measure.transposeIndex = instrument.keyOffset;
				selection.measure.voices.forEach((voice) => {
					voice.notes.forEach((note) => {
						note.clef = instrument.clef;
					});
				});
			}
		});
	}

	static addMeasure(score, systemIndex, nmeasure) {
		score.addMeasure(systemIndex, nmeasure);
	}
}
;
// ## UndoBuffer
// ## Description:
// manage a set of undo or redo operations on a score.  The objects passed into
// undo must implement serialize()/deserialize()
// ## Buffer format:
// A buffer is one of 3 things:
// * A single measure,
// * A single staff
// * the whole score.
class UndoBuffer {
    constructor() {
        this.buffer = [];
		this.opCount = 0;
    }
    static get bufferMax() {
        return 100;
    }

    static get bufferTypes() {
        return ['measure', 'staff', 'score'];
    }

    // ### addBuffer
    // ### Description:
    // Add the current state of the score required to undo the next operation we
    // are about to perform.  For instance, if we are adding a crescendo, we back up the
    // staff the crescendo will go on.
    addBuffer(title, type, selector, obj) {
        if (UndoBuffer.bufferTypes.indexOf(type) < 0) {
            throw ('Undo failure: illegal buffer type ' + type);
        }
        var json = obj.serialize();
        var undoObj = {
            title: title,
            type: type,
            selector: selector,
            json: json
        };
        if (this.buffer.length >= UndoBuffer.bufferMax) {
            this.buffer.splice(0,1);
        }
		this.opCount += 1;
        this.buffer.push(undoObj);
    }

    // ### _pop
    // ### Description:
    // Internal method to pop the top buffer off the stack.
    _pop() {

        if (this.buffer.length < 1)
            return null;
        var buf = this.buffer.pop();
        return buf;
    }

    // ## Before undoing, peek at the top action in the q
    // so it can be re-rendered
    peek() {
        if (this.buffer.length < 1)
            return null;
        return this.buffer[this.buffer.length - 1];
    }

    // ## undo
    // ## Description:
    // Undo the operation at the top of the undo stack.  This is done by replacing
    // the music as it existed before the change was made.
    undo(score) {
        var buf = this._pop();
        if (!buf)
            return score;
        if (buf.type === 'measure') {
            var measure = SmoMeasure.deserialize(buf.json);
            measure.setChanged();
            score.replaceMeasure(buf.selector, measure);
        } else if (buf.type === 'score') {
            // Score expects string, as deserialized score is how saving is done.
            score = SmoScore.deserialize(JSON.stringify(buf.json));
        } else {
            // TODO: test me
            var staff = SmoSystemStaff.deserialize(buf.json);
            score.replaceStaff(buf.selector.staff, staff);
        }
        return score;
    }

}

// ## SmoUndoable
// ## Description:
// Convenience functions to save the score state before operations so we can undo the operation.
// Each undo-able knows which set of parameters the undo operation requires (measure, staff, score).
class SmoUndoable {
	static undoForSelections(score,selections,undoBuffer,operation) {
	    var staffUndo = false;
		var scoreUndo = false;
		if (!selections.length)
			return;
		var measure=selections[0].selector.measure;
		var staff = selections[0].selector.staff;
		for (var i=0;i<selections.length;++i) {
			var sel = selections[i];
			if (sel.selector.measure != measure) {
				staffUndo = true;
			} else if (sel.selector.staff != staff) {
				scoreUndo = true;
				break;
			}
		}
		if (scoreUndo) {
			undoBuffer.addBuffer('score backup for '+operation, 'score', null, score);
		} else if (staffUndo) {
			undoBuffer.addBuffer('staff backup for '+operation, 'staff', selections[0].selector, score);
		} else {
			undoBuffer.addBuffer('measure backup for '+operation, 'measure', selections[0].selector, selections[0].measure);
		}		
	}
	// Add the measure/staff/score that will cover this list of selections
	static batchDurationOperation(score,selections,operation,undoBuffer) {		
	    SmoUndoable.undoForSelections(score,selections,undoBuffer,operation);
		SmoOperation.batchSelectionOperation(score,selections,operation);
	}
    static setPitch(selection, pitches, undoBuffer) {
        undoBuffer.addBuffer('pitch change ' + JSON.stringify(pitches, null, ' '),
            'measure', selection.selector, selection.measure);
        SmoOperation.setPitch(selection, pitches);
    }
    static doubleDuration(selection, undoBuffer) {
        undoBuffer.addBuffer('double duration', 'measure', selection.selector, selection.measure);
        SmoOperation.doubleDuration(selection);
    }
    static halveDuration(selection, undoBuffer) {
        undoBuffer.addBuffer('halve note duration', 'measure', selection.selector, selection.measure);
        SmoOperation.halveDuration(selection);
    }
    static makeTuplet(selection, numNotes, undoBuffer) {
        undoBuffer.addBuffer(numNotes + '-let', 'measure', selection.selector, selection.measure);
        SmoOperation.makeTuplet(selection, numNotes);
    }
    static makeRest(selection, undoBuffer) {
        undoBuffer.addBuffer('make rest', 'measure', selection.selector, selection.measure);
        SmoOperation.makeRest(selection);
    }
    static makeNote(selection, undoBuffer) {
        undoBuffer.addBuffer('make note', 'measure', selection.selector, selection.measure);
        SmoOperation.makeNote(selection);
    }
    static unmakeTuplet(selection, undoBuffer) {
        undoBuffer.addBuffer('unmake tuplet', 'measure', selection.selector, selection.measure);
        SmoOperation.unmakeTuplet(selection);
    }
    static dotDuration(selection, undoBuffer) {
        undoBuffer.addBuffer('dot duration', 'measure', selection.selector, selection.measure);
        SmoOperation.dotDuration(selection);
    }
    static toggleBeamGroups(selections, undoBuffer) {
        var measureUndoHash = {};
        selections.forEach((selection) => {
            if (!measureUndoHash[selection.selector.measure]) {
                measureUndoHash[selection.selector.measure] = true;
                undoBuffer.addBuffer('toggleBeamGroups', 'measure', selection.selector, selection.measure);
            }
            SmoOperation.toggleBeamGroup(selection);
        });
    }
    
    static beamSelections(selections,undoBuffer) {
        undoBuffer.addBuffer('beam notes', 'measure', selections[0].selector, selections[0].measure);
        SmoOperation.beamSelections(selections);
    }
    static undotDuration(selection, undoBuffer) {
        undoBuffer.addBuffer('undot duration', 'measure', selection.selector, selection.measure);
        SmoOperation.undotDuration(selection);
    }
    static transpose(selection, offset, undoBuffer) {
        undoBuffer.addBuffer('transpose pitches ' + offset, 'measure', selection.selector, selection.measure);
        SmoOperation.transpose(selection, offset);
    }
    static courtesyAccidental(pitchSelection, toBe, undoBuffer) {
        undoBuffer.addBuffer('courtesy accidental ', 'measure', pitchSelection.selector, pitchSelection.measure);
        SmoOperation.courtesyAccidental(pitchSelection, toBe);
    }
    static addDynamic(selection, dynamic, undoBuffer) {
        undoBuffer.addBuffer('add dynamic', 'measure', selection.selector, selection.measure);
        SmoOperation.addDynamic(selection, dynamic);
    }
	static toggleEnharmonic(pitchSelection,undoBuffer) {
	     undoBuffer.addBuffer('toggle enharmonic', 'measure', pitchSelection.selector, pitchSelection.measure);
		 SmoOperation.toggleEnharmonic(pitchSelection)
	}
    static interval(selection, interval, undoBuffer) {
        undoBuffer.addBuffer('add interval ' + interval, 'measure', selection.selector, selection.measure);
        SmoOperation.interval(selection, interval);
    }
    static crescendo(fromSelection, toSelection, undoBuffer) {
        undoBuffer.addBuffer('crescendo', 'staff', fromSelection.selector, fromSelection.staff);
        SmoOperation.crescendo(fromSelection, toSelection);
    }
    static decrescendo(fromSelection, toSelection, undoBuffer) {
        undoBuffer.addBuffer('decrescendo', 'staff', fromSelection.selector, fromSelection.staff);
        SmoOperation.decrescendo(fromSelection, toSelection);
    }
    static slur(fromSelection, toSelection, undoBuffer) {
        undoBuffer.addBuffer('slur', 'staff', fromSelection.selector, fromSelection.staff);
        SmoOperation.slur(fromSelection, toSelection);
    }
	static noop(score,undoBuffer) {
        undoBuffer.addBuffer('Backup', 'score', null, score);		
	}
        
	static measureSelectionOp(score,selection,op,params,undoBuffer,description) {
		undoBuffer.addBuffer(description, 'measure', selection.selector, selection.measure);
		SmoOperation[op](score,selection,params);
	}
    
    static staffSelectionOp(score,selection,op,params,undoBuffer,description) {
		undoBuffer.addBuffer(description, 'staff', selection.selector, selection.staff);
		SmoOperation[op](selection,params);
	}
	
	static scoreSelectionOp(score,selection,op,params,undoBuffer,description) {
        undoBuffer.addBuffer(description, 'score', null, score);
		SmoOperation[op](score,selection,params);
	}
	static scoreOp(score,op,params,undoBuffer,description) {
		undoBuffer.addBuffer(description, 'score', null, score);
		SmoOperation[op](score,params);
	}

    static addKeySignature(score, selection, keySignature, undoBuffer) {
        undoBuffer.addBuffer('addKeySignature ' + keySignature, 'score', null, score);
        SmoOperation.addKeySignature(score, selection, keySignature);
    }
    static addMeasure(score, systemIndex, nmeasure, undoBuffer) {
        undoBuffer.addBuffer('add measure', 'score', null, score);
        SmoOperation.addMeasure(score, systemIndex, nmeasure);
    }
    static deleteMeasure(score, selection, undoBuffer) {
        undoBuffer.addBuffer('delete measure', 'score', null, score);
        var measureIndex = selection.selector.measure;
        score.deleteMeasure(measureIndex);
    }
    static addStaff(score, parameters, undoBuffer) {
        undoBuffer.addBuffer('add instrument', 'score', null, score);
        SmoOperation.addStaff(score, parameters);
    }
	static toggleCourtesyAccidental(selection,undoBuffer) {
        undoBuffer.addBuffer('toggle courtesy ','measure', selection.selector, selection.measure);
		SmoOperation.toggleCourtesyAccidental(selection);		
	}
    static removeStaff(score, index, undoBuffer) {
        undoBuffer.addBuffer('remove instrument', 'score', null, score);
        SmoOperation.removeStaff(score, index);
    }
    static changeInstrument(score, instrument, selections, undoBuffer) {
        undoBuffer.addBuffer('changeInstrument', 'staff', selections[0].selector, score);
        SmoOperation.changeInstrument(score, instrument, selections);
    }
	static pasteBuffer(score,pasteBuffer,selections,undoBuffer,operation) {
		SmoUndoable.undoForSelections(score,selections,undoBuffer,operation);
		var pasteTarget = selections[0].selector;
        pasteBuffer.pasteSelections(this.score, pasteTarget);
	}
}
;


// ## PasteBuffer
// ### Description:
// Hold some music that can be pasted back to the score
class PasteBuffer {
	constructor() {
		this.notes = [];
		this.noteIndex = 0;
		this.measures = [];
		this.measureIndex = -1;
		this.remainder = 0;
	}

	setSelections(score, selections) {
		this.notes = [];
		this.noteIndex = 0;
		var measureIndex = -1;
		this.score = score;

		if (selections.length < 1) {
			return;
		}

		this.tupletNoteMap = {};
		var first = selections[0];
		var last = selections[selections.length - 1];

		var startTuplet = first.measure.getTupletForNote(first.note);
		if (startTuplet) {
			if (startTuplet.getIndexOfNote(first.note) != 0) {
				return; // can't paste from the middle of a tuplet
			}
		}
		var endTuplet = last.measure.getTupletForNote(last.note);
		if (endTuplet) {
			if (endTuplet.getIndexOfNote(last.note) != endTuplet.notes.length - 1) {
				return; // can't paste part of a tuplet.
			}
		}

		this._populateSelectArray(selections);

	}
	// ### _populateSelectArray
	// ### Description:
	// copy the selected notes into the paste buffer with their original locations.
	_populateSelectArray(selections) {
		var currentTupletParameters = null;
		var currentTupletNotes = [];
		selections.forEach((selection) => {
			var selector = JSON.parse(JSON.stringify(selection.selector));
			if (selection.note.isTuplet) {
				var tuplet = selection.measure.getTupletForNote(selection.note);
				var index = tuplet.getIndexOfNote(selection.note);
				if (index == 0) {
					var ntuplet = SmoTuplet.cloneTuplet(tuplet);
					this.tupletNoteMap[ntuplet.attrs.id] = ntuplet;
					ntuplet.notes.forEach((nnote) => {
						
						this.notes.push({
						selector:selector,note:nnote});
						selector = JSON.parse(JSON.stringify(selector));
						selector.tick += 1;
					});
				}
			} else {

				var note = SmoNote.clone(selection.note);
				this.notes.push({
					selector: selector,
					note: note
				});
			}
		});
		this.notes.sort((a, b) => {
			return SmoSelector.gt(a.selector, b.selector) ? 1 : -1;
		});
	}

	clearSelections() {
		this.notes = [];
	}

	// ### _populateMeasureArray
	// ### Description:
	// Before pasting, populate an array of existing measures from the paste destination
	// so we know how to place the notes.
	_populateMeasureArray() {
		this.measures = [];
		var measureSelection = SmoSelection.measureSelection(this.score, this.destination.staff, this.destination.measure);
		var measure = measureSelection.measure;
		this.measures.push(measure);
		var tickmap = measure.tickmap();
		var startSel = this.notes[0].selector;
		var currentDuration = tickmap.durationMap[this.destination.tick];
		var rv = [];
		this.notes.forEach((selection) => {
			if (currentDuration + selection.note.tickCount > tickmap.totalDuration && measureSelection != null) {
				// If this note will overlap the measure boundary, the note will be split in 2 with the
				// remainder going to the next measure.  If they line up exactly, the remainder is 0.
				var remainder = (currentDuration + selection.note.tickCount) - tickmap.totalDuration;
				currentDuration = remainder;

				measureSelection = SmoSelection.measureSelection(this.score,
						measureSelection.selector.staff,
						measureSelection.selector.measure + 1);

				// If the paste buffer overlaps the end of the score, we can't paste (TODO:  add a measure in this case)
				if (measureSelection != null) {
					this.measures.push(measureSelection.measure);
				}
			} else if (measureSelection != null) {
				currentDuration += selection.note.tickCount;
			}
		});
	}

	// ### _populatePre
	// When we paste, we replace entire measures.  Populate the first measure up until the start of pasting.
	_populatePre(voiceIndex, measure, startTick, tickmap) {
		var voice = {
			notes: []
		};
		var ticksToFill = tickmap.durationMap[startTick];
		var filled = 0;
		// TODO: bug here, need to handle tuplets in pre-part, create new tuplet
		for (var i = 0; i < measure.voices[voiceIndex].notes.length; ++i) {

			var note = measure.voices[voiceIndex].notes[i];
			// IF this is a tuplet, clone all the notes at once.
			if (note.isTuplet) {
				var tuplet = measure.getTupletForNote(note);
				// create a new tuplet array for the new measure.
				if (tuplet.getIndexOfNote(note) === 0) {
					var ntuplet = SmoTuplet.cloneTuplet(tuplet);
					this.tupletNoteMap[ntuplet.attrs.id] = ntuplet;
					ticksToFill -= tuplet.tickCount;
					voice.notes = voice.notes.concat(ntuplet.notes);
				}
			} else if (ticksToFill >= note.tickCount) {
				ticksToFill -= note.tickCount;
				voice.notes.push(SmoNote.clone(note));
			} else {
				var duration = note.tickCount - ticksToFill;
				SmoNote.cloneWithDuration(note, {
					numerator: duration,
					denominator: 1,
					remainder: 0
				});
				ticksToFill = 0;
			}
			if (ticksToFill < 1) {
				break;
			}
		}
		return voice;
	}

	// ### _populateVoice
	// ### Description:
	// Create a new voice for a new measure in the paste destination
	_populateVoice(voiceIndex) {
		this._populateMeasureArray();
		var measures = this.measures;
		this.measureIndex = 0;
		var measureVoices = [];

		var measure = measures[0];
		var tickmap = measure.tickmap();
		var startSelector = JSON.parse(JSON.stringify(this.destination));
		var measureTuplets = [];
		var voice = this._populatePre(voiceIndex, measure, this.destination.tick, tickmap);
		measureVoices.push(voice);
		while (this.measureIndex < measures.length) {
			measure = measures[this.measureIndex];
			tickmap = measure.tickmap();
			this._populateNew(voice, voiceIndex, measure, tickmap, startSelector);
			if (this.noteIndex < this.notes.length && this.measureIndex < measures.length) {
				voice = {
					notes: []
				};
				measureVoices.push(voice);
				startSelector = {
					staff: startSelector.staff,
					measure: startSelector.measure,
					voice: voiceIndex,
					tick: 0
				};
				this.measureIndex += 1;
			} else {
				break;
			}
		}
		this._populatePost(voice, voiceIndex, measure, tickmap, startSelector.tick);

		return measureVoices;
	}

	static _countTicks(voice) {
		var voiceTicks = 0;
		voice.notes.forEach((note) => {
			voiceTicks += note.tickCount;
		});
		return voiceTicks;
	}

	// ### _populateNew
	// ### Description:
	// Start copying the paste buffer into the destination by copying the notes and working out
	// the measure overlap
	_populateNew(voice, voiceIndex, measure, tickmap, startSelector) {
		var currentDuration = tickmap.durationMap[startSelector.tick];
		var totalDuration = tickmap.totalDuration;
		while (currentDuration < totalDuration && this.noteIndex < this.notes.length) {
			var note = this.notes[this.noteIndex].note;
			if (note.isTuplet) {
				var tuplet = this.tupletNoteMap[note.tuplet.id];
				var index = tuplet.getIndexOfNote(note);
				// If the tuplet fits in the rest of the measure, just paste all the notes
				// Note they are not cloned.
				if (index === 0) {
					if (currentDuration + tuplet.tickCount <= totalDuration && this.remainder === 0) {
						currentDuration += tuplet.tickCount;
						tuplet.notes.forEach((tnote) => {
							voice.notes.push(tnote);
						});
						this.noteIndex += 1;
						measure.tuplets.push(tuplet);
						startSelector.tick += tuplet.notes.length;
					} else {
						// The tuplet won't fit.  There is no way to split up a tuplet, we
						// should try to prevent this.  Just paste the first note to the
						// last spot in the measure
						var partial = totalDuration - currentDuration;
						var snote = SmoNote.cloneWithDuration(tuplet.notes[0], {
								numerator: partial,
								denominator: 1,
								remainder: 0
							});
						snote.tuplet = null;
						totalDuration = currentDuration;
						voice.notes.push(snote);
						this.noteIndex += 1;
						this.startSelector.tick += 1;
					}
				} else {
					this.noteIndex += 1;
				}
			} else if (currentDuration + note.tickCount <= totalDuration && this.remainder === 0) {
				// The whole note fits in the measure, paste it.
				voice.notes.push(SmoNote.clone(note));
				currentDuration += note.tickCount;
				this.noteIndex += 1;
				startSelector.tick += 1;
			} else if (this.remainder > 0) {
				// This is a note that spilled over the last measure
				voice.notes.push(SmoNote.cloneWithDuration(note, {
						numerator: this.remainder,
						denominator: 1,
						remainder: 0
					}));

				currentDuration += this.remainder;
				this.remainder = 0;
			} else {
				// The note won't fit, so we split it in 2 and paste the remainder in the next measure.
				// TODO:  tie the last note to this one.
				var partial = totalDuration - currentDuration;
				voice.notes.push(SmoNote.cloneWithDuration(note, {
						numerator: partial,
						denominator: 1,
						remainder: 0
					}));
				currentDuration += partial;

				// Set the remaining length of the current note, this will be added to the
				// next measure with the previous note's pitches
				this.remainder = note.tickCount - partial;
			}
		}
	}

	// ### _populatePost
	// When we paste, we replace entire measures.  Populate the last measure from the end of paste to the
	// end of the measure with notes in the existing measure.
	_populatePost(voice, voiceIndex, measure, tickmap, endTick) {
		var startTicks = PasteBuffer._countTicks(voice);
		var notes = measure.voices[voiceIndex].notes;
		var totalDuration = tickmap.totalDuration;
		while (startTicks < totalDuration) {
			// Find the point in the music where the paste area runs out, or as close as we can get.
			var existingIndex = tickmap.durationMap.indexOf(startTicks);
			existingIndex = (existingIndex < 0) ? measure.voices[voiceIndex].notes.length - 1 : existingIndex;
			var note = measure.voices[voiceIndex].notes[existingIndex];
			var ticksLeft = totalDuration - startTicks;
			if (ticksLeft >= note.tickCount) {
				startTicks += note.tickCount;
				voice.notes.push(SmoNote.clone(note));
			} else {
				var remainder = totalDuration - startTicks;
				voice.notes.push(SmoNote.cloneWithDuration(note, {
						numerator: remainder,
						denominator: 1,
						remainder: 0
					}));
				startTicks = totalDuration;
			}
		}
	}

	pasteSelections(score, selector) {
		this.destination = selector;
		if (this.notes.length < 1) {
			return;
		}

		var voices = this._populateVoice(this.destination.voice);
		var measureSel = JSON.parse(JSON.stringify(this.destination));
		for (var i = 0; i < this.measures.length; ++i) {
			var measure = this.measures[i];
			var nvoice = voices[i];
			var ser = measure.serialize();
			var vobj = {
				notes: []
			};
			nvoice.notes.forEach((note) => {
				vobj.notes.push(note.serialize());
			});
			// TODO: figure out how to do this with multiple voices
			ser.voices = [vobj];
			var nmeasure = SmoMeasure.deserialize(ser);
			var tupletKeys = Object.keys(this.tupletNoteMap);
			nmeasure.tuplets = [];
			// since we are deserializing the measure that had different tuplets, need to create the correct tuplet.
			tupletKeys.forEach((key) => {
				if (vobj.notes.findIndex((nn) => {return nn.tuplet && nn.tuplet.id===key}) >= 0) {
				    nmeasure.tuplets.push(this.tupletNoteMap[key]);
				}
			});
			this.score.replaceMeasure(measureSel, nmeasure);
			measureSel.measure += 1;
		}

	}
}
;VF = Vex.Flow;
Vex.Xform = (typeof(Vex.Xform) == 'undefined' ? {}
     : Vex.Xform);
VX = Vex.Xform;

VX.groupCounter = 1;

// ## Description:
//   Create a staff and draw music on it usinbg VexFLow rendering engine
//
// ###  Options:
//  `{measure:measure}` - The SMO measure to render
// ### VxMeasure methods
// ---
class VxMeasure {
    constructor(context, options) {
        this.context = context;
        Vex.Merge(this, VxMeasure.defaults);
        Vex.Merge(this, options);
        this.smoMeasure = this.smoMeasure ? this.smoMeasure : new SmoMeasure(options);
        this.noteToVexMap = {};
        this.beamToVexMap = {};
        this.tupletToVexMap = {};
        this.modifierOptions = {};
        this.tickmap = this.smoMeasure.tickmap();

        this.vexNotes = [];
        this.vexBeamGroups = [];
        this.vexTuplets = [];
    }
	
	static get adjLeftPixels() {
		return 5;
	}
	
	static get adjRightPixels() {
		return 5;
	}

    static get defaults() {
        // var defaultLayout = new smrfSimpleLayout();

        return {
            smoMeasure: null
        };
    }
    addCustomModifier(ctor, parameters) {
        this.smoMeasure.addCustomModifier(ctor, parameters);
    }

    applyTransform(actor) {
        SmoTickTransformer.applyTransform(this.smoMeasure, [actor]);
        smoModifierFactory.applyModifiers(this.smoMeasure);
    }
    applyModifiers() {
        smoModifierFactory.applyModifiers(this.smoMeasure);
    }
    tickmap() {
        return VX.TICKMAP(this.smoMeasure);
    }     

    // ## Description:
    // decide whether to force stem direction for multi-voice, or use the default.
    // ## TODO:
    // use x position of ticks in other voices, pitch of note, and consider
    // stem direction modifier.
    applyStemDirection(vxParams) {
        if (this.smoMeasure.voices.length === 1) {
            vxParams.auto_stem = true;
        } else if (this.smoMeasure.activeVoice % 2) {
            vxParams.stem_direction = -1;
        } else {
            vxParams.stem_direction = 1;
        }
    }
		
	_createAccidentals(smoNote,vexNote,tickIndex) {		
        for (var i = 0; i < smoNote.pitches.length; ++i) {
            var pitch = smoNote.pitches[i];
            var accidental = pitch.accidental ? pitch.accidental : 'n';

            // was this accidental declared earlier in the measure?
            var declared = this.tickmap.getActiveAccidental(pitch,tickIndex,this.smoMeasure.keySignature);

            if (accidental != declared || pitch.cautionary) {
                var acc = new VF.Accidental(accidental);

                if (pitch.cautionary) {
                    acc.setAsCautionary();
                }
                vexNote.addAccidental(i, acc);
            }
        }
        for (var i = 0; i < smoNote.dots; ++i) {
            vexNote.addDotToAll();
        }	
	}
    
    _createLyric(smoNote,vexNote) {
        var lyrics = smoNote.getModifiers('SmoLyric');
        var ix = 0;
        lyrics.forEach((ll) => {
            var y = ll.verse*10;
            var vexL = new VF.Annotation(ll.text);
            vexL.setFont(ll.fontInfo.family, ll.fontInfo.size,ll.fontInfo.weight);
            vexL.setYShift(y); // need this?
			vexL.setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
            vexNote.addAnnotation(0,vexL);
            const classString = 'lyric lyric-'+ll.verse;
            vexL.addClass(classString);
        });
    }

    // ## Description:
    // convert a smoNote into a vxNote so it can be rasterized
    _createVexNote(smoNote, tickIndex) {
		// If this is a tuplet, we only get the duration so the appropriate stem
		// can be rendered.  Vex calculates the actual ticks later when the tuplet is made
		var duration = 
		   smoNote.isTuplet ? 
		     smoMusic.closestVexDuration(smoNote.tickCount) : 
			 smoMusic.ticksToDuration[smoNote.tickCount];
			 
		// transpose for instrument-specific keys
		var keys=smoMusic.smoPitchesToVexKeys(smoNote.pitches,this.smoMeasure.transposeIndex);
        var noteParams = {
            clef: smoNote.clef,
            keys: keys,
            duration: duration + smoNote.noteType
        };
		
        this.applyStemDirection(noteParams);
        var vexNote = new VF.StaveNote(noteParams);
        smoNote.renderId = 'vf-' + vexNote.attrs.id; // where does 'vf' come from?

		this._createAccidentals(smoNote,vexNote,tickIndex);
        this._createLyric(smoNote,vexNote);
		
        return vexNote;
    }
	
	_renderArticulations(smoNote,articulation) {
		var i=0;
		this.smoMeasure.notes.forEach((smoNote) => {
			smoNote.articulations.forEach((art) => {
				var vx = this.noteToVexMap[smoNote.id];
				var position = SmoArticulation.positionToVex[art.position];
				var vexArt = SmoArticulation.articulationToVex[art.articulation];
				var vxArt=new VF.Articulation(vexArt).setPosition(position);
				vx.addArticulation(i,vxArt);
			});
		});		
	}
	
	_renderNoteGlyph(smoNote,textObj) {		
		var x = this.noteToVexMap[smoNote.id].getAbsoluteX();
		// the -3 is copied from vexflow textDynamics
		var y=this.stave.getYForLine(textObj.yOffsetLine-3) + textObj.yOffsetPixels; 
		var group = this.context.openGroup();
        group.classList.add(textObj.id+'-'+smoNote.id);
		group.classList.add(textObj.id);
		textObj.text.split('').forEach((ch)=> {
			const glyphCode = VF.TextDynamics.GLYPHS[ch];
			const glyph=new Vex.Flow.Glyph(glyphCode.code, textObj.fontSize);
			glyph.render(this.context, x, y);
			x += VF.TextDynamics.GLYPHS[ch].width;
		});
		textObj.renderedBox = svgHelpers.smoBox(group.getBoundingClientRect());
		this.context.closeGroup();
	}
	
	renderDynamics() {
		this.smoMeasure.notes.forEach((smoNote) => {
			var mods = smoNote.textModifiers.filter((mod) => {
				return mod.attrs.type === 'SmoDynamicText';
			});
			mods.forEach((tm) => {
				this._renderNoteGlyph(smoNote,tm);
			});
		});
	}
	

    // ## Description:
    // create an a array of VF.StaveNote objects to render the active voice.
    createVexNotes() {
        this.vexNotes = [];
        this.noteToVexMap = {};

        for (var i = 0; i < this.smoMeasure.notes.length; ++i) {
            var smoNote = this.smoMeasure.notes[i];           
            var vexNote = this._createVexNote(smoNote, i);
            this.noteToVexMap[smoNote.attrs.id] = vexNote;
            this.vexNotes.push(vexNote);
        }
		this._renderArticulations();
    }

    // ### createVexBeamGroups
    // create the VX beam groups. VexFlow has auto-beaming logic, but we use 
	// our own because the user can specify stem directions, breaks etc.
    createVexBeamGroups() {
        this.vexBeamGroups = [];
        this.beamToVexMap = {};
        for (var i = 0; i < this.smoMeasure.beamGroups.length; ++i) {
            var bg = this.smoMeasure.beamGroups[i];
            var vexNotes = [];
            var stemDirection = VF.Stem.DOWN;
            for (var j = 0; j < bg.notes.length; ++j) {
                var note = bg.notes[j];
                var vexNote = this.noteToVexMap[note.attrs.id]
                    if (j === 0) {
                        stemDirection = note.flagState == SmoNote.flagStates.auto ? 
                            vexNote.getStemDirection() : note.toVexStemDirection();
                    } 
                    vexNote.setStemDirection(stemDirection);
                    
                    vexNotes.push(this.noteToVexMap[note.attrs.id]);
            }
            var vexBeam = new VF.Beam(vexNotes);
            this.beamToVexMap[bg.attrs.id] = vexBeam;
            this.vexBeamGroups.push(vexBeam);
        }
    }

    // ### createVexTuplets
    // Create the VF tuplet objects based on the smo tuplet objects
    // that have been defined.
    createVexTuplets() {
        this.vexTuplets = [];
        this.tupletToVexMap = {};
        for (var i = 0; i < this.smoMeasure.tuplets.length; ++i) {
            var tp = this.smoMeasure.tuplets[i];
            var vexNotes = [];
            for (var j = 0; j < tp.notes.length; ++j) {
                var smoNote = tp.notes[j];
                vexNotes.push(this.noteToVexMap[smoNote.attrs.id]);
            }
            var vexTuplet = new VF.Tuplet(vexNotes, {
                    num_notes: tp.num_notes,
                    notes_occupied: tp.notes_occupied,
                    ratioed: false,
                    bracketed: true,
                    location: 1
                });
            this.tupletToVexMap[tp.attrs.id] = vexTuplet;
            this.vexTuplets.push(vexTuplet);
        }
    }
    unrender() {
        $(this.context.svg).find('g.' + this.smoMeasure.attrs.id).remove();
    }
	
	handleMeasureModifiers() {
		var sb = this.smoMeasure.getStartBarline();
		var eb = this.smoMeasure.getEndBarline();
		var sym = this.smoMeasure.getRepeatSymbol();

        // don't create a begin bar for any but the 1st measure.
		if (this.smoMeasure.measureNumber.systemIndex != 0 && sb.barline === SmoBarline.barlines.singleBar) {
		    this.stave.setBegBarType(VF.Barline.type.NONE);
		} else {
			this.stave.setBegBarType(sb.toVexBarline());
		}
		if (eb.barline != SmoBarline.barlines.singleBar) {
			this.stave.setEndBarType(eb.toVexBarline());
		}
		if (sym && sym.symbol != SmoRepeatSymbol.symbols.None) {
			var rep = new VF.Repetition(sym.toVexSymbol(),sym.xOffset+this.smoMeasure.staffX,sym.yOffset);
			this.stave.modifiers.push(rep);
		}
		var tms = this.smoMeasure.getMeasureText();
		// TODO: set font
		tms.forEach((tm) => {
			/* var vm = new VF.StaveText(tm.text,tm.toVexPosition(),{
				shift_x:tm.adjustX,shift_y:tm.adjustY,justification:tm.toVexJustification()
			});
			vm.setFont(tm.fontInfo);   */
			this.stave.setText(
			    tm.text,tm.toVexPosition(),{
				shift_x:tm.adjustX,shift_y:tm.adjustY,justification:tm.toVexJustification()
			});
			// hack - we can't create staveText directly so this is the only way I could set the font
			var ar = this.stave.getModifiers();
			var vm=ar[ar.length - 1];
			vm.setFont(tm.fontInfo);
			
		});
        
        var rm = this.smoMeasure.getRehearsalMark();
        if (rm) {
            this.stave.setSection(rm.symbol,0);
        }
        
        var tempo = this.smoMeasure.getTempo();
        if (tempo) {
            this.stave.setTempo(tempo.toVexTempo(),tempo.yOffset);
        }
		
	}

    // ## Description:
    // Render all the notes in my smoMeasure.  All rendering logic is called from here.
    render() {
        $(this.context.svg).find('g.' + this.smoMeasure.attrs.id).remove();

        var group = this.context.openGroup();
        group.classList.add(this.smoMeasure.attrs.id);
		group.id=this.smoMeasure.attrs.id;
		
		var key = smoMusic.vexKeySignatureTranspose(this.smoMeasure.keySignature,this.smoMeasure.transposeIndex);
		var canceledKey = this.smoMeasure.canceledKeySignature ? smoMusic.vexKeySignatureTranspose(this.smoMeasure.canceledKeySignature,this.smoMeasure.transposeIndex)
		   : this.smoMeasure.canceledKeySignature;

        this.stave = new VF.Stave(this.smoMeasure.staffX, this.smoMeasure.staffY, this.smoMeasure.staffWidth - 1);
        if (this.smoMeasure.prevFrame < VxMeasure.fps) {
            this.smoMeasure.prevFrame += 1;
        }
		
		this.stave.options.space_above_staff_ln=0; // don't let vex place the staff, we want to.
        //console.log('adjX is '+this.smoMeasure.adjX);

        // Add a clef and time signature.
        if (this.smoMeasure.forceClef) {
            this.stave.addClef(this.smoMeasure.clef);
        }
        if (this.smoMeasure.forceKeySignature) {
			var sig = new VF.KeySignature(key);
			if (this.smoMeasure.canceledKeySignature) {
				sig.cancelKey(canceledKey);
			}
            sig.addToStave(this.stave);
        }
        if (this.smoMeasure.forceTimeSignature) {
            this.stave.addTimeSignature(this.smoMeasure.timeSignature);
        }
        // Connect it to the rendering context and draw!
        this.stave.setContext(this.context);
		
		this.handleMeasureModifiers();
		this.stave.draw();

        var voiceAr = [];

        // If there are multiple voices, add them all to the formatter at the same time so they don't collide
        for (var j = 0; j < this.smoMeasure.voices.length; ++j) {

            this.smoMeasure.activeVoice = j;
            this.createVexNotes();
            this.createVexTuplets();
            this.createVexBeamGroups();

            // Create a voice in 4/4 and add above notes
            var voice = new VF.Voice({
                    num_beats: this.smoMeasure.numBeats,
                    beat_value: this.smoMeasure.beatValue
                });
            voice.addTickables(this.vexNotes);
            voiceAr.push(voice);
        }
		
		// Need to format for x position, then set y position before drawing dynamics.
        this.formatter = new VF.Formatter().joinVoices(voiceAr).format(voiceAr, this.smoMeasure.staffWidth-
		    (this.smoMeasure.adjX + this.smoMeasure.adjRight));
		
        for (var j = 0; j < voiceAr.length; ++j) {
            voiceAr[j].draw(this.context, this.stave);
        }

        var self = this;
        this.vexBeamGroups.forEach(function (b) {
            b.setContext(self.context).draw();
        });

        this.vexTuplets.forEach(function (tuplet) {
            tuplet.setContext(self.context).draw();
        });
		this.renderDynamics();
		// this.smoMeasure.adjX = this.stave.start_x - (this.smoMeasure.staffX);

        this.context.closeGroup();
        var box = svgHelpers.smoBox(group.getBoundingClientRect());
		var lbox = svgHelpers.clientToLogical(this.context.svg,box);
        this.smoMeasure.renderedBox = {
            x: box.x,
            y: box.y,
            height: box.height,
            width: box.width
        };		
		this.smoMeasure.logicalBox = lbox;
        this.smoMeasure.changed = false;
		

		this.smoMeasure.voices.forEach((voice) => {
			voice.notes.forEach((smoNote) =>  {
                var el = this.context.svg.getElementById(smoNote.renderId);
				svgHelpers.updateArtifactBox(this.context.svg,el,smoNote);
                
                // TODO: fix this, only works on the first line.
                smoNote.getModifiers('SmoLyric').forEach((lyric) => {
                    var ar = Array.from(el.getElementsByClassName('vf-lyric'));
                    ar.forEach((lbox) => {
                        svgHelpers.updateArtifactBox(this.context.svg,lbox,lyric);
                    });
                });
            });
        });
    }
}
;// ## Description:
//   Create a system of staves and draw music on it.
//
// ##  Options:
//  clef:'treble',
//  num_beats:num_beats,
//  timeSignature: '4/4',
//  smoMeasures: []
class VxSystem {
	constructor(context, topY, lineIndex) {
		this.context = context;
		this.leftConnector = [null, null];
		this.lineIndex = lineIndex;
		this.maxStaffIndex = -1;
		this.maxSystemIndex = -1;
		this.width = -1;
		this.smoMeasures = [];
		this.vxMeasures = [];
		this.endcaps = [];
		this.endings = [];
		this.box = {
			x: -1,
			y: -1,
			width: 0,
			height: 0
		};
		this.currentY = 0;
		this.topY = topY;
		this.clefWidth = 70;
		this.ys = [];
		this.measures = [];
		this.modifiers = [];
	}

	getVxMeasure(smoMeasure) {
		for (var i = 0; i < this.vxMeasures.length; ++i) {
			var vm = this.vxMeasures[i];
			if (vm.smoMeasure.attrs.id === smoMeasure.attrs.id) {
				return vm;
			}
		}

		return null;
	}

	getVxNote(smoNote) {
		var note;
		if (!smoNote) {
			return null;
		}
		for (var i = 0; i < this.measures.length; ++i) {
			var mm = this.measures[i];
			if (mm.noteToVexMap[smoNote.id]) {
				return mm.noteToVexMap[smoNote.id];
			}
		}
		return null;
	}
	
	updateLyricOffsets() {
		var lowestYs = {};
		var lyrics=[];
		this.vxMeasures.forEach((mm) => {
			var smoMeasure = mm.smoMeasure;
			smoMeasure.voices.forEach((voice) => {
				voice.notes.forEach((note) => {
					note.getModifiers('SmoLyric').forEach((lyric) => {
						var lowest = (lyric.logicalBox.y+lyric.logicalBox.height)-lyric.adjY;
						if (!lowestYs[lyric.verse]) {
							lowestYs[lyric.verse] = lowest;
						} else {
							lowestYs[lyric.verse] = lowestYs[lyric.verse] > lowest ? lowest : lowestYs[lyric.verse];
						}
						lyric.selector='#'+note.renderId+' g.lyric-'+lyric.verse;
						lyrics.push(lyric);
					});
				});
			});
		});

		lyrics.forEach((lyric) => {
			lyric.adjY = lowestYs[lyric.verse] - (lyric.logicalBox.y + lyric.logicalBox.height);
			var dom = $(this.context.svg).find(lyric.selector)[0];
			dom.setAttributeNS('','transform','translate(0 '+lyric.adjY+')');
		});
		
		
	}

	renderModifier(modifier, vxStart, vxEnd) {
		// if it is split between lines, render one artifact for each line, with a common class for
		// both if it is removed.
		var artifactId = modifier.attrs.id + '-' + this.lineIndex;
		$(this.context.svg).find('g.' + artifactId).remove();
		var group = this.context.openGroup();
		group.classList.add(modifier.id);
		group.classList.add(artifactId);
		if ((modifier.type == 'SmoStaffHairpin' && modifier.hairpinType == SmoStaffHairpin.types.CRESCENDO) ||
			(modifier.type == 'SmoStaffHairpin' && modifier.hairpinType == SmoStaffHairpin.types.DECRESCENDO)) {
			var hairpin = new VF.StaveHairpin({
					first_note: vxStart,
					last_note: vxEnd
				}, modifier.hairpinType);
			hairpin.setRenderOptions({
				height: modifier.height,
				y_shift: modifier.yOffset,
				left_shift_px: modifier.xOffsetLeft,
				right_shift_px: modifier.xOffsetRight
			});
			hairpin.setContext(this.context).setPosition(modifier.position).draw();
		} else if (modifier.type == 'SmoSlur') {
			var curve = new VF.Curve(
					vxStart, vxEnd, //first_indices:[0],last_indices:[0]});
				{
					thickness: modifier.thickness,
					x_shift: modifier.xOffset,
					y_shift: modifier.yOffset,
					cps: modifier.controlPoints,
					invert: modifier.invert,
					position: modifier.position
				});
			curve.setContext(this.context).draw();

		}

		this.context.closeGroup();
		return svgHelpers.smoBox(group.getBoundingClientRect());
	}

	renderEndings() {
		this.smoMeasures.forEach((smoMeasure) => {
			var staffId = smoMeasure.measureNumber.staffId;
			var endings = smoMeasure.getNthEndings();
			endings.forEach((ending) => {
				$(this.context.svg).find('g.' + ending.attrs.id).remove();
				var group = this.context.openGroup(null,ending.attrs.id);
				var voAr=[];
				group.classList.add(ending.attrs.id);
				group.classList.add(ending.endingId);

				for (var i = ending.startBar; i <= ending.endBar; ++i) {
					var endMeasure = this.getMeasureByIndex(i,staffId);
					if (!endMeasure) {
						continue;
					}
					voAr.push(endMeasure);
					var vxMeasure = this.getVxMeasure(endMeasure);
					var vtype = ending.toVexVolta(endMeasure.measureNumber.measureNumber);
					var vxVolta = new VF.Volta(vtype, ending.number,ending.xOffsetStart, ending.yOffset);
					vxMeasure.stave.modifiers.push(vxVolta);
					vxVolta.setContext(this.context).draw(vxMeasure.stave, endMeasure.staffX);
				}
				this.context.closeGroup();
				ending.renderedBox = svgHelpers.smoBox(group.getBoundingClientRect());
				ending.logicalBox = svgHelpers.clientToLogical(this.context.svg, ending.renderedBox);
				
				// Adjust real height of measure to match volta height
				voAr.forEach((mm) => {
					var delta =  mm.logicalBox.y - ending.logicalBox.y;
					if (delta > 0) {
						mm.logicalBox.y -= delta;
						mm.logicalBox.height += delta;
					}
				});
			});
		});
	}

	getMeasureByIndex(measureIndex,staffId) {
		for (var i = 0; i < this.smoMeasures.length; ++i) {
			var mm = this.smoMeasures[i];
			if (measureIndex === mm.measureNumber.measureNumber && staffId === mm.measureNumber.staffId) {
				return mm;
			}
		}
		return null;
	}

	// ## renderMeasure
	// ## Description:
	// Create the graphical (VX) notes and render them on svg.  Also render the tuplets and beam
	// groups
	renderMeasure(staffIndex, smoMeasure) {
		var systemIndex = smoMeasure.measureNumber.systemIndex;
		this.smoMeasures.push(smoMeasure);

		var vxMeasure = new VxMeasure(this.context, {
				smoMeasure: smoMeasure
			});

		vxMeasure.render();
		this.vxMeasures.push(vxMeasure);

		// Keep track of the y coordinate for the nth staff


		// keep track of left-hand side for system connectors
		if (systemIndex === 0) {
			if (staffIndex === 0) {
				this.leftConnector[0] = vxMeasure.stave;
			} else if (staffIndex > this.maxStaffIndex) {
				this.maxStaffIndex = staffIndex;
				this.leftConnector[1] = vxMeasure.stave;
			}
		} else if (smoMeasure.measureNumber.systemIndex > this.maxSystemIndex) {
			this.endcaps = [];
			this.endcaps.push(vxMeasure.stave);
			this.maxSystemIndex = smoMeasure.measureNumber.systemIndex;
		} else if (smoMeasure.measureNumber.systemIndex === this.maxSystemIndex) {
			this.endcaps.push(vxMeasure.stave);
		}
		this.measures.push(vxMeasure);
		// this._adjustBox(vxMeasure.renderedSize);
	}

	// ## cap
	// ## Description:
	// draw the system brackets.  I don't know why I call them a cap.
	cap() {
		$(this.context.svg).find('g.lineBracket-' + this.lineIndex).remove();
		var group = this.context.openGroup();
		group.classList.add('lineBracket-' + this.lineIndex);
		group.classList.add('lineBracket');
		if (this.leftConnector[0] && this.leftConnector[1]) {
			var c1 = new VF.StaveConnector(this.leftConnector[0], this.leftConnector[1])
				.setType(VF.StaveConnector.type.BRACKET);
			var c2 = new VF.StaveConnector(this.leftConnector[0], this.leftConnector[1])
				.setType(VF.StaveConnector.type.SINGLE);
			c1.setContext(this.context).draw();
			c2.setContext(this.context).draw();
		}
		this.context.closeGroup();
	}
}
;
class TrackerBase {
}

// ## suiTracker
// A tracker maps the UI elements to the logical elements ,and allows the user to
// move through the score and make selections, for navigation and editing.
//
// ### Usage:
// `` javascript ``
// `new suiTracker(layout)`
//
// ### See also:
// `SuiSimpleLayout`, `controller`, `menu`
// ### class methods:
// ---
class suiTracker {
	constructor(layout) {
		this.layout = layout;
		this.groupObjectMap = {};
		this.objectGroupMap = {};
		this.objects = [];
		this.selections = [];
		this.modifierTabs = [];
		this.modifierIndex = -1;
		this.modifierSuggestion=-1;
		this.suggestion = {};
		this.pitchIndex = -1;
		this.pasteBuffer = new PasteBuffer();
	}

	// ### renderElement
	// the element the score is rendered on
	get renderElement() {
		return this.layout.renderElement;
	}

	get score() {
		return this.layout.score;
	}

	get context() {
		return this.layout.context;
	}

	_copySelections() {
		var rv = [];
		this.selections.forEach((sel) => {
			rv.push(sel.selector)
		});
		return rv;
	}
	
	_getTicksFromSelections() {
		var rv = 0;
		this.selections.forEach((sel) => {
			if (sel.note) {
				rv += sel.note.tickCount;
			}
		});
		return rv;		
	}

	_updateModifiers(rebox) {
		this.modifierTabs = [];
		this.modifierBoxes = [];
		var modMap = {};
		var ix=0;
        this.layout.score.scoreText.forEach((modifier) => {
            if (!modMap[modifier.attrs.id]) {
                if (rebox) {
                    var el = this.context.svg.getElementsByClassName(modifier.attrs.id)[0]
                    svgHelpers.updateArtifactBox(this.context.svg,el,modifier);
                }
                this.modifierTabs.push({
                    modifier: modifier,
							selection: null,
							box:modifier.renderedBox,
							index:ix
                });
                ix += 1;
            }            
        });
		this.objects.forEach((selection) => {
			selection.staff.modifiers.forEach((modifier) => {
				if (SmoSelector.contains(selection.selector, modifier.startSelector, modifier.endSelector)) {
					if (!modMap[modifier.id]) {
                        if (rebox) {
                            var el = this.context.svg.getElementsByClassName(modifier.id)[0];
                            svgHelpers.updateArtifactBox(this.context.svg,el,modifier);
                        }
						this.modifierTabs.push({
							modifier: modifier,
							selection: selection,
							box:modifier.renderedBox,
							index:ix
						});
						ix += 1;
						modMap[modifier.id] = {
							exists: true
						};
					}
				}
			});
			selection.measure.modifiers.forEach((modifier) => {
				if (modifier.id && !modMap[modifier.id]) {
                    if (rebox) {
                        var el = this.context.svg.getElementsByClassName(modifier.id)[0];
                        svgHelpers.updateArtifactBox(this.context.svg,el,modifier);
                    }
					this.modifierTabs.push({
						modifier: modifier,
						selection: selection,
						box:modifier.renderedBox,
						index:ix
					});
					ix += 1;
					modMap[modifier.id] = {
						exists: true
					};
				}
			});
			selection.note.textModifiers.forEach((modifier) => {
				if (!modMap[modifier.id]) {
                    if (rebox) {
                        var el = this.context.svg.getElementsByClassName(modifier.id)[0];
                        svgHelpers.updateArtifactBox(this.context.svg,el,modifier);
                    }
					this.modifierTabs.push({
						modifier: modifier,
						selection: selection,
						box:modifier.renderedBox,
						index:ix
					});
					ix += 1;
					modMap[modifier.id] = {
						exists: true
					};
				}
			});
		});
	}

	_highlightModifier() {
		if (this.modifierIndex >= 0 && this.modifierIndex < this.modifierTabs.length) {
			var modSelection = this.modifierTabs[this.modifierIndex];
			if (modSelection.modifier.renderedBox) {
				this._drawRect(modSelection.modifier.renderedBox, 'staffModifier');
			}
		}
	}
    
    // ### selectModifierById
    // programatically select a modifier by ID
    selectId(id) {
        this.modifierIndex = this.modifierTabs.findIndex((mm) =>  mm.modifier.attrs.id==id);        
    }

	clearModifierSelections() {
		this.modifierTabs = [];
		this.modifierIndex = -1;
		this.eraseRect('staffModifier');
		this.pasteBuffer.clearSelections();
	}
	getSelectedModifier() {
		if (this.modifierIndex >= 0) {
			return this.modifierTabs[this.modifierIndex];
		}
	}

	advanceModifierSelection() {
		this.eraseRect('staffModifier');

		if (!this.modifierTabs.length) {
			return;
		}
		this.modifierIndex = this.modifierIndex + 1;
		if (this.modifierIndex >= this.modifierTabs.length) {
			this.modifierIndex = -1;
			return;
		}
		this._highlightModifier();
	}

	_findClosestSelection(selector) {
		var artifact = this._getClosestTick(selector);
		if (!artifact)
			return;
		if (this.selections.find((sel) => JSON.stringify(sel.selector)
				 === JSON.stringify(artifact.selector))) {
			return;
		}
		if (selector.pitches && selector.pitches.length && selector.pitches.length <= artifact.note.pitches.length) {
			// If the old selection had only a single pitch, try to recreate that.
			artifact.selector.pitches = JSON.parse(JSON.stringify(selector.pitches));
		}
		this.selections.push(artifact);
	}
    
    // ### _updateNoteBox
    // Update the svg to screen coordinates based on a change in viewport.
    _updateNoteBox(svg,smoNote) {
        var el = svg.getElementById(smoNote.renderId);
        svgHelpers.updateArtifactBox(svg,el,smoNote);
        
        // TODO: fix this, only works on the first line.
        smoNote.getModifiers('SmoLyric').forEach((lyric) => {
			var ar = Array.from(el.getElementsByClassName('vf-lyric'));
			ar.forEach((lbox) => {
                svgHelpers.updateArtifactBox(svg,lbox,lyric);
			});
		});
    }
	
	// ### updateMap
	// This should be called after rendering the score.  It updates the score to
	// graphics map and selects the first object.
	//
	// ### TODO:
	// try to preserve the previous selection
	_updateMap(rebox) {
		var notes = [].slice.call(this.renderElement.getElementsByClassName('vf-stavenote'));
		this.groupObjectMap = {};
		this.objectGroupMap = {};
		this.objects = [];
		var selCopy = this._copySelections();
		var ticksSelectedCopy = this._getTicksFromSelections();
		var firstSelection = this.getExtremeSelection(-1);

		this.layout.score.staves.forEach((staff) => {
			staff.measures.forEach((measure) => {
				var voiceIx = 0;
				measure.voices.forEach((voice) => {
					var tick = 0;
					voice.notes.forEach((note) => {
						var selector = {
								staff: staff.staffId,
								measure: measure.measureNumber.measureIndex,
								voice: voiceIx,
								tick: tick,
								pitches: []
							};
						// if we need to update the screen based on scroll
						if (rebox) {
							this._updateNoteBox(this.layout.svg,note);
						}
							
						var selection = new SmoSelection({
									selector: selector,
									_staff: staff,
									_measure: measure,
									_note: note,
									_pitches: [],
									box: note.renderedBox,
									type: 'rendered'
								});
						this.objects.push(selection); 							
                        tick += 1;
					});
				});
				voiceIx += 1;
			});
		});
		/* notes.forEach((note) => {
			var box = svgHelpers.smoBox(note.getBoundingClientRect());
			// box = svgHelpers.untransformSvgBox(this.context.svg,box);
			var selection = SmoSelection.renderedNoteSelection(this.score, note, box);
			if (selection) {
				this.objects.push(selection);                
			}
		}); */
		this._updateModifiers(rebox);
		this.selections = [];
		if (this.objects.length && !selCopy.length) {
			console.log('adding selection ' + this.objects[0].note.id);
			this.selections = [this.objects[0]];
		} else {
			this._findClosestSelection(firstSelection.selector);
			var first = this.selections[0];
			var tickSelected = first.note.tickCount;
			while (tickSelected < ticksSelectedCopy && first) {
				var delta = this.growSelectionRight();
				if (!delta)  {
					break;
				}
				tickSelected += delta;
			}
			// selCopy.forEach((sel) => this._findClosestSelection(sel));
		}
		this.highlightSelection();
		this.triggerSelection();
		this.pasteBuffer.clearSelections();
		this.pasteBuffer.setSelections(this.score, this.selections);
	}
	
	updateMap(rebox) {
		const promise = new Promise((resolve, reject) => {
             this._updateMap(rebox);
			 resolve();
                });
            return promise;
	}

	static stringifyBox(box) {
		return '{x:' + box.x + ',y:' + box.y + ',width:' + box.width + ',height:' + box.height + '}';
	}

	// ### _mapNoteElementToNote
	// given a svg note group, find the smo element that defines this note;
	_mapNoteElementToNote(nel) {
		var id = nel.getAttribute('id');
		var artifact = SmoSelection.renderedNoteSelection(this.score, nel);
		if (!artifact) {
			console.log('note ' + id + ' not found');
		} else {
			//console.log('note '+JSON.stringify(artifact.smoMeasure.measureNumber,null,' ')+' box: '+
			// suiTracker.stringifyBox(box));
			this.groupObjectMap[id] = artifact;
			this.objectGroupMap[artifact.note.id] = artifact;
			this.objects.push({
				artifact: artifact
			});
		}
	}

	_getClosestTick(selector) {
		var measureObj = this.objects.find((e) => SmoSelector.sameMeasure(e.selector, selector)
				 && e.selector.tick === 0);
		var tickObj = this.objects.find((e) => SmoSelector.sameNote(e.selector, selector));
		var firstObj = this.objects[0];
		return (tickObj) ? tickObj: 
		    (measureObj ? measureObj : firstObj);
	}

	// ### getExtremeSelection
	// Get the rightmost (1) or leftmost (-1) selection
	getExtremeSelection(sign) {
		var rv = this.selections[0];
		for (var i = 1; i < this.selections.length; ++i) {
			var sa = this.selections[i].selector;
			if (sa.measure * sign > rv.selector.measure * sign) {
				rv = this.selections[i];
			} else if (sa.measure === rv.selector.measure && sa.tick * sign > rv.selector.tick * sign) {
				rv = this.selections[i];
			}
		}
		return rv;
	}

	// ### _getOffsetSelection
	// Get the selector that is the offset of the first existing selection
	_getOffsetSelection(offset) {
		var increment = offset;
		var testSelection = this.getExtremeSelection(Math.sign(offset));
		var scopyTick = JSON.parse(JSON.stringify(testSelection.selector));
		var scopyMeasure = JSON.parse(JSON.stringify(testSelection.selector));
		scopyTick.tick += increment;
		scopyMeasure.measure += increment;
		var targetMeasure = SmoSelection.measureSelection(this.score, testSelection.selector.staff,
				scopyMeasure.measure);
		if (targetMeasure && targetMeasure.measure) {
			scopyMeasure.tick = (offset < 0) ? targetMeasure.measure.notes.length - 1 : 0;
		}

		if (testSelection.measure.notes.length > scopyTick.tick && scopyTick.tick >= 0) {
			return scopyTick;
		} else if (targetMeasure &&
			scopyMeasure.measure < testSelection.staff.measures.length && scopyMeasure.measure >= 0) {
			return scopyMeasure;
		}
		return testSelection.selector;
	}

	static unionRect(b1, b2) {
		return svgHelpers.unionRect(b1, b2);
	}

	get selectedArtifact() {
		for (var i = 0; i < this.selections.length; ++i) {
			var selection = this.selections[i];
			if (selection['artifact']) {
				return selection.artifact;
			}
		}
		return {};
	}

	growSelectionRight() {
		var nselect = this._getOffsetSelection(1);
		// already selected
		var artifact = this._getClosestTick(nselect);
		if (!artifact) {
			return 0;
		}
		if (this.selections.find((sel) => SmoSelector.sameNote(sel.selector, artifact.selector))) {
			return 0;
		}
		console.log('adding selection ' + artifact.note.id);

		this.selections.push(artifact);
		this.highlightSelection();
		this.triggerSelection();
		return artifact.note.tickCount;
	}

	growSelectionLeft() {
		var nselect = this._getOffsetSelection(-1);
		// already selected
		var artifact = this._getClosestTick(nselect);
		if (!artifact) {
			return;
		}
		if (this.selections.find((sel) => SmoSelector.sameNote(sel.selector, artifact.selector))) {
			return;
		}

		console.log('adding selection ' + artifact.note.id);
		this.selections.push(artifact);
		this.highlightSelection();
		this.triggerSelection();
		return artifact.note.tickCount;
	}

	moveSelectionRight() {
		if (this.selections.length == 0) {
			return;
		}
		var nselect = this._getOffsetSelection(1);
		this._replaceSelection(nselect);
	}

	moveSelectionLeft() {
		if (this.selections.length == 0) {
			return;
		}
		var nselect = this._getOffsetSelection(-1);
		this._replaceSelection(nselect);
	}
	moveSelectionLeftMeasure() {
		this._moveSelectionMeasure(-1);
	}
	moveSelectionRightMeasure() {
		this._moveSelectionMeasure(1);
	}
	moveSelectionOffset(offset) {
		var fcn = (offset >= 0 ? 'moveSelectionRight' : 'moveSelectionLeft');
		offset = (offset < 0) ? -1 * offset : offset;
		for (var i = 0; i < offset; ++i) {
			this[fcn]();
		}
	}

	_moveSelectionMeasure(offset) {
		var selection = this.getExtremeSelection(Math.sign(offset));
		selection = JSON.parse(JSON.stringify(selection.selector));
		selection.measure += offset;
		selection.tick = 0;
		var selObj = this._getClosestTick(selection);
		if (selObj) {
			this.selections = [selObj];
		}
		this.highlightSelection();
		this.triggerSelection();
	}

	_moveStaffOffset(offset) {
		if (this.selections.length == 0) {
			return;
		}

		var nselector = JSON.parse(JSON.stringify(this.selections[0].selector));
		nselector.staff = this.score.incrementActiveStaff(offset);
		this.selections = [this._getClosestTick(nselector)];
		this.highlightSelection();
		this.triggerSelection();
	}

	// ### _moveSelectionPitch
	// Suggest a specific pitch in a chord, so we can transpose just the one note vs. the whole chord.
	_moveSelectionPitch(index) {
		if (!this.selections.length) {
			return;
		}
		var sel = this.selections[0];
		var note = sel.note;
		if (note.pitches.length < 2) {
			this.pitchIndex = -1;
			return;
		}
		this.pitchIndex = (this.pitchIndex + index) % note.pitches.length;
		sel.selector.pitches = [];
		sel.selector.pitches.push(this.pitchIndex);
		this._highlightPitchSelection(note, this.pitchIndex);
	}
	moveSelectionPitchUp() {
		this._moveSelectionPitch(1);
	}
	moveSelectionPitchDown() {
		if (!this.selections.length) {
			return;
		}
		this._moveSelectionPitch(this.selections[0].note.pitches.length - 1);
	}

	moveSelectionUp() {
		this._moveStaffOffset(-1);
	}
	moveSelectionDown() {
		this._moveStaffOffset(1);
	}

	containsArtifact() {
		return this.selections.length > 0;
	}

	_replaceSelection(nselector) {
		var artifact = SmoSelection.noteSelection(this.score, nselector.staff, nselector.measure, nselector.voice, nselector.tick);
		this.score.setActiveStaff(nselector.staff);
		var mapped = this.objects.find((el) => {
				return SmoSelector.sameNote(el.selector, artifact.selector);
			});
		if (!mapped) {
			return;
		}
		// If this is a new selection, remove pitch-specific and replace with note-specific
		if (!nselector['pitches'] || nselector.pitches.length==0) {
			this.pitchIndex = -1;
		}
		console.log('adding selection ' + mapped.note.id);

		this.selections = [mapped];
		this.highlightSelection();
		this.triggerSelection();
	}

	getFirstMeasureOfSelection() {
		if (this.selections.length) {
			return this.selections[0].measure;
		}
		return null;
	}
	// ## measureIterator
	// Description: iterate over the any measures that are part of the selection
	iterateMeasures(callback) {
		var set = [];
		this.selections.forEach((sel) => {
			var measure = SmoSelection.measureSelection(this.score, sel.selector.staff, sel.selector.measure).measure;
			var ix = measure.measureNumber.measureIndex;
			if (set.indexOf(ix) === -1) {
				set.push(ix);
				callback(measure);
			}
		});
	}
	
	_selectFromToInStaff(sel1,sel2) {
		this.selections=[];
		this.objects.forEach((obj) => {
			if (SmoSelector.gteq(obj.selector,sel1.selector) && SmoSelector.lteq(obj.selector,sel2.selector)) {
				this.selections.push(obj);
			}
		});
	}
	_addSelection(selection) {
		var ar=this.selections.filter((sel) => {
			return SmoSelector.neq(sel.selector,selection.selector);
		});
		ar.push(selection);
		this.selections=ar;
	}
	
	selectSuggestion(ev) {
		if (!this.suggestion['measure']) {
			return;
		}
		console.log('adding selection ' + this.suggestion.note.id);
		
		if (this.modifierSuggestion >= 0) {
			if (this['suggestFadeTimer']) {
			   clearTimeout(this.suggestFadeTimer);
    		}	
			this.modifierIndex = this.modifierSuggestion;
			this.modifierSuggestion = -1;
			this._highlightModifier();
			$('body').trigger('tracker-select-modifier');
			return;
		}
		if (ev.shiftKey) {
			var sel1 = this.getExtremeSelection(-1);
			if (sel1.selector.staff === this.suggestion.selector.staff) {
				var min = SmoSelector.gt(sel1.selector,this.suggestion.selector)  ? this.suggestion : sel1;
				var max = SmoSelector.lt(min.selector,this.suggestion.selector) ? this.suggestion : sel1;
				this._selectFromToInStaff(min,max);
				this.highlightSelection();
				return;
			}
		}
		
		if (ev.ctrlKey) {
			this._addSelection(this.suggestion);
			this.highlightSelection();
			return;
		}

		this.selections = [this.suggestion];
		this.score.setActiveStaff(this.selections[0].selector.staff);
		if (this.selections.length == 0)
			return;
		var first = this.selections[0];
		for (var i = 0; i < this.selections.length; ++i) {
			var selection = this.selections[i];
			this.highlightSelection();
		}
		this.triggerSelection();
	}

	static get strokes() {
		return {
			'suggestion': {
				'stroke': '#fc9',
				'stroke-width': 2,
				'stroke-dasharray': '4,1',
				'fill': 'none'
			},
			'selection': {
				'stroke': '#99d',
				'stroke-width': 2,
				'fill': 'none'
			},
			'staffModifier': {
				'stroke': '#933',
				'stroke-width': 2,
				'fill': 'none'
			}
		}
	}
	
	_setFadeTimer() {
		if (this['suggestFadeTimer']) {
			clearTimeout(this.suggestFadeTimer);
		}
		var tracker=this;
		this.suggestFadeTimer = setTimeout(function () {
				if (tracker.containsArtifact()) {
					tracker.eraseRect('suggestion');
					tracker.modifierSuggestion=-1;
				}
			}, 1000);
	}
	

    _setModifierAsSuggestion(bb,artifact) {
		
		this.modifierSuggestion = artifact.index;

		this._drawRect(artifact.box, 'suggestion');
		this._setFadeTimer();
	}
	_setArtifactAsSuggestion(bb, artifact) {
		var self = this;

		var sameSel =
			this.selections.find((ss) => SmoSelector.sameNote(ss.selector, artifact.selector));

		if (sameSel) {
			return ;
		}
		
		this.modifierSuggestion = -1;

		this.suggestion = artifact;
		this._drawRect(artifact.box, 'suggestion');
		this._setFadeTimer();
	}

	intersectingArtifact(bb) {
		var artifacts = svgHelpers.findIntersectingArtifact(bb,this.objects);
		// TODO: handle overlapping suggestions
		if (!artifacts.length) {			
			var sel = svgHelpers.findIntersectingArtifact(bb,this.modifierTabs);
			if (sel.length) {
				sel = sel[0];
				this._setModifierAsSuggestion(bb, sel);
			}
			return;
		}
		var artifact = artifacts[0];
		this._setArtifactAsSuggestion(bb, artifact);
		return;
	}

	eraseAllSelections() {
		var strokeKeys = Object.keys(suiTracker.strokes);
		strokeKeys.forEach((key) => {
			this.eraseRect(key);
		});
	}

	eraseRect(stroke) {
		$(this.renderElement).find('g.vf-' + stroke).remove();
	}

	_highlightPitchSelection(note, index) {
		this.eraseAllSelections();
		var noteDiv = $(this.renderElement).find('#' + note.renderId);
		var heads = noteDiv.find('.vf-notehead');
		if (!heads.length) {
			return;
		}
		var headEl = heads[index];
		var box = svgHelpers.smoBox(headEl.getBoundingClientRect());
		this._drawRect(box, 'staffModifier');
	}
	triggerSelection() {
		$('body').trigger('tracker-selection');
	}

	highlightSelection() {
		if (this.pitchIndex >= 0 && this.selections.length == 1 &&
			this.pitchIndex < this.selections[0].note.pitches.length) {
			this._highlightPitchSelection(this.selections[0].note, this.pitchIndex);
			return;
		}
		this.pitchIndex = -1;
		this.eraseAllSelections();
		if (this.selections.length === 1) {
			this._drawRect(this.selections[0].box, 'selection');			
			return;
		}
		var sorted = this.selections.sort((a, b) => a.box.y - b.box.y);
		var prevSel = sorted[0];
		var curBox = svgHelpers.smoBox(prevSel.box);
		var boxes = [];
		for (var i = 1; i < sorted.length; ++i) {
			var sel = sorted[i];
			var ydiff = Math.abs(prevSel.box.y - sel.box.y);
			if (sel.selector.staff === prevSel.selector.staff && ydiff < 1.0) {
				curBox = svgHelpers.unionRect(curBox, sel.box);
			} else {
				boxes.push(curBox);
				curBox = sel.box;
			}
			prevSel = sel;
		}
		boxes.push(curBox);
		this._drawRect(boxes, 'selection');
	}
	_outerSelection() {
		if (this.selections.length == 0)
			return null;
		var rv = this.selections[0].box;
		for (var i = 1; i < this.selections.length; ++i) {
			rv = suiTracker.unionRect(rv, this.selections[i].box);
		}
		return rv;
	}
	_drawRect(bb, stroke) {
		this.eraseRect(stroke);
		var grp = this.context.openGroup(stroke, stroke + '-');
		if (!Array.isArray(bb)) {
			bb = [bb];
		}
		bb.forEach((box) => {
			var strokes = suiTracker.strokes[stroke];
			var strokeObj = {};
			var margin = 5;
			$(Object.keys(strokes)).each(function (ix, key) {
				strokeObj[key] = strokes[key];
			});
			box = svgHelpers.clientToLogical(this.context.svg, box);
			this.context.rect(box.x - margin, box.y - margin, box.width + margin * 2, box.height + margin * 2, strokeObj);
		});
		this.context.closeGroup(grp);
	}
}
;
// ## suiLayoutBase
// ## Description:
// A layout maps the measures and notes to a spot on the page.  It
// manages the flow of music as an ordinary score.  We call it simple layout, because
// there may be other layouts for parts view, or output to other media.
class suiLayoutBase {
	constructor(ctor) {		
		this.attrs = {
			id: VF.Element.newID(),
			type: ctor
		};
		this.dirty=true;
		this.setPassState(suiLayoutBase.initial,'ctor');
		console.log('layout ctor: pstate initial');
		this.viewportChange = false;
	}
	
	static get passStates() {
		return {initial:0,pass:1,clean:2,replace:3};
	}
	
	setDirty() {
		if (!this.dirty) {
			this.dirty = true;
			if (this.viewportChange) {
				this.setPassState(suiLayoutBase.passStates.initial,'setDirty 1');
			} else if (this.passState == suiLayoutBase.passStates.clean || 
			   this.passState == suiLayoutBase.passStates.replace) {
				this.setPassState(suiLayoutBase.passStates.replace,'setDirty 2');
			} else {
				this.setPassState(suiLayoutBase.passStates.pass,'setDirty 3');
			}
		}
	}
	setRefresh() {
		this.dirty=true;
		this.setPassState(suiLayoutBase.passStates.initial,'setRefresh');
	}

	_setViewport(reset,elementId) {
		// this.screenWidth = window.innerWidth;
		var layout = this._score.layout;
		this.zoomScale = layout.zoomMode === SmoScore.zoomModes.zoomScale ?
			layout.zoomScale : (window.innerWidth - 200) / layout.pageWidth;

		this.svgScale = layout.svgScale * this.zoomScale;
		this.orientation = this._score.layout.orientation;
		var w = Math.round(layout.pageWidth * this.zoomScale) ;
		var h = Math.round(layout.pageHeight * this.zoomScale);
		this.pageWidth =  (this.orientation  === SmoScore.orientations.portrait) ? w: h;
		this.pageHeight = (this.orientation  === SmoScore.orientations.portrait) ? h : w;
		
		this.leftMargin=this._score.layout.leftMargin;
        this.rightMargin = this._score.layout.rightMargin;
		$(elementId).css('width', '' + Math.round(this.pageWidth) + 'px');
		$(elementId).css('height', '' + Math.round(this.pageHeight) + 'px');        
		if (reset) {
		    $(elementId).html('');
    		this.renderer = new VF.Renderer(elementId, VF.Renderer.Backends.SVG);
            this.viewportChange = true;
		}
		// this.renderer.resize(this.pageWidth, this.pageHeight);

		svgHelpers.svgViewport(this.context.svg, this.pageWidth, this.pageHeight, this.svgScale);

		this.context.setFont(this.font.typeface, this.font.pointSize, "").setBackgroundFillStyle(this.font.fillStyle);
		this.resizing = false;
		this.setPassState(suiLayoutBase.passStates.initial,'setViewport');
		console.log('layout setViewport: pstate initial');
		this.dirty=true;
	}
    
    setViewport(reset) {
        this._setViewport(reset,this.elementId);
        this.mainRenderer = this.renderer;
        
        if (this.shadowElement) {
            this._setViewport(reset,this.shadowElement);
            if (reset) {
                this.shadowRenderer = this.renderer;
            }
            this.renderer = this.mainRenderer;
        } else {
            this.shadowRenderer = this.renderer;
        }
    }
	
	setPassState(st,location) {
		console.log(location + ': passState '+this.passState+'=>'+st);
		this.passState = st;
	}
	static get defaults() {
		return {
			clefWidth: 70,
			staffWidth: 250,
			totalWidth: 250,
			leftMargin: 15,
			topMargin: 15,
			pageWidth: 8 * 96 + 48,
			pageHeight: 11 * 96,
			svgScale: 0.7,
			font: {
				typeface: "Arial",
				pointSize: 10,
				fillStyle: '#eed'
			}
		};
	}
	static get debugLayout() {
		suiLayoutBase['_debugLayout'] = suiLayoutBase['_debugLayout'] ? suiLayoutBase._debugLayout : false
			return suiLayoutBase._debugLayout;
	}

	static set debugLayout(value) {
		suiLayoutBase._debugLayout = value;
        if (value) {
            $('body').addClass('layout-debug');
        } else {
            $('body').removeClass('layout-debug');
        }
	}

	// ### get context
	// ### Description:
	// return the VEX renderer context.
	get context() {
		return this.renderer.getContext();
	}
	get renderElement() {
		return this.renderer.elementId;
	}
	
	get svg() {
		return this.context.svg;
	}
	
	// ### render
	// ### Description:
	// Render the current score in the div using VEX.  Rendering is actually done twice:
	// 1. Rendering is done just to the changed parts of the score.  THe first time, the whole score is rendered.
	// 2. Widths and heights are adjusted for elements that may have overlapped or exceeded their expected boundary.
	// 3. The whole score is rendered a second time with the new values.
	

	// ### undo
	// ### Description:
	// Undo is handled by the layout, because the layout has to first delete areas of the div that may have changed
	// , then create the modified score, then render the 'new' score.
	undo(undoBuffer) {
		var buffer = undoBuffer.peek();
		// Unrender the modified music because the IDs may change and normal unrender won't work
		if (buffer) {
			var sel = buffer.selector;
			if (buffer.type == 'measure') {
				this.unrenderMeasure(SmoSelection.measureSelection(this._score, sel.staff, sel.measure).measure);
			} else if (buffer.type === 'staff') {
				this.unrenderStaff(SmoSelection.measureSelection(this._score, sel.staff, 0).staff);
			} else {
				this.unrenderAll();
			}
			this._score = undoBuffer.undo(this._score);
			this.render();
		}
	}

	// ### renderNoteModifierPreview
	// ### Description:
	// For dialogs that allow you to manually modify elements that are automatically rendered, we allow a preview so the
	// changes can be undone before the buffer closes.
	renderNoteModifierPreview(modifier) {
		var selection = SmoSelection.noteSelection(this._score, modifier.selector.staff, modifier.selector.measure, modifier.selector.voice, modifier.selector.tick);
		if (!selection.measure.renderedBox) {
			return;
		}
		var system = new VxSystem(this.context, selection.measure.staffY, selection.measure.lineIndex);
		system.renderMeasure(selection.selector.staff, selection.measure);
	}
	
	// ### renderStaffModifierPreview
	// ### Description:
	// Similar to renderNoteModifierPreview, but lets you preveiw a change to a staff element.
	// re-render a modifier for preview during modifier dialog
	renderStaffModifierPreview(modifier) {
		// get the first measure the modifier touches
		var startSelection = SmoSelection.measureSelection(this._score, modifier.startSelector.staff, modifier.startSelector.measure);

		// We can only render if we already have, or we don't know where things go.
		if (!startSelection.measure.renderedBox) {
			return;
		}
		var system = new VxSystem(this.context, startSelection.measure.staffY, startSelection.measure.lineIndex);
		while (startSelection && startSelection.selector.measure <= modifier.endSelector.measure) {
			smoBeamerFactory.applyBeams(startSelection.measure);
			system.renderMeasure(startSelection.selector.staff, startSelection.measure);
			var nextSelection = SmoSelection.measureSelection(this._score, startSelection.selector.staff, startSelection.selector.measure + 1);

			// If we go to new line, render this line part, then advance because the modifier is split
			if (nextSelection && nextSelection.measure && nextSelection.measure.lineIndex != startSelection.measure.lineIndex) {
				this._renderModifiers(startSelection.staff, system);
				var system = new VxSystem(this.context, startSelection.measure.staffY, startSelection.measure.lineIndex);
			}
			startSelection = nextSelection;
		}
		this._renderModifiers(startSelection.staff, system);
	}

	// ### unrenderMeasure
	// ### Description:
	// All SVG elements are associated with a logical SMO element.  We need to erase any SVG element before we change a SMO
	// element in such a way that some of the logical elements go away (e.g. when deleting a measure).
	unrenderMeasure(measure) {
		if (!measure)
			return;

		$(this.svg).find('g.' + measure.attrs.id).remove();
		measure.staffX = SmoMeasure.defaults.staffX;
		measure.staffY = SmoMeasure.defaults.staffY;
		measure.staffWidth = SmoMeasure.defaults.staffWidth;
		measure.adjY = 0;
		measure.setChanged();
	}

	// ### unrenderStaff
	// ### Description:
	// See unrenderMeasure.  Like that, but with a staff.
	unrenderStaff(staff) {
		staff.measures.forEach((measure) => {
			this.unrenderMeasure(measure);
		});
		staff.modifiers.forEach((modifier) => {
			$(this.renderer.getContext().svg).find('g.' + modifier.attrs.id).remove();
		});
	}

	
	// ### _renderModifiers
	// ### Description:
	// Render staff modifiers (modifiers straddle more than one measure, like a slur).  Handle cases where the destination
	// is on a different system due to wrapping.
	_renderModifiers(staff, system) {
		var svg = this.svg;
		staff.modifiers.forEach((modifier) => {
			var startNote = SmoSelection.noteSelection(this._score,
					modifier.startSelector.staff, modifier.startSelector.measure, modifier.startSelector.voice, modifier.startSelector.tick);
			var endNote = SmoSelection.noteSelection(this._score,
					modifier.endSelector.staff, modifier.endSelector.measure, modifier.endSelector.voice, modifier.endSelector.tick);

			var vxStart = system.getVxNote(startNote.note);
			var vxEnd = system.getVxNote(endNote.note);

			// If the modifier goes to the next staff, draw what part of it we can on this staff.
			if (vxStart && !vxEnd) {
				var nextNote = SmoSelection.nextNoteSelection(this._score,
						modifier.startSelector.staff, modifier.startSelector.measure, modifier.startSelector.voice, modifier.startSelector.tick);
				var testNote = system.getVxNote(nextNote.note);
				while (testNote) {
					vxEnd = testNote;
					nextNote = SmoSelection.nextNoteSelection(this._score,
							nextNote.selector.staff, nextNote.selector.measure, nextNote.selector.voice, nextNote.selector.tick);
                    // last beat of the measure
                    if (!nextNote) {
                        break;
                    }
					testNote = system.getVxNote(nextNote.note);

				}
			}
			if (vxEnd && !vxStart) {
				var lastNote = SmoSelection.lastNoteSelection(this._score,
						modifier.endSelector.staff, modifier.endSelector.measure, modifier.endSelector.voice, modifier.endSelector.tick);
				var testNote = system.getVxNote(lastNote.note);
				while (testNote) {
					vxStart = testNote;
					lastNote = SmoSelection.lastNoteSelection(this._score,
							lastNote.selector.staff, lastNote.selector.measure, lastNote.selector.voice, lastNote.selector.tick);
                    if (!lastNote) {
                        break;
                    }
					testNote = system.getVxNote(lastNote.note);
				}
			}

			if (!vxStart || !vxEnd)
				return;

			// TODO: notes may have changed, get closest if these exact endpoints don't exist
			modifier.renderedBox = system.renderModifier(modifier, vxStart, vxEnd);
			modifier.logicalBox = svgHelpers.clientToLogical(svg,modifier.renderedBox);

			// TODO: consider staff height with these.
			// TODO: handle dynamics split across systems.
		});
		
		system.updateLyricOffsets();
	}
	
	render() {
		if (this.viewportChange) {
			this.unrenderAll();
			this.setPassState(suiLayoutBase.passStates.initial,'render 1');			
			this.viewportChange = false;
		}

		// layout a second time to adjust for issues.
		// this.adjustWidths();
		// this.adjustWidths();
		var params = {useY:false,useX:false};
		if (this.passState == suiLayoutBase.passStates.pass) {
			params.useX=true;
		    suiLayoutAdjuster.adjustWidths(this._score,this.renderer);
		}
		if ((this.passState == suiLayoutBase.passStates.clean) || 
		    (this.passState == suiLayoutBase.passStates.replace)) {
			params.useY=true;
			params.useX=true;
		}
        this.renderer = (this.passState == suiLayoutBase.passStates.initial || this.passState == suiLayoutBase.passStates.pass) ? 
            this.shadowRenderer : this.mainRenderer;
		
        this.layout(params);
		
		if (this.passState == suiLayoutBase.passStates.replace) {
			this.dirty=false;
			return;
		}
		
		if (params.useX == true) {
			if (this.passState == suiLayoutBase.passStates.clean) {
				this.dirty=false;
			} else {
				suiLayoutAdjuster.justifyWidths(this._score,this.renderer,this.pageMarginWidth / this.svgScale);
				suiLayoutAdjuster.adjustHeight(this._score,this.renderer);
				this.setPassState(suiLayoutBase.passStates.clean,'render 2');
			}
		} else {
			// otherwise we need another pass.
			this.dirty=true;
			this.setPassState(suiLayoutBase.passStates.pass,'render 3');
			console.log('layout after pass: pstate pass');
		}	
	}
}
;
class suiPiano {
	constructor(parameters) {
		this.elementId = parameters.elementId;
		this.renderElement = document.getElementById('piano-svg')
			this.selections = [];
		this.render();
	}

	static get dimensions() {
		return {
			wwidth: 23,
			bwidth: 13,
			wheight: 120,
			bheight: 80,
			octaves:5
		};
	}
		// 7 white keys per octave
	static get wkeysPerOctave() {
		return 7;
	}
	static get owidth() {
		return suiPiano.dimensions.wwidth * suiPiano.wkeysPerOctave;
	}

	static createAndDisplay(parms) {
		// Called by ribbon button.
		$('body').toggleClass('show-piano');
		// handle resize work area.
		window.dispatchEvent(new Event('resize'));
	}
	_mapKeys() {
		this.objects = [];
		var keys = [].slice.call(this.renderElement.getElementsByClassName('piano-key'));
		keys.forEach((key) => {
			var rect = svgHelpers.smoBox(key.getBoundingClientRect());
			var id = key.getAttributeNS('', 'id');
			var artifact = {
				keyElement: key,
				box: rect,
				id: id
			};
			this.objects.push(artifact);
		});
	}
	_removeClass(classes) {
		Array.from(this.renderElement.getElementsByClassName('piano-key')).forEach((el) => {
			$(el).removeClass(classes);
		});
	}
	_removeGlow() {
		this._removeClass('glow-key');
	}
	_fadeGlow(el) {
		if (this['suggestFadeTimer']) {
			clearTimeout(this.suggestFadeTimer);
		}
		// Make selection fade if there is a selection.
		this.suggestFadeTimer = setTimeout(function () {
				$(el).removeClass('glow-key');
			}, 1000);
	}
	bind() {
		var self = this;
		$(this.renderElement).off('mousemove').on('mousemove', function (ev) {
			var keyPressed = svgHelpers.findSmallestIntersection({
					x: ev.clientX,
					y: ev.clientY
				}, self.objects);
			if (!keyPressed) {
				return;
			}
			var el = self.renderElement.getElementById(keyPressed.id);
			if ($(el).hasClass('glow-key')) {
				return;
			}
			self._removeGlow();
			$(el).addClass('glow-key');
			self._fadeGlow(el);

		});
		$(this.renderElement).off('blur').on('blur',function(ev) {
			self._removeGlow();
		});
		$(this.renderElement).off('click').on('click', function (ev) {
			self._updateSelections(ev);
		});

		$('.close-piano').off('click').on('click', function () {
			$('body').removeClass('show-piano');
			// resize the work area.
			window.dispatchEvent(new Event('resize'));
		});
	}
	_updateSelections(ev) {
		var keyPressed = svgHelpers.findSmallestIntersection({
				x: ev.clientX,
				y: ev.clientY
			}, this.objects);
		if (!keyPressed) {
			return;
		}
		if (!ev.shiftKey) {
			this.selections = [];
			this._removeClass('glow-key pressed-key');
		} else {
			var el = this.renderElement.getElementById(keyPressed.id);
			$(el).addClass('pressed-key');
		}
		var key = keyPressed.id.substr(6, keyPressed.id.length - 6);
		var pitch = {
			letter: key[0].toLowerCase(),
			octave: parseInt(key[key.length - 1]),
			accidental: key.length == 3 ? key[1] : 'n'
		};
		this.selections.push(pitch);
		$('body').trigger('smo-piano-key', {
			selections: JSON.parse(JSON.stringify(this.selections))
		});
	}
	_renderclose() {
		var b = htmlHelpers.buildDom;
		var r = b('button').classes('icon icon-cross close close-piano');
		$(this.renderElement).closest('div').append(r.dom());
	}
	handleResize() {
		this._updateOffsets();
		this._mapKeys();
	}
	_updateOffsets() {
		var padding = Math.round(window.innerWidth - suiPiano.owidth*suiPiano.dimensions.octaves)/2;
		$(this.renderElement).closest('div').css('margin-left',''+padding+'px');
	}
	render() {
		$('body').addClass('show-piano');
		var b = svgHelpers.buildSvg;
		var d = suiPiano.dimensions;
		// https://www.mathpages.com/home/kmath043.htm
		
		// Width of white key at back for C,D,E
		var b1off = d.wwidth - (d.bwidth * 2 / 3);
		
		// Width of other white keys at the back.
		var b2off=d.wwidth-(d.bwidth*3)/4;
		
		var keyAr = [];
		var xwhite = [{
				note: 'C',
				x: 0
			}, {
				note: 'D',
				x: d.wwidth
			}, {
				note: 'E',
				x: 2 * d.wwidth
			}, {
				note: 'F',
				x: 3 * d.wwidth
			}, {
				note: 'G',
				x: 4 * d.wwidth
			}, {
				note: 'A',
				x: 5 * d.wwidth
			}, {
				note: 'B',
				x: 6 * d.wwidth
			}
		];
		var xblack = [{
				note: 'Db',
				x: b1off
			}, {
				note: 'Eb',
				x: 2*b1off+d.bwidth
			}, {
				note: 'Gb',
				x: 3*d.wwidth+b2off
			}, {
				note: 'Ab',
				x: (3*d.wwidth+b2off)+b2off+d.bwidth
			}, {
				note: 'Bb',
				x: suiPiano.owidth-(b2off+d.bwidth)
			}
		];
		var wwidth = d.wwidth;
		var bwidth = d.bwidth;
		var wheight = d.wheight;
		var bheight = d.bheight;
		var owidth = suiPiano.wkeysPerOctave * wwidth;
		
		// Start on C2 to C6 to reduce space
		var octaveOff = 7-d.octaves;
		
		var x = 0;
		var y = 0;
		var r = b('g');
		for (var i = 0; i < d.octaves; ++i) {
			x = i * owidth;
			xwhite.forEach((key) => {
				var nt = key.note + (octaveOff + i + 1).toString();
				var classes = 'piano-key white-key';
				if (nt == 'C4') {
					classes += ' middle-c';
				}
				var rect = b('rect').attr('id', 'keyId-' + nt).rect(x + key.x, y, wwidth, wheight, classes);
				r.append(rect);

				var tt = b('text').text(x + key.x + (wwidth / 5), bheight + 16, 'note-text', nt);
				r.append(tt);
			});
			xblack.forEach((key) => {
				var nt = key.note + (octaveOff + i + 1).toString();
				var classes = 'piano-key black-key';
				var rect = b('rect').attr('id', 'keyId-' + nt).rect(x + key.x, 0, bwidth, bheight, classes);
				r.append(rect);
			});
		}
		var el = document.getElementById(this.elementId);
		el.appendChild(r.dom());
		this._renderclose();
		this._updateOffsets();
		this._mapKeys();
		this.bind();
	}
}
;
// ## suiAdjuster
// Perform adjustments on the score based on the rendered components so we can re-render it more legibly.
class suiLayoutAdjuster {	
	
	static estimateMusicWidth(smoMeasure) {
		var width = 0;
		var tm = smoMeasure.tickmap();
		smoMeasure.voices.forEach((voice) => {
			var tickIndex = 0;
			voice.notes.forEach((note) => {
				width += vexGlyph.dimensions.noteHead.width + vexGlyph.dimensions.noteHead.spacingRight;
				width += vexGlyph.dimensions.dot.width * note.dots + vexGlyph.dimensions.dot.spacingRight * note.dots;
				note.pitches.forEach((pitch) => {
					var declared = tm.getActiveAccidental(pitch, tickIndex, smoMeasure.keySignature);

					if (pitch.accidental != declared || pitch.cautionary) {
						width += vexGlyph.accidental(pitch.accidental).width;
					}
				});
				tickIndex += 1;
			});
		});
		return width;
	}

	static estimateStartSymbolWidth(smoMeasure) {
		var width = 0;
		if (smoMeasure.forceKeySignature) {
			if ( smoMeasure.canceledKeySignature) {
			    width += vexGlyph.keySignatureLength(smoMeasure.canceledKeySignature);
			}			
            width += vexGlyph.keySignatureLength(smoMeasure.keySignature);
		}
		if (smoMeasure.forceClef) {
			width += vexGlyph.clef(smoMeasure.clef).width + vexGlyph.clef(smoMeasure.clef).spacingRight;
		}
		if (smoMeasure.forceTimeSignature) {
			width += vexGlyph.dimensions.timeSignature.width + vexGlyph.dimensions.timeSignature.spacingRight;
		}
		var starts = smoMeasure.getStartBarline();
		if (starts) {
			width += vexGlyph.barWidth(starts);
		}
		return width;
	}
	
	static estimateEndSymbolWidth(smoMeasure) {
		var width = 0;
		var ends  = smoMeasure.getEndBarline();
		if (ends) {
			width += vexGlyph.barWidth(ends);
		}
		return width;
	}
	
    
	static estimateTextOffset(renderer,smoMeasure) {
		var leftText = smoMeasure.modifiers.filter((mm) => mm.ctor==='SmoMeasureText' && mm.position === SmoMeasureText.positions.left);
		var rightText = smoMeasure.modifiers.filter((mm) => mm.ctor==='SmoMeasureText' && mm.position === SmoMeasureText.positions.right);
		var svg = renderer.getContext().svg;
		var xoff=0;
		var width=0;
		leftText.forEach((tt) => {
    		var testText = new SmoScoreText({text:tt.text});
    		var box = svgHelpers.getTextBox(svg,testText.toSvgAttributes(),testText.classes,testText.text);
			xoff += box.width;
		});
		rightText.forEach((tt) => {
    		var testText = new SmoScoreText({text:tt.text});
			var box = svgHelpers.getTextBox(svg,testText.toSvgAttributes(),testText.classes,testText.text);
			width += box.width;
		});
		return svgHelpers.boxPoints(xoff,0,width,0);
	}
	
	static estimateMeasureWidth(renderer,measure,staffBox) {
	
		// Calculate the existing staff width, based on the notes and what we expect to be rendered.
		measure.staffWidth = suiLayoutAdjuster.estimateMusicWidth(measure);
		measure.adjX = suiLayoutAdjuster.estimateStartSymbolWidth(measure);
		measure.adjRight = suiLayoutAdjuster.estimateEndSymbolWidth(measure);
		measure.staffWidth = measure.staffWidth  + measure.adjX + measure.adjRight;
		
		// Calculate the space for left/right text which displaces the measure.
		var textOffsetBox=suiLayoutAdjuster.estimateTextOffset(renderer,measure);
		measure.staffX += textOffsetBox.x;
	}
	
	// ### justifyWidths
	// After we adjust widths so each staff has enough room, evenly distribute the remainder widths to the measures.
	static justifyWidths(score,renderer,pageSize) {
		var context = renderer.getContext();
		var svg = context.svg;
		
		if (suiLayoutBase.debugLayout) {
			$(context.svg).find('g.measure-adjust-dbg').remove();
		}
		var topStaff = score.staves[0];
		var maxLine = topStaff.measures[topStaff.measures.length - 1].lineIndex - 1;
		for (var i = 0; i <= maxLine; ++i) {
			var systemIndex = 0;

			score.staves.forEach((staff) => {
				var measures = staff.measures.filter((mm) => {
						return mm.lineIndex === i
					});
				if (measures.length > 0) {
					var width = measures.map((mm) => {
							return mm.staffWidth;
						}).reduce((a, b) => {
							return a + b
						});
					width += measures[0].staffX + score.layout.leftMargin;
					var just = Math.round((pageSize - width) / measures.length) - 1;
					if (just > 0) {
						var accum = 0;
						measures.forEach((mm) => {
							mm.staffWidth += just;
							mm.staffX += accum;
							accum += just;
							if (suiLayoutBase.debugLayout) {
								var dbgBox = svgHelpers.boxPoints(
										mm.staffX, mm.staffY, mm.staffWidth, mm.logicalBox.height);
								svgHelpers.debugBox(svg, dbgBox, 'measure-adjust-dbg', 10);
							}
						});
					}
				}
			});
		}
	}

	static _spaceNotes(svg,smoMeasure) {
		var g = svg.getElementById(smoMeasure.attrs.id);
        if (!g) {
            return;
        }
		var notes = Array.from(g.getElementsByClassName('vf-stavenote'));
		var acc = 0;
		for (var i = 1; i < notes.length; ++i) {
			var b1 = notes[i - 1].getBBox();
			var b2 = notes[i].getBBox();
			var dif = b2.x - (b1.x + b1.width);
			if (dif < 10) {
				acc += 10 - dif;
			}
		}
		smoMeasure.logicalBox.width += acc;
	}
	
    // ### adjustWidths
	// Set the width of each measure in a system to the max width for that column so the measures are aligned.
	static adjustWidths(score,renderer) {
		var topStaff = score.staves[0];
		var maxLine = topStaff.measures[topStaff.measures.length - 1].lineIndex;
		var svg = renderer.getContext().svg;
		if (suiLayoutBase.debugLayout) {
			$(renderer.getContext().svg).find('g.measure-adjust-dbg').remove();
		}

		for (var i = 0; i <= maxLine; ++i) {
			var systemIndex = 0;
			while (true) {
				var measures = [];
				score.staves.forEach((staff) => {
					var ix = staff.measures.findIndex((x) => {
							return x.lineIndex === i && x.measureNumber.systemIndex === systemIndex;
						});
					if (ix >= 0) {
						measures.push(staff.measures[ix]);
					}
				});
				// Make sure each note head is not squishing
				measures.forEach((mm) => {suiLayoutAdjuster._spaceNotes(svg,mm);});

				if (measures.length) {
					var widest = measures.map((x) => {
							return x.logicalBox.width;
						}).reduce((a, w) => {
							return a > w ? a : w;
						});
					measures.forEach((measure) => {
						measure.staffWidth = widest;
						measure.setChanged();
					});
				}
				if (!measures.length)
					break;
				systemIndex += 1;
			}
		}

		score.staves.forEach((staff) => {
			var last = null;
			staff.measures.forEach((measure) => {
				if (last && measure.measureNumber.systemIndex > 0) {
					measure.staffX = last.staffX + last.staffWidth;
				}
				if (suiLayoutBase.debugLayout) {
					var dbgBox = svgHelpers.boxPoints(measure.staffX, measure.staffY, measure.staffWidth, measure.logicalBox.height);
					svgHelpers.debugBox(svg, dbgBox, 'measure-adjust-dbg', 10);
				}
				last = measure;
			});
		});

	}
	
	static _minMaxYModifier(staff,minMeasure,maxMeasure,minY,maxY) {
		staff.modifiers.forEach((modifier) => {
            if (modifier.startSelector.measure >= minMeasure && modifier.startSelector <= maxMeasure) {
                minY = modifier.logicalBox.y < minY ? modifier.logicalBox.y : minY;
                var max = modifier.logicalBox.y + modifier.logicalBox.height;
                maxY = max > maxY ? max : maxY;	 
            }
			});

		return {minY:minY,maxY:maxY};
	}

	// ### adjustHeight
	// Handle measure bumping into each other, vertically.
	static adjustHeight(score,renderer) {
		var topStaff = score.staves[0];
		var maxLine = topStaff.measures[topStaff.measures.length - 1].lineIndex;
		var svg = renderer.getContext().svg;
		// array of the max Y measure per line, used to space next line down
		var maxYPerLine = [];
		var lineIndexPerLine = [];

		if (suiLayoutBase.debugLayout) {
			$(renderer.getContext().svg).find('g.measure-adjust-dbg').remove();
		}
		var accum = 0;
		// iterate: system, staves within a system, measures 
		for (var i = 0; i <= maxLine; ++i) {
			for (var j = 0; j < score.staves.length; ++j) {
				var absLine = score.staves.length * i + j;
				var staff = score.staves[j];
				var measures = staff.measures.filter((mm) => {
						return mm.lineIndex === i
					});

				if (measures.length === 0) {
					continue;
				}
                
                var measureNums = measures.map((mm)=> {
                    return mm.measureNumber.measureIndex;
                });
                var measureMax = measureNums.reduce((a,b) => a > b ? a : b);
                var measureMin = measureNums.reduce((a,b) => a < b ? a : b);

				// maxYMeasure is measure on this line with y closest to bottom of page (maxYMeasure y point)
				var maxYMeasure = measures.reduce((a, b) => {
						if (a.logicalBox.y + a.logicalBox.height >
							b.logicalBox.y + b.logicalBox.height) {
							return a;
						}
						return b;
					});
				// minYMeasure is measure on this line with y closest to top of the page
				var minYMeasure = measures.reduce((a, b) => {
						return a.logicalBox.y < b.logicalBox.y ? a : b;
					});
					
				var minYRenderedY = minYMeasure.logicalBox.y;
				var minYStaffY = minYMeasure.staffY;
				
				var thisLineMaxY = maxYMeasure.logicalBox.y + maxYMeasure.logicalBox.height;
				
				var modAdj = suiLayoutAdjuster._minMaxYModifier(staff,measureMin,measureMax,minYRenderedY,thisLineMaxY);
				minYRenderedY=modAdj.minY;
				thisLineMaxY=modAdj.maxY;

				maxYPerLine.push(thisLineMaxY);
				lineIndexPerLine.push(maxYMeasure.lineIndex);

				if (absLine == 0) {
					accum = score.layout.topMargin - minYRenderedY;					
					var staffY = minYStaffY+ accum;					
					measures.forEach((measure) => {
						measure.staffY = staffY;
						if (suiLayoutBase.debugLayout) {
							var dbgBox = svgHelpers.boxPoints(measure.staffX, measure.staffY, measure.staffWidth, measure.logicalBox.height);
							svgHelpers.debugBox(svg, dbgBox, 'measure-adjust-dbg', 10);
						}
					});
				} else {
					var my = maxYPerLine[absLine - 1]  + score.layout.intraGap;
					var delta = my - minYRenderedY;
					if (lineIndexPerLine[absLine - 1] < minYMeasure.lineIndex) {
						delta += score.layout.interGap;
					}
					accum += delta;
					var staffY = minYStaffY + accum;					
					measures.forEach((measure) => {
						var ll = measures.logicalBox;
						measure.staffY = staffY;
						if (suiLayoutBase.debugLayout) {
							var dbgBox = svgHelpers.boxPoints(measure.staffX, measure.staffY, measure.staffWidth, measure.logicalBox.height);
							svgHelpers.debugBox(svg, dbgBox, 'measure-adjust-dbg', 10);
						}
					});
				}
			}
		}
	}	
};
// ## suiLayoutBase
// ## Description:
// A layout maps the measures and notes to a spot on the page.  It
// manages the flow of music as an ordinary score.  We call it simple layout, because
// there may be other layouts for parts view, or output to other media.
class suiScoreLayout extends suiLayoutBase {
	constructor(params) {
		super('suiScoreLayout');
		Vex.Merge(this, suiLayoutBase.defaults);
		Vex.Merge(this, params);
		
		this.setViewport(true);

		this.attrs = {
			id: VF.Element.newID(),
			type: 'testLayout'
		};
	}
	
	get score() {
		return this._score;
	}
	
	set score(score) {
		if (this._score) {
		    this.unrenderAll();
		}
		this.passState = suiLayoutBase.passStates.initial;
		this.dirty=true;
		this._score = score;
	}
	

	// ### createScoreLayout
	// ### Description;
	// to get the score to appear, a div and a score object are required.  The layout takes care of creating the
	// svg element in the dom and interacting with the vex library.
	static createScoreLayout(renderElement,shadowElement, score, layoutParams) {
		var ctorObj = {
			elementId: renderElement,
            shadowElement:shadowElement,
			score: score
		};
		if (layoutParams) {
			Vex.Merge(ctorObj, layoutParams);
		}
		var layout = new suiScoreLayout(ctorObj);
		return layout;
	}
	static get defaults() {
		return {
			clefWidth: 70,
			staffWidth: 250,
			totalWidth: 250,
			leftMargin: 15,
			topMargin: 15,
			pageWidth: 8 * 96 + 48,
			pageHeight: 11 * 96,
			svgScale: 0.7,
			font: {
				typeface: "Arial",
				pointSize: 10,
				fillStyle: '#eed'
			}
		};
	}
	
	// ### unrenderAll
	// ### Description:
	// Delete all the svg elements associated with the score.
	unrenderAll() {
		this._score.staves.forEach((staff) => {
			this.unrenderStaff(staff);
		});
		$(this.renderer.getContext().svg).find('g.lineBracket').remove();
	}
	get pageMarginWidth() {
		return this.pageWidth - this.rightMargin * 2;
	}
	get pageMarginHeight() {
		return this.pageHeight - this.topMargin * 2;
	}

	get logicalPageWidth() {
		return this.pageMarginWidth/this.svgScale;
	}
	get logicalPageHeight() {
		return this.pageMarginHeight/this.svgScale;
	}

	_previousAttr(i, j, attr) {
		var staff = this._score.staves[j];
		var measure = staff.measures[i];
		return (i > 0 ? staff.measures[i - 1][attr] : measure[attr]);
	}
	
	renderScoreText(tt) {
		var svg = this.context.svg;
		var classes = tt.attrs.id+' '+'score-text'+' '+tt.classes;
		var args = {svg:this.svg,width:this.logicalPageWidth,height:this.logicalPageHeight,layout:this._score.layout};
		if (tt.autoLayout === true) {
			var fcn = tt.position+'TextPlacement';
			suiTextLayout[fcn](tt,args);
		} else {
			suiTextLayout.placeText(tt,args);
		}
	}	
	_renderScoreModifiers() {
		var svg = this.context.svg;
		$(this.renderer.getContext().svg).find('text.score-text').remove();
		this._score.scoreText.forEach((tt) => {
			this.renderScoreText(tt);
		});
	}


	calculateBeginningSymbols(systemIndex, measure, clefLast, keySigLast, timeSigLast) {
		var measureKeySig = smoMusic.vexKeySignatureTranspose(measure.keySignature, measure.transposeIndex);
		measure.forceClef = (systemIndex === 0 || measure.clef !== clefLast);
		measure.forceTimeSignature = (systemIndex === 0 || measure.timeSignature !== timeSigLast);
		if (measureKeySig !== keySigLast) {
			measure.canceledKeySignature = keySigLast;
			measure.setChanged();
			measure.forceKeySignature = true;
		} else if (measure.measureNumber.measureIndex == 0 && measureKeySig != 'C') {
			measure.forceKeySignature = true;
		} else {
			measure.forceKeySignature = false;
		}
	}

	// ### layout
	//  Render the music, keeping track of the bounding boxes of all the
	// elements.  Re-render a second time to adjust measure widths to prevent notes
	// from overlapping.  Then render all the modifiers.
	// * useAdjustedY is false if we are dynamically rendering the score, and we use other
	// measures to find our sweet spot.  If true, we assume the coordinates are correct and we use those.
	layout(params) {
		var useAdjustedY = params.useY;
		var useAdjustedX = params.useX;
		var svg = this.context.svg;

		if (suiLayoutBase.debugLayout) {
			$(this.renderer.getContext().svg).find('g.measure-place-dbg').remove();
			$(this.renderer.getContext().svg).find('g.measure-render-dbg').remove();
			$(this.renderer.getContext().svg).find('g.measure-note-dbg').remove();
		}

		// bounding box of all artifacts on the page
		var pageBox = {};
		// bounding box of all artifacts in a system
		var systemBoxes = {};
		var staffBoxes = {};
		if (!this._score.staves.length) {
			return;
		}
		var topStaff = this._score.staves[0];
		var topStaffY = topStaff.staffY;
		if (!topStaff.measures.length) {
			return;
		}

		// Note: line index is index of this line on a page
		// System index is index of current measure from the left of the system
		var lineIndex = 0;
		var system = new VxSystem(this.context, topStaff.measures[0].staffY, lineIndex);
		var systemIndex = 0;

		for (var i = 0; i < topStaff.measures.length; ++i) {
			var staffWidth = 0;
			for (var j = 0; j < this._score.staves.length; ++j) {
				var staff = this._score.staves[j];
				var measure = staff.measures[i];

				measure.lineIndex = lineIndex;

				// The SVG X,Y of this staff.  Set it initially to the UL corner of page.  Width,height filled in later.
				var staffBox = svgHelpers.pointBox(this._score.layout.leftMargin, this._score.layout.topMargin);

				// The left-most measure sets the y for the row, top measure sets the x for the column.
				// Other measures get the x, y from previous measure on this row.  Once the music is rendered we will adjust
				// based on actual rendered dimensions.
				if (!staffBoxes[j]) {
					if (j == 0) {
						staffBoxes[j] = svgHelpers.copyBox(staffBox);
					} else {
						staffBoxes[j] = svgHelpers.pointBox(staffBoxes[j - 1].x, staffBoxes[j - 1].y + staffBoxes[j - 1].height + this._score.layout.intraGap);
					}
				}

				staffBox = staffBoxes[j];
				
				// If we are calculating the measures' location dynamically, always update the y
				if (!useAdjustedY && measure.changed) { // && systemIndex === 0) {
					measure.staffY = staffBox.y;
						if (isNaN(measure.staffY)) {
							throw ("nan measure ");
						}
				}

				if (!systemBoxes[lineIndex] || j > 0) {
					systemBoxes[lineIndex] = svgHelpers.copyBox(staffBox);
				}

				if (!pageBox['width']) {
					pageBox = svgHelpers.copyBox(staffBox);
				}
				var measureKeySig = smoMusic.vexKeySignatureTranspose(measure.keySignature, measure.transposeIndex);
				var keySigLast = smoMusic.vexKeySignatureTranspose(this._previousAttr(i, j, 'keySignature'), measure.transposeIndex);
				var timeSigLast = this._previousAttr(i, j, 'timeSignature');
				var clefLast = this._previousAttr(i, j, 'clef');

				this.calculateBeginningSymbols(systemIndex, measure, clefLast, keySigLast, timeSigLast);

				if (!useAdjustedX) {
					measure.staffX = staffBox.x + staffBox.width;					
					suiLayoutAdjuster.estimateMeasureWidth(this.renderer,measure,staffBox);    				
				}

				// Do we need to start a new line?  Don't start a new line on the first measure in a line...
				if (j == 0 && systemIndex > 0 && staffBox.x + staffBox.width + measure.staffWidth
					 > this.logicalPageWidth) {
					system.renderEndings();
					if (useAdjustedY) {
						system.cap();
					}
					// If we have wrapped at a place other than the wrap point, give up and 
					// start computing X again
					if (useAdjustedX && measure.measureNumber.systemIndex != 0) {
						useAdjustedX = params.useX = false;
    				}
					measure.staffX = this._score.layout.leftMargin;

					this._score.staves.forEach((stf) => {
						this._renderModifiers(stf, system);
					});
					if (!useAdjustedY && measure.changed) {
                        if (suiLayoutBase.debugLayout) {
					       svgHelpers.debugBox(
						svg, svgHelpers.boxPoints(measure.staffX, pageBox.y + pageBox.height, 1, this._score.layout.interGap), 
                          'measure-place-dbg');
				        }
						measure.staffY = pageBox.y + pageBox.height + this._score.layout.interGap;
						if (isNaN(measure.staffY)) {
							throw ("nan measure ");
						}
					}
					staffBoxes = {};
					staffBoxes[j] = svgHelpers.boxPoints(this._score.layout.leftMargin, measure.staffY, 1, 1);
					lineIndex += 1;
					measure.lineIndex = lineIndex;
					system = new VxSystem(this.context, staff.staffY, lineIndex);
					systemIndex = 0;
					systemBoxes[lineIndex] = staffBoxes[j];

					// If we have wrapped lines, calculate the beginning stuff again.
					this.calculateBeginningSymbols(systemIndex, measure, clefLast, keySigLast, timeSigLast);
					if (!useAdjustedX) {						
						suiLayoutAdjuster.estimateMeasureWidth(this.renderer,measure,staffBox);
					}
				}

				
				// guess height of staff the first time
				measure.measureNumber.systemIndex = systemIndex;

				if (suiLayoutBase.debugLayout) {
					svgHelpers.debugBox(
						svg, svgHelpers.boxPoints(measure.staffX, measure.staffY, measure.staffWidth, 1), 'measure-place-dbg');
				}
				
				// When we are estimating dimensions, just draw changed measures.
				if (useAdjustedY || useAdjustedX || measure.changed) {
					smoBeamerFactory.applyBeams(measure);
					system.renderMeasure(j, measure);

					if (suiLayoutBase.debugLayout) {
						svgHelpers.debugBox(svg, svgHelpers.clientToLogical(svg, measure.renderedBox), 'measure-render-dbg');
						measure.voices.forEach((voice) => {
							voice.notes.forEach((note) => {
								var noteEl = svg.getElementById(note.renderId);
								svgHelpers.debugBox(svg, noteEl.getBBox(), 'measure-note-dbg');
							});
						});
					}
                    // If we are still animating, pass that information back.
                    if (measure.staffY != measure.prevY) {
                        params.animateY=true;
                    }
                    if (measure.staffX != measure.prevX) {
                        params.animateX=true;
                    }
					measure.changed = false;
				}
				// Rendered box is in client coordinates, convert it to SVG
				var logicalRenderedBox = measure.logicalBox;

				// Keep a running tally of the page, system, and staff dimensions as we draw.
				systemBoxes[lineIndex] = svgHelpers.unionRect(systemBoxes[lineIndex], logicalRenderedBox);

				// For x coordinate we adjust to the actual rendered size.  For Y, we want all staves at the same height
				// so we only consider the height of the first measure in the system
				if (systemIndex === 0) {
					staffBoxes[j] = svgHelpers.unionRect(staffBoxes[j], logicalRenderedBox);
				} else {
					staffBoxes[j].width = (logicalRenderedBox.x + logicalRenderedBox.width) - staffBoxes[j].x;
				}
				staffBoxes[j].y = measure.staffY;
				pageBox = svgHelpers.unionRect(pageBox, logicalRenderedBox);
			}
			++systemIndex;
		}
		system.renderEndings();
		this._score.staves.forEach((stf) => {
			this._renderModifiers(stf, system);
		});
		this._renderScoreModifiers();
		if (useAdjustedY) {
			system.cap();
		}
	}
}
;
class suiTextLayout {
	
	static _getTextBox(scoreText,parameters) {
		var svg = parameters.svg;
		if (scoreText.width && scoreText.height && scoreText.boxModel == SmoScoreText.boxModels.wrap) {
			return svgHelpers.boxPoints(scoreText.x,scoreText.y,scoreText.width,scoreText.height);
		}
		return svgHelpers.getTextBox(svg,scoreText.toSvgAttributes(),scoreText.classes,scoreText.text);		
	}
	static _saveBox(scoreText,parameters,el) {
		var svg = parameters.svg;
		 var box = svgHelpers.smoBox(el.getBoundingClientRect());
		 var lbox = svgHelpers.clientToLogical(svg,box);
		 scoreText.renderedBox = {
			x: box.x,
			y: box.y,
			height: box.height,
			width: box.width
		};
		scoreText.logicalBox = lbox;
	}
	static titleTextPlacement(scoreText,parameters) {
		var svg = parameters.svg;
		var bbox = suiTextLayout._getTextBox(scoreText,parameters);
		scoreText.x=parameters.width/2-(bbox.width/2);
		scoreText.y=parameters.layout.topMargin;
		parameters.layout.topMargin += bbox.height;
		scoreText.autoLayout=false; // use custom placement or calculated placement next time
		suiTextLayout.placeText(scoreText,parameters);
	}
	
	static headerTextPlacement(scoreText,parameters) {
		var svg = parameters.svg;
		var bbox = suiTextLayout._getTextBox(scoreText,parameters);
		scoreText.x=parameters.width/2-(bbox.width/2);
		scoreText.y=10;
		scoreText.autoLayout=false;
		suiTextLayout.placeText(scoreText,parameters);
	}
	
	static footerTextPlacement(scoreText,parameters) {
		var svg = parameters.svg;
		var bbox = suiTextLayout._getTextBox(scoreText,parameters);
		scoreText.x=parameters.width/2-(bbox.width/2);
		scoreText.y=parameters.height-(bbox.height+10);
		scoreText.autoLayout=false;
		suiTextLayout.placeText(scoreText,parameters);
	}
	
	static copyrightTextPlacement(scoreText,parameters) {
		var svg = parameters.svg;
		var bbox = suiTextLayout._getTextBox(scoreText,parameters);
		scoreText.x=parameters.width-(bbox.width+10);
		scoreText.y=10;
		suiTextLayout.placeText(scoreText,parameters);
		scoreText.autoLayout=false;
	}
	
	static placeText(scoreText,parameters) {
		var svg = parameters.svg;
		if (scoreText.width && scoreText.height && scoreText.boxModel == SmoScoreText.boxModels.wrap) {
    		suiTextLayout.placeWithWrap(scoreText,parameters);
		} else {
			var el = svgHelpers.placeSvgText(svg,scoreText.toSvgAttributes(),scoreText.classes,scoreText.text);	
            suiTextLayout._saveBox(scoreText,parameters,el);
		}
	}
	
	
	static _placeWithWrap(scoreText,parameters,justification) {
		var justifyOnly=false;
		if (!justification.length) {
			justifyOnly=true;
		}
		var svg = parameters.svg;
		var words = scoreText.text.split(' ');		
		var curx = scoreText.x;
		var left = curx;
		var right = scoreText.x+scoreText.width;
		var top = scoreText.y;
		var params = scoreText.backupParams();
		var cury = scoreText.y;
		var width=	scoreText.width;
		var height = scoreText.height;
		var delta = 0;
		params.boxModel = SmoScoreText.boxModels.none;
		params.width=0;
		params.height = 0;
		scoreText.logicalBox=svgHelpers.boxPoints(scoreText.x,scoreText.y,scoreText.width,scoreText.height);
		scoreText.renderedBox = svgHelpers.logicalToClient(svg,scoreText.logicalBox);
		var justifyAmount = justifyOnly ? 0 : justification[0];
		if(!justifyOnly) {
		    justification.splice(0,1);
		}
		
		words.forEach((word) => {
			var bbox = svgHelpers.getTextBox(svg,SmoScoreText.toSvgAttributes(params),scoreText.classes,word);
			delta = right - (bbox.width + bbox.x);
			if (delta > 0) {
				params.x=bbox.x;
				params.y=cury;
				if (!justifyOnly) {
                   params.x += justifyAmount;					
				   svgHelpers.placeSvgText(svg,SmoScoreText.toSvgAttributes(params),scoreText.classes,word);
				} 
			} else {
				if (!justifyOnly) {
					justifyAmount = justification[0];
				    justification.splice(0,1);
				} else {
					// If we are computing for justification, do that.
					delta = right - bbox.x;
					delta = scoreText.justification === SmoScoreText.justifications.right ? delta :
					    (scoreText.justification === SmoScoreText.justifications.center ? delta/2 : 0);
					justification.push(delta);
				}
				cury += bbox.height;
				curx = left;
				params.x=curx + justifyAmount;
				params.y=cury;
				if (!justifyOnly) {
				    svgHelpers.placeSvgText(svg,SmoScoreText.toSvgAttributes(params),scoreText.classes,word);
				}
			}
			curx += bbox.width + 5;
			params.x = curx;
			// calculate delta in case this is last time			
			delta = right - curx; 
		});	
		delta = scoreText.justification === SmoScoreText.justifications.right ? delta :
					    (scoreText.justification === SmoScoreText.justifications.center ? delta/2 : 0);
        justification.push(delta-5);		
	}
	static placeWithWrap(scoreText,parameters) {
		var justification=[];
		
		// One pass is to compute justification for the box model.
		suiTextLayout._placeWithWrap(scoreText,parameters,justification);
		suiTextLayout._placeWithWrap(scoreText,parameters,justification);
	}

};


// ## editSvgText
// A class that implements very basic text editing behavior in an svg text node
class editSvgText {
    constructor(params) {
        this.target = params.target;
        var ns = svgHelpers.namespace;
        this.layout = params.layout;
        this.fontInfo = params.fontInfo;
		this.svg = document.createElementNS(ns, 'svg');
        this.editText = document.createElementNS(ns, 'text');
        this.attrAr = [];
        
        // create a mirror of the node under edit by copying attributes
        // and setting up a similarly-dimensioned viewbox
        editSvgText.textAttrs.forEach((attr) => {
			if (this.target.attributes[attr]) {
         		var val = this.target.attributes[attr].value;
				this.editText.setAttributeNS('',attr,val);
				this.attrAr.push(JSON.parse('{"'+attr+'":"'+val+'"}'));
			}
        });
        this.editing = this.running=false;
        
        // Hide the original - TODO, handle non-white background.
        this.oldFill = this.target.getAttributeNS(null,'fill');
        this.target.setAttributeNS(null,'fill','#fff');

        this.editText.textContent=this.target.textContent;
        this._value = this.editText.textContent;
        this.clientBox = svgHelpers.smoBox(svgHelpers.smoBox(this.target.getBoundingClientRect()));
        var svgBox = svgHelpers.smoBox(this.target.getBBox());
        this.editText.setAttributeNS('','y',svgBox.height);        
        
        $('.textEdit').html('');
        this.svg.appendChild(this.editText);
        var b = htmlHelpers.buildDom;        
        var r = b('span').classes('hide icon-move');
        $('.textEdit').append(r.dom());
        $('.textEdit').append(this.svg);
        $('.textEdit').removeClass('hide').attr('contentEditable','true');
        this.setEditorPosition(this.clientBox,svgBox);
    }
    
    setEditorPosition(clientBox,svgBox) {
        var box = svgHelpers.pointBox(this.layout.pageWidth, this.layout.pageHeight);
        svgHelpers.svgViewport(this.svg, box.x, box.y,this.layout.svgScale);
        
        $('.textEdit').css('top',this.clientBox.y-5)
          .css('left',this.clientBox.x-5)
          .width(this.clientBox.width+10)
          .height(this.clientBox.height+10);
    }
    
    endSession() {
        this.editing = false;
        this.target.setAttributeNS(null,'fill',this.oldFill);

        $('.textEdit').addClass('hide');        
    }
    
    get value() {
        return this._value;
    }
    
    /* moveCursorToEnd() {
       if (this.editText.getNumberOfChars() < 1) 
           return;
       var content = this.editText.textContent;
       this.editText.textContent = content+content.substr(content.length-1,1);
       this.editText.selectSubString(content.length,1);
    }  */
    
    _updateText() {
        $('.textEdit').focus();
        
        if (this.editText.textContent && 
         this.editText.textContent.length &&
           this._value != this.editText.textContent) {
          // if (this.editText[0]
          // this.editText.textContent = this.editText.textContent.replace(' ','');
          /* if (this.editText.textContent.length > 1 && 
              this.editText.textContent[this.editText.textContent.length - 1] == '_') {
            this.editText.textContent = this.editText.textContent.substr(0,this.editText.textContent.length - 1);
            var self = this;
            setTimeout(function() {
                self.moveCursorToEnd();
            },1);
          }  */
          this.target.textContent = this._value = this.editText.textContent;
          this._value = this.target.textContent;
          var fontAttr = svgHelpers.fontIntoToSvgAttributes(this.fontInfo);
          var svgBox = svgHelpers.getTextBox(this.svg,this.attrAr,null,this._value);
          var nbox = svgHelpers.logicalToClient(this.svg,svgBox);
          if (nbox.width > this.clientBox.width) {
             this.clientBox.width = nbox.width + nbox.width*.3;
             this.clientBox.height = nbox.height;
             this.setEditorPosition(this.clientBox,svgBox);
           }
        }  
        if (!this.editText.textContent) {
           this.editText.textContent='\xa0';
        }
    }
    
    startSessionPromise() {
        var self=this;
        this.editing=true;
        this.running = true;
        const promise = new Promise((resolve, reject) => {
            function editTimer() {
                setTimeout(function() {
                    self._updateText();
                    if (self.editing) {
                      editTimer();
                    } else {
                      self._updateText();                      
                      resolve();
                    }
                },25);
                
            }            
            editTimer();
		});
        
        return promise;
    }

    static get textAttrs() {
        return ['font-size','font-family','font-weight','fill','transform'];
    }
}

class editLyricSession {
	static get states() {
        return {stopped:0,started:1,minus:2,space:3,backSpace:4,stopping:5};
    }
	// tracker, selection, controller
    constructor(parameters) {
        this.tracker = parameters.tracker;
        this.selection = parameters.selection;
        this.controller = parameters.controller;
        this.verse=0;
		this.bound = false;
        this.state=editLyricSession.states.stopped;
    }
    
    detach() {
        $('body').removeClass('showAttributeDialog');
		window.removeEventListener("keydown", this.keydownHandler, true);
		var self=this;
		function rebind() {
			self.controller.bindEvents();
		}
        if (this.selection) {
            this.selection.measure.changed=true;
        }
		this.controller.bindEvents();
		this.controller.resizeEvent();
    }
	
	_editingSession() {       
		if (!this.bound) {
			this.bindEvents();
		}
		this.textElement = $(this.tracker.layout.svg).find('#'+this.selection.note.renderId).find('g.lyric-'+this.lyric.verse)[0];
		this.editor = new editSvgText({target:this.textElement,layout:this.tracker.layout,fontInfo:this.fontInfo});
        this.state = editLyricSession.states.started;
        var self = this;
        function handleSkip() {
            self._handleSkip();
        }

        this.editor.startSessionPromise().then(handleSkip);
	}
    
    _getOrCreateLyric(note) {
        var lyrics =  note.getModifiers('SmoLyric');
        if (!lyrics.length) {
			this.lyric = new SmoLyric({text:'\xa0'});
        } else {
			this.lyric = lyrics[0];
		}
    }
    
    _handleSkip() {
        var tag = this.state == editLyricSession.states.minus ? '-' :'';
        this.lyric.text = this.editor.value+tag;
        this.selection.measure.changed = true;
        if (this.state != editLyricSession.states.stopping) {
			var func = (this.state == editLyricSession.states.backSpace) ? 'lastNoteSelection' : 'nextNoteSelection';
            var sel = SmoSelection[func](
		      this.tracker.layout.score, this.selection.selector.staff, 
              this.selection.selector.measure, this.selection.selector.voice, this.selection.selector.tick);
            if (sel) {
                this.selection=sel;
                this._getOrCreateLyric(this.selection.note);
                this.editNote();
            }
        } else {
            this.detach();
        }
        
    }
    editNote() {
		var self=this;
		function _startEditing() {
			self._editingSession();
		}
        $('body').addClass('showAttributeDialog');
        this._getOrCreateLyric(this.selection.note)
		this.fontInfo = JSON.parse(JSON.stringify(this.lyric.fontInfo));
        this.selection.note.addLyric(this.lyric);
        this.tracker.layout.render();
		_startEditing();
    }
	
	handleKeydown(event) {
		console.log("Lyric KeyboardEvent: key='" + event.key + "' | code='" +
			event.code + "'"
			 + " shift='" + event.shiftKey + "' control='" + event.ctrlKey + "'" + " alt='" + event.altKey + "'");
       
		if (['Space', 'Minus'].indexOf(event.code) >= 0) {            
			this.state =  (event.key == '-') ? editLyricSession.states.minus :  editLyricSession.states.space;
			this.state = (this.state === editLyricSession.states.space && event.shiftKey) 
			     ? editLyricSession.states.backSpace :  this.state;
            this.editor.endSession();
		}
		
		if (event.code == 'Escape') {
            this.state = editLyricSession.states.stopping;
            this.editor.endSession();
		}
        this.selection.measure.changed=true;
	}
    
    bindEvents() {
		var self = this;
        this.controller.detach();

		if (!this.bound) {
			this.keydownHandler = this.handleKeydown.bind(this);

			window.addEventListener("keydown", this.keydownHandler, true);
			this.bound = true;
		}
		this.bound = true;
	}
};

class suiEditor {
    constructor(params) {
        Vex.Merge(this, params);
        this.slashMode = false;
    }

    // ## _render
    // utility function to render the music and update the tracker map.
    _render() {
		this.layout.setDirty();
    }
    
    get score() {
        return this.layout.score;
    }

    _renderAndAdvance() {
		this.tracker.moveSelectionRight();
		this.layout.setDirty();
    }
    _batchDurationOperation(operation) {
        SmoUndoable.batchDurationOperation(this.score, this.tracker.selections, operation, this.undoBuffer);
        this._render();
    }
	
	scoreSelectionOperation(selection,name,parameters,description) {
		SmoUndoable.scoreSelectionOp(this.score,selection,name,parameters,
			    this.undoBuffer,description);
		this._render();
				
	}
	scoreOperation(name,parameters,description) {
		SmoUndoable.scoreOp(this.score,name,parameters,this.undoBuffer,description);
		this._render();
	}

    _selectionOperation(selection, name, parameters) {
        if (parameters) {
            SmoUndoable[name](selection, parameters, this.undoBuffer);
        } else {
            SmoUndoable[name](selection, this.undoBuffer);
        }
		selection.measure.setChanged();
    }

    undo() {
        this.layout.undo(this.undoBuffer);
    }

    _singleSelectionOperation(name, parameters) {
        if (this.tracker.selections.length != 1) {
            return;
        }
        var selection = this.tracker.selections[0];
        if (parameters) {
            SmoUndoable[name](selection, parameters, this.undoBuffer);
        } else {
            SmoUndoable[name](selection, this.undoBuffer);
        }
        this._render();
    }

    _transpose(selection, offset) {
        this._selectionOperation(selection, 'transpose', offset);
    }

    copy() {
        if (this.tracker.selections.length < 1) {
            return;
        }
        this.pasteBuffer.setSelections(this.score, this.tracker.selections);
    }
    paste() {
        if (this.tracker.selections.length < 1) {
            return;
        }
        this.layout.unrenderAll();
        SmoUndoable.pasteBuffer(this.score, this.pasteBuffer, this.tracker.selections, this.undoBuffer, 'paste')
        this._render();
    }
    toggleBeamGroup() {
        if (this.tracker.selections.length < 1) {
            return;
        }
        SmoUndoable.toggleBeamGroups(this.tracker.selections, this.undoBuffer);
        this._render();
    }
    
    beamSelections() {
        if (this.tracker.selections.length < 1) {
            return;
        }
        SmoUndoable.beamSelections(this.tracker.selections, this.undoBuffer);
    }

    deleteMeasure() {
        if (this.tracker.selections.length < 1) {
            return;
        }
        var selection = this.tracker.selections[0];
        this.layout.unrenderAll();
        SmoUndoable.deleteMeasure(this.score, selection, this.undoBuffer);
        this.tracker.selections = [];
        this.tracker.clearModifierSelections();
        this._render();
    }

    collapseChord() {
        SmoUndoable.noop(this.score, this.undoBuffer);
        this.tracker.selections.forEach((selection) => {
            var p = selection.note.pitches[0];
            p = JSON.parse(JSON.stringify(p));
            selection.note.pitches = [p];
        });
        this._render();
    }

    intervalAdd(interval, direction) {
        this._singleSelectionOperation('interval', direction * interval);
    }

    interval(keyEvent) {
        if (this.tracker.selections.length != 1)
            return;
        // code='Digit3'
        var interval = parseInt(keyEvent.code[5]) - 1;
        if (isNaN(interval) || interval < 2 || interval > 7) {
            return;
        }
        this.intervalAdd(interval, keyEvent.shiftKey ? -1 : 1);
    }

    transpose(offset) {
        this.tracker.selections.forEach((selected) => this._transpose(selected, offset,false));
        this._render();
    }
    transposeDown() {
        this.transpose(-1);
    }
    transposeUp() {
        this.transpose(1);
    }
    upOctave() {
        this.transpose(12);
    }
    downOctave() {
        this.transpose(-12);
    }
    makeRest() {
        this._singleSelectionOperation('makeRest');
    }

    _setPitch(selected, letter) {
        var selector = selected.selector;
        var hintSel = SmoSelection.lastNoteSelection(this.score,
                selector.staff, selector.measure, selector.voice, selector.tick);
        if (!hintSel) {
            hintSel = SmoSelection.nextNoteSelection(this.score,
                    selector.staff, selector.measure, selector.voice, selector.tick);
        }

        var hintNote = hintSel.note;
        var hpitch = hintNote.pitches[0];
        var pitch = JSON.parse(JSON.stringify(hpitch));
        pitch.letter = letter;

        // Make the key 'a' make 'Ab' in the key of Eb, for instance
        var vexKsKey = smoMusic.getKeySignatureKey(letter, selected.measure.keySignature);
        if (vexKsKey.length > 1) {
            pitch.accidental = vexKsKey[1];
        } else {
            pitch.accidental = 'n';
        }

        // make the octave of the new note as close to previous (or next) note as possible.
        var upv = ['bc', 'ac', 'bd', 'da', 'be', 'gc'];
        var downv = ['cb', 'ca', 'db', 'da', 'eb', 'cg'];
        var delta = hpitch.letter + pitch.letter;
        if (upv.indexOf(delta) >= 0) {
            pitch.octave += 1;
        }
        if (downv.indexOf(delta) >= 0) {
            pitch.octave -= 1;
        }
        SmoUndoable['setPitch'](selected, pitch, this.undoBuffer);
    }

    setPitchCommand(letter) {
        this.tracker.selections.forEach((selected) => this._setPitch(selected, letter));
        this._renderAndAdvance();
    }

    setPitch(keyEvent) {
        this.setPitchCommand(keyEvent.key.toLowerCase());
    }

    dotDuration(keyEvent) {
        this._batchDurationOperation('dotDuration');
    }

    undotDuration(keyEvent) {
        this._batchDurationOperation('undotDuration');
    }

    doubleDuration(keyEvent) {
        this._batchDurationOperation('doubleDuration');
    }

    halveDuration(keyEvent) {
        this._batchDurationOperation('halveDuration');
    }

    addMeasure(keyEvent) {
        if (this.tracker.selections.length < 1) {
            return;
        }
        var measure = this.tracker.getFirstMeasureOfSelection();
        if (measure) {
            var nmeasure = SmoMeasure.getDefaultMeasureWithNotes(measure);
            nmeasure.measureNumber.measureIndex = measure.measureNumber.measureIndex;
            SmoUndoable.addMeasure(this.score, measure.measureNumber.measureIndex, nmeasure, this.undoBuffer);
            this._render();
        }
    }
    toggleCourtesyAccidental() {
        if (this.tracker.selections.length < 1) {
            return;
        }
        this.tracker.selections.forEach((selection) => {
            SmoUndoable.toggleCourtesyAccidental(selection, this.undoBuffer);
        });
        this._render();
    }
    toggleEnharmonic() {
        this.tracker.selections.forEach((selected) => this._selectionOperation(selected, 'toggleEnharmonic'));
        this._render();
    }

    rerender(keyEvent) {
        this.layout.unrenderAll();
        SmoUndoable.noop(this.score, this.undoBuffer);
        this.undo();
        this._render();
    }
    makeTupletCommand(numNotes) {
        this._singleSelectionOperation('makeTuplet', numNotes);
    }
    makeTuplet(keyEvent) {
        var numNotes = parseInt(keyEvent.key);
        this.makeTupletCommand(numNotes);
    }

    unmakeTuplet(keyEvent) {
        this._singleSelectionOperation('unmakeTuplet');
    }

    toggleArticulationCommand(articulation, position) {
        this.undoBuffer.addBuffer('change articulation ' + articulation,
            'staff', this.tracker.selections[0].selector, this.tracker.selections[0].staff);

        this.tracker.selections.forEach((sel) => {
            var aa = new SmoArticulation({
                    articulation: articulation,
                    position: position
                });
            SmoOperation.toggleArticulation(sel, aa);
        });
        this._render();
    }

    addRemoveArticulation(keyEvent) {
        if (this.tracker.selections.length < 1)
            return;

        var atyp = SmoArticulation.articulations.accent;

        if (keyEvent.key.toLowerCase() === 'h') {
            atyp = SmoArticulation.articulations.accent;
        }
        if (keyEvent.key.toLowerCase() === 'i') {
            atyp = SmoArticulation.articulations.tenuto;
        }
        if (keyEvent.key.toLowerCase() === 'j') {
            atyp = SmoArticulation.articulations.staccato;
        }
        if (keyEvent.key.toLowerCase() === 'k') {
            atyp = SmoArticulation.articulations.marcato;
        }
        if (keyEvent.key.toLowerCase() === 'l') {
            atyp = SmoArticulation.articulations.pizzicato;
        }
        var pos = keyEvent.shiftKey ? SmoArticulation.positions.below : SmoArticulation.positions.above;
        this.toggleArticulationCommand(atyp, pos);

    }
}
;
class suiMenuBase {
	constructor(params) {
		Vex.Merge(this, params);
        this.focusIndex = -1;
	}

	complete() {
		$('body').trigger('menuDismiss');
	}
}

class suiMenuManager {
	constructor(params) {
		Vex.Merge(this, suiMenuManager.defaults);
		Vex.Merge(this, params);
		this.bound = false;
        this.hotkeyBindings={};
	}

	static get defaults() {
		return {
			menuBind: suiMenuManager.menuKeyBindingDefaults,
			menuContainer: '.menuContainer'
		};
	}
    
    setController(c) {
        this.controller=c;
    }
    
    get score() {
        return this.layout.score;
    }

	// ### Description:
	// slash ('/') menu key bindings.  The slash key followed by another key brings up
	// a menu.
	static get menuKeyBindingDefaults() {
		return [{
				event: "keydown",
				key: "k",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "suiKeySignatureMenu"
			}, {
				event: "keydown",
				key: "l",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "suiStaffModifierMenu"
			}, {
				event: "keydown",
				key: "d",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "SuiDynamicsMenu"
			}, {
				event: "keydown",
				key: "s",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "SuiAddStaffMenu"
			}, {
				event: "keydown",
				key: "f",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "SuiFileMenu"
			},
			 {
				event: "keydown",
				key: "t",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "SuiTextMenu"
			},
			 {
				event: "keydown",
				key: "m",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "SuiTimeSignatureMenu"
			}

		];
	}
    _advanceSelection(inc) {
        var options = $('.menuContainer ul.menuElement li.menuOption');
        inc = inc < 0 ? options.length - 1: 1;
        this.menu.focusIndex = (this.menu.focusIndex+inc) % options.length;
        $(options[this.menu.focusIndex]).find('button').focus();
    }

	get menuBindings() {
		return this.menuBind;
	}

	unattach() {
		window.removeEventListener("keydown", this.keydownHandler, true);
		$('body').removeClass('modal');
		$(this.menuContainer).html('');
		$('body').off('dismissMenu');
		this.bound = false;
	}

	attach(el) {
		var b = htmlHelpers.buildDom();

		$(this.menuContainer).html('');
		$(this.menuContainer).attr('z-index', '12');
		var b = htmlHelpers.buildDom;
		var r = b('ul').classes('menuElement').attr('size', this.menu.menuItems.length)
			.css('left', '' + this.menuPosition.x + 'px')
			.css('top', '' + this.menuPosition.y + 'px');			
        var hotkey=0;
		this.menu.menuItems.forEach((item) => {
			r.append(
				b('li').classes('menuOption').append(
					b('button').attr('data-value',item.value)
                    .append(b('span').classes('menuText').text(item.text))
					
					.append(
						b('span').classes('icon icon-' + item.icon))
                     .append(b('span').classes('menu-key').text(''+hotkey))));
            item.hotkey=hotkey;
            hotkey += 1;
		});
		$(this.menuContainer).append(r.dom());
		$('body').addClass('modal');
		this.bindEvents();
	}
	slashMenuMode() {
		var self = this;
		this.bindEvents();
		this.closeMenuPromise = new Promise((resolve, reject) => {
				$('body').off('menuDismiss').on('menuDismiss', function () {
					self.unattach();
					resolve();
				});

			});
		return this.closeMenuPromise;
	}

	createMenu(action) {
		this.menuPosition = {x:250,y:40,width:1,height:1};
		var ctor = eval(action);
		this.menu = new ctor({
				position: this.menuPosition,
				tracker: this.tracker,
				editor: this.editor,
				score: this.score,
                controller:this.controller,
                closePromise:this.closeMenuPromise
			});
		this.attach(this.menuContainer);
        this.menu.menuItems.forEach((item) => {
            if (item.hotkey) {
                this.hotkeyBindings[item.hotkey] = item.value;
            }
        });
	}

	handleKeydown(event) {
		console.log("KeyboardEvent: key='" + event.key + "' | code='" +
			event.code + "'"
			 + " shift='" + event.shiftKey + "' control='" + event.ctrlKey + "'" + " alt='" + event.altKey + "'");
		if (['Tab', 'Enter'].indexOf(event.code) >= 0) {
			return;
		}

		event.preventDefault();

		if (event.code === 'Escape') {
			$('body').trigger('menuDismiss');
		}
		if (this.menu) {
            if (event.code == 'ArrowUp') {
                this._advanceSelection(-1);
            }
            else if (event.code == 'ArrowDown') {
                this._advanceSelection(1);
            } else  if (this.hotkeyBindings[event.key]) {
                $('button[data-value="'+this.hotkeyBindings[event.key]+'"]').click();
            } else {
			    this.menu.keydown(event);
            }
		}
		if (this.tracker.selections.length == 0) {
			this.unattach();
			return;
		}
		
		var binding = this.menuBind.find((ev) => {
				return ev.key === event.key
			});
		if (!binding) {
			return;
		}
		this.createMenu(binding.action);
	}

	bindEvents() {
		var self = this;
        this.hotkeyBindings={};

		if (!this.bound) {
			this.keydownHandler = this.handleKeydown.bind(this);

			window.addEventListener("keydown", this.keydownHandler, true);
			this.bound = true;
		}
		$(this.menuContainer).find('button').off('click').on('click', function (ev) {
			if ($(ev.currentTarget).attr('data-value') == 'cancel') {
				self.menu.complete();
				return;
			}
			self.menu.selection(ev);
		});
	}
}



class SuiFileMenu extends suiMenuBase {
    constructor(params) {
		params = (params ? params : {});
		Vex.Merge(params, SuiFileMenu.defaults);
		super(params);
	}
     static get defaults() {
		return {
			menuItems: [{
					icon: 'folder-new',
					text: 'New Score',
					value: 'newFile'
				},{
					icon: 'folder-open',
					text: 'Open',
					value: 'openFile'
				}, {
					icon: 'floppy-disk',
					text: 'Save',
					value: 'saveFile' 
                },	{
					icon: '',
					text: 'Cancel',
					value: 'cancel'
				}                
            ]
        };
     }
     selection(ev) {
		var text = $(ev.currentTarget).attr('data-value');

		if (text == 'saveFile') {
            SuiSaveFileDialog.createAndDisplay({
			layout: this.layout,
            controller:this.controller,
            closeMenuPromise:this.closePromise
		    });            
        } else if (text == 'openFile') {
            SuiLoadFileDialog.createAndDisplay({
			layout: this.layout,
            controller:this.controller,
            closeMenuPromise:this.closePromise
		    });
        } else if (text == 'newFile') {
            this.controller.undoBuffer.addBuffer('New Score', 'score', null, this.controller.layout.score);
            var score = SmoScore.getDefaultScore();
            this.controller.layout.score = score;
        }
		this.complete();
	}
	keydown(ev) {}
     
}
class SuiTextMenu extends suiMenuBase {
    	constructor(params) {
		params = (params ? params : {});
		Vex.Merge(params, SuiTextMenu.defaults);
		super(params);
	}
    static get defaults() {
		return {
			menuItems: [{
					icon: '',
					text: 'Title',
					value: 'titleText'
				}, {
					icon: '',
					text: 'Page Header',
					value: 'headerText'
				}, {
					icon: '',
					text: 'Page Footer',
					value: 'footerText'
				}, {
					icon: '',
					text: 'Custom Text',
					value: 'customText'
				}, {
					icon: '',
					text: 'Composer/Copyright',
					value: 'copyrightText'
				}, {
					icon: '',
					text: 'MeasureText',
					value: 'measureText'
				}, {
					icon: '',
					text: 'Rehearsal Mark',
					value: 'rehearsalMark'
				}, {
					icon: '',
					text: 'Tempo',
					value: 'tempoText'
				}, {
					icon: '',
					text: 'Rehearsal Mark',
					value: 'rehearsalMark'
				}, {
                    icon:'',
                    text:'Lyrics',
                    value:'lyrics'
                },
				 {
					icon: '',
					text: 'Cancel',
					value: 'cancel'
				}
			]
		};
	}
    
    static get menuCommandMap() {
        return {
            titleText: {
                ctor:'SmoScoreText',
                operation:'addScoreText',
                params: {
                    position:'title',
                    text:'Title',
                }
            },
            headerText: {
                ctor:'SmoScoreText',
                operation:'addScoreText',
                params: {
                    position:'header',
                    text:'Header text'
                }
            },
            footerText: {
                ctor:'SmoScoreText',
                operation:'addScoreText',
                params: {
                    position:'header',
                    text:'Header text'
                }
            },
            copyrightText: {
                ctor:'SmoScoreText',
                operation:'addScoreText',
                params: {
                    position:'copyright',
                    text:'Copyright/Composer'
                }
            }
        };
    }
    bind() {
    }
    _editNewText(txtObj) {                
        this.tracker.selectId(txtObj.attrs.id);
        // Treat a created text score like a selected text score that needs to be edited.
        $('body').trigger('tracker-select-modifier');
                            
    }
    selection(ev) {
		var command = $(ev.currentTarget).attr('data-value');
        var menuObj = SuiTextMenu.menuCommandMap[command];
        if (menuObj) {
            var ctor = eval(menuObj.ctor);
            var txtObj = new ctor(menuObj.params);
            SmoUndoable.scoreOp(this.editor.score,menuObj.operation,
               txtObj, this.editor.undoBuffer,'Text Menu Command');     
			this._editNewText(txtObj);                
        }

		this.complete();
	}
    keydown(ev) {}
}
class SuiDynamicsMenu extends suiMenuBase {
	constructor(params) {
		params = (params ? params : {});
		Vex.Merge(params, SuiDynamicsMenu.defaults);
		super(params);
	}
	static get defaults() {
		return {
			menuItems: [{
					icon: 'pianissimo',
					text: 'Pianissimo',
					value: 'pp'
				}, {
					icon: 'piano',
					text: 'Piano',
					value: 'p'
				}, {
					icon: 'mezzopiano',
					text: 'Mezzo-piano',
					value: 'mp'
				}, {
					icon: 'mezzoforte',
					text: 'Mezzo-forte',
					value: 'mf'
				}, {
					icon: 'forte',
					text: 'Forte',
					value: 'f'
				}, {
					icon: 'fortissimo',
					text: 'Fortissimo',
					value: 'ff'
				}, {
					icon: 'sfz',
					text: 'sfortzando',
					value: 'sfz'
				},
				 {
					icon: '',
					text: 'Cancel',
					value: 'cancel'
				}
			]
		};
	}
	
	selection(ev) {
		var text = $(ev.currentTarget).attr('data-value');

		var ft = this.tracker.getExtremeSelection(-1);
		if (!ft || !ft.note) {
			return;
		}

		SmoUndoable.addDynamic(ft, new SmoDynamicText({
				selector: ft.selector,
				text: text,
				yOffsetLine: 11,
				fontSize: 38
			}), this.editor.undoBuffer);
		this.complete();
	}
	keydown(ev) {}
}

class SuiTimeSignatureMenu extends suiMenuBase {
    constructor(params) {
		params = (params ? params : {});
		Vex.Merge(params, SuiTimeSignatureMenu.defaults);
		super(params);
	}
    static get defaults() {
		return {
			menuItems: [{
					icon: 'sixeight',
					text: '6/8',
					value: '6/8',
				},{
					icon: 'threefour',
					text: '3/4',
					value: '3/4',
				},{
					icon: 'twofour',
					text: '2/4',
					value: '2/4',
				},{
					icon: 'twelveeight',
					text: '12/8',
					value: '12/8',
				},{
					icon: 'seveneight',
					text: '7/8',
					value: '7/8',
				},{
					icon: 'fiveeight',
					text: '5/8',
					value: '5/8',
				},{
					icon: '',
					text: 'Cancel',
					value: 'cancel'
				}
                ]
        };
    }
    
    selection(ev) {
		var timeSig = $(ev.currentTarget).attr('data-value');
        this.controller.layout.unrenderAll();
        SmoUndoable.scoreSelectionOp(this.controller.layout.score,this.tracker.selections,
            'setTimeSignature',timeSig,this.controller.undoBuffer,'change time signature');
		this.complete();
	}
	keydown(ev) {}
}
class suiKeySignatureMenu extends suiMenuBase {

	constructor(params) {
		params = (params ? params : {});
		Vex.Merge(params, suiKeySignatureMenu.defaults);
		super(params);
	}
	static get defaults() {
		return {
			menuItems: [{
					icon: 'key-sig-c',
					text: 'C Major',
					value: 'C',
				}, {
					icon: 'key-sig-f',
					text: 'F Major',
					value: 'F',
				}, {
					icon: 'key-sig-g',
					text: 'G Major',
					value: 'G',
				}, {
					icon: 'key-sig-bb',
					text: 'Bb Major',
					value: 'Bb'
				}, {
					icon: 'key-sig-d',
					text: 'D Major',
					value: 'D'
				}, {
					icon: 'key-sig-eb',
					text: 'Eb Major',
					value: 'Eb'
				}, {
					icon: 'key-sig-a',
					text: 'A Major',
					value: 'A'
				}, {
					icon: 'key-sig-ab',
					text: 'Ab Major',
					value: 'Ab'
				}, {
					icon: 'key-sig-e',
					text: 'E Major',
					value: 'E'
				}, {
					icon: 'key-sig-bd',
					text: 'Db Major',
					value: 'Db'
				}, {
					icon: 'key-sig-b',
					text: 'B Major',
					value: 'B'
				}, {
					icon: 'key-sig-fs',
					text: 'F# Major',
					value: 'F#'
				}, {
					icon: 'key-sig-cs',
					text: 'C# Major',
					value: 'C#'
				},
				 {
					icon: '',
					text: 'Cancel',
					value: 'cancel'
				}
			],
			menuContainer: '.menuContainer'
		};
	}
    
	selection(ev) {
		var keySig = $(ev.currentTarget).attr('data-value');
		var changed = [];
		this.tracker.selections.forEach((sel) => {
			if (changed.indexOf(sel.selector.measure) === -1) {
				changed.push(sel.selector.measure);
				SmoUndoable.addKeySignature(this.score, sel, keySig, this.editor.undoBuffer);
			}
		});
		this.complete();
	}
	keydown(ev) {}

}

class suiStaffModifierMenu extends suiMenuBase {

	constructor(params) {
		params = (params ? params : {});
		Vex.Merge(params, suiStaffModifierMenu.defaults);
		super(params);
	}
	static get defaults() {
		return {
			menuItems: [{
					icon: 'cresc',
					text: 'Crescendo',
					value: 'crescendo'
				}, {
					icon: 'decresc',
					text: 'Decrescendo',
					value: 'decrescendo'
				}, {
					icon: 'slur',
					text: 'Slur/Tie',
					value: 'slur'
				}, {
					icon: 'ending',
					text: 'nth ending',
					value: 'ending'
				},				
				 {
					icon: '',
					text: 'Cancel',
					value: 'cancel'
				}
			],
			menuContainer: '.menuContainer'
		};
	}
	selection(ev) {
		var op = $(ev.currentTarget).attr('data-value');

		var ft = this.tracker.getExtremeSelection(-1);
		var tt = this.tracker.getExtremeSelection(1);
		
		if (op === 'ending') {
           SmoUndoable.scoreOp(this.score,'addEnding',
		       new SmoVolta({startBar:ft.selector.measure,endBar:tt.selector.measure,number:1}),this.editor.undoBuffer,'add ending');
		    this.complete();
			return;
		}
		if (SmoSelector.sameNote(ft.selector, tt.selector)) {
			this.complete();
			return;
		}

		SmoUndoable[op](ft, tt, this.editor.undoBuffer);
		this.complete();
	}
	keydown(ev) {}
}

class SuiAddStaffMenu extends suiMenuBase {
	constructor(params) {
		params = (params ? params : {});
		Vex.Merge(params, SuiAddStaffMenu.defaults);
		super(params);
	}
	static get defaults() {
		return {
			menuItems: [{
					icon: 'treble',
					text: 'Treble Clef Staff',
					value: 'trebleInstrument'
				}, {
					icon: 'bass',
					text: 'Bass Clef Staff',
					value: 'bassInstrument'
				}, {
					icon: 'alto',
					text: 'Alto Clef Staff',
					value: 'altoInstrument'
				}, {
					icon: 'tenor',
					text: 'Tenor Clef Staff',
					value: 'tenorInstrument'
				}, {
					icon: 'cancel-circle',
					text: 'Remove Staff',
					value: 'remove'
				},
				 {
					icon: '',
					text: 'Cancel',
					value: 'cancel'
				}
			],
			menuContainer: '.menuContainer'
		};
	}
	static get instrumentMap() {
		return {
			'trebleInstrument': {
				instrumentInfo: {
					instrumentName: 'Treble Clef Staff',
					keyOffset: 0,
					clef: 'treble'
				}
			},
			'bassInstrument': {
				instrumentInfo: {
					instrumentName: 'Bass Clef Staff',
					keyOffset: 0,
					clef: 'bass'
				}
			},
			'altoInstrument': {
				instrumentInfo: {
					instrumentName: 'Alto Clef Staff',
					keyOffset: 0,
					clef: 'alto'
				}
			},
			'tenorInstrument': {
				instrumentInfo: {
					instrumentName: 'Tenor Clef Staff',
					keyOffset: 0,
					clef: 'tenor'
				}
			},
			'remove': {
				instrumentInfo: {
					instrumentName: 'Remove clef',
					keyOffset: 0,
					clef: 'tenor'
				}
			}
		}

	}
	selection(ev) {
		var op = $(ev.currentTarget).attr('data-value');
		if (op == 'remove') {
			if (this.score.staves.length > 1 && this.tracker.selections.length > 0) {
				this.tracker.layout.unrenderAll();
				SmoUndoable.removeStaff(this.score, this.tracker.selections[0].selector.staff, this.editor.undoBuffer);
			}

		} else if (op === 'cancel') {
			this.complete();
		}else {
			var instrument = SuiAddStaffMenu.instrumentMap[op];

			SmoUndoable.addStaff(this.score, instrument, this.editor.undoBuffer);
		}
		this.complete();
	}
	keydown(ev) {}

}
;
// ## utController
// a simple controller object to render the unit test cases.
class utController {

	constructor(params) {

		Vex.Merge(this, utController.defaults);
		Vex.Merge(this, params);
		this.bindEvents();
		this.undoBuffer = new UndoBuffer();
	}

	static createUi(score, title) {
		utController.createDom();
		if (title) {
			$('h1.testTitle').text(title);
		}
		var params = {};
		params.layout = suiScoreLayout.createScoreLayout($('#boo')[0],null, score);
		params.tracker = new suiTracker(params.layout);
		// params.tracker = new suiTracker(params.layout);
		params.score = score;
		// params.editor = new suiEditor(params);
		// params.menus = new suiMenuManager(params);
		var keys = new utController(params);
		var h =  window.innerHeight - $('.musicRelief').offset().top;
		$('.musicRelief').css('height',''+h+'px');
		return keys;
	}

	static createDom() {
		var b = htmlHelpers.buildDom;
		$('#smoo').html('');
		var r = b('div').classes('dom-container')
			.append(b('div').classes('modes'))
			.append(b('div').classes('overlay'))
			.append(b('div').classes('attributeDialog'))
			.append(b('div').classes('helpDialog'))
			.append(b('div').classes('menuContainer'))
			.append(b('h1').classes('testTitle').text('Smoosic'))
			.append(b('h2').classes('subTitle'))
			.append(b('div').classes('piano-container')
				.append(b('div').classes('piano-keys')))
			.append(b('div').classes('workspace-container')
				.append(b('div').classes('workspace')
					.append(b('div').classes('controls-top'))
					.append(b('div').classes('controls-left'))
					.append(b('div').classes('musicRelief')
						.append(b('div').classes('musicContainer').attr('id', 'boo')))));
		$('#smoo').append(r.dom());
	}

	get renderElement() {
		return this.layout.renderElement;
	}

	static get defaults() {
		return {};
	}

	detach() {
		this.layout = null;
	}

	render() {
        var ix = 0;
        this.layout.setRefresh();
		while(this.layout.dirty) {
            this.layout.render();
            ix += 1;
            if (ix>20)
                break;
        }
	}

	bindEvents() {}

}
;
class SuiExceptionHandler {
    constructor(params) {
        this.tracker = params.tracker;
        this.layout = params.layout;
        this.score = params.score;
        this.undoBuffer = params.undoBuffer;
		SuiExceptionHandler._instance = this;
    }
	static get instance() {
		return SuiExceptionHandler._instance;
	}
    exceptionHandler(e) {
        var self = this;
        if (suiController.reentry) {
            return;
        }
        suiController.reentry = true;
        var scoreString = 'Could not serialize score.';
        try {
            scoreString = this.score.serialize();
        } catch (e) {
            scoreString += ' ' + e.message;
        }
        var message = e.message;
        var stack = 'No stack trace available';

        try {
            if (e.error && e.error.stack) {
                stack = e.error.stack;
            } else if (e['stack']) {
				stack = e.stack;
			}
        } catch (e) {
            stack = 'Error with stack: ' + e.message;
        }
        var doing = 'Last operation not available.';

        var lastOp = this.undoBuffer.peek();
        if (lastOp) {
            doing = lastOp.title;
        }
        var url = 'https://github.com/AaronDavidNewman/Smoosic/issues';
        var bodyObject = JSON.stringify({
                message: message,
                stack: stack,
                lastOperation: doing,
                scoreString: scoreString
            }, null, ' ');

        var b = htmlHelpers.buildDom;
        var r = b('div').classes('bug-modal').append(
                b('img').attr('src', '../styles/images/logo.png').classes('bug-logo'))
            .append(b('button').classes('icon icon-cross bug-dismiss-button'))
            .append(b('span').classes('bug-title').text('oh nooooo!  You\'ve found a bug'))
            .append(b('p').text('It would be helpful if you would submit a bug report, and copy the data below into an issue'))
            .append(b('div')
                .append(b('textarea').attr('id', 'bug-text-area').text(bodyObject))
                .append(
                    b('div').classes('button-container').append(b('button').classes('bug-submit-button').text('Submit Report'))));

        $('.bugDialog').html('');
        $('.bugDialog').append(r.dom());

        $('.bug-dismiss-button').off('click').on('click', function () {
            $('body').removeClass('bugReport');
            if (lastOp) {
                self.undoBuffer.undo(self.score);
                self.layout.render();
                suiController.reentry = false;
            }
        });
        $('.bug-submit-button').off('click').on('click', function () {
            var data = {
                title: "automated bug report",
                body: encodeURIComponent(bodyObject)
            };
            $('#bug-text-area').select();
            document.execCommand('copy');
            window.open(url, 'Report Smoosic issues');
        });
        $('body').addClass('bugReport');
    }
}
;class defaultEditorKeys {

	static get keys() {
		return [{
				event: "keydown",
				key: "=",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "transposeUp"
			}, {
				event: "keydown",
				key: "-",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "transposeDown"
			}, {
				event: "keydown",
				key: "+",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "upOctave"
			}, {
				event: "keydown",
				key: "_",
				ctrlKey:false,
				altKey: false,
				shiftKey: true,
				action: "downOctave"
			}, {
				event: "keydown",
				key: "F",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "toggleCourtesyAccidental"
			}, {
				event: "keydown",
				key: ".",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "doubleDuration"
			}, {
				event: "keydown",
				key: ",",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "halveDuration"
			}, {
				event: "keydown",
				key: ">",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "dotDuration"
			}, {
				event: "keydown",
				key: "<",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "undotDuration"
			}, {
				event: "keydown",
				key: "a",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "setPitch"
			}, {
				event: "keydown",
				key: "b",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "setPitch"
			}, {
				event: "keydown",
				key: "c",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "setPitch"
			}, {
				event: "keydown",
				key: "d",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "setPitch"
			}, {
				event: "keydown",
				key: "e",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "setPitch"
			}, {
				event: "keydown",
				key: "f",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "setPitch"
			}, {
				event: "keydown",
				key: "g",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "setPitch"
			}, {
				event: "keydown",
				key: "r",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "makeRest"
			}, {
				event: "keydown",
				key: "r",
				ctrlKey: false,
				altKey: true,
				shiftKey: false,
				action: "rerender"
			}, {
				event: "keydown",
				key: "3",
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				action: "makeTuplet"
			}, {
				event: "keydown",
				key: "5",
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				action: "makeTuplet"
			}, {
				event: "keydown",
				key: "7",
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				action: "makeTuplet"
			},
			// interval commands
			{
				event: "keydown",
				key: "2",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "interval"
			}, {
				event: "keydown",
				key: "3",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "interval"
			}, {
				event: "keydown",
				key: "4",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "interval"
			}, {
				event: "keydown",
				key: "5",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "interval"
			}, {
				event: "keydown",
				key: "6",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "interval"
			}, {
				event: "keydown",
				key: "7",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "interval"
			}, {
				event: "keydown",
				key: "8",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "interval"
			}, {
				event: "keydown",
				key: "@",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "interval"
			}, {
				event: "keydown",
				key: "$",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "interval"
			}, {
				event: "keydown",
				key: "#",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "interval"
			}, {
				event: "keydown",
				key: "%",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "interval"
			}, {
				event: "keydown",
				key: "^",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "interval"
			}, {
				event: "keydown",
				key: "&",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "interval"
			}, {
				event: "keydown",
				key: "*",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "interval"
			}, {
				event: "keydown",
				key: "8",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "interval"
			}, {
				event: "keydown",
				key: "0",
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				action: "unmakeTuplet"
			}, {
				event: "keydown",
				key: "Insert",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "addMeasure"
			}, {
				event: "keydown",
				key: "Delete",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "deleteMeasure"
			}, {
				event: "keydown",
				key: "z",
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				action: "undo"
			}, {
				event: "keydown",
				key: "c",
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				action: "copy"
			}, {
				event: "keydown",
				key: "x",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "toggleBeamGroup"
			}, {
				event: "keydown",
				key: "X",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "beamSelections"
			},{
				event: "keydown",
				key: "v",
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				action: "paste"
			}, {
				event: "keydown",
				key: "h",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "addRemoveArticulation"
			}, {
				event: "keydown",
				key: "i",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "addRemoveArticulation"
			}, {
				event: "keydown",
				key: "j",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "addRemoveArticulation"
			}, {
				event: "keydown",
				key: "k",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "addRemoveArticulation"
			}, {
				event: "keydown",
				key: "l",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "addRemoveArticulation"
			}, {
				event: "keydown",
				key: "H",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "addRemoveArticulation"
			}, {
				event: "keydown",
				key: "I",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "addRemoveArticulation"
			}, {
				event: "keydown",
				key: "J",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "addRemoveArticulation"
			}, {
				event: "keydown",
				key: "K",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "addRemoveArticulation"
			}, {
				event: "keydown",
				key: "L",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "addRemoveArticulation"
			},{
				event: "keydown",
				key: "E",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "toggleEnharmonic"
			}
		];
	}

}
;
class defaultTrackerKeys {
	
	static get keys() {
		return [{
				event: "keydown",
				key: "ArrowRight",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "moveSelectionRight"
			}, {
				event: "keydown",
				key: "ArrowRight",
				ctrlKey: false,
				altKey: true,
				shiftKey: false,
				action: "advanceModifierSelection"
			}, {
				event: "keydown",
				key: "ArrowLeft",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "moveSelectionLeft"
			}, {
				event: "keydown",
				key: "ArrowRight",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "growSelectionRight"
			}, {
				event: "keydown",
				key: "ArrowLeft",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "growSelectionLeft"
			}, {
				event: "keydown",
				key: "ArrowUp",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "moveSelectionUp"
			}, {
				event: "keydown",
				key: "ArrowDown",
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				action: "moveSelectionDown"
			}, {
				event: "keydown",
				key: "ArrowRight",
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				action: "moveSelectionRightMeasure"
			}, {
				event: "keydown",
				key: "ArrowLeft",
				ctrlKey: true,
				altKey: false,
				shiftKey: false,
				action: "moveSelectionLeftMeasure"
			},{
				event: "keydown",
				key: "ArrowUp",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "moveSelectionPitchUp"
			},{
				event: "keydown",
				key: "ArrowDown",
				ctrlKey: false,
				altKey: false,
				shiftKey: true,
				action: "moveSelectionPitchDown"
			}
			];
	}
};
class SuiDialogFactory {

	static createDialog(modSelection, context, tracker, layout,undoBuffer) {
		var dbType = SuiDialogFactory.modifierDialogMap[modSelection.modifier.attrs.type];
		var ctor = eval(dbType);
		if (!ctor) {
			console.warn('no dialog for modifier ' + modSelection.modifier.type);
			return;
		}
		return ctor.createAndDisplay({
			modifier: modSelection.modifier,
			selection: modSelection.selection,
			context: context,
			tracker: tracker,
			layout: layout,
            undo:undoBuffer
		});
	}
	static get modifierDialogMap() {
		return {
			SmoStaffHairpin: 'SuiHairpinAttributesDialog',
			SmoSlur: 'SuiSlurAttributesDialog',
			SmoDynamicText: 'SuiTextModifierDialog',
			SmoVolta: 'SuiVoltaAttributeDialog',
            SmoScoreText: 'SuiTextTransformDialog',
            SmoLoadScore:  'SuiLoadFileDialog'
		};
	}
}

class SuiDialogBase {
	constructor(dialogElements, parameters) {
		this.id = parameters.id;
		this.components = [];
		this.closeDialogPromise = new Promise((resolve, reject) => {
				$('body').off('dialogDismiss').on('dialogDismiss', function () {
					resolve();
				});

			});
		this.dialogElements = dialogElements;
		this.dgDom = this._constructDialog(dialogElements, {
				id: 'dialog-' + this.id,
				top: parameters.top,
				left: parameters.left,
				label: parameters.label
			});
	}
	position(box) {
		var y = box.y + box.height;

		// TODO: adjust if db is clipped by the browser.
        var dge = $(this.dgDom.element).find('.attributeModal')
		$(dge).css('top', '' + y + 'px');
        
        var x = box.x;
        var w = $(dge).width();
        x = (x > window.innerWidth /2)  ? x - (w+25) : x + (w+25);
        $(dge).css('left', '' + x + 'px');
	}
	_constructDialog(dialogElements, parameters) {
		var id = parameters.id;
		var b = htmlHelpers.buildDom;
		var r = b('div').classes('attributeModal').css('top', parameters.top + 'px').css('left', parameters.left + 'px')
			.append(b('spanb').classes('draggable button').append(b('span').classes('icon icon-move jsDbMove')))
			.append(b('h2').text(parameters.label));
            
        var ctrl = b('div').classes('smoControlContainer');
		dialogElements.forEach((de) => {
			var ctor = eval(de.control);
			var control = new ctor(this, de);
			this.components.push(control);
			ctrl.append(control.html);
		});
        r.append(ctrl);
		r.append(
			b('div').classes('buttonContainer').append(
				b('button').classes('ok-button button-left').text('OK')).append(
				b('button').classes('cancel-button button-center').text('Cancel')).append(
				b('button').classes('remove-button button-right').text('Remove').append(
					b('span').classes('icon icon-cancel-circle'))));
		$('.attributeDialog').html('');

		$('.attributeDialog').append(r.dom());

		var trapper = htmlHelpers.inputTrapper('.attributeDialog');
		$('.attributeDialog').find('.cancel-button').focus();
		return {
			element: $('.attributeDialog'),
			trapper: trapper
		};
	}

	_commit() {
		this.modifier.restoreOriginal();
		this.components.forEach((component) => {
			this.modifier[component.smoName] = component.getValue();
		});
	}

	complete() {
		$('body').removeClass('showAttributeDialog');
		$('body').trigger('dialogDismiss');
		this.dgDom.trapper.close();
	}

	display() {
		$('body').addClass('showAttributeDialog');
		this.components.forEach((component) => {
			component.bind();
		});
		this._bindElements();
		this.position(this.modifier.renderedBox);

		var cb = function (x, y) {}
		htmlHelpers.draggable({
			parent: $(this.dgDom.element).find('.attributeModal'),
			handle: $(this.dgDom.element).find('.jsDbMove'),
            animateDiv:'.draganime',            
			cb: cb,
			moveParent: true
		});
	}

	_bindElements() {
		var self = this;
		var dgDom = this.dgDom;

		$(dgDom.element).find('.ok-button').off('click').on('click', function (ev) {
			self._commit();
			self.complete();
		});

		$(dgDom.element).find('.cancel-button').off('click').on('click', function (ev) {
			self.modifier.restoreOriginal();
			self.complete();
		});
		$(dgDom.element).find('.remove-button').off('click').on('click', function (ev) {
			self.handleRemove();
			self.complete();
		});
	}
}

class SuiFileDialog extends SuiDialogBase {
     constructor(parameters) {
		if (!(parameters.controller)) {
			throw new Error('file dialog must have score');
		}
		var p = parameters;
        var ctor = eval(parameters.ctor);

		super(ctor.dialogElements, {
			id: 'dialog-layout',
			top: (p.layout.score.layout.pageWidth / 2) - 200,
			left: (p.layout.score.layout.pageHeight / 2) - 200,
			label: 'Score Layout'
		});
        this.startPromise=p.closeMenuPromise;
		this.layout = p.layout;
        this.value='';
		// this.modifier = this.layout.score.layout;
		this.controller = p.controller;
		// this.backupOriginal();
	}
    display() {
        $('body').addClass('showAttributeDialog');
		this.components.forEach((component) => {
			component.bind();
		});		
		this._bindElements();
        
        // make sure keyboard is unbound or we get dupicate key events.
        var self=this;
        function getKeys() {
            self.controller.unbindKeyboardForDialog(self);
        }
        this.startPromise.then(getKeys);        
	}
    _bindElements() {
		var self = this;
		var dgDom = this.dgDom;       

		$(dgDom.element).find('.ok-button').off('click').on('click', function (ev) {
            self.commit();
		});

		$(dgDom.element).find('.cancel-button').off('click').on('click', function (ev) {
			self.complete();	
		});

		$(dgDom.element).find('.remove-button').remove();
	}

    
}
class SuiLoadFileDialog extends SuiFileDialog {
   
    static get dialogElements() {
		return [{
				smoName: 'loadFile',
				parameterName: 'jsonFile',
				defaultValue: '',
				control: 'SuiFileDownloadComponent',
				label:'Load'
			}];
    }    
    
    changed() {
        this.value = this.components[0].getValue();
        $(this.dgDom.element).find('.ok-button').prop('disabled',false);
    }
    commit() {
        var scoreWorks = false;
        var self=this;
        if (this.value) {
            try {
                var score = SmoScore.deserialize(this.value);
                var finish = function() {
                    self.complete();
                }
                scoreWorks=true;
                this.layout.unrenderAll();
                this.layout.score = score;
                this.layout.redraw().then(finish);                  
            } catch (e) {
                console.log('unable to score '+e);
            }
            if (!scoreWorks) {
                this.complete();
            }
        }
    }
    static createAndDisplay(params) {
		var dg = new SuiLoadFileDialog({				
				layout: params.controller.layout,
				controller: params.controller,
                closeMenuPromise:params.closeMenuPromise
			});
		dg.display();
         // disable until file is selected
        $(dg.dgDom.element).find('.ok-button').prop('disabled',true);
	}
    constructor(parameters) {
        parameters.ctor='SuiLoadFileDialog';
        super(parameters);
	}
}

class SuiSaveFileDialog extends SuiFileDialog {
   
    static get dialogElements() {
		return [{
				smoName: 'saveFileName',
				parameterName: 'saveFileName',
				defaultValue: '',
				control: 'SuiTextInputComponent',
				label:'Save'
			}];
    }    
   
    changed() {
        this.value = this.components[0].getValue();        
    }
    commit() {
        var filename = this.value;
        if (!filename) {
            filename='myScore.json';
        }
        if (filename.indexOf('.json') < 0) {
            filename = filename + '.json';
        }
        var txt = this.layout.score.serialize();
        txt = JSON.stringify(txt,null,' ');
        htmlHelpers.addFileLink(filename,txt,$('.saveLink'));
        $('.saveLink a')[0].click();
        this.complete();        
    }   
    static createAndDisplay(params) {
		var dg = new SuiSaveFileDialog({				
				layout: params.controller.layout,
				controller: params.controller,
                closeMenuPromise:params.closeMenuPromise
			});
		dg.display();
	}
    constructor(parameters) {
        parameters.ctor='SuiSaveFileDialog';
        super(parameters);
	}
}
class SuiTextTransformDialog  extends SuiDialogBase {
    static createAndDisplay(parameters) {
		var dg = new SuiTextTransformDialog(parameters);
		dg.display();
        return dg;
	}
    
    static get dialogElements() {
		return [{
				smoName: 'textEditor',
				parameterName: 'text',
				defaultValue: 0,
				control: 'SuiTextInPlace',
				label:'Edit Text',
				options: []
			},{
				smoName: 'textDragger',
				parameterName: 'textLocation',
				defaultValue: 0,
				control: 'SuiDragText',
				label:'Move Text',
				options: []
			},{
				smoName: 'textResizer',
				parameterName: 'textBox',
				defaultValue: 0,
				control: 'SuiResizeTextBox',
				label:'Coming Soon',
				options: []
			},
            {
				smoName: 'x',
				parameterName: 'x',
				defaultValue: 0,
				control: 'SuiRockerComponent',
				label: 'X Position (Px)',
                startRow:true,
				type: 'int'
			},{
				smoName: 'y',
				parameterName: 'y',
				defaultValue: 0,
				control: 'SuiRockerComponent',
				label: 'Y Position (Px)',
                startRow:true,
				type: 'int'
			}, {
				smoName: 'scaleX',
				parameterName: 'scaleX',
				defaultValue: 100,
				control: 'SuiRockerComponent',
				label: 'Horizontal Scale (%)',
                startRow:true,
				type: 'percent'
			}, {
				smoName: 'scaleY',
				parameterName: 'scaleY',
				defaultValue: 100,
				control: 'SuiRockerComponent',
				label: 'Vertical Scale (%)',
                startRow:true,
				type: 'percent'
			}, {
				smoName: 'justification',
				parameterName: 'justification',
				defaultValue: SmoScoreText.justifications.left,
				control: 'SuiDropdownComponent',
				label:'Justification',
                startRow:true,
				options: [{
						value: 'left',
						label: 'Left'
					}, {
						value: 'right',
						label: 'Right'
					}, {
						value: 'center',
						label: 'Center'
					}
				]
			} ,
            {
				smoName: 'fontFamily',
				parameterName: 'fontFamily',
				defaultValue: SmoScoreText.fontFamilies.times,
				control: 'SuiDropdownComponent',
				label:'Font Family',
                startRow:true,
				options: [{value:'serif',label:'Serif'},
                  {value:'sans-serif',label:'Sans-Serif'},
                  {label:'Monospace',value:'monospace'},
                  {label:'Cursive',value:'cursive'},
                  {label:'Times',value:'Times New Roman'},
                  {label:'Arial',value:'Arial'},
                  {label:'Helvetica',value:'Helvetica'}
                  ]
                  
			},
            {
				smoName: 'fontSize',
				parameterName: 'fontSize',
				defaultValue: 1,
				control: 'SuiRockerComponent',
				label: 'Font Size',
				type: 'float',
                increment:0.1
			},
            {
				smoName: 'fontUnit',
				parameterName: 'fontUnit',
				defaultValue: 'em',
				control: 'SuiDropdownComponent',
				label: 'Units',
                options: [{value:'em',label:'em'},{value:'px',label:'px'},{value:'pt',label:'pt'}]
			},
            
            ];
    }
    
    display() {
		$('body').addClass('showAttributeDialog');
		this.components.forEach((component) => {            
			component.bind();
            
            if (component.smoName === 'textDragger') {
                this.textDragger = component;
            }
            if (typeof(component['setValue'])=='function' && this.modifier[component.parameterName]) {
			  component.setValue(this.modifier[component.parameterName]);
            }
		});
        
        var dbFontSize = this.components.find((c) => c.smoName === 'fontSize');
        var dbFontUnit  = this.components.find((c) => c.smoName === 'fontUnit');
        var fontSize = this.modifier.fontInfo.size;
        fontSize=svgHelpers.getFontSize(fontSize);
        dbFontSize.setValue(fontSize.size);
        dbFontUnit.setValue(fontSize.unit);
        
		this._bindElements();
		this.position(this.modifier.renderedBox);

		var cb = function (x, y) {}
		htmlHelpers.draggable({
			parent: $(this.dgDom.element).find('.attributeModal'),
			handle: $(this.dgDom.element).find('span.jsDbMove'),
            animateDiv:'.draganime',
			cb: cb,
			moveParent: true
		});
        if (!this.modifier.edited) {
            this.modifier.edited = true;
            var textEditor = this.components.find((c) => c.smoName === 'textEditor');
            textEditor.startEditSession();
        }
	}
    
    changed() {
        
        var textEditor = this.components.find((c) => c.smoName === 'textEditor');
        this.modifier.text = textEditor.getValue();
        this.components.find((x) => {
            if (typeof(x['getValue'])=='function') {                
                if (x.parameterName.indexOf('scale') == 0) {
                   var val = x.getValue();                    
                    var fcn = x.parameterName+'InPlace';
                    this.modifier[fcn](val);
                } 
            }
		});
        var xcomp = this.components.find((x) => x.smoName === 'x');
        var ycomp = this.components.find((x) => x.smoName === 'y');
        if (this.textDragger.dragging) {
            var val = this.textDragger.getValue();
            xcomp.setValue(val.x);
            ycomp.setValue(val.y);
        } 
        this.modifier.x=xcomp.getValue();
        this.modifier.y=ycomp.getValue();
        
        var fontComp = this.components.find((c) => c.smoName === 'fontFamily');
        this.modifier.fontInfo.family = fontComp.getValue();
        
        var dbFontSize = this.components.find((c) => c.smoName === 'fontSize');
        var dbFontUnit  = this.components.find((c) => c.smoName === 'fontUnit');
        this.modifier.fontInfo.size=''+dbFontSize.getValue()+dbFontUnit.getValue();
        
        // Use layout context because render may have reset svg.
        $(this.layout.context.svg).find('.' + this.modifier.attrs.id).remove();;
        this.layout.renderScoreText(this.modifier);
    }
    

	constructor(parameters) {
		if (!parameters.modifier) {
			throw new Error('modifier attribute dialog must have modifier');
		}

		super(SuiTextTransformDialog.dialogElements, {
			id: 'dialog-' + parameters.modifier.attrs.id,
			top: parameters.modifier.renderedBox.y,
			left: parameters.modifier.renderedBox.x,
			label: 'Text Box Properties'
		});
       
        this.undo = parameters.undo;
        // Do we jump right into editing?
        this.textElement=$(parameters.context.svg).find('.' + parameters.modifier.attrs.id)[0];
		Vex.Merge(this, parameters);
        this.modifier.backupParams();
	}
    _commit() {
        
    }
    _bindElements() {
        var self = this;
		var dgDom = this.dgDom;
        var textEditor = this.components.find((c) => c.smoName === 'textEditor');
        var textDragger = this.components.find((c) => c.smoName === 'textDragger');
        var fontComp = this.components.find((c) => c.smoName === 'fontFamily');

        fontComp.setValue(this.modifier.fontInfo.family);


		$(dgDom.element).find('.ok-button').off('click').on('click', function (ev) {
            textEditor.endSession();
            textDragger.endSession();
			self.complete();
		});

		$(dgDom.element).find('.cancel-button').off('click').on('click', function (ev) {
            textEditor.endSession();
            textDragger.endSession();
            self.modifier.restoreParams();
			self.complete();
		});
		$(dgDom.element).find('.remove-button').off('click').on('click', function (ev) {
            textEditor.endSession();
            textDragger.endSession();
            SmoUndoable.scoreOp(self.layout.score,'removeScoreText',self.modifier,self.undo,'remove text from dialog');
			self.complete();
		});
    }
}
class SuiLayoutDialog extends SuiDialogBase {
	static get attributes() {
		return ['pageWidth', 'pageHeight', 'leftMargin', 'topMargin', 'rightMargin', 'interGap', 'intraGap', 'zoomScale', 'svgScale'];
	}
	static get dialogElements() {
		return [{
				smoName: 'pageSize',
				parameterName: 'pageSize',
				defaultValue: SmoScore.pageSizes.letter,
				control: 'SuiDropdownComponent',
				label:'Page Size',
				options: [{
						value: 'letter',
						label: 'Letter'
					}, {
						value: 'tabloid',
						label: 'Tabloid (11x17)'
					}, {
						value: 'A4',
						label: 'A4'
					}, {
						value: 'custom',
						label: 'Custom'
					}
				]
			}, {
				smoName: 'pageWidth',
				parameterName: 'pageWidth',
				defaultValue: SmoScore.defaults.layout.pageWidth,
				control: 'SuiRockerComponent',
				label: 'Page Width (px)'
			}, {
				smoName: 'pageHeight',
				parameterName: 'pageHeight',
				defaultValue: SmoScore.defaults.layout.pageHeight,
				control: 'SuiRockerComponent',
				label: 'Page Height (px)'
			}, {
				smoName: 'orientation',
				parameterName: 'orientation',
				defaultValue: SmoScore.orientations.portrait,
				control: 'SuiDropdownComponent',
				label: 'Orientation',
				dataType:'int',
				options:[{
					value:SmoScore.orientations.portrait,
					label:'Portrait'
				}, {
					value:SmoScore.orientations.landscape,
					label:'Landscape'
				}]
			}, {
				smoName: 'leftMargin',
				parameterName: 'leftMargin',
				defaultValue: SmoScore.defaults.layout.leftMargin,
				control: 'SuiRockerComponent',
				label: 'Left Margin (px)'
			}, {
				smoName: 'rightMargin',
				parameterName: 'rightMargin',
				defaultValue: SmoScore.defaults.layout.rightMargin,
				control: 'SuiRockerComponent',
				label: 'Right Margin (px)'
			}, {
				smoName: 'topMargin',
				parameterName: 'topMargin',
				defaultValue: SmoScore.defaults.layout.topMargin,
				control: 'SuiRockerComponent',
				label: 'Top Margin (px)'
			}, {
				smoName: 'interGap',
				parameterName: 'interGap',
				defaultValue: SmoScore.defaults.layout.interGap,
				control: 'SuiRockerComponent',
				label: 'Inter-System Margin'
			}, {
				smoName: 'intraGap',
				parameterName: 'intraGap',
				defaultValue: SmoScore.defaults.layout.intraGap,
				control: 'SuiRockerComponent',
				label: 'Intra-System Margin'
			}, {
				smoName: 'zoomScale',
				parameterName: 'zoomScale',
				defaultValue: SmoScore.defaults.layout.zoomScale,
				control: 'SuiRockerComponent',
				label: '% Zoom',
				type: 'percent'
			}, {
				smoName: 'svgScale',
				parameterName: 'svgScale',
				defaultValue: SmoScore.defaults.layout.svgScale,
				control: 'SuiRockerComponent',
				label: '% Note size',
				type: 'percent'
			}
		];
	}
	backupOriginal() {
		this.backup = JSON.parse(JSON.stringify(this.modifier));;
	}
	display() {
		$('body').addClass('showAttributeDialog');
		this.components.forEach((component) => {
			component.bind();
		});
		this.components.forEach((component) => {
			var val = this.modifier[component.parameterName];
			component.setValue(val);
		});
		this._setPageSizeDefault();
		this._bindElements();

		var cb = function (x, y) {}
		htmlHelpers.draggable({
			parent: $(this.dgDom.element).find('.attributeModal'),
			handle: $(this.dgDom.element).find('.icon-move'),
            animateDiv:'.draganime',            
			cb: cb,
			moveParent: true
		});
		this.controller.unbindKeyboardForDialog(this);

	}
	_handleCancel() {
		this.layout.score.layout = this.backup;
		this.layout.setViewport();
		this.complete();
	}
	_bindElements() {
		var self = this;
		var dgDom = this.dgDom;

		$(dgDom.element).find('.ok-button').off('click').on('click', function (ev) {
			self.layout.setViewport();
			self.complete();			
		});

		$(dgDom.element).find('.cancel-button').off('click').on('click', function (ev) {
			self._handleCancel();	
		});

		$(dgDom.element).find('.remove-button').remove();
	}
	_setPageSizeDefault() {
		var value = 'custom';
		var scoreDims = this.layout.score.layout;
		SmoScore.pageSizes.forEach((sz) => {
			var dim = SmoScore.pageDimensions[sz];
			if (scoreDims.pageWidth === dim.width && scoreDims.pageHeight === dim.height) {
				value = sz;
			} else if (scoreDims.pageHeight === dim.width && scoreDims.pageWidth === dim.height) {
				value = sz;
			}
		});
		this.components.find((x)=>{return x.parameterName==='pageSize'}).setValue(value);
	}
	_handlePageSizeChange() {
		var pageSizeComp = this.components.find((x)=>{return x.parameterName==='pageSize'});
		var sel = pageSizeComp.getValue();
		if (sel === 'custom') {
			$('.attributeModal').addClass('customPage');			
		} else {
			$('.attributeModal').removeClass('customPage');
			var dim = SmoScore.pageDimensions[sel];
			var hComp = this.components.find((x)=>{return x.parameterName==='pageHeight'});
			var wComp = this.components.find((x)=>{return x.parameterName==='pageWidth'});
			hComp.setValue(dim.height);
			wComp.setValue(dim.width);			
		}		
	}
	changed() {
		// this.modifier.backupOriginal();
		this._handlePageSizeChange();
		this.components.forEach((component) => {
			this.layout.score.layout[component.smoName] = component.getValue();
		});
		this.layout.setViewport();
	}
	static createAndDisplay(buttonElement, buttonData, controller) {
		var dg = new SuiLayoutDialog({				
				layout: controller.layout,
				controller: controller
			});
		dg.display();
	}
	constructor(parameters) {
		if (!(parameters.layout && parameters.controller)) {
			throw new Error('layout  dialog must have score');
		}
		var p = parameters;

		super(SuiLayoutDialog.dialogElements, {
			id: 'dialog-layout',
			top: (p.layout.score.layout.pageWidth / 2) - 200,
			left: (p.layout.score.layout.pageHeight / 2) - 200,
			label: 'Score Layout'
		});
		this.layout = p.layout;
		this.modifier = this.layout.score.layout;
		this.controller = p.controller;
		this.backupOriginal();
	}
}

class SuiTextModifierDialog extends SuiDialogBase {
	static get dialogElements() {
		return [{
				smoName: 'yOffsetLine',
				parameterName: 'yOffsetLine',
				defaultValue: 11,
				control: 'SuiRockerComponent',
				label: 'Y Line'
			}, {
				smoName: 'yOffsetPixels',
				parameterName: 'yOffsetPixels',
				defaultValue: 0,
				control: 'SuiRockerComponent',
				label: 'Y Offset Px'
			}, {
				smoName: 'xOffset',
				parameterName: 'yOffset',
				defaultValue: 0,
				control: 'SuiRockerComponent',
				label: 'X Offset'
			}, {
				smoName: 'text',
				parameterName: 'text',
				defaultValue: SmoDynamicText.dynamics.P,
				options: [{
						value: SmoDynamicText.dynamics.P,
						label: 'Piano'
					}, {
						value: SmoDynamicText.dynamics.PP,
						label: 'Pianissimo'
					}, {
						value: SmoDynamicText.dynamics.MP,
						label: 'Mezzo-Piano'
					}, {
						value: SmoDynamicText.dynamics.MF,
						label: 'Mezzo-Forte'
					}, {
						value: SmoDynamicText.dynamics.F,
						label: 'Forte'
					}, {
						value: SmoDynamicText.dynamics.FF,
						label: 'Fortissimo'
					}, {
						value: SmoDynamicText.dynamics.SFZ,
						label: 'Sforzando'
					}
				],
				control: 'SuiDropdownComponent',
				label: 'Text'
			}
		];
	}
	static createAndDisplay(parameters) {
		var dg = new SuiTextModifierDialog(parameters);
		dg.display();
		return dg;
	}

	constructor(parameters) {
		if (!parameters.modifier || !parameters.selection) {
			throw new Error('modifier attribute dialog must have modifier and selection');
		}

		super(SuiTextModifierDialog.dialogElements, {
			id: 'dialog-' + parameters.modifier.id,
			top: parameters.modifier.renderedBox.y,
			left: parameters.modifier.renderedBox.x,
			label: 'Dynamics Properties'
		});
		Vex.Merge(this, parameters);
		this.components.find((x) => {
			return x.parameterName == 'text'
		}).defaultValue = parameters.modifier.text;
	}
	handleRemove() {
		$(this.context.svg).find('g.' + this.modifier.id).remove();
        this.undo.addBuffer('remove dynamic', 'measure', this.selection.selector, this.selection.measure);
		this.selection.note.removeModifier(this.modifier);
		this.tracker.clearModifierSelections();
	}
	changed() {
		this.modifier.backupOriginal();
		this.components.forEach((component) => {
			this.modifier[component.smoName] = component.getValue();
		});
		this.layout.renderNoteModifierPreview(this.modifier);
	}
}

class helpModal {
	constructor() {}
	static createAndDisplay() {
		SmoHelp.displayHelp();
		return htmlHelpers.closeDialogPromise();
	}
}
;// # dbComponents - components of modal dialogs.

// ## SuiRockerComponent
// A numeric input box with +- buttons.   Adjustable type and scale
class SuiRockerComponent {
	static get dataTypes() {
		return ['int','float','percent'];
	}
	static get increments() {
		return {'int':1,'float':0.1,'percent':10}
	}
	static get parsers() {
		return {'int':'_getIntValue','float':'_getFloatValue','percent':'_getPercentValue'};
	}
    constructor(dialog, parameter) {
        smoMusic.filteredMerge(
            ['parameterName', 'smoName', 'defaultValue', 'control', 'label','increment','type'], parameter, this);
        if (!this.defaultValue) {
            this.defaultValue = 0;
        }
		if (!this.type) {
			this.type='int';
		}
		if (!this.increment) {
		    this.increment = SuiRockerComponent.increments[this.type];	
		}
		if (SuiRockerComponent.dataTypes.indexOf(this.type) < 0) {
			throw new Error('dialog element invalid type '+this.type);
		}
        
        this.id = this.id ? this.id : '';
		
		if (this.type === 'percent') {
			this.defaultValue = 100*this.defaultValue;
		}
		this.parser=SuiRockerComponent.parsers[this.type];
        this.dialog = dialog;
    }

    get html() {
        var b = htmlHelpers.buildDom;
        var id = this.parameterId;
        var r = b('div').classes('rockerControl smoControl').attr('id', id).attr('data-param', this.parameterName)
            .append(
                b('button').classes('increment').append(
                    b('span').classes('icon icon-circle-up'))).append(
                b('button').classes('decrement').append(
                    b('span').classes('icon icon-circle-down'))).append(
                b('input').attr('type', 'text').classes('rockerInput')
                .attr('id', id + '-input')).append(
                b('label').attr('for', id + '-input').text(this.label));
        return r;
    }

    get parameterId() {
        return this.dialog.id + '-' + this.parameterName;
    }

    bind() {
        var dialog = this.dialog;
        var pid = this.parameterId;
        var input = this._getInputElement();
        this.setValue(this.defaultValue);
        var self = this;
        $('#' + pid).find('button.increment').off('click').on('click',
            function (ev) {
            var val = self[self.parser]();
			if (self.type === 'percent') {
			    val = 100*val;
     		}
            $(input).val(val + self.increment);
            dialog.changed();
        });
        $('#' + pid).find('button.decrement').off('click').on('click',
            function (ev) {
            var val = self[self.parser]();
			if (self.type === 'percent') {
			    val = 100*val;
     		}
            $(input).val(val - self.increment);
            dialog.changed();
        });
        $(input).off('blur').on('blur',
            function (ev) {
            dialog.changed();
        });
    }

    _getInputElement() {
        var pid = this.parameterId;
        return $(this.dialog.dgDom.element).find('#' + pid).find('input');
    }
    _getIntValue() {
        var pid = this.parameterId;
        var val = parseInt(this._getInputElement().val());
        val = isNaN(val) ? 0 : val;
        return val;
    }
	 _getFloatValue() {
        var pid = this.parameterId;
        var val = parseFloat(this._getInputElement().val());
        val = isNaN(val) ? 1.0 : val;
        return val;
    }
	_getPercentValue() {
        var pid = this.parameterId;
        var val = parseFloat(this._getInputElement().val());
        val = isNaN(val) ? 1 : val;
        return val/100;
	}
    _setIntValue(val) {
        this._getInputElement().val(val);
    }
    setValue(value) {
		if (this.type === 'percent') {
			value = value * 100;
		}
        this._setIntValue(value);
    }
    getValue() {
        return this[this.parser]();
    }
}

// ## SuiDragText
// A component that lets you drag the text you are editing to anywhere on the score.
// The text is not really part of the dialog but the location of the text appears 
// in other dialog fields. 
class SuiDragText {
    constructor(dialog,parameter) {
        smoMusic.filteredMerge(
            ['parameterName', 'smoName', 'defaultValue', 'control', 'label'], parameter, this);
        if (!this.defaultValue) {
            this.defaultValue = 0;
        }
        this.dragging=false;

        this.dialog = dialog;
        this.value='';        
    }
    
    get html() {
        var b = htmlHelpers.buildDom;
        var id = this.parameterId;
        var r = b('div').classes('cbDragTextDialog smoControl').attr('id', this.parameterId).attr('data-param', this.parameterName)
            .append(b('button').attr('type', 'checkbox').classes('toggleTextEdit')
                .attr('id', id + '-input').append(
                b('span').classes('icon icon-move'))
                .append(
                b('label').attr('for', id + '-input').text(this.label)));
        return r;
    }
    get parameterId() {
        return this.dialog.id + '-' + this.parameterName;
    }
    endSession() {
        if (this.editor) {
          this.dragging = false;
          this.editor.endSession();
          this.dragger.disconnect();
          var button = document.getElementById(this.parameterId);
          $(button).find('span.icon').removeClass('icon-checkmark').addClass('icon-move');
          $('.dom-container .textEdit').addClass('hide').removeClass('icon-move');
          this.editor = null;
           
        }
    }
    getValue() {
        return this.value;
    }
    _getInputElement() {
        var pid = this.parameterId;
        return $(this.dialog.dgDom.element).find('#' + pid).find('button');
    }
    _handleEndDrag() {
        var svgBox = svgHelpers.clientToLogical(this.dialog.layout.svg,svgHelpers.smoBox(this.editor.editText.getBoundingClientRect()));                
        var offsetBox = this.editor.editText.getBBox();
        var x = svgBox.x;
        var y = svgBox.y+svgBox.height-offsetBox.y;
        this.textElement.setAttributeNS('', 'x', '' + x);
        this.textElement.setAttributeNS('', 'y', '' + y);
        this.value = {x:x,y:y};        
        this.dialog.changed();
    }
    startDrag() {
        if (!this.dragging) {
        var self=this;
        this.dragging = true;
        var dragCb = function() {
            self._handleEndDrag();
        }
        var draggingCb = function() {
            self._handleDragging();
        }
        this.textElement=$(this.dialog.layout.svg).find('.'+this.dialog.modifier.attrs.id)[0];
        var value = this.textElement.getBBox();
        this.value = {x:value.x,y:value.y};
        this.editor = new editSvgText({target:this.textElement,layout:this.dialog.layout,fontInfo:this.fontInfo});
        var button = document.getElementById(this.parameterId);
        $(button).find('span.icon').removeClass('icon-move').addClass('icon-checkmark');
        $('.textEdit').removeClass('hide');
        $('.textEdit span.icon-move').removeClass('hide');
        this.dragger = htmlHelpers.draggable({
			parent: $('.dom-container .textEdit'),
			handle: $('.dom-container .textEdit'),
            animateDiv:'.draganime',            
			cb: dragCb,
            draggingCb:draggingCb,
			moveParent: true,
            dragParent: true
		});
        } else {
          this.endSession();
        }
    }
 
    bind() {
        var self=this;
        this.textElement=$(this.dialog.layout.svg).find('.'+this.dialog.modifier.attrs.id)[0];
        this.fontInfo = JSON.parse(JSON.stringify(this.dialog.modifier.fontInfo));
        this.value = this.textElement.textContent;
        $(this._getInputElement()).off('click').on('click',function(ev) {
            self.startDrag();
        });
    }
}

// ## TBD: do this.
class SuiResizeTextBox {
    constructor(dialog,parameter) {
        smoMusic.filteredMerge(
            ['parameterName', 'smoName', 'defaultValue', 'control', 'label'], parameter, this);
        if (!this.defaultValue) {
            this.defaultValue = 0;
        }
        this.editMode=false;

        this.dialog = dialog;
        this.value='';        
    }
    
    get html() {
        var b = htmlHelpers.buildDom;
        var id = this.parameterId;
        var r = b('div').classes('cbResizeTextBox smoControl').attr('id', this.parameterId).attr('data-param', this.parameterName)
            .append(b('button').attr('type', 'checkbox').classes('toggleTextEdit')
                .attr('id', id + '-input').append(
                b('span').classes('icon icon-enlarge'))
                .append(
                b('label').attr('for', id + '-input').text(this.label)));
        return r;
    }
    get parameterId() {
        return this.dialog.id + '-' + this.parameterName;
    }
    endSession() {
        if (this.editor) {
            this.value=this.editor.value;
            this.editor.endSession();
        }
    }
    getValue() {
        return this.value;
    }
    _getInputElement() {
        var pid = this.parameterId;
        return $(this.dialog.dgDom.element).find('#' + pid).find('button');
    }
    startEditSession() {
        var self=this;
        if (!this.editor) {
          this.textElement=$(this.dialog.layout.svg).find('.'+this.dialog.modifier.attrs.id)[0];
          this.value = this.textElement.textContent;            
          this.editor = new editSvgText({target:this.textElement,layout:this.dialog.layout,fontInfo:this.fontInfo});
          var button = document.getElementById(this.parameterId);
          $(button).find('span.icon').removeClass('icon-pencil').addClass('icon-checkmark');
          this.editor.startSessionPromise().then(function() {
              self.value=self.editor.value;
              self.editor=null;
          });
        } else {
          var button = document.getElementById(this.parameterId);
          this.value=this.editor.value;
          $(button).find('span.icon').removeClass('icon-checkmark').addClass('icon-pencil');
          this.editor.endSession();
          this.dialog.changed();
        }
    }
 
    bind() {
        var self=this;
        this.textElement=$(this.dialog.layout.svg).find('.'+this.dialog.modifier.attrs.id)[0];
        this.fontInfo = JSON.parse(JSON.stringify(this.dialog.modifier.fontInfo));
        this.value = this.textElement.textContent;
        $(this._getInputElement()).off('click').on('click',function(ev) {
            self.startEditSession();
        });
    }
}

// ## SuiTextInPlace
// Edit the text in an SVG element, in the same scale etc. as the text in the score SVG DOM.
// This component just manages the text editing component of hte renderer.
class SuiTextInPlace {
    constructor(dialog,parameter) {
        smoMusic.filteredMerge(
            ['parameterName', 'smoName', 'defaultValue', 'control', 'label'], parameter, this);
        if (!this.defaultValue) {
            this.defaultValue = 0;
        }
        this.editMode=false;

        this.dialog = dialog;
        this.value='';        
    }
    
    get html() {
        var b = htmlHelpers.buildDom;
        var id = this.parameterId;
        var r = b('div').classes('cbTextInPlace smoControl').attr('id', this.parameterId).attr('data-param', this.parameterName)
            .append(b('button').attr('type', 'checkbox').classes('toggleTextEdit')
                .attr('id', id + '-input').append(
                b('span').classes('icon icon-pencil'))
                .append(
                b('label').attr('for', id + '-input').text(this.label)));
        return r;
    }
    get parameterId() {
        return this.dialog.id + '-' + this.parameterName;
    }
    endSession() {
        if (this.editor) {
            this.value=this.editor.value;
            this.editor.endSession();
        }
    }
    getValue() {
        return this.value;
    }
    _getInputElement() {
        var pid = this.parameterId;
        return $(this.dialog.dgDom.element).find('#' + pid).find('button');
    }
    startEditSession() {
        var self=this;
        if (!this.editor) {
          this.textElement=$(this.dialog.layout.svg).find('.'+this.dialog.modifier.attrs.id)[0];
          this.value = this.textElement.textContent;            
          this.editor = new editSvgText({target:this.textElement,layout:this.dialog.layout,fontInfo:this.fontInfo});
          var button = document.getElementById(this.parameterId);
          $(button).find('span.icon').removeClass('icon-pencil').addClass('icon-checkmark');
          this.editor.startSessionPromise().then(function() {
              self.value=self.editor.value;
              self.editor=null;
          });
        } else {
          var button = document.getElementById(this.parameterId);
          this.value=this.editor.value;
          $(button).find('span.icon').removeClass('icon-checkmark').addClass('icon-pencil');
          this.editor.endSession();
          this.dialog.changed();
        }
    }
 
    bind() {
        var self=this;
        this.textElement=$(this.dialog.layout.svg).find('.'+this.dialog.modifier.attrs.id)[0];
        this.fontInfo = JSON.parse(JSON.stringify(this.dialog.modifier.fontInfo));
        this.value = this.textElement.textContent;
        $(this._getInputElement()).off('click').on('click',function(ev) {
            self.startEditSession();
        });
    }
}

// ## SuiTextInputComponent
// Just get text from an input, such as a filename.
class SuiTextInputComponent {
    constructor(dialog, parameter) {
        smoMusic.filteredMerge(
            ['parameterName', 'smoName', 'defaultValue', 'control', 'label'], parameter, this);
        if (!this.defaultValue) {
            this.defaultValue = 0;
        }
        this.dialog = dialog;
        this.value='';
    }
    get parameterId() {
        return this.dialog.id + '-' + this.parameterName;
    }
    get html() {
        var b = htmlHelpers.buildDom;
        var id = this.parameterId;
        var r = b('div').classes('select-file').attr('id', this.parameterId).attr('data-param', this.parameterName)
            .append(b('input').attr('type', 'text').classes('file-name')
                .attr('id', id + '-input')).append(
                b('label').attr('for', id + '-input').text(this.label));
        return r;
    }
    
    getValue() {
        return this.value;
    }
    bind() {
        var self=this;
        $('#'+this.parameterId).find('input').off('change').on('change',function(e) {
            self.value = $(this).val();
            self.dialog.changed();
        });
    }    
}

// ## SuiFileDownloadComponent
// Download a test file using the file input.
class SuiFileDownloadComponent {
    constructor(dialog, parameter) {
        smoMusic.filteredMerge(
            ['parameterName', 'smoName', 'defaultValue', 'control', 'label'], parameter, this);
        if (!this.defaultValue) {
            this.defaultValue = 0;
        }
        this.dialog = dialog;
        this.value='';
    }
    get parameterId() {
        return this.dialog.id + '-' + this.parameterName;
    }
    get html() {
        var b = htmlHelpers.buildDom;
        var id = this.parameterId;
        var r = b('div').classes('select-file').attr('id', this.parameterId).attr('data-param', this.parameterName)
            .append(b('input').attr('type', 'file').classes('file-button')
                .attr('id', id + '-input')).append(
                b('label').attr('for', id + '-input').text(this.label));
        return r;
    }
    
    _handleUploadedFiles(evt)  {
        var reader = new FileReader();
        var self=this;
        reader.onload = function(file) {
            self.value = file.target.result;
            self.dialog.changed();
        }
        reader.readAsText(evt.target.files[0]);
    }
    getValue() {
        return this.value;
    }
    bind() {
        var self=this;
        $('#'+this.parameterId).find('input').off('change').on('change',function(e) {
            self._handleUploadedFiles(e);
        });
    }
    
}

// ## SuiToggleComponent
// Simple on/off behavior
class SuiToggleComponent {
    constructor(dialog, parameter) {
        smoMusic.filteredMerge(
            ['parameterName', 'smoName', 'defaultValue', 'control', 'label'], parameter, this);
        if (!this.defaultValue) {
            this.defaultValue = 0;
        }
        this.dialog = dialog;
    }
    get html() {
        var b = htmlHelpers.buildDom;
        var id = this.parameterId;
        var r = b('div').classes('toggleControl smoControl').attr('id', this.parameterId).attr('data-param', this.parameterName)
            .append(b('input').attr('type', 'checkbox').classes('toggleInput')
                .attr('id', id + '-input')).append(
                b('label').attr('for', id + '-input').text(this.label));
        return r;
    }
    _getInputElement() {
        var pid = this.parameterId;
        return $(this.dialog.dgDom.element).find('#' + pid).find('input');
    }
    get parameterId() {
        return this.dialog.id + '-' + this.parameterName;
    }

    setValue(value) {
        $(this._getInputElement()).prop('checked', value);
    }
    getValue() {
        return $(this._getInputElement()).prop('checked');
    }

    bind() {
        var dialog = this.dialog;
        var pid = this.parameterId;
        var input = this._getInputElement();
        this.setValue(this.defaultValue);
        var self = this;
        $(input).off('change').on('change',
            function (ev) {
            dialog.changed();
        });
    }
}

class SuiDropdownComponent {
    constructor(dialog, parameter) {
        smoMusic.filteredMerge(
            ['parameterName', 'smoName', 'defaultValue', 'options', 'control', 'label','dataType'], parameter, this);
        if (!this.defaultValue) {
            this.defaultValue = 0;
        }
		if (!this.dataType) {
			this.dataType = 'string';
		}

        this.dialog = dialog;
    }

    get parameterId() {
        return this.dialog.id + '-' + this.parameterName;
    }

    get html() {
        var b = htmlHelpers.buildDom;
        var id = this.parameterId;
        var r = b('div').classes('dropdownControl smoControl').attr('id', id).attr('data-param', this.parameterName);
        var s = b('select');
        this.options.forEach((option) => {
            s.append(
                b('option').attr('value', option.value).text(option.label));
        });
        r.append(s).append(
            b('label').attr('for', id + '-input').text(this.label));

        return r;
    }

    _getInputElement() {
        var pid = this.parameterId;
        return $(this.dialog.dgDom.element).find('#' + pid).find('select');
    }
    getValue() {
        var input = this._getInputElement();
        var option = this._getInputElement().find('option:selected');
		var val = $(option).val();
		val = (this.dataType.toLowerCase() === 'int') ?	parseInt(val) : val;
		val = (this.dataType.toLowerCase() === 'float') ?	parseFloat(val) : val;
        return val;
    }
    setValue(value) {
        var input = this._getInputElement();
        $(input).val(value);
    }

    bind() {
        var dialog = this.dialog;
        var pid = this.parameterId;
        var input = this._getInputElement();
        this.setValue(this.defaultValue);
        var self = this;
        $(input).off('change').on('change',
            function (ev) {
            dialog.changed();
        });
    }
}
;

class defaultRibbonLayout {

	static get ribbons() {
		var left = defaultRibbonLayout.leftRibbonIds;
		var top = defaultRibbonLayout.noteButtonIds.concat(defaultRibbonLayout.navigateButtonIds).concat(defaultRibbonLayout.articulateButtonIds)
		    .concat(defaultRibbonLayout.intervalIds).concat(defaultRibbonLayout.durationIds).concat(defaultRibbonLayout.measureIds)
              .concat(defaultRibbonLayout.textIds).concat(defaultRibbonLayout.debugIds);
			
		return {
			left: left,
			top:top
		};
	}
	
	static get ribbonButtons() {
		return defaultRibbonLayout.leftRibbonButtons.concat(
			defaultRibbonLayout.navigationButtons).concat(
			defaultRibbonLayout.noteRibbonButtons).concat(
			defaultRibbonLayout.articulationButtons).concat(
			defaultRibbonLayout.chordButtons).concat(
			defaultRibbonLayout.durationRibbonButtons).concat(defaultRibbonLayout.measureRibbonButtons)
            .concat(defaultRibbonLayout.textRibbonButtons).concat(defaultRibbonLayout.debugRibbonButtons);
	}
	
	static get leftRibbonIds() {
		return ['helpDialog', 'fileMenu','addStaffMenu', 'timeSignatureMenu','keyMenu', 'staffModifierMenu', 'staffModifierMenu2','pianoModal','layoutModal'];
	}
	static get noteButtonIds() {
		return ['NoteButtons', 'ANoteButton', 'BNoteButton', 'CNoteButton', 'DNoteButton', 'ENoteButton', 'FNoteButton', 'GNoteButton','ToggleRestButton',
				'UpNoteButton', 'DownNoteButton', 'UpOctaveButton', 'DownOctaveButton', 'ToggleRest','ToggleAccidental', 'ToggleCourtesy'];
	}	
	static get navigateButtonIds()  {
		return ['NavigationButtons', 'navLeftButton', 'navRightButton', 'navUpButton', 'navDownButton', 'navFastForward', 'navRewind',
				'navGrowLeft', 'navGrowRight'];
	}
	
	static get articulateButtonIds()  {
		return ['articulationButtons', 'accentAboveButton', 'accentBelowButton', 'tenutoAboveButton', 'tenutoBelowButton',
				'staccatoAboveButton', 'staccatoBelowButton', 'marcatoAboveButton', 'marcatoBelowButton', 'pizzicatoAboveButton', 'pizzicatoBelowButton'];
	}
	
	static get intervalIds()  {
		return ['CreateChordButtons', 'SecondUpButton', 'SecondDownButton', 'ThirdUpButton', 'ThirdDownButton', 'FourthUpButton', 'FourthDownButton',
				'FifthUpButton', 'FifthDownButton','SixthUpButton', 'SixthDownButton'
				,'SeventhUpButton', 'SeventhDownButton','OctaveUpButton','OctaveDownButton','CollapseChordButton'];
	}
	
	static get debugIds() {
		return ['DebugGroup','DebugButton2'];
	}
	static get durationIds() {
		return ['DurationButtons','GrowDuration','LessDuration','GrowDurationDot','LessDurationDot','TripletButton','QuintupletButton','SeptupletButton','NoTupletButton'];
	}
	static get measureIds() {
		return ['MeasureButtons','endRepeat','startRepeat','endBar','doubleBar','singleBarEnd','singleBarStart','nthEnding','dcAlCoda','dsAlCoda','dcAlFine','dsAlFine','coda','toCoda','segno','toSegno','fine'];
	}
    
    static get textIds() {
		return ['TextButtons','addTextMenu','rehearsalMark','lyrics','addDynamicsMenu'];
	}
    
    static get textRibbonButtons() {
        return [
        {
			leftText: '',
				rightText: '',
				classes: 'icon  collapseParent measure',
				icon: 'icon-text',
				action: 'collapseParent',
				ctor: 'CollapseRibbonControl',
				group: 'textEdit',
				id: 'TextButtons'			
		},
        {
                leftText: '',
				rightText: '/t',
				classes: 'icon collapsed textButton',
				icon: 'icon-textBasic',
				action: 'collapseChild',
				ctor: 'TextButtons',
				group: 'textEdit',
				id: 'addTextMenu'		
		},{
                leftText: '',
				rightText: '',
				classes: 'icon collapsed textButton',
				icon: 'icon-rehearsemark',
				action: 'collapseChild',
				ctor: 'TextButtons',
				group: 'textEdit',
				id: 'rehearsalMark'		
		},{
                leftText: '',
				rightText: '',
				classes: 'icon collapsed textButton',
				icon: 'icon-lyric',
				action: 'collapseChild',
				ctor: 'TextButtons',
				group: 'textEdit',
				id: 'lyrics'		
		} ,{
                leftText: '',
				rightText: '/d',
				classes: 'icon collapsed textButton',
				icon: 'icon-mezzopiano',
				action: 'collapseChild',
				ctor: 'TextButtons',
				group: 'textEdit',
				id: 'addDynamicsMenu'		
		} 
        ];
    }
	
	static get measureRibbonButtons() {
		return [{
			leftText: '',
				rightText: '',
				classes: 'icon  collapseParent measure',
				icon: 'icon-end_rpt',
				action: 'collapseParent',
				ctor: 'CollapseRibbonControl',
				group: 'measure',
				id: 'MeasureButtons'			
		},{
				leftText: '',
				rightText: '',
				icon: 'icon-end_rpt',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'endRepeat'
			},
			{
				leftText: '',
				rightText: '',
				icon: 'icon-start_rpt',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'startRepeat'
			}
			,
			{
				leftText: '',
				rightText: '',
				icon: 'icon-end_bar',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'endBar'
			},
			{
				leftText: '',
				rightText: '',
				icon: 'icon-double_bar',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'doubleBar'
			},
			{
				leftText: '',
				rightText: '',
				icon: 'icon-single_bar',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'singleBarEnd'
			},			
			{
				leftText: '',
				rightText: '',
				icon: 'icon-single_bar_start',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'singleBarStart'
			},
			{
				leftText: '',
				rightText: '',
				icon: 'icon-ending',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'nthEnding'
			},
			{
				leftText: 'DC Al Coda',
				rightText: '',
				icon: '',
				classes: 'collapsed repetext',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'dcAlCoda'
			},
			{
				leftText: 'DS Al Coda',
				rightText: '',
				icon: '',
				classes: 'collapsed repetext',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'dsAlCoda'
			},
			{
				leftText: 'DC Al Fine',
				rightText: '',
				icon: '',
				classes: 'collapsed repetext',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'dcAlFine'
			},
			{
				leftText: 'DS Al Fine',
				rightText: '',
				icon: '',
				classes: 'collapsed repetext',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'dsAlFine'
			},
			{
				leftText: '',
				rightText: '',
				icon: 'icon-coda',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'coda'
			},
			{
				leftText: 'to ',
				rightText: '',
				icon: 'icon-coda',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'toCoda'
			},
			{
				leftText: '',
				rightText: '',
				icon: 'icon-segno',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'segno'
			},
			{
				leftText: 'Fine',
				rightText: '',
				icon: '',
				classes: 'collapsed repetext',
				action: 'collapseChild',
				ctor: 'MeasureButtons',
				group: 'measure',
				id: 'fine'
			}
		];
	}
	static get debugRibbonButtons() {
		return [{
				leftText: '',
				rightText: '',
				classes: 'icon  collapseParent',
				icon: 'icon-new-tab',
				action: 'collapseParent',
				ctor: 'CollapseRibbonControl',
				group: 'debug',
				id: 'DebugGroup'
			},{
				leftText: '',
				rightText: '',
				classes: 'icon  collapsed',
				icon: 'icon-new-tab',
				action: 'collapseChild',
				ctor: 'DebugButtons',
				group: 'debug',
				id: 'DebugButton2'
			}];
	}
	
	static get durationRibbonButtons() {
		return [{
				leftText: '',
				rightText: '',
				classes: 'icon  collapseParent duration',
				icon: 'icon-duration',
				action: 'collapseParent',
				ctor: 'CollapseRibbonControl',
				group: 'duration',
				id: 'DurationButtons'
			},{
				leftText: '',
				rightText: '.',
				icon: 'icon-duration_grow',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'DurationButtons',
				group: 'duration',
				id: 'GrowDuration'
			},{
				leftText: '',
				rightText: ',',
				icon: 'icon-duration_less',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'DurationButtons',
				group: 'duration',
				id: 'LessDuration'
			},{
				leftText: '',
				rightText: '>',
				icon: 'icon-duration_grow_dot',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'DurationButtons',
				group: 'duration',
				id: 'GrowDurationDot'
			},{
				leftText: '',
				rightText: '<',
				icon: 'icon-duration_less_dot',
				classes: 'collapsed duration',
				action: 'collapseChild',
				ctor: 'DurationButtons',
				group: 'duration',
				id: 'LessDurationDot'
			},{
				leftText: '',
				rightText: 'Ctrl-3',
				icon: 'icon-triplet',
				classes: 'collapsed duration tuplet',
				action: 'collapseChild',
				ctor: 'DurationButtons',
				group: 'duration',
				id: 'TripletButton'
			},{
				leftText: '',
				rightText: 'Ctrl-5',
				icon: 'icon-quint',
				classes: 'collapsed duration tuplet',
				action: 'collapseChild',
				ctor: 'DurationButtons',
				group: 'duration',
				id: 'QuintupletButton'
			},{
				leftText: '',
				rightText: 'Ctrl-7',
				icon: 'icon-septuplet',
				classes: 'collapsed duration tuplet',
				action: 'collapseChild',
				ctor: 'DurationButtons',
				group: 'duration',
				id: 'SeptupletButton'
			},
			{
				leftText: '',
				rightText: 'Ctrl-0',
				icon: 'icon-no_tuplet',
				classes: 'collapsed duration tuplet',
				action: 'collapseChild',
				ctor: 'DurationButtons',
				group: 'duration',
				id: 'NoTupletButton'
			}
			];
	}

	static get noteRibbonButtons() {
		return [{
				leftText: '',
				rightText: '',
				classes: 'icon  collapseParent',
				icon: 'icon-note',
				action: 'collapseParent',
				ctor: 'CollapseRibbonControl',
				group: 'notes',
				id: 'NoteButtons'
			}, {
				leftText: 'A',
				rightText: 'a',
				icon: '',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'ANoteButton'
			}, {
				leftText: 'B',
				rightText: 'b',
				icon: '',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'BNoteButton'
			}, {
				leftText: 'C',
				rightText: 'c',
				icon: '',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'CNoteButton'
			}, {
				leftText: 'D',
				rightText: 'd',
				icon: '',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'DNoteButton'
			}, {
				leftText: 'E',
				rightText: 'e',
				icon: '',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'ENoteButton'
			}, {
				leftText: 'F',
				rightText: 'f',
				icon: '',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'FNoteButton'
			}, {
				leftText: 'G',
				rightText: 'g',
				icon: '',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'GNoteButton'
			}, {
				leftText: '',
				rightText: '-',
				icon: 'icon-sharp',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'UpNoteButton'
			}, {
				leftText: '',
				rightText: '=',
				icon: 'icon-flat',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'DownNoteButton'
			}, {
				leftText: '',
				rightText: 'r',
				icon: 'icon-rest',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'ToggleRestButton'
			}, {
				leftText: '8va',
				rightText: 'Shift=',
				icon: '',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'UpOctaveButton'
			}, {
				leftText: '8vb',
				rightText: 'Shift-',
				icon: '',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'DownOctaveButton'
			}, {
				leftText: '',
				rightText: 'ShiftE',
				icon: 'icon-accident',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'ToggleAccidental'
			}, {
				leftText: '',
				rightText: 'ShiftF',
				icon: 'icon-courtesy',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NoteButtons',
				group: 'notes',
				id: 'ToggleCourtesy'
			}

		];
	}
	static get articulationButtons() {
		return [{
				leftText: '',
				rightText: '',
				icon: 'icon-articulation',
				classes: 'icon collapseParent articulation',
				action: 'collapseParent',
				ctor: 'CollapseRibbonControl',
				group: 'articulations',
				id: 'articulationButtons'
			}, {
				leftText: '',
				rightText: 'h',
				icon: 'icon-accent_above',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'accentAboveButton'
			}, {
				leftText: '',
				rightText: 'H',
				icon: 'icon-accent_below',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'accentBelowButton'
			}, {
				leftText: '',
				rightText: 'i',
				icon: 'icon-tenuto_above',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'tenutoAboveButton'
			}, {
				leftText: '',
				rightText: 'I',
				icon: 'icon-tenuto_below',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'tenutoBelowButton'
			}, {
				leftText: '',
				rightText: 'j',
				icon: 'icon-staccato_above',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'staccatoAboveButton'
			}, {
				leftText: '',
				rightText: 'J',
				icon: 'icon-staccato_below',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'staccatoBelowButton'
			}, {
				leftText: '',
				rightText: 'k',
				icon: 'icon-marcato_above',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'marcatoAboveButton'
			}, {
				leftText: '',
				rightText: 'K',
				icon: 'icon-marcato_below',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'marcatoBelowButton'
			}, {
				leftText: '',
				rightText: 'l',
				icon: 'icon-pitz_above',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'pizzicatoAboveButton'
			}, {
				leftText: '',
				rightText: 'L',
				icon: 'icon-pitz_below',
				classes: 'icon collapsed articulation',
				action: 'collapseChild',
				ctor: 'ArticulationButtons',
				group: 'articulations',
				id: 'pizzicatoBelowButton'
			}
		];
	}
	static get navigationButtons() {
		return [{
				leftText: '',
				rightText: '',
				classes: 'icon  collapseParent',
				icon: 'icon-navigate',
				action: 'collapseParent',
				ctor: 'CollapseRibbonControl',
				group: 'navigation',
				id: 'NavigationButtons'
			}, {
				leftText: '',
				rightText: '',
				icon: 'icon-arrow-left',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NavigationButtons',
				group: 'navigation',
				id: 'navLeftButton'
			}, {
				leftText: '',
				rightText: '',
				icon: 'icon-arrow-right',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NavigationButtons',
				group: 'navigation',
				id: 'navRightButton'
			}, {
				leftText: '',
				rightText: '',
				icon: 'icon-arrow-up',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NavigationButtons',
				group: 'navigation',
				id: 'navUpButton'
			}, {
				leftText: '',
				rightText: '',
				icon: 'icon-arrow-down',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NavigationButtons',
				group: 'navigation',
				id: 'navDownButton'
			}, {
				leftText: '',
				rightText: '',
				icon: 'icon-fforward',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NavigationButtons',
				group: 'navigation',
				id: 'navFastForward'
			}, {
				leftText: '',
				rightText: '',
				icon: 'icon-rewind',
				classes: 'collapsed',
				action: 'collapseChild',
				ctor: 'NavigationButtons',
				group: 'navigation',
				id: 'navRewind'
			}, {
				leftText: '',
				rightText: '',
				icon: 'icon-note_select_left',
				classes: 'collapsed selection-icon',
				action: 'collapseChild',
				ctor: 'NavigationButtons',
				group: 'navigation',
				id: 'navGrowLeft'
			}, {
				leftText: '',
				rightText: '',
				icon: 'icon-note_select_right',
				classes: 'collapsed selection-icon',
				action: 'collapseChild',
				ctor: 'NavigationButtons',
				group: 'navigation',
				id: 'navGrowRight'
			}
		];
	}
	static get chordButtons() {
		return [{
				icon: 'icon-chords',
				leftText: '',
				rightText: '',
				classes: 'icon collapseParent',
				action: 'collapseParent',
				ctor: 'CollapseRibbonControl',
				group: 'chords',
				id: 'CreateChordButtons'
			}, {
				icon: 'icon-arrow-up',
				leftText: '2nd',
				rightText: '2',
				classes: 'collapsed addChord',
				action: 'collapseChild',
				dataElements: {
					interval: '1',
					direction: '1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'SecondUpButton'
			}, {
				icon: 'icon-arrow-down',
				leftText: '2nd',
				rightText: 'Shift 2',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '1',
					direction: '1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'SecondDownButton'
			}, {
				icon: 'icon-arrow-up',
				leftText: '3rd',
				rightText: '3',
				classes: 'collapsed addChord',
				action: 'collapseChild',
				dataElements: {
					interval: '2',
					direction: '1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'ThirdUpButton'
			}, {
				icon: 'icon-arrow-down',
				leftText: '3rd',
				rightText: 'Shift 3',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '2',
					direction: '-1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'ThirdDownButton'
			}, {
				icon: 'icon-arrow-up',
				leftText: '4th',
				rightText: '4',
				classes: 'collapsed addChord',
				action: 'collapseChild',
				dataElements: {
					interval: '3',
					direction: '1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'FourthUpButton'
			}, {
				icon: 'icon-arrow-down',
				leftText: '4th',
				rightText: 'Shift 4',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '3',
					direction: '-1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'FourthDownButton'
			}, {
				icon: 'icon-arrow-up',
				leftText: '5th',
				rightText: '5',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '4',
					direction: '1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'FifthUpButton'
			}, {
				icon: 'icon-arrow-down',
				leftText: '5th',
				rightText: 'Shift 5',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '4',
					direction: '-1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'FifthDownButton'
			}, {
				icon: 'icon-arrow-up',
				leftText: '6th',
				rightText: '6',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '5',
					direction: '1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'SixthUpButton'
			}, {
				icon: 'icon-arrow-down',
				leftText: '6th',
				rightText: 'Shift 6',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '5',
					direction: '-1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'SixthDownButton'
			}, {
				icon: 'icon-arrow-up',
				leftText: '7th',
				rightText: '7',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '6',
					direction: '1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'SeventhUpButton'
			}, {
				icon: 'icon-arrow-down',
				leftText: '7th',
				rightText: 'Shift 7',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '6',
					direction: '-1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'SeventhDownButton'
			}, {
				icon: 'icon-arrow-up',
				leftText: '8va',
				rightText: '8',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '7',
					direction: '1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'OctaveUpButton'
			}, {
				icon: 'icon-arrow-down',
				leftText: '7th',
				rightText: 'Shift 7',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				dataElements: {
					interval: '7',
					direction: '-1'
				},
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'OctaveDownButton'
			}, {
				icon: '',
				leftText: 'Collapse',
				rightText: '',
				classes: 'collapsed addChord dirdown',
				action: 'collapseChild',
				ctor: 'ChordButtons',
				group: 'chords',
				id: 'CollapseChordButton'
			}
		];
	}

	static get leftRibbonButtons() {
		return [{
				icon: '',
				leftText: 'Help',
				rightText: '?',
				classes: 'help-button',
				action: 'modal',
				ctor: 'helpModal',
				group: 'scoreEdit',
				id: 'helpDialog'
			}, {
				leftText: 'File',
				rightText: '/f',
				icon: '',
				classes: 'file-modify',
				action: 'menu',
				ctor: 'SuiFileMenu',
				group: 'scoreEdit',
				id: 'fileMenu'
			}, {
				leftText: 'Time Sig',
				rightText: '/m',
				icon: '',
				classes: 'staff-modify',
				action: 'menu',
				ctor: 'SuiTimeSignatureMenu',
				group: 'scoreEdit',
				id: 'timeSignatureMenu'
			}, {
				leftText: 'Staves',
				rightText: '/s',
				icon: '',
				classes: 'staff-modify',
				action: 'menu',
				ctor: 'SuiAddStaffMenu',
				group: 'scoreEdit',
				id: 'addStaffMenu'
			}, {
				leftText: 'Key',
				rightText: '/k',
				icon: '',
				classes: 'note-modify',
				action: 'menu',
				ctor: 'suiKeySignatureMenu',
				group: 'scoreEdit',
				id: 'keyMenu'
			}, {
				leftText: 'Lines',
				rightText: '/l',
				icon: '',
				classes: 'icon note-modify',
				action: 'menu',
				ctor: 'suiStaffModifierMenu',
				group: 'scoreEdit',
				id: 'staffModifierMenu'
			},
			 {
				leftText: 'Piano',
				rightText: '',
				icon: '',
				classes: 'icon keyboard',
				action: 'modal',
				ctor: 'suiPiano',
				group: 'scoreEdit',
				id: 'pianoModal'
			},
			 {
				leftText: 'Layout',
				rightText: '',
				icon: '',
				classes: 'icon ',
				action: 'modal',
				ctor: 'SuiLayoutDialog',
				group: 'scoreEdit',
				id: 'layoutModal'
			}
		];
	}
}
;

class vexGlyph {
	static accidental(a) {
       return vexGlyph.accidentals[a];				    
	}
	static barWidth(b) {
		var str = SmoBarline.barlineString(b);
		var cc = vexGlyph.dimensions[str];
		return cc.width+cc.spacingRight;
	}
	static get accidentals() {
		return {
		'b':vexGlyph.dimensions.flat,
		'#':vexGlyph.dimensions.sharp,
		'bb':vexGlyph.dimensions.doubleFlat,
		'##':vexGlyph.dimensions.doubleSharp,
		'n':vexGlyph.dimensions.natural
		};
	}
	static keySignatureLength(key) {
		return smoMusic.getSharpsInKeySignature(key)*vexGlyph.dimensions['sharp'].width + 
		    smoMusic.getFlatsInKeySignature(key)*vexGlyph.dimensions['flat'].width + 
			vexGlyph.dimensions['keySignature'].spacingRight;
	}
	static get timeSignature() {
		return vexGlyph.dimensions['timeSignature'];
	}
	static get dot() {
		return vexGlyph.dimensions['dot'];
	}
	
	static clef(c) {
		var key = c.toLowerCase()+'Clef';
		if (!vexGlyph.dimensions[key]) {
			return vexGlyph.dimensions['tenorClef'];
		}
		return vexGlyph.dimensions[key];
	}
	static get dimensions() {
		return {
			singleBar: {
				width:1,
				height:41,
                yTop:0,
                yBottom:0,
				spacingRight:10
			},
			endBar: {
				width:5.22,
				height:40.99,
                yTop:0,
                yBottom:0,
				spacingRight:10
			},			
			doubleBar: {
				width:3.22,
				height:40.99,
                yTop:0,
                yBottom:0,
				spacingRight:0
			},
			endRepeat: {
				width:6,
				height:40.99,
                yTop:0,
                yBottom:0,
				spacingRight:0,
			},
			startRepeat: {
				width:6,
				height:40.99,
                yTop:0,
                yBottom:0,
				spacingRight:5,
			},
			noteHead: {
				width:12.02,
				height:10.48,
                yTop:0,
                yBottom:0,
				spacingRight:15,
			},
			dot: {
				width:5,
				height:5,
				spacingRight:2
			},
			trebleClef: {
				width: 25.5,
				height: 68.32,
                yTop:14,
                yBottom:0,
				spacingRight: 10,
			},
			bassClef: {
				width: 32.32,
				height: 31.88,
                yTop:0,
                yBottom:0,
				spacingRight: 5,
			},
			altoClef: {
				width: 31.5,
                yTop:0,
                yBottom:0,
				height: 85.5,
				spacingRight: 10
			},
			tenorClef: {
				width: 31.5,
                yTop:10,
                yBottom:0,
				height: 41,
				spacingRight: 10
			},
			timeSignature: {
				width: 13.48,
				height: 85,
                yTop:0,
                yBottom:0,
				spacingRight: 5
			},
			flat: {
				width: 7.44,
				height: 23.55,
                yTop:0,
                yBottom:0,
				spacingRight: 2
			},
			keySignature: {
				width: 0,
				height: 85.5,
                yTop:0,
                yBottom:0,
				spacingRight: 10
			},
			sharp: {
				width: 8.84,
				height: 62,
                yTop:0,
                yBottom:0,
				spacingRight: 2
			},
			natural: {
				width: 6.54,
				height: 53.35,
                yTop:0,
                yBottom:0,
				spacingRight: 2
			},
			doubleSharp: {
				height: 10.04,
				width: 21.63,
                yTop:0,
                yBottom:0,
				spacingRight: 2
			},
			doubleFlat: {
				width: 13.79,
				height: 49.65,
                yTop:0,
                yBottom:0,
				spacingRight:2
			}
		};
	}
}
;var inventionJson = `{
 "score": {
  "layout": {
   "leftMargin": 30,
   "rightMargin": 30,
   "topMargin": 103.671875,
   "bottomMargin": 40,
   "pageWidth": 816,
   "pageHeight": 1056,
   "orientation": 0,
   "interGap": 30,
   "intraGap": 10,
   "svgScale": 0.7,
   "zoomScale": 2,
   "zoomMode": 2,
   "pageSize": "letter"
  },
  "startIndex": 0,
  "renumberingMap": {}
 },
 "staves": [
  {
   "staffId": 0,
   "staffX": 10,
   "staffY": 40,
   "adjY": 0,
   "staffWidth": 1600,
   "staffHeight": 90,
   "startIndex": 0,
   "renumberingMap": {},
   "keySignatureMap": {},
   "instrumentInfo": {
    "instrumentName": "Treble Instrument",
    "keyOffset": "0",
    "clef": "treble"
   },
   "modifiers": [
    {
     "startSelector": {
      "staff": 0,
      "measure": 0,
      "voice": 0,
      "tick": 8,
      "pitches": []
     },
     "endSelector": {
      "staff": 0,
      "measure": 0,
      "voice": 0,
      "tick": 11,
      "pitches": []
     },
     "spacing": 2,
     "xOffset": 0,
     "yOffset": 10,
     "position": "1",
     "position_end": "1",
     "invert": true,
     "cp1x": 0,
     "cp1y": 40,
     "cp2x": 0,
     "cp2y": 40,
     "attrs": {
      "id": "auto7766680",
      "type": "SmoSlur"
     },
     "thickness": 2,
     "ctor": "SmoSlur"
    }
   ],
   "measures": [
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 123.4843978881836,
     "measureNumber": {
      "measureNumber": 0,
      "measureIndex": 0,
      "systemIndex": 0,
      "staffId": 0
     },
     "staffWidth": 557.2199993133545,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 64.98,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto30387",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353724",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353738",
         "renderedBox": {
          "x": 287.84527587890625,
          "y": 305.9010009765625,
          "width": 17.68536376953125,
          "height": 36.11749267578125
         },
         "logicalBox": {
          "x": 119.90081787109375,
          "y": 164.97613525390625,
          "width": 12.635986328125,
          "height": 25.8055419921875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [
          {
           "ctor": "SmoDynamicText",
           "xOffset": 0,
           "fontSize": 38,
           "yOffsetLine": 11,
           "yOffsetPixels": 0,
           "text": "p",
           "selector": {
            "staff": 0,
            "measure": 0,
            "voice": 0,
            "tick": 1,
            "pitches": []
           },
           "attrs": {
            "id": "auto7709807",
            "type": "SmoDynamicText"
           },
           "renderedBox": {
            "x": 335.02740478515625,
            "y": 345.09271240234375,
            "width": 21.6739501953125,
            "height": 24.20123291015625
           }
          }
         ],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto30388",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353724",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353744",
         "renderedBox": {
          "x": 337.0569763183594,
          "y": 310.49920654296875,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 155.06201171875,
          "y": 168.26150512695312,
          "width": 12.018234252929688,
          "height": 10.473861694335938
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto41469",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353724",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353751",
         "renderedBox": {
          "x": 385.404052734375,
          "y": 303.501220703125,
          "width": 16.820770263671875,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 189.60545349121094,
          "y": 163.2615203857422,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto41470",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353724",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353758",
         "renderedBox": {
          "x": 433.75115966796875,
          "y": 296.5032043457031,
          "width": 16.82073974609375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 224.14891052246094,
          "y": 158.2615203857422,
          "width": 12.018234252929688,
          "height": 10.473846435546875
         }
        }
       ],
       "attrs": {
        "id": "auto2353724",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto50330",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353725",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353765",
         "renderedBox": {
          "x": 482.0982360839844,
          "y": 289.50518798828125,
          "width": 16.820770263671875,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 258.6923522949219,
          "y": 153.2615203857422,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto50331",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353725",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353772",
         "renderedBox": {
          "x": 530.4453125,
          "y": 303.501220703125,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 293.23577880859375,
          "y": 163.2615203857422,
          "width": 12.018280029296875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto59952",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353725",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353779",
         "renderedBox": {
          "x": 578.79248046875,
          "y": 296.5032043457031,
          "width": 16.8206787109375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 327.779296875,
          "y": 158.2615203857422,
          "width": 12.0181884765625,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto59953",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353725",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353786",
         "renderedBox": {
          "x": 627.1395263671875,
          "y": 310.49920654296875,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 362.32269287109375,
          "y": 168.26150512695312,
          "width": 12.01824951171875,
          "height": 10.473861694335938
         }
        }
       ],
       "attrs": {
        "id": "auto2353725",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto75728",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353726",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353793",
         "renderedBox": {
          "x": 675.4866333007812,
          "y": 282.5071716308594,
          "width": 16.82073974609375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 396.86614990234375,
          "y": 148.2615203857422,
          "width": 12.01824951171875,
          "height": 10.473831176757812
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto75732",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353726",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353800",
         "renderedBox": {
          "x": 746.9624633789062,
          "y": 261.51312255859375,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 447.934814453125,
          "y": 133.26150512695312,
          "width": 12.01824951171875,
          "height": 10.473861694335938
         }
        }
       ],
       "attrs": {
        "id": "auto2353726",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto108540",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353727",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353807",
         "renderedBox": {
          "x": 818.4382934570312,
          "y": 268.51116943359375,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 499.0035095214844,
          "y": 138.26153564453125,
          "width": 12.018218994140625,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto108541",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2353727",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2353814",
         "renderedBox": {
          "x": 889.9141235351562,
          "y": 261.51312255859375,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 550.0721435546875,
          "y": 133.26150512695312,
          "width": 12.01824951171875,
          "height": 10.473861694335938
         }
        }
       ],
       "attrs": {
        "id": "auto2353727",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto30387",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto30388",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": [
          {
           "ctor": "SmoDynamicText",
           "xOffset": 0,
           "fontSize": 38,
           "yOffsetLine": 11,
           "yOffsetPixels": 0,
           "text": "p",
           "selector": {
            "staff": 0,
            "measure": 0,
            "voice": 0,
            "tick": 1,
            "pitches": []
           },
           "attrs": {
            "id": "auto7709807",
            "type": "SmoDynamicText"
           },
           "renderedBox": {
            "x": 335.02740478515625,
            "y": 345.09271240234375,
            "width": 21.6739501953125,
            "height": 24.20123291015625
           }
          }
         ]
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto41469",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto41470",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto50330",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto50331",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto59952",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto59953",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto75728",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto75732",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto108540",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto108541",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      },
      {
       "position": 0,
       "barline": 3,
       "ctor": "SmoBarline"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 587.2199993133545,
     "staffY": 123.4843978881836,
     "measureNumber": {
      "measureNumber": 1,
      "measureIndex": 1,
      "systemIndex": 1,
      "staffId": 0
     },
     "staffWidth": 503.2400207519531,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto134088",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354782",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354789",
         "renderedBox": {
          "x": 965.6995239257812,
          "y": 261.51312255859375,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 604.219970703125,
          "y": 133.26150512695312,
          "width": 12.01824951171875,
          "height": 10.473861694335938
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto134089",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354782",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354796",
         "renderedBox": {
          "x": 1014.1007080078125,
          "y": 282.5071716308594,
          "width": 16.8206787109375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 638.8020629882812,
          "y": 148.2615203857422,
          "width": 12.0181884765625,
          "height": 10.473831176757812
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto134092",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354782",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354803",
         "renderedBox": {
          "x": 1062.501708984375,
          "y": 275.5091552734375,
          "width": 16.82080078125,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 673.384033203125,
          "y": 143.2615203857422,
          "width": 12.01824951171875,
          "height": 10.473831176757812
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto134093",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354782",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354810",
         "renderedBox": {
          "x": 1110.9029541015625,
          "y": 268.51116943359375,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 707.9661865234375,
          "y": 138.26153564453125,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2354782",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto134096",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354783",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354817",
         "renderedBox": {
          "x": 1159.3040771484375,
          "y": 261.51312255859375,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 742.5482177734375,
          "y": 133.26150512695312,
          "width": 12.01824951171875,
          "height": 10.473861694335938
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto134097",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354783",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354824",
         "renderedBox": {
          "x": 1207.7052001953125,
          "y": 275.5091552734375,
          "width": 16.82080078125,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 777.1302490234375,
          "y": 143.2615203857422,
          "width": 12.018310546875,
          "height": 10.473831176757812
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto134100",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354783",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354831",
         "renderedBox": {
          "x": 1256.1063232421875,
          "y": 268.51116943359375,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 811.7123413085938,
          "y": 138.26153564453125,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto134101",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354783",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354838",
         "renderedBox": {
          "x": 1304.507568359375,
          "y": 282.5071716308594,
          "width": 16.8206787109375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 846.2944946289062,
          "y": 148.2615203857422,
          "width": 12.0181884765625,
          "height": 10.473831176757812
         }
        }
       ],
       "attrs": {
        "id": "auto2354783",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto644646",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354784",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354845",
         "renderedBox": {
          "x": 1352.9085693359375,
          "y": 254.51513671875,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 880.87646484375,
          "y": 128.2615203857422,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto644647",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354784",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354852",
         "renderedBox": {
          "x": 1424.4925537109375,
          "y": 233.52108764648438,
          "width": 16.8206787109375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 932.0223999023438,
          "y": 113.26151275634766,
          "width": 12.0181884765625,
          "height": 10.473838806152344
         }
        }
       ],
       "attrs": {
        "id": "auto2354784",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto644650",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354785",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354859",
         "renderedBox": {
          "x": 1496.076416015625,
          "y": 240.51910400390625,
          "width": 16.82080078125,
          "height": 14.659194946289062
         },
         "logicalBox": {
          "x": 983.168212890625,
          "y": 118.26152038574219,
          "width": 12.018310546875,
          "height": 10.473831176757812
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto644651",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2354785",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354866",
         "renderedBox": {
          "x": 1567.6602783203125,
          "y": 233.52108764648438,
          "width": 16.82080078125,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 1034.3140869140625,
          "y": 113.26151275634766,
          "width": 12.018310546875,
          "height": 10.473838806152344
         }
        }
       ],
       "attrs": {
        "id": "auto2354785",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134088",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134089",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134092",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134093",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134096",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134097",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134100",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134101",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto644646",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto644647",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto644650",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto644651",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 380.28621673583984,
     "measureNumber": {
      "measureNumber": 2,
      "measureIndex": 2,
      "systemIndex": 0,
      "staffId": 0
     },
     "staffWidth": 553.2999858856201,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 64.98,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704280",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355929",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355942",
         "renderedBox": {
          "x": 259.85321044921875,
          "y": 606.9375610351562,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 99.90080261230469,
          "y": 380.0633544921875,
          "width": 12.018226623535156,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704281",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355929",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355949",
         "renderedBox": {
          "x": 301.6068115234375,
          "y": 585.9434814453125,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 129.7332763671875,
          "y": 365.0633239746094,
          "width": 12.018264770507812,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704284",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355929",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355956",
         "renderedBox": {
          "x": 343.3604736328125,
          "y": 592.9415283203125,
          "width": 16.820770263671875,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 159.5657958984375,
          "y": 370.0633239746094,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704285",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355929",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355963",
         "renderedBox": {
          "x": 385.1141357421875,
          "y": 599.9395141601562,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 189.3983154296875,
          "y": 375.0633239746094,
          "width": 12.018218994140625,
          "height": 10.473846435546875
         }
        }
       ],
       "attrs": {
        "id": "auto2355929",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704288",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355930",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355970",
         "renderedBox": {
          "x": 426.86773681640625,
          "y": 606.9375610351562,
          "width": 16.820770263671875,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 219.2307891845703,
          "y": 380.0633544921875,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704289",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355930",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355977",
         "renderedBox": {
          "x": 468.62139892578125,
          "y": 592.9415283203125,
          "width": 16.820770263671875,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 249.06329345703125,
          "y": 370.0633239746094,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704292",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355930",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355984",
         "renderedBox": {
          "x": 510.375,
          "y": 599.9395141601562,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 278.8957824707031,
          "y": 375.0633239746094,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704293",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355930",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355991",
         "renderedBox": {
          "x": 552.128662109375,
          "y": 585.9434814453125,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 308.7283020019531,
          "y": 365.0633239746094,
          "width": 12.018218994140625,
          "height": 10.473846435546875
         }
        }
       ],
       "attrs": {
        "id": "auto2355930",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704296",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355931",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355998",
         "renderedBox": {
          "x": 593.88232421875,
          "y": 592.9415283203125,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 338.5608215332031,
          "y": 370.0633239746094,
          "width": 12.018218994140625,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704297",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355931",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356005",
         "renderedBox": {
          "x": 635.6359252929688,
          "y": 599.9395141601562,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 368.3932800292969,
          "y": 375.0633239746094,
          "width": 12.018218994140625,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704300",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355931",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356012",
         "renderedBox": {
          "x": 677.3895874023438,
          "y": 606.9375610351562,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 398.2257995605469,
          "y": 380.0633544921875,
          "width": 12.018218994140625,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704301",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355931",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356019",
         "renderedBox": {
          "x": 719.1431884765625,
          "y": 613.935546875,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 428.0582580566406,
          "y": 385.0633239746094,
          "width": 12.018280029296875,
          "height": 10.473846435546875
         }
        }
       ],
       "attrs": {
        "id": "auto2355931",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704304",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355932",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356026",
         "renderedBox": {
          "x": 760.8968505859375,
          "y": 620.9335327148438,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 457.8907775878906,
          "y": 390.06329345703125,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704305",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355932",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356033",
         "renderedBox": {
          "x": 802.6505126953125,
          "y": 606.9375610351562,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 487.7232971191406,
          "y": 380.0633544921875,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704308",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355932",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356040",
         "renderedBox": {
          "x": 844.4041137695312,
          "y": 613.935546875,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 517.5557861328125,
          "y": 385.0633239746094,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto704309",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2355932",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356047",
         "renderedBox": {
          "x": 886.1577758789062,
          "y": 599.9395141601562,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 547.3883056640625,
          "y": 375.0633239746094,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        }
       ],
       "attrs": {
        "id": "auto2355932",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704280",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704281",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704284",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704285",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704288",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704289",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704292",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704293",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704296",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704297",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704300",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704301",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704304",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704305",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704308",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto704309",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 583.2999858856201,
     "staffY": 380.28621673583984,
     "measureNumber": {
      "measureNumber": 3,
      "measureIndex": 3,
      "systemIndex": 1,
      "staffId": 0
     },
     "staffWidth": 508.1600341796875,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto888601",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357149",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357156",
         "renderedBox": {
          "x": 960.2130737304688,
          "y": 606.9375610351562,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 600.2999877929688,
          "y": 380.0633544921875,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto888602",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357149",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357163",
         "renderedBox": {
          "x": 1001.6170654296875,
          "y": 613.935546875,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 629.8826293945312,
          "y": 385.0633239746094,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto888605",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357149",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357170",
         "renderedBox": {
          "x": 1043.02099609375,
          "y": 620.9335327148438,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 659.4652709960938,
          "y": 390.06329345703125,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888606",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357149",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357177",
         "renderedBox": {
          "x": 1084.425048828125,
          "y": 627.9315795898438,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 689.0480346679688,
          "y": 395.0633239746094,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2357149",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888609",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357150",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357184",
         "renderedBox": {
          "x": 1125.8291015625,
          "y": 634.9295654296875,
          "width": 16.8206787109375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 718.6307373046875,
          "y": 400.0633239746094,
          "width": 12.0181884765625,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto888610",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357150",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357191",
         "renderedBox": {
          "x": 1167.23291015625,
          "y": 620.9335327148438,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 748.2132568359375,
          "y": 390.06329345703125,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888613",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357150",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357198",
         "renderedBox": {
          "x": 1208.636962890625,
          "y": 627.9315795898438,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 777.7960205078125,
          "y": 395.0633239746094,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto888614",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357150",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357205",
         "renderedBox": {
          "x": 1250.0408935546875,
          "y": 613.935546875,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 807.378662109375,
          "y": 385.0633239746094,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        }
       ],
       "attrs": {
        "id": "auto2357150",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto888617",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357151",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357212",
         "renderedBox": {
          "x": 1291.4449462890625,
          "y": 620.9335327148438,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 836.9613647460938,
          "y": 390.06329345703125,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888618",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357151",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357219",
         "renderedBox": {
          "x": 1332.848876953125,
          "y": 627.9315795898438,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 866.5440063476562,
          "y": 395.0633239746094,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888621",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357151",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357226",
         "renderedBox": {
          "x": 1374.2529296875,
          "y": 634.9295654296875,
          "width": 16.8206787109375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 896.126708984375,
          "y": 400.0633239746094,
          "width": 12.0181884765625,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888622",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357151",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357233",
         "renderedBox": {
          "x": 1415.6568603515625,
          "y": 641.9276123046875,
          "width": 16.8206787109375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 925.7093505859375,
          "y": 405.0633239746094,
          "width": 12.0181884765625,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2357151",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888625",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357152",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357240",
         "renderedBox": {
          "x": 1458.46044921875,
          "y": 635.6721801757812,
          "width": 33.3883056640625,
          "height": 41.16510009765625
         },
         "logicalBox": {
          "x": 956.2920532226562,
          "y": 400.5939025878906,
          "width": 23.8555908203125,
          "height": 29.4119873046875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888626",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357152",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357249",
         "renderedBox": {
          "x": 1516.431884765625,
          "y": 634.9295654296875,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 997.7119750976562,
          "y": 400.0633239746094,
          "width": 12.018310546875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888629",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357152",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357256",
         "renderedBox": {
          "x": 1557.8359375,
          "y": 641.9276123046875,
          "width": 16.8206787109375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 1027.294677734375,
          "y": 405.0633239746094,
          "width": 12.0181884765625,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto888630",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2357152",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2357263",
         "renderedBox": {
          "x": 1599.2398681640625,
          "y": 627.9315795898438,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 1056.8773193359375,
          "y": 395.0633239746094,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2357152",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888601",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888602",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888605",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888606",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888609",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888610",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888613",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888614",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888617",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888618",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888621",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888622",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888625",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888626",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888629",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto888630",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 590.5380783081055,
     "measureNumber": {
      "measureNumber": 4,
      "measureIndex": 4,
      "systemIndex": 0,
      "staffId": 0
     },
     "staffWidth": 511.0599956512451,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 64.98,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827883",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358303",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358316",
         "renderedBox": {
          "x": 259.85321044921875,
          "y": 929.1986083984375,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 99.90080261230469,
          "y": 610.315185546875,
          "width": 12.018226623535156,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827884",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358303",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358323",
         "renderedBox": {
          "x": 320.0657958984375,
          "y": 957.1906127929688,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 142.92201232910156,
          "y": 630.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2358303",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 3072,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto1827885",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358304",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358330",
         "renderedBox": {
          "x": 380.2784118652344,
          "y": 915.2025756835938,
          "width": 26.617950439453125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 185.9432373046875,
          "y": 600.315185546875,
          "width": 19.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto1827886",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358304",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358338",
         "renderedBox": {
          "x": 466.3857421875,
          "y": 908.2045288085938,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 247.4659423828125,
          "y": 595.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2358304",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827887",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358305",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358345",
         "renderedBox": {
          "x": 509.1012268066406,
          "y": 922.2005615234375,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 277.9856872558594,
          "y": 605.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827888",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358305",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358352",
         "renderedBox": {
          "x": 551.8167114257812,
          "y": 929.1986083984375,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 308.5054016113281,
          "y": 610.315185546875,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827889",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358305",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358359",
         "renderedBox": {
          "x": 594.5322265625,
          "y": 936.1965942382812,
          "width": 16.8206787109375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 339.025146484375,
          "y": 615.315185546875,
          "width": 12.0181884765625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827890",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358305",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358366",
         "renderedBox": {
          "x": 638.6472778320312,
          "y": 929.941162109375,
          "width": 33.38824462890625,
          "height": 41.16510009765625
         },
         "logicalBox": {
          "x": 370.54486083984375,
          "y": 610.8457641601562,
          "width": 23.85552978515625,
          "height": 29.4119873046875
         }
        }
       ],
       "attrs": {
        "id": "auto2358305",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827891",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358306",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358375",
         "renderedBox": {
          "x": 697.9302978515625,
          "y": 950.192626953125,
          "width": 16.8206787109375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 412.90191650390625,
          "y": 625.315185546875,
          "width": 12.018157958984375,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827892",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358306",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358382",
         "renderedBox": {
          "x": 740.645751953125,
          "y": 936.1965942382812,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 443.4216003417969,
          "y": 615.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827893",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358306",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358389",
         "renderedBox": {
          "x": 783.3612670898438,
          "y": 943.1946411132812,
          "width": 16.8206787109375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 473.94134521484375,
          "y": 620.315185546875,
          "width": 12.0181884765625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1827894",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2358306",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358396",
         "renderedBox": {
          "x": 826.0767211914062,
          "y": 929.1986083984375,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 504.4610595703125,
          "y": 610.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2358306",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827883",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827884",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 3072,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827885",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827886",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827887",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827888",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827889",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827890",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827891",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827892",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827893",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1827894",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 541.0599956512451,
     "staffY": 590.5380783081055,
     "measureNumber": {
      "measureNumber": 5,
      "measureIndex": 5,
      "systemIndex": 1,
      "staffId": 0
     },
     "staffWidth": 549.3200073242188,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto3953599",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359529",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359536",
         "renderedBox": {
          "x": 901.0939331054688,
          "y": 936.1965942382812,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 558.0599975585938,
          "y": 615.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto3953600",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359529",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359543",
         "renderedBox": {
          "x": 947.2213134765625,
          "y": 922.2005615234375,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 591.0175170898438,
          "y": 605.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto3953603",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359529",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359550",
         "renderedBox": {
          "x": 993.3486938476562,
          "y": 929.1986083984375,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 623.9749755859375,
          "y": 610.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto3953604",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359529",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359557",
         "renderedBox": {
          "x": 1039.47607421875,
          "y": 915.2025756835938,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 656.9324951171875,
          "y": 600.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2359529",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto3880053",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359530",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359564",
         "renderedBox": {
          "x": 1085.603515625,
          "y": 922.2005615234375,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 689.8900146484375,
          "y": 605.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto3880054",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359530",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359571",
         "renderedBox": {
          "x": 1131.7308349609375,
          "y": 908.2045288085938,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 722.8474731445312,
          "y": 595.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto4020250",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359530",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359578",
         "renderedBox": {
          "x": 1177.8582763671875,
          "y": 915.2025756835938,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 755.8049926757812,
          "y": 600.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto4020251",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359530",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359585",
         "renderedBox": {
          "x": 1223.9857177734375,
          "y": 901.20654296875,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 788.7625122070312,
          "y": 590.315185546875,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2359530",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto4020254",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359531",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359592",
         "renderedBox": {
          "x": 1270.113037109375,
          "y": 908.2045288085938,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 821.719970703125,
          "y": 595.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 512,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto4344970",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359531",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359599",
         "renderedBox": {
          "x": 1316.240478515625,
          "y": 922.2005615234375,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 854.677490234375,
          "y": 605.315185546875,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 512,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto4344971",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359531",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359606",
         "renderedBox": {
          "x": 1351.913330078125,
          "y": 915.2025756835938,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 880.1653442382812,
          "y": 600.315185546875,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto4020242",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359531",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359613",
         "renderedBox": {
          "x": 1387.5863037109375,
          "y": 908.2045288085938,
          "width": 16.8206787109375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 905.6532592773438,
          "y": 595.315185546875,
          "width": 12.0181884765625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto4020243",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359531",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359620",
         "renderedBox": {
          "x": 1433.713623046875,
          "y": 887.2105102539062,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 938.6107177734375,
          "y": 580.315185546875,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2359531",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto4512325",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359532",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359627",
         "renderedBox": {
          "x": 1479.841064453125,
          "y": 922.2005615234375,
          "width": 16.8206787109375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 971.5682373046875,
          "y": 605.315185546875,
          "width": 12.0181884765625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto3880041",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359532",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359634",
         "renderedBox": {
          "x": 1546.87744140625,
          "y": 929.1986083984375,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 1019.4649658203125,
          "y": 610.315185546875,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto3880042",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2359532",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359641",
         "renderedBox": {
          "x": 1593.0048828125,
          "y": 936.1965942382812,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 1052.4224853515625,
          "y": 615.315185546875,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2359532",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto3953599",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto3953600",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto3953603",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto3953604",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto3880053",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto3880054",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4020250",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4020251",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4020254",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 512,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4344970",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 512,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4344971",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4020242",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4020243",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4512325",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto3880041",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto3880042",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 840.4047164916992,
     "measureNumber": {
      "measureNumber": 6,
      "measureIndex": 6,
      "systemIndex": 0,
      "staffId": 0
     },
     "staffWidth": 377.2000102996826,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 64.98,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto4893041",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2360753",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360783",
         "renderedBox": {
          "x": 411.5118408203125,
          "y": 1281.3123779296875,
          "width": 17.68536376953125,
          "height": 36.1175537109375
         },
         "logicalBox": {
          "x": 208.25917053222656,
          "y": 861.896484375,
          "width": 12.635986328125,
          "height": 25.80560302734375
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto4893042",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2360753",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360789",
         "renderedBox": {
          "x": 446.00958251953125,
          "y": 1285.9105224609375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 232.90740966796875,
          "y": 865.1818237304688,
          "width": 12.018234252929688,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto4893045",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2360753",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360796",
         "renderedBox": {
          "x": 479.6427001953125,
          "y": 1278.9124755859375,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 256.9378967285156,
          "y": 860.1817626953125,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto4893046",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2360753",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360803",
         "renderedBox": {
          "x": 513.2758178710938,
          "y": 1271.91455078125,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 280.9683837890625,
          "y": 855.1818237304688,
          "width": 12.018218994140625,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2360753",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto4893049",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2360754",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360810",
         "renderedBox": {
          "x": 546.908935546875,
          "y": 1264.91650390625,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 304.9988708496094,
          "y": 850.1818237304688,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto4893050",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2360754",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360817",
         "renderedBox": {
          "x": 580.5421142578125,
          "y": 1278.9124755859375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 329.0293884277344,
          "y": 860.1817626953125,
          "width": 12.018218994140625,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto4893053",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2360754",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360824",
         "renderedBox": {
          "x": 614.1751708984375,
          "y": 1271.91455078125,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 353.059814453125,
          "y": 855.1818237304688,
          "width": 12.018280029296875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto4893054",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2360754",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360831",
         "renderedBox": {
          "x": 647.808349609375,
          "y": 1285.9105224609375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 377.09033203125,
          "y": 865.1818237304688,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2360754",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4754719",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": true,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto4754720",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto1906356",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto4893041",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4893042",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4893045",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4893046",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4893049",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4893050",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4893053",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto4893054",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 407.2000102996826,
     "staffY": 840.4047164916992,
     "measureNumber": {
      "measureNumber": 7,
      "measureIndex": 7,
      "systemIndex": 1,
      "staffId": 0
     },
     "staffWidth": 359.0799865722656,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto5985762",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2361681",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361707",
         "renderedBox": {
          "x": 899.4801635742188,
          "y": 1274.3143310546875,
          "width": 17.6854248046875,
          "height": 36.1175537109375
         },
         "logicalBox": {
          "x": 556.906982421875,
          "y": 856.896484375,
          "width": 12.63604736328125,
          "height": 25.8055419921875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto5985763",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2361681",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361713",
         "renderedBox": {
          "x": 935.9918212890625,
          "y": 1278.9124755859375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 582.994140625,
          "y": 860.1817626953125,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto5985766",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2361681",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361720",
         "renderedBox": {
          "x": 971.6388549804688,
          "y": 1271.91455078125,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 608.4635620117188,
          "y": 855.1818237304688,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto5985767",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2361681",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361727",
         "renderedBox": {
          "x": 1007.2859497070312,
          "y": 1264.91650390625,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 633.9329833984375,
          "y": 850.1818237304688,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2361681",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto5985770",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2361682",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361734",
         "renderedBox": {
          "x": 1042.9329833984375,
          "y": 1257.91845703125,
          "width": 16.8206787109375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 659.4024047851562,
          "y": 845.1818237304688,
          "width": 12.0181884765625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto5985771",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2361682",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361741",
         "renderedBox": {
          "x": 1078.5799560546875,
          "y": 1271.91455078125,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 684.8717651367188,
          "y": 855.1818237304688,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto5985774",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2361682",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361748",
         "renderedBox": {
          "x": 1114.22705078125,
          "y": 1264.91650390625,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 710.3411865234375,
          "y": 850.1818237304688,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto5985775",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2361682",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361755",
         "renderedBox": {
          "x": 1149.8741455078125,
          "y": 1278.9124755859375,
          "width": 16.8206787109375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 735.8106689453125,
          "y": 860.1817626953125,
          "width": 12.0181884765625,
          "height": 10.47393798828125
         }
        }
       ],
       "attrs": {
        "id": "auto2361682",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto5450034",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": true,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto5450035",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto1886589",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto5985762",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto5985763",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto5985766",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto5985767",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto5985770",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto5985771",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto5985774",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto5985775",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 766.2799968719482,
     "staffY": 840.4047164916992,
     "measureNumber": {
      "measureNumber": 8,
      "measureIndex": 8,
      "systemIndex": 2,
      "staffId": 0
     },
     "staffWidth": 323.22003173828125,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto6626751",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2362754",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362778",
         "renderedBox": {
          "x": 1359.5606689453125,
          "y": 1253.3203125,
          "width": 17.685302734375,
          "height": 36.1175537109375
         },
         "logicalBox": {
          "x": 885.6292724609375,
          "y": 841.896484375,
          "width": 12.635986328125,
          "height": 25.8055419921875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto6626752",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2362754",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362784",
         "renderedBox": {
          "x": 1395.109619140625,
          "y": 1257.91845703125,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 911.0286254882812,
          "y": 845.1818237304688,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto6626755",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2362754",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362791",
         "renderedBox": {
          "x": 1429.7940673828125,
          "y": 1264.91650390625,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 935.8102416992188,
          "y": 850.1818237304688,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto6626756",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2362754",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362798",
         "renderedBox": {
          "x": 1464.478515625,
          "y": 1271.91455078125,
          "width": 16.8206787109375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 960.5919189453125,
          "y": 855.1818237304688,
          "width": 12.0181884765625,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2362754",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto6626759",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2362755",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362805",
         "renderedBox": {
          "x": 1499.1629638671875,
          "y": 1278.9124755859375,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 985.37353515625,
          "y": 860.1817626953125,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto6626760",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2362755",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362812",
         "renderedBox": {
          "x": 1533.847412109375,
          "y": 1264.91650390625,
          "width": 16.8206787109375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 1010.1552124023438,
          "y": 850.1818237304688,
          "width": 12.01812744140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto6626763",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2362755",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362819",
         "renderedBox": {
          "x": 1568.53173828125,
          "y": 1271.91455078125,
          "width": 16.8206787109375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 1034.936767578125,
          "y": 855.1818237304688,
          "width": 12.0181884765625,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto6626764",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2362755",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362826",
         "renderedBox": {
          "x": 1603.2161865234375,
          "y": 1257.91845703125,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 1059.7183837890625,
          "y": 845.1818237304688,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2362755",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto6417337",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": true,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto6417338",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto1867118",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto6626751",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto6626752",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto6626755",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto6626756",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto6626759",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto6626760",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto6626763",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto6626764",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 1061.0244674682617,
     "measureNumber": {
      "measureNumber": 9,
      "measureIndex": 9,
      "systemIndex": 0,
      "staffId": 0
     },
     "staffWidth": 397.2000102996826,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 64.98,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto7540256",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2363682",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363694",
         "renderedBox": {
          "x": 259.85321044921875,
          "y": 1580.694580078125,
          "width": 16.82073974609375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 99.90080261230469,
          "y": 1075.8016357421875,
          "width": 12.018226623535156,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto7540257",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2363682",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363701",
         "renderedBox": {
          "x": 307.502685546875,
          "y": 1576.0963134765625,
          "width": 13.71600341796875,
          "height": 22.63720703125
         },
         "logicalBox": {
          "x": 133.94581604003906,
          "y": 1072.5162353515625,
          "width": 9.7999267578125,
          "height": 16.174072265625
         }
        }
       ],
       "attrs": {
        "id": "auto2363682",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto575803",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363683",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363713",
         "renderedBox": {
          "x": 417.09747314453125,
          "y": 1590.09228515625,
          "width": 17.685394287109375,
          "height": 36.1175537109375
         },
         "logicalBox": {
          "x": 212.2500457763672,
          "y": 1082.5162353515625,
          "width": 12.636001586914062,
          "height": 25.8055419921875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto575804",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363683",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363719",
         "renderedBox": {
          "x": 454.3960266113281,
          "y": 1566.698486328125,
          "width": 16.82073974609375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 238.89942932128906,
          "y": 1065.8016357421875,
          "width": 12.018234252929688,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto7540262",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2363683",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363726",
         "renderedBox": {
          "x": 490.8299560546875,
          "y": 1573.696533203125,
          "width": 16.820770263671875,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 264.9310607910156,
          "y": 1070.8016357421875,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto7540263",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2363683",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363733",
         "renderedBox": {
          "x": 527.2638549804688,
          "y": 1580.694580078125,
          "width": 16.82073974609375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 290.9626770019531,
          "y": 1075.8016357421875,
          "width": 12.018218994140625,
          "height": 10.4737548828125
         }
        }
       ],
       "attrs": {
        "id": "auto2363683",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto7540264",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2363684",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363740",
         "renderedBox": {
          "x": 563.69775390625,
          "y": 1587.6925048828125,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 316.9942626953125,
          "y": 1080.8016357421875,
          "width": 12.018280029296875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto7540265",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2363684",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363747",
         "renderedBox": {
          "x": 600.1317138671875,
          "y": 1573.696533203125,
          "width": 16.82073974609375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 343.02593994140625,
          "y": 1070.8016357421875,
          "width": 12.018218994140625,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto7540266",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2363684",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363754",
         "renderedBox": {
          "x": 636.565673828125,
          "y": 1580.694580078125,
          "width": 16.82073974609375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 369.0575866699219,
          "y": 1075.8016357421875,
          "width": 12.018218994140625,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto7540267",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2363684",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363761",
         "renderedBox": {
          "x": 672.9995727539062,
          "y": 1566.698486328125,
          "width": 16.82073974609375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 395.08917236328125,
          "y": 1065.8016357421875,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        }
       ],
       "attrs": {
        "id": "auto2363684",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7540256",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto7540257",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto500835",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto575803",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto575804",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7540262",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7540263",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7540264",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7540265",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7540266",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7540267",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 427.2000102996826,
     "staffY": 1061.0244674682617,
     "measureNumber": {
      "measureNumber": 10,
      "measureIndex": 10,
      "systemIndex": 1,
      "staffId": 0
     },
     "staffWidth": 352.06005859375,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto1028946",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2364671",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364677",
         "renderedBox": {
          "x": 741.7352294921875,
          "y": 1573.696533203125,
          "width": 16.82073974609375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 444.2000427246094,
          "y": 1070.8016357421875,
          "width": 12.018218994140625,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1066417",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2364671",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364684",
         "renderedBox": {
          "x": 788.6853637695312,
          "y": 1576.0963134765625,
          "width": 13.71600341796875,
          "height": 22.63720703125
         },
         "logicalBox": {
          "x": 477.745361328125,
          "y": 1072.5162353515625,
          "width": 9.7999267578125,
          "height": 16.174072265625
         }
        }
       ],
       "attrs": {
        "id": "auto2364671",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto144046",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2364672",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364696",
         "renderedBox": {
          "x": 896.1822509765625,
          "y": 1576.0963134765625,
          "width": 17.68536376953125,
          "height": 36.117431640625
         },
         "logicalBox": {
          "x": 554.5506591796875,
          "y": 1072.5162353515625,
          "width": 12.635986328125,
          "height": 25.8055419921875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto144047",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2364672",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364702",
         "renderedBox": {
          "x": 933.131103515625,
          "y": 1559.700439453125,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 580.9501953125,
          "y": 1060.8016357421875,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto144050",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2364672",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364709",
         "renderedBox": {
          "x": 969.21533203125,
          "y": 1566.698486328125,
          "width": 16.82080078125,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 606.7319946289062,
          "y": 1065.8016357421875,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto144051",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2364672",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364716",
         "renderedBox": {
          "x": 1005.2996215820312,
          "y": 1573.696533203125,
          "width": 16.82080078125,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 632.5137939453125,
          "y": 1070.8016357421875,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        }
       ],
       "attrs": {
        "id": "auto2364672",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto144054",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2364673",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364723",
         "renderedBox": {
          "x": 1041.3839111328125,
          "y": 1580.694580078125,
          "width": 16.8206787109375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 658.2955932617188,
          "y": 1075.8016357421875,
          "width": 12.0181884765625,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto144055",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2364673",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364730",
         "renderedBox": {
          "x": 1077.4681396484375,
          "y": 1566.698486328125,
          "width": 16.82080078125,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 684.077392578125,
          "y": 1065.8016357421875,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "#",
           "octave": 5
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto144058",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2364673",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364737",
         "renderedBox": {
          "x": 1114.9520263671875,
          "y": 1560.4429931640625,
          "width": 33.3883056640625,
          "height": 41.1651611328125
         },
         "logicalBox": {
          "x": 710.8591918945312,
          "y": 1061.3321533203125,
          "width": 23.8555908203125,
          "height": 29.4119873046875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "clef": "treble",
         "attrs": {
          "id": "auto144059",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2364673",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364746",
         "renderedBox": {
          "x": 1167.603759765625,
          "y": 1559.700439453125,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 748.478271484375,
          "y": 1060.8016357421875,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        }
       ],
       "attrs": {
        "id": "auto2364673",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1028946",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto1066417",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto1165671",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto144046",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto144047",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto144050",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto144051",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto144054",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto144055",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "#",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto144058",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto144059",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 779.2600688934326,
     "staffY": 1061.0244674682617,
     "measureNumber": {
      "measureNumber": 11,
      "measureIndex": 11,
      "systemIndex": 2,
      "staffId": 0
     },
     "staffWidth": 154.08001708984375,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7356712",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7356713",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7356714",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7356715",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 933.3400859832764,
     "staffY": 1061.0244674682617,
     "measureNumber": {
      "measureNumber": 12,
      "measureIndex": 12,
      "systemIndex": 3,
      "staffId": 0
     },
     "staffWidth": 154.08001708984375,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7327021",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7327022",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7327023",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7327024",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 1234.924430847168,
     "measureNumber": {
      "measureNumber": 13,
      "measureIndex": 13,
      "systemIndex": 0,
      "staffId": 0
     },
     "staffWidth": 416.0599956512451,
     "activeVoice": 0,
     "clef": "treble",
     "transposeIndex": 0,
     "adjX": 64.98,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1351378",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365450",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365463",
         "renderedBox": {
          "x": 259.85321044921875,
          "y": 1831.083251953125,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 99.90080261230469,
          "y": 1254.7015380859375,
          "width": 12.018226623535156,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1351382",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365450",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365470",
         "renderedBox": {
          "x": 303.4455261230469,
          "y": 1859.0753173828125,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 131.04701232910156,
          "y": 1274.7015380859375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2365450",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 3072,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto1414086",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365451",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365477",
         "renderedBox": {
          "x": 347.037841796875,
          "y": 1817.0872802734375,
          "width": 26.61798095703125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 162.1932373046875,
          "y": 1244.7015380859375,
          "width": 19.018234252929688,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "attrs": {
          "id": "auto1299131",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365451",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365485",
         "renderedBox": {
          "x": 408.2147521972656,
          "y": 1810.0892333984375,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 205.9034423828125,
          "y": 1239.7015380859375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2365451",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1299134",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365452",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365492",
         "renderedBox": {
          "x": 442.6201171875,
          "y": 1824.085205078125,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 230.48568725585938,
          "y": 1249.7015380859375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1299135",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365452",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365499",
         "renderedBox": {
          "x": 477.02545166015625,
          "y": 1831.083251953125,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 255.06790161132812,
          "y": 1254.7015380859375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1299138",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365452",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365506",
         "renderedBox": {
          "x": 511.4308166503906,
          "y": 1838.081298828125,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 279.650146484375,
          "y": 1259.7015380859375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1299139",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365452",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365513",
         "renderedBox": {
          "x": 545.836181640625,
          "y": 1845.079345703125,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 304.2323913574219,
          "y": 1264.7015380859375,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2365452",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1299142",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365453",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365520",
         "renderedBox": {
          "x": 580.2415161132812,
          "y": 1852.0772705078125,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 328.8146057128906,
          "y": 1269.7015380859375,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1299143",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365453",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365527",
         "renderedBox": {
          "x": 614.6468505859375,
          "y": 1838.081298828125,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 353.3968200683594,
          "y": 1259.7015380859375,
          "width": 12.018280029296875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1299146",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365453",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365534",
         "renderedBox": {
          "x": 650.4517822265625,
          "y": 1831.8258056640625,
          "width": 33.38824462890625,
          "height": 41.165283203125
         },
         "logicalBox": {
          "x": 378.9790344238281,
          "y": 1255.2320556640625,
          "width": 23.85552978515625,
          "height": 29.412109375
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto1299147",
          "type": "SmoNote"
         },
         "clef": "treble",
         "beam_group": {
          "id": "auto2365453",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2365543",
         "renderedBox": {
          "x": 701.4246215820312,
          "y": 1831.083251953125,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 415.3985595703125,
          "y": 1254.7015380859375,
          "width": 12.018280029296875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2365453",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1351378",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1351382",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 3072,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1414086",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 5
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1299131",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1299134",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1299135",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1299138",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1299139",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1299142",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1299143",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1299146",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1299147",
          "type": "SmoNote"
         },
         "clef": "treble",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    }
   ]
  },
  {
   "staffId": 1,
   "staffX": 10,
   "staffY": 40,
   "adjY": 0,
   "staffWidth": 1600,
   "staffHeight": 90,
   "startIndex": 0,
   "renumberingMap": {},
   "keySignatureMap": {},
   "instrumentInfo": {
    "instrumentName": "Bass Clef Staff",
    "keyOffset": 0,
    "clef": "bass"
   },
   "modifiers": [
    {
     "startSelector": {
      "staff": 1,
      "measure": 2,
      "voice": 0,
      "tick": 1,
      "pitches": []
     },
     "endSelector": {
      "staff": 1,
      "measure": 2,
      "voice": 0,
      "tick": 4,
      "pitches": []
     },
     "spacing": 2,
     "xOffset": 0,
     "yOffset": 10,
     "position": 4,
     "position_end": 1,
     "invert": false,
     "cp1x": 0,
     "cp1y": 40,
     "cp2x": 0,
     "cp2y": 40,
     "attrs": {
      "id": "auto588494",
      "type": "SmoSlur"
     },
     "thickness": 2,
     "ctor": "SmoSlur"
    },
    {
     "startSelector": {
      "staff": 1,
      "measure": 2,
      "voice": 0,
      "tick": 5,
      "pitches": []
     },
     "endSelector": {
      "staff": 1,
      "measure": 3,
      "voice": 0,
      "tick": 0,
      "pitches": []
     },
     "spacing": 2,
     "xOffset": 0,
     "yOffset": 10,
     "position": 4,
     "position_end": 1,
     "invert": false,
     "cp1x": 0,
     "cp1y": 40,
     "cp2x": 0,
     "cp2y": 40,
     "attrs": {
      "id": "auto594340",
      "type": "SmoSlur"
     },
     "thickness": 2,
     "ctor": "SmoSlur"
    },
    {
     "startSelector": {
      "staff": 1,
      "measure": 3,
      "voice": 0,
      "tick": 1,
      "pitches": []
     },
     "endSelector": {
      "staff": 1,
      "measure": 3,
      "voice": 0,
      "tick": 6,
      "pitches": []
     },
     "spacing": 2,
     "xOffset": 0,
     "yOffset": 10,
     "position": 4,
     "position_end": 1,
     "invert": false,
     "cp1x": 0,
     "cp1y": 40,
     "cp2x": 0,
     "cp2y": 40,
     "attrs": {
      "id": "auto617832",
      "type": "SmoSlur"
     },
     "thickness": 2,
     "ctor": "SmoSlur"
    },
    {
     "startSelector": {
      "staff": 1,
      "measure": 1,
      "voice": 0,
      "tick": 0,
      "pitches": []
     },
     "endSelector": {
      "staff": 1,
      "measure": 1,
      "voice": 0,
      "tick": 1,
      "pitches": []
     },
     "spacing": 2,
     "xOffset": 0,
     "yOffset": 10,
     "position": 4,
     "position_end": 1,
     "invert": false,
     "cp1x": 0,
     "cp1y": 40,
     "cp2x": 0,
     "cp2y": 40,
     "attrs": {
      "id": "auto3323430",
      "type": "SmoSlur"
     },
     "thickness": 2,
     "ctor": "SmoSlur"
    }
   ],
   "measures": [
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 240.19468688964844,
     "measureNumber": {
      "measureNumber": 0,
      "measureIndex": 0,
      "systemIndex": 0,
      "staffId": 1
     },
     "staffWidth": 557.2199993133545,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 66.8,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto45839",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2354335",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354353",
         "renderedBox": {
          "x": 537.11669921875,
          "y": 434.2589416503906,
          "width": 17.6854248046875,
          "height": 36.11749267578125
         },
         "logicalBox": {
          "x": 298.0024108886719,
          "y": 256.6864318847656,
          "width": 12.63604736328125,
          "height": 25.8055419921875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto45840",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2354335",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354359",
         "renderedBox": {
          "x": 590.85107421875,
          "y": 438.8571472167969,
          "width": 16.8206787109375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 336.39501953125,
          "y": 259.9718017578125,
          "width": 12.0181884765625,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto45843",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2354335",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354366",
         "renderedBox": {
          "x": 643.7206420898438,
          "y": 431.859130859375,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 374.1697082519531,
          "y": 254.97178649902344,
          "width": 12.018280029296875,
          "height": 10.473861694335938
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto45844",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2354335",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354373",
         "renderedBox": {
          "x": 696.59033203125,
          "y": 424.86114501953125,
          "width": 16.82080078125,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 411.94451904296875,
          "y": 249.97181701660156,
          "width": 12.01824951171875,
          "height": 10.473831176757812
         }
        }
       ],
       "attrs": {
        "id": "auto2354335",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto45847",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2354336",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354380",
         "renderedBox": {
          "x": 749.4600219726562,
          "y": 417.8631286621094,
          "width": 16.82073974609375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 449.71929931640625,
          "y": 244.9718017578125,
          "width": 12.018218994140625,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto45848",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2354336",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354387",
         "renderedBox": {
          "x": 802.3297119140625,
          "y": 431.859130859375,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 487.4941101074219,
          "y": 254.97178649902344,
          "width": 12.018218994140625,
          "height": 10.473861694335938
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto45851",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2354336",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354394",
         "renderedBox": {
          "x": 855.1993408203125,
          "y": 424.86114501953125,
          "width": 16.82080078125,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 525.2688598632812,
          "y": 249.97181701660156,
          "width": 12.01824951171875,
          "height": 10.473831176757812
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto45852",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2354336",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2354401",
         "renderedBox": {
          "x": 908.0690307617188,
          "y": 438.8571472167969,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 563.0436401367188,
          "y": 259.9718017578125,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        }
       ],
       "attrs": {
        "id": "auto2354336",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 8192,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto27338",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto45839",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto45840",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto45843",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto45844",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto45847",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto45848",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto45851",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto45852",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      },
      {
       "position": 0,
       "barline": 3,
       "ctor": "SmoBarline"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 587.2199993133545,
     "staffY": 240.19468688964844,
     "measureNumber": {
      "measureNumber": 1,
      "measureIndex": 1,
      "systemIndex": 1,
      "staffId": 1
     },
     "staffWidth": 503.2400207519531,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto134691",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355386",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355392",
         "renderedBox": {
          "x": 965.6995239257812,
          "y": 410.8651123046875,
          "width": 16.82073974609375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 604.219970703125,
          "y": 239.9718017578125,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto134692",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355386",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355399",
         "renderedBox": {
          "x": 1040.95654296875,
          "y": 459.8511962890625,
          "width": 16.82080078125,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 657.990234375,
          "y": 274.9718017578125,
          "width": 12.018310546875,
          "height": 10.473846435546875
         }
        }
       ],
       "attrs": {
        "id": "auto2355386",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto183282",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355387",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355412",
         "renderedBox": {
          "x": 1236.4783935546875,
          "y": 427.2609558105469,
          "width": 17.6854248046875,
          "height": 36.117462158203125
         },
         "logicalBox": {
          "x": 797.6884155273438,
          "y": 251.6864471435547,
          "width": 12.63604736328125,
          "height": 25.805526733398438
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto183283",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355387",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355418",
         "renderedBox": {
          "x": 1287.5806884765625,
          "y": 410.8651123046875,
          "width": 16.8206787109375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 834.2003784179688,
          "y": 239.9718017578125,
          "width": 12.0181884765625,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto183286",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355387",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355425",
         "renderedBox": {
          "x": 1337.8182373046875,
          "y": 403.8670959472656,
          "width": 16.82080078125,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 870.0945434570312,
          "y": 234.9718017578125,
          "width": 12.018310546875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto183287",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355387",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355432",
         "renderedBox": {
          "x": 1388.0560302734375,
          "y": 396.86907958984375,
          "width": 16.8206787109375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 905.9888916015625,
          "y": 229.9718017578125,
          "width": 12.0181884765625,
          "height": 10.473831176757812
         }
        }
       ],
       "attrs": {
        "id": "auto2355387",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto183290",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355388",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355439",
         "renderedBox": {
          "x": 1438.293701171875,
          "y": 389.8710632324219,
          "width": 16.8206787109375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 941.8831176757812,
          "y": 224.9718017578125,
          "width": 12.0181884765625,
          "height": 10.473861694335938
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto183291",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355388",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355446",
         "renderedBox": {
          "x": 1488.5313720703125,
          "y": 403.8670959472656,
          "width": 16.8206787109375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 977.7774047851562,
          "y": 234.9718017578125,
          "width": 12.0181884765625,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto183294",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355388",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355453",
         "renderedBox": {
          "x": 1538.7689208984375,
          "y": 396.86907958984375,
          "width": 16.82080078125,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 1013.6715698242188,
          "y": 229.9718017578125,
          "width": 12.01824951171875,
          "height": 10.473831176757812
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto183295",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2355388",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2355460",
         "renderedBox": {
          "x": 1589.006591796875,
          "y": 410.8651123046875,
          "width": 16.8206787109375,
          "height": 14.659210205078125
         },
         "logicalBox": {
          "x": 1049.5657958984375,
          "y": 239.9718017578125,
          "width": 12.0181884765625,
          "height": 10.473846435546875
         }
        }
       ],
       "attrs": {
        "id": "auto2355388",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134691",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto134692",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto12942",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto183282",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto183283",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto183286",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto183287",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto183290",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto183291",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto183294",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto183295",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 480.3778610229492,
     "measureNumber": {
      "measureNumber": 2,
      "measureIndex": 2,
      "systemIndex": 0,
      "staffId": 1
     },
     "staffWidth": 553.2999858856201,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 66.8,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto266565",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2356791",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356804",
         "renderedBox": {
          "x": 261.9492492675781,
          "y": 726.031982421875,
          "width": 16.820770263671875,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 101.39839935302734,
          "y": 465.15496826171875,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto266566",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2356791",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356811",
         "renderedBox": {
          "x": 345.13812255859375,
          "y": 733.030029296875,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 160.83590698242188,
          "y": 470.15496826171875,
          "width": 12.018218994140625,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2356791",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto266569",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2356792",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356818",
         "renderedBox": {
          "x": 428.32696533203125,
          "y": 726.031982421875,
          "width": 16.820770263671875,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 220.2733917236328,
          "y": 465.15496826171875,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto266570",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2356792",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356825",
         "renderedBox": {
          "x": 511.515869140625,
          "y": 719.0339965820312,
          "width": 16.8206787109375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 279.7109069824219,
          "y": 460.15496826171875,
          "width": 12.0181884765625,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2356792",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto266573",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2356793",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356832",
         "renderedBox": {
          "x": 594.7047119140625,
          "y": 712.0359497070312,
          "width": 16.82073974609375,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 339.1484069824219,
          "y": 455.1549377441406,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto266574",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2356793",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356839",
         "renderedBox": {
          "x": 677.8935546875,
          "y": 747.0260620117188,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 398.58587646484375,
          "y": 480.1549987792969,
          "width": 12.018218994140625,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2356793",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto266577",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2356794",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356846",
         "renderedBox": {
          "x": 761.0823974609375,
          "y": 740.0280151367188,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 458.0233459472656,
          "y": 475.15496826171875,
          "width": 12.018280029296875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto266578",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2356794",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2356853",
         "renderedBox": {
          "x": 844.2713012695312,
          "y": 733.030029296875,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 517.4608764648438,
          "y": 470.15496826171875,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2356794",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto266565",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto266566",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto266569",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto266570",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto266573",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto266574",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto266577",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto266578",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 583.2999858856201,
     "staffY": 480.3778610229492,
     "measureNumber": {
      "measureNumber": 3,
      "measureIndex": 3,
      "systemIndex": 1,
      "staffId": 1
     },
     "staffWidth": 508.1600341796875,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto399180",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358007",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358013",
         "renderedBox": {
          "x": 960.2130737304688,
          "y": 726.031982421875,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 600.2999877929688,
          "y": 465.15496826171875,
          "width": 12.01824951171875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto399181",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358007",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358020",
         "renderedBox": {
          "x": 1046.17333984375,
          "y": 761.0220336914062,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 661.7175903320312,
          "y": 490.1549377441406,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2358007",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto399176",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358008",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358027",
         "renderedBox": {
          "x": 1133.533203125,
          "y": 740.7706298828125,
          "width": 33.3883056640625,
          "height": 41.16510009765625
         },
         "logicalBox": {
          "x": 724.13525390625,
          "y": 475.685546875,
          "width": 23.85552978515625,
          "height": 29.4119873046875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto399177",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358008",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358036",
         "renderedBox": {
          "x": 1236.0609130859375,
          "y": 747.0260620117188,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 797.39013671875,
          "y": 480.1549987792969,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2358008",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto520233",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358009",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358043",
         "renderedBox": {
          "x": 1322.0211181640625,
          "y": 740.0280151367188,
          "width": 16.82080078125,
          "height": 14.65924072265625
         },
         "logicalBox": {
          "x": 858.8076782226562,
          "y": 475.15496826171875,
          "width": 12.018310546875,
          "height": 10.473846435546875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto520234",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358009",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358050",
         "renderedBox": {
          "x": 1407.9814453125,
          "y": 733.030029296875,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 920.2254028320312,
          "y": 470.15496826171875,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2358009",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto399180",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto399181",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto399176",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto399177",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto520233",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto520234",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto12972",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 685.6672286987305,
     "measureNumber": {
      "measureNumber": 4,
      "measureIndex": 4,
      "systemIndex": 0,
      "staffId": 1
     },
     "staffWidth": 511.0599956512451,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 66.8,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "attrs": {
          "id": "auto2112596",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358917",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358930",
         "renderedBox": {
          "x": 261.9492492675781,
          "y": 1013.35546875,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 101.39839935302734,
          "y": 670.4443359375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2112597",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358917",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358937",
         "renderedBox": {
          "x": 305.0303955078125,
          "y": 1055.343505859375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 132.17938232421875,
          "y": 700.4442749023438,
          "width": 12.018234252929688,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2112600",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358917",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358944",
         "renderedBox": {
          "x": 348.11151123046875,
          "y": 1048.3455810546875,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 162.96035766601562,
          "y": 695.4443359375,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2112601",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358917",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358951",
         "renderedBox": {
          "x": 392.5922546386719,
          "y": 1028.0941162109375,
          "width": 33.38824462890625,
          "height": 41.1651611328125
         },
         "logicalBox": {
          "x": 194.74134826660156,
          "y": 680.9749145507812,
          "width": 23.855514526367188,
          "height": 29.41204833984375
         }
        }
       ],
       "attrs": {
        "id": "auto2358917",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2112604",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358918",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358960",
         "renderedBox": {
          "x": 452.2408752441406,
          "y": 1034.349609375,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 237.35960388183594,
          "y": 685.4443969726562,
          "width": 12.018218994140625,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2112605",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358918",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358967",
         "renderedBox": {
          "x": 495.3219909667969,
          "y": 1048.3455810546875,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 268.14056396484375,
          "y": 695.4443359375,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2112608",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358918",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358974",
         "renderedBox": {
          "x": 538.4031372070312,
          "y": 1041.3475341796875,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 298.92156982421875,
          "y": 690.4443359375,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2112609",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358918",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358981",
         "renderedBox": {
          "x": 581.4842529296875,
          "y": 1055.343505859375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 329.7025146484375,
          "y": 700.4442749023438,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        }
       ],
       "attrs": {
        "id": "auto2358918",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2326933",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358919",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358988",
         "renderedBox": {
          "x": 624.5654296875,
          "y": 1034.349609375,
          "width": 16.82073974609375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 360.4835510253906,
          "y": 685.4443969726562,
          "width": 12.018218994140625,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto2326934",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358919",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2358995",
         "renderedBox": {
          "x": 685.5093383789062,
          "y": 1069.339599609375,
          "width": 16.8206787109375,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 404.02728271484375,
          "y": 710.4443359375,
          "width": 12.018157958984375,
          "height": 10.47381591796875
         }
        }
       ],
       "attrs": {
        "id": "auto2358919",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2326937",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358920",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359002",
         "renderedBox": {
          "x": 746.4531860351562,
          "y": 1062.341552734375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 447.5709533691406,
          "y": 705.4443359375,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2326938",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2358920",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2359009",
         "renderedBox": {
          "x": 807.3970947265625,
          "y": 1055.343505859375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 491.11468505859375,
          "y": 700.4442749023438,
          "width": 12.018218994140625,
          "height": 10.47393798828125
         }
        }
       ],
       "attrs": {
        "id": "auto2358920",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2112596",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2112597",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2112600",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2112601",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2112604",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2112605",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2112608",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2112609",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2326933",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2326934",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2326937",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2326938",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 541.0599956512451,
     "staffY": 685.6672286987305,
     "measureNumber": {
      "measureNumber": 5,
      "measureIndex": 5,
      "systemIndex": 1,
      "staffId": 1
     },
     "staffWidth": 549.3200073242188,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2596642",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2360385",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360392",
         "renderedBox": {
          "x": 901.0939331054688,
          "y": 1048.3455810546875,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 558.0599975585938,
          "y": 695.4443359375,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2596643",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2360385",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360399",
         "renderedBox": {
          "x": 991.4527587890625,
          "y": 1028.0941162109375,
          "width": 33.38818359375,
          "height": 41.1651611328125
         },
         "logicalBox": {
          "x": 622.620361328125,
          "y": 680.9749145507812,
          "width": 23.85546875,
          "height": 29.41204833984375
         }
        }
       ],
       "attrs": {
        "id": "auto2360385",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2596646",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2360386",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360408",
         "renderedBox": {
          "x": 1096.9793701171875,
          "y": 1034.349609375,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 698.0179443359375,
          "y": 685.4443969726562,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2596647",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2360386",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360415",
         "renderedBox": {
          "x": 1185.9385986328125,
          "y": 1048.3455810546875,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 761.5783081054688,
          "y": 695.4443359375,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        }
       ],
       "attrs": {
        "id": "auto2360386",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 3072,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto2620040",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2360387",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360422",
         "renderedBox": {
          "x": 1274.8978271484375,
          "y": 1066.852294921875,
          "width": 26.617919921875,
          "height": 17.146484375
         },
         "logicalBox": {
          "x": 825.138671875,
          "y": 708.6671752929688,
          "width": 19.0181884765625,
          "height": 12.2509765625
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2620041",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2360387",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360430",
         "renderedBox": {
          "x": 1404.125,
          "y": 1062.341552734375,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 917.469970703125,
          "y": 705.4443359375,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2360387",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto2596654",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2360388",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360437",
         "renderedBox": {
          "x": 1461.2138671875,
          "y": 1055.343505859375,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 958.2593383789062,
          "y": 700.4442749023438,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto2596655",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2360388",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2360444",
         "renderedBox": {
          "x": 1550.1729736328125,
          "y": 1104.32958984375,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 1021.819580078125,
          "y": 735.4442749023438,
          "width": 12.018310546875,
          "height": 10.47393798828125
         }
        }
       ],
       "attrs": {
        "id": "auto2360388",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2596642",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2596643",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2596646",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2596647",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 3072,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "b",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2620040",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2620041",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2596654",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2596655",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 935.5527267456055,
     "measureNumber": {
      "measureNumber": 6,
      "measureIndex": 6,
      "systemIndex": 0,
      "staffId": 1
     },
     "staffWidth": 377.2000102996826,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 66.8,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "r",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto8459958",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2361224",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361235",
         "renderedBox": {
          "x": 261.9492492675781,
          "y": 1428.477783203125,
          "width": 17.685394287109375,
          "height": 36.1175537109375
         },
         "logicalBox": {
          "x": 101.39839935302734,
          "y": 967.0444946289062,
          "width": 12.636009216308594,
          "height": 25.80560302734375
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto8459959",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2361224",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361241",
         "renderedBox": {
          "x": 298.40679931640625,
          "y": 1426.077880859375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 127.44690704345703,
          "y": 965.3297729492188,
          "width": 12.018226623535156,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto8459962",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2361224",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361248",
         "renderedBox": {
          "x": 333.99969482421875,
          "y": 1433.075927734375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 152.87762451171875,
          "y": 970.329833984375,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto8459963",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2361224",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361255",
         "renderedBox": {
          "x": 369.59259033203125,
          "y": 1433.075927734375,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 178.308349609375,
          "y": 970.329833984375,
          "width": 12.018234252929688,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2361224",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto8459966",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2361225",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361262",
         "renderedBox": {
          "x": 405.1855163574219,
          "y": 1433.075927734375,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 203.7390899658203,
          "y": 970.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto8459967",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2361225",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361269",
         "renderedBox": {
          "x": 440.7784423828125,
          "y": 1433.075927734375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 229.16983032226562,
          "y": 970.329833984375,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto8459970",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2361225",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361276",
         "renderedBox": {
          "x": 476.371337890625,
          "y": 1433.075927734375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 254.6005401611328,
          "y": 970.329833984375,
          "width": 12.018234252929688,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "attrs": {
          "id": "auto8459971",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2361225",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2361283",
         "renderedBox": {
          "x": 511.9642639160156,
          "y": 1433.075927734375,
          "width": 16.820709228515625,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 280.0312805175781,
          "y": 970.329833984375,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2361225",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "r",
         "attrs": {
          "id": "auto8459958",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto8459959",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto8459962",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto8459963",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto8459966",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto8459967",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto8459970",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 2
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto8459971",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1906368",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1906369",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 407.2000102996826,
     "staffY": 935.5527267456055,
     "measureNumber": {
      "measureNumber": 7,
      "measureIndex": 7,
      "systemIndex": 1,
      "staffId": 1
     },
     "staffWidth": 359.0799865722656,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1532842",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362148",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362155",
         "renderedBox": {
          "x": 713.7431640625,
          "y": 1377.091796875,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 424.20001220703125,
          "y": 930.3297729492188,
          "width": 12.018218994140625,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1532843",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362148",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362162",
         "renderedBox": {
          "x": 748.410888671875,
          "y": 1405.0838623046875,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 448.9697265625,
          "y": 950.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1532846",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362148",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362169",
         "renderedBox": {
          "x": 783.0786743164062,
          "y": 1398.0859375,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 473.73944091796875,
          "y": 945.3298950195312,
          "width": 12.018280029296875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1532847",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362148",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362176",
         "renderedBox": {
          "x": 819.1460571289062,
          "y": 1377.83447265625,
          "width": 33.3883056640625,
          "height": 41.1650390625
         },
         "logicalBox": {
          "x": 499.5091857910156,
          "y": 930.8604125976562,
          "width": 23.855560302734375,
          "height": 29.4119873046875
         }
        }
       ],
       "attrs": {
        "id": "auto2362148",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1532850",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362149",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362185",
         "renderedBox": {
          "x": 870.38134765625,
          "y": 1384.08984375,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 536.1162109375,
          "y": 935.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1532851",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362149",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362192",
         "renderedBox": {
          "x": 905.049072265625,
          "y": 1398.0859375,
          "width": 16.82080078125,
          "height": 14.6591796875
         },
         "logicalBox": {
          "x": 560.8859252929688,
          "y": 945.3298950195312,
          "width": 12.01824951171875,
          "height": 10.47381591796875
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1532854",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362149",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362199",
         "renderedBox": {
          "x": 939.7168579101562,
          "y": 1391.087890625,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 585.6556396484375,
          "y": 940.329833984375,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1532855",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362149",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362206",
         "renderedBox": {
          "x": 974.3847045898438,
          "y": 1405.0838623046875,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 610.4254150390625,
          "y": 950.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2362149",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1873973",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362150",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362213",
         "renderedBox": {
          "x": 1009.0524291992188,
          "y": 1377.091796875,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 635.1951293945312,
          "y": 930.3297729492188,
          "width": 12.01824951171875,
          "height": 10.47393798828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1873974",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362150",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362220",
         "renderedBox": {
          "x": 1053.169677734375,
          "y": 1356.0977783203125,
          "width": 16.820556640625,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 666.7164306640625,
          "y": 915.329833984375,
          "width": 12.01806640625,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2362150",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1873977",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362151",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362227",
         "renderedBox": {
          "x": 1097.2867431640625,
          "y": 1363.0958251953125,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 698.237548828125,
          "y": 920.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto1873978",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2362151",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2362234",
         "renderedBox": {
          "x": 1141.4039306640625,
          "y": 1356.0977783203125,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 729.7587890625,
          "y": 915.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2362151",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1532842",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1532843",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1532846",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1532847",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1532850",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "e",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1532851",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "f",
           "accidental": "#",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1532854",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1532855",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "a",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1873973",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1873974",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "c",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1873977",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 2048,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 4
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1873978",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 766.2799968719482,
     "staffY": 935.5527267456055,
     "measureNumber": {
      "measureNumber": 8,
      "measureIndex": 8,
      "systemIndex": 2,
      "staffId": 1
     },
     "staffWidth": 323.22003173828125,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto2258110",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363218",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363223",
         "renderedBox": {
          "x": 1216.3123779296875,
          "y": 1384.08984375,
          "width": 16.8206787109375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 783.280029296875,
          "y": 935.329833984375,
          "width": 12.0181884765625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto2258111",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363218",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363230",
         "renderedBox": {
          "x": 1252.1185302734375,
          "y": 1384.08984375,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 808.8630981445312,
          "y": 935.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto2258114",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363218",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363237",
         "renderedBox": {
          "x": 1287.9246826171875,
          "y": 1384.08984375,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 834.4461669921875,
          "y": 935.329833984375,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto2258115",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363218",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363244",
         "renderedBox": {
          "x": 1323.7308349609375,
          "y": 1384.08984375,
          "width": 16.8206787109375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 860.029296875,
          "y": 935.329833984375,
          "width": 12.0181884765625,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2363218",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto2258118",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363219",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363251",
         "renderedBox": {
          "x": 1359.5369873046875,
          "y": 1405.0838623046875,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 885.6123657226562,
          "y": 950.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto2258119",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363219",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363258",
         "renderedBox": {
          "x": 1395.3431396484375,
          "y": 1405.0838623046875,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 911.1954345703125,
          "y": 950.329833984375,
          "width": 12.018310546875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto2258122",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363219",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363265",
         "renderedBox": {
          "x": 1431.1492919921875,
          "y": 1405.0838623046875,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 936.778564453125,
          "y": 950.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "clef": "bass",
         "attrs": {
          "id": "auto2258123",
          "type": "SmoNote"
         },
         "beam_group": {
          "id": "auto2363219",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2363272",
         "renderedBox": {
          "x": 1466.9554443359375,
          "y": 1405.0838623046875,
          "width": 16.82080078125,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 962.3616333007812,
          "y": 950.329833984375,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2363219",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2258110",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2258111",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2258114",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "g",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2258115",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2258118",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2258119",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2258122",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto2258123",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1867130",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1867131",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 1126.7245407104492,
     "measureNumber": {
      "measureNumber": 9,
      "measureIndex": 9,
      "systemIndex": 0,
      "staffId": 1
     },
     "staffWidth": 397.2000102996826,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 66.8,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto7605883",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2364213",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364224",
         "renderedBox": {
          "x": 261.9492492675781,
          "y": 1672.6485595703125,
          "width": 16.820770263671875,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 101.39839935302734,
          "y": 1141.501708984375,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto7605884",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2364213",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364231",
         "renderedBox": {
          "x": 299.345703125,
          "y": 1672.6485595703125,
          "width": 16.820770263671875,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 128.11773681640625,
          "y": 1141.501708984375,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto7605885",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2364213",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364238",
         "renderedBox": {
          "x": 336.7421569824219,
          "y": 1672.6485595703125,
          "width": 16.820770263671875,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 154.8370819091797,
          "y": 1141.501708984375,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto7605886",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2364213",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364245",
         "renderedBox": {
          "x": 374.13861083984375,
          "y": 1672.6485595703125,
          "width": 16.820770263671875,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 181.55642700195312,
          "y": 1141.501708984375,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        }
       ],
       "attrs": {
        "id": "auto2364213",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto7605887",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2364214",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364252",
         "renderedBox": {
          "x": 411.5350646972656,
          "y": 1672.6485595703125,
          "width": 16.820770263671875,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 208.2757568359375,
          "y": 1141.501708984375,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto7605888",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2364214",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364259",
         "renderedBox": {
          "x": 448.9315185546875,
          "y": 1672.6485595703125,
          "width": 16.82073974609375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 234.99510192871094,
          "y": 1141.501708984375,
          "width": 12.018234252929688,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto7605889",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2364214",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364266",
         "renderedBox": {
          "x": 486.3279724121094,
          "y": 1672.6485595703125,
          "width": 16.820770263671875,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 261.7144470214844,
          "y": 1141.501708984375,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto7605890",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2364214",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2364273",
         "renderedBox": {
          "x": 523.7244262695312,
          "y": 1672.6485595703125,
          "width": 16.82073974609375,
          "height": 14.6590576171875
         },
         "logicalBox": {
          "x": 288.43377685546875,
          "y": 1141.501708984375,
          "width": 12.01824951171875,
          "height": 10.4737548828125
         }
        }
       ],
       "attrs": {
        "id": "auto2364214",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605883",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605884",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605885",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605886",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605887",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605888",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605889",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605890",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605891",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7605892",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 427.2000102996826,
     "staffY": 1126.7245407104492,
     "measureNumber": {
      "measureNumber": 10,
      "measureIndex": 10,
      "systemIndex": 1,
      "staffId": 1
     },
     "staffWidth": 352.06005859375,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7386710",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7386711",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7386712",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7386713",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 779.2600688934326,
     "staffY": 1126.7245407104492,
     "measureNumber": {
      "measureNumber": 11,
      "measureIndex": 11,
      "systemIndex": 2,
      "staffId": 1
     },
     "staffWidth": 154.08001708984375,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7356723",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7356724",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7356725",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7356726",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 933.3400859832764,
     "staffY": 1126.7245407104492,
     "measureNumber": {
      "measureNumber": 12,
      "measureIndex": 12,
      "systemIndex": 3,
      "staffId": 1
     },
     "staffWidth": 154.08001708984375,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 11,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7327032",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7327033",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7327034",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto7327035",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    },
    {
     "timeSignature": "4/4",
     "keySignature": "C",
     "staffX": 30,
     "staffY": 1315.274284362793,
     "measureNumber": {
      "measureNumber": 13,
      "measureIndex": 13,
      "systemIndex": 0,
      "staffId": 1
     },
     "staffWidth": 416.0599956512451,
     "activeVoice": 0,
     "clef": "bass",
     "transposeIndex": 0,
     "adjX": 66.8,
     "adjRight": 11,
     "padRight": 10,
     "rightMargin": 2,
     "tuplets": [],
     "beamGroups": [
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto1763324",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2366064",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2366075",
         "renderedBox": {
          "x": 261.9492492675781,
          "y": 1936.5430908203125,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 101.39839935302734,
          "y": 1330.0513916015625,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto1763325",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2366064",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2366082",
         "renderedBox": {
          "x": 300.9954833984375,
          "y": 1936.5430908203125,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 129.29649353027344,
          "y": 1330.0513916015625,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto1763328",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2366064",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2366089",
         "renderedBox": {
          "x": 340.0417175292969,
          "y": 1936.5430908203125,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 157.194580078125,
          "y": 1330.0513916015625,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto1763329",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2366064",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2366096",
         "renderedBox": {
          "x": 379.08795166015625,
          "y": 1936.5430908203125,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 185.09266662597656,
          "y": 1330.0513916015625,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2366064",
        "type": "SmoBeamGroup"
       }
      },
      {
       "notes": [
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto1763332",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2366065",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2366103",
         "renderedBox": {
          "x": 418.1341857910156,
          "y": 1936.5430908203125,
          "width": 16.820770263671875,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 212.99075317382812,
          "y": 1330.0513916015625,
          "width": 12.01824951171875,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto1763333",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2366065",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2366110",
         "renderedBox": {
          "x": 457.180419921875,
          "y": 1936.5430908203125,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 240.88885498046875,
          "y": 1330.0513916015625,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto1763336",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2366065",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2366117",
         "renderedBox": {
          "x": 496.22662353515625,
          "y": 1936.5430908203125,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 268.78692626953125,
          "y": 1330.0513916015625,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        },
        {
         "noteType": "n",
         "textModifiers": [],
         "articulations": [],
         "endBeam": false,
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "attrs": {
          "id": "auto1763337",
          "type": "SmoNote"
         },
         "clef": "bass",
         "beam_group": {
          "id": "auto2366065",
          "type": "SmoBeamGroup"
         },
         "renderId": "vf-auto2366124",
         "renderedBox": {
          "x": 535.2728881835938,
          "y": 1936.5430908203125,
          "width": 16.82073974609375,
          "height": 14.6593017578125
         },
         "logicalBox": {
          "x": 296.6850280761719,
          "y": 1330.0513916015625,
          "width": 12.018218994140625,
          "height": 10.473876953125
         }
        }
       ],
       "attrs": {
        "id": "auto2366065",
        "type": "SmoBeamGroup"
       }
      }
     ],
     "voices": [
      {
       "notes": [
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1763324",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1763325",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1763328",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1763329",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1763332",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1763333",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1763336",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 1024,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto1763337",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto12985",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        },
        {
         "ticks": {
          "numerator": 4096,
          "denominator": 1,
          "remainder": 0
         },
         "pitches": [
          {
           "letter": "d",
           "accidental": "n",
           "octave": 3
          }
         ],
         "noteType": "n",
         "attrs": {
          "id": "auto12986",
          "type": "SmoNote"
         },
         "clef": "bass",
         "endBeam": false,
         "noteModifiers": []
        }
       ]
      }
     ],
     "modifiers": [
      {
       "position": 0,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "position": 1,
       "barline": 0,
       "ctor": "SmoBarline"
      },
      {
       "symbol": 0,
       "xOffset": 0,
       "yOffset": 30,
       "position": 0,
       "ctor": "SmoRepeatSymbol"
      }
     ]
    }
   ]
  }
 ],
 "scoreText": [
  {
   "ctor": "SmoScoreText",
   "attrs": {
    "id": "auto3181348",
    "type": "SmoScoreText"
   },
   "backup": {},
   "edited": false,
   "x": 264.1640625,
   "y": 72.171875,
   "text": "15 Inventions a 2 voix",
   "pagination": "every",
   "position": "title",
   "fontInfo": {
    "size": "1.8em",
    "family": "Times New Roman",
    "style": "normal",
    "weight": "normal"
   },
   "classes": "score-text auto3181348 auto1328",
   "boxModel": "none",
   "justification": "left",
   "fill": "black",
   "width": 0,
   "height": 0,
   "scaleX": 1,
   "scaleY": 1,
   "translateX": 0,
   "translateY": 0,
   "autoLayout": false,
   "renderedBox": {
    "x": 489.7455139160156,
    "y": 139.99403381347656,
    "height": 45.02783203125,
    "width": 360.4413757324219
   },
   "logicalBox": {
    "x": 264.15625,
    "y": 46.4375,
    "width": 257.53125,
    "height": 32.171875
   }
  }
 ]
}` ;;

// ## RibbonButtons
// Render the ribbon buttons based on group, function, and underlying UI handler.
// Also handles UI events.
// ## RibbonButton methods
// ---
class RibbonButtons {
	static get paramArray() {
		return ['ribbonButtons', 'ribbons', 'editor', 'controller', 'tracker', 'menus'];
	}
	static ribbonButton(buttonId, buttonClass, buttonText, buttonIcon, buttonKey) {
		var b = htmlHelpers.buildDom;
		var r = b('div').classes('ribbonButtonContainer').append(b('button').attr('id', buttonId).classes(buttonClass).append(
					b('span').classes('left-text').append(
					    b('span').classes('text-span').text(buttonText)).append(
					b('span').classes('ribbon-button-text icon ' + buttonIcon))).append(
					b('span').classes('ribbon-button-hotkey').text(buttonKey)));
		return r.dom();
	}
	constructor(parameters) {
		smoMusic.filteredMerge(RibbonButtons.paramArray, parameters, this);
		this.ribbonButtons = parameters.ribbonButtons;
		this.ribbons = parameters.ribbons;
		this.collapsables = [];
		this.collapseChildren = [];
	}
	_executeButtonModal(buttonElement, buttonData) {
		var ctor = eval(buttonData.ctor);
		ctor.createAndDisplay(buttonElement, buttonData,this.controller);
	}
	_executeButtonMenu(buttonElement, buttonData) {
		var self = this;
        this.controller.unbindKeyboardForMenu(this.menus);
		this.menus.createMenu(buttonData.ctor);
	}
	_bindCollapsibleAction(buttonElement, buttonData) {
		// collapseParent
		this.collapsables.push(new CollapseRibbonControl({
				ribbonButtons: this.ribbonButtons,
				menus: this.menus,
				tracker: this.tracker,
				controller: this.controller,
				editor: this.editor,
				buttonElement: buttonElement,
				buttonData: buttonData
			}));
	}

	_rebindController() {
		this.controller.render();
		this.controller.bindEvents();
	}
	_executeButton(buttonElement, buttonData) {
		if (buttonData.action === 'modal') {
			this._executeButtonModal(buttonElement, buttonData);
			return;
		}
		if (buttonData.action === 'menu') {
			this._executeButtonMenu(buttonElement, buttonData);
			return;
		}
	}

	_bindButton(buttonElement, buttonData) {
		var self = this;
		$(buttonElement).off('click').on('click', function () {
			self._executeButton(buttonElement, buttonData);
		});
	}
	_createButtonHtml(buttonAr, selector) {
		buttonAr.forEach((buttonId) => {
			var b = this.ribbonButtons.find((e) => {
					return e.id === buttonId;
				});
			if (b) {
				if (b.action === 'collapseChild') {
					this.collapseChildren.push(b);
				} else {

					var buttonHtml = RibbonButtons.ribbonButton(b.id, b.classes, b.leftText, b.icon, b.rightText);
					$(buttonHtml).attr('data-group', b.group);

					$(selector).append(buttonHtml);
					var el = $(selector).find('#' + b.id);
					this._bindButton(el, b);
					if (b.action == 'collapseParent') {
						$(buttonHtml).addClass('collapseContainer');
						this._bindCollapsibleAction(el, b);
					}
				}
			}
		});
		this.collapseChildren.forEach((b) => {
			var buttonHtml = RibbonButtons.ribbonButton(b.id, b.classes, b.leftText, b.icon, b.rightText);
			if (b.dataElements) {
				var bkeys = Object.keys(b.dataElements);
				bkeys.forEach((bkey) => {
					var de = b.dataElements[bkey];
					$(buttonHtml).find('button').attr('data-' + bkey, de);
				});
			}
			var parent = $(selector).find('.collapseContainer[data-group="' + b.group + '"]');
			$(parent).append(buttonHtml);
			var el = $(selector).find('#' + b.id);
			this._bindButton(el, b);
		});
		this.collapsables.forEach((cb) => {
			cb.bind();
		});
	}
	display() {
		$('body .controls-left').html('');
		$('body .controls-top').html('');

		var buttonAr = this.ribbons['left'];
		this._createButtonHtml(buttonAr, 'body .controls-left');

		buttonAr = this.ribbons['top'];
		this._createButtonHtml(buttonAr, 'body .controls-top');
	}
}

class DebugButtons {
	constructor(parameters) {
		this.buttonElement = parameters.buttonElement;
		this.buttonData = parameters.buttonData;
		this.editor = parameters.editor;
	}
	bind() {
		var self = this;
		$(this.buttonElement).off('click').on('click', function () {
			$('body').trigger('redrawScore');
		});
    }
}
class DurationButtons {
	constructor(parameters) {
		this.buttonElement = parameters.buttonElement;
		this.buttonData = parameters.buttonData;
		this.editor = parameters.editor;
	}
	setDuration() {
		if (this.buttonData.id === 'GrowDuration') {
			this.editor.doubleDuration();
		} else if (this.buttonData.id === 'LessDuration') {
			this.editor.halveDuration();
		} else if (this.buttonData.id === 'GrowDurationDot') {
			this.editor.dotDuration();
		} else if (this.buttonData.id === 'LessDurationDot') {
			this.editor.undotDuration();
		} else if (this.buttonData.id === 'TripletButton') {
			this.editor.makeTupletCommand(3);
		} else if (this.buttonData.id === 'QuintupletButton') {
			this.editor.makeTupletCommand(5);
		} else if (this.buttonData.id === 'SeptupletButton') {
			this.editor.makeTupletCommand(7);
		} else if (this.buttonData.id === 'NoTupletButton') {
			this.editor.unmakeTuplet();
		}
	}
	bind() {
		var self = this;
		$(this.buttonElement).off('click').on('click', function () {
			self.setDuration();
		});
	}
}

class NoteButtons {
	constructor(parameters) {
		this.buttonElement = parameters.buttonElement;
		this.buttonData = parameters.buttonData;
		this.editor = parameters.editor;
	}
	setPitch() {
		if (this.buttonData.id === 'UpNoteButton') {
			this.editor.transposeUp();
		} else if (this.buttonData.id === 'DownNoteButton') {
			this.editor.transposeDown();
		} else if (this.buttonData.id === 'UpOctaveButton') {
			this.editor.upOctave();
		} else if (this.buttonData.id === 'DownOctaveButton') {
			this.editor.downOctave();
		} else if (this.buttonData.id === 'ToggleAccidental') {
			this.editor.toggleEnharmonic();
		} else if (this.buttonData.id === 'ToggleCourtesy') {
			this.editor.toggleCourtesyAccidental();
		} else if (this.buttonData.id === 'ToggleRestButton') {
			this.editor.makeRest();
		} else {
			this.editor.setPitchCommand(this.buttonData.rightText);
		}
	}
	bind() {
		var self = this;
		$(this.buttonElement).off('click').on('click', function () {
			self.setPitch();
		});
	}
}

class ChordButtons {
	constructor(parameters) {
		this.buttonElement = parameters.buttonElement;
		this.buttonData = parameters.buttonData;
		this.editor = parameters.editor;
		this.tracker = parameters.tracker;
		this.score = parameters.score;
		this.interval = parseInt($(this.buttonElement).attr('data-interval'));
		this.direction = parseInt($(this.buttonElement).attr('data-direction'));
	}
	static get direction() {
		return {
			up: 1,
			down: -1
		}
	}
	static get intervalButtonMap() {}
	collapseChord() {
		this.editor.collapseChord();
	}
	setInterval() {
		this.editor.intervalAdd(this.interval, this.direction);
	}
	bind() {
		var self = this;
		$(this.buttonElement).off('click').on('click', function () {
			if ($(self.buttonElement).attr('id') === 'CollapseChordButton') {
				self.collapseChord();
				return;
			}
			self.setInterval();
		});
	}
}
class MeasureButtons {
	constructor(parameters) {
		this.buttonElement = parameters.buttonElement;
		this.buttonData = parameters.buttonData;
		this.tracker = parameters.tracker;
		this.editor = parameters.editor;
		this.score = this.editor.score;
	}
	/* 
	 static get barlines() {
        return {
            singleBar: 0,
            doubleBar: 1,
            endBar: 2,
            startRepeat: 3,
            endRepeat: 4,
            none: 5
        }
    }*/
	setEnding(startBar,endBar,number) {
		this.editor.scoreOperation('addEnding',new SmoVolta({startBar:startBar,endBar:endBar,number:number}));
	}
	setBarline(selection,position,barline,description) {
		this.editor.scoreSelectionOperation(selection, 'setMeasureBarline', new SmoBarline({position:position,barline:barline})
		    ,description);
	}
	setSymbol(selection,position,symbol,description) {
		this.editor.scoreSelectionOperation(selection, 'setRepeatSymbol', new SmoRepeatSymbol({position:position,symbol:symbol})
		    ,description);
	}
	endRepeat() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setBarline(selection,SmoBarline.positions.end,SmoBarline.barlines.endRepeat,'add repeat');
	}
	startRepeat() {
		var selection = this.tracker.getExtremeSelection(-1);
		this.setBarline(selection,SmoBarline.positions.start,SmoBarline.barlines.startRepeat,'add start repeat');
	}
	singleBarStart() {
		var selection = this.tracker.getExtremeSelection(-1);
		this.setBarline(selection,SmoBarline.positions.start,SmoBarline.barlines.singleBar,'single start bar');
	}
    singleBarEnd() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setBarline(selection,SmoBarline.positions.end,SmoBarline.barlines.singleBar,'single  bar');
	}

	doubleBar() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setBarline(selection,SmoBarline.positions.end,SmoBarline.barlines.doubleBar,'double  bar');
	}
	endBar() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setBarline(selection,SmoBarline.positions.end,SmoBarline.barlines.endBar,'final  bar');
	}
	coda() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setSymbol(selection,SmoRepeatSymbol.positions.end,SmoRepeatSymbol.symbols.Coda);
	}
	toCoda() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setSymbol(selection,SmoRepeatSymbol.positions.end,SmoRepeatSymbol.symbols.ToCoda);
	}
	segno() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setSymbol(selection,SmoRepeatSymbol.positions.end,SmoRepeatSymbol.symbols.Segno);
	}
	dsAlCoda() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setSymbol(selection,SmoRepeatSymbol.positions.end,SmoRepeatSymbol.symbols.DsAlCoda);
	}
	dcAlCoda() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setSymbol(selection,SmoRepeatSymbol.positions.end,SmoRepeatSymbol.symbols.DcAlCoda);
	}
	dsAlFine() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setSymbol(selection,SmoRepeatSymbol.positions.end,SmoRepeatSymbol.symbols.DsAlFine);
	}
	dcAlFine() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setSymbol(selection,SmoRepeatSymbol.positions.end,SmoRepeatSymbol.symbols.DcAlFine);
	}
	fine() {
		var selection = this.tracker.getExtremeSelection(1);
		this.setSymbol(selection,SmoRepeatSymbol.positions.end,SmoRepeatSymbol.symbols.Fine);
	}
	nthEnding() {
		var startSel = this.tracker.getExtremeSelection(-1);
		var endSel = this.tracker.getExtremeSelection(1);
		this.setEnding(startSel.selector.measure,endSel.selector.measure,1);
	}
	
	bind() {
		var self = this;
		$(this.buttonElement).off('click').on('click', function (ev) {
			var id = self.buttonData.id;
			if (typeof(self[id]) === 'function') {
				self[id]();
			}
			 console.log('couch');
		});
	}
}

class TextButtons {
	constructor(parameters) {
		this.buttonElement = parameters.buttonElement;
		this.buttonData = parameters.buttonData;
		this.tracker = parameters.tracker;
        this.editor = parameters.editor;
		this.controller = parameters.controller;
        this.menus=parameters.controller.menus;
	}
    lyrics() {
		// tracker, selection, controller
		var selection = this.tracker.getExtremeSelection(-1);
		var editor = new editLyricSession({tracker:this.tracker,selection:selection,controller:this.controller});
		editor.editNote();
    }
    rehearsalMark() {
        var selection = this.tracker.getExtremeSelection(-1);
        var cmd = selection.measure.getRehearsalMark() ? 'removeRehearsalMark' : 'addRehearsalMark';
        this.editor.scoreSelectionOperation(selection, cmd, new SmoRehearsalMark());
    }
    _invokeMenu(cmd) {
      this.controller.unbindKeyboardForMenu(this.menus);
      this.menus.createMenu(cmd);
    }
    addTextMenu() {
        this._invokeMenu('SuiTextMenu');
    }
	addDynamicsMenu() {
        this._invokeMenu('SuiDynamicsMenu');
	}
    bind() {
        var self=this;
        $(this.buttonElement).off('click').on('click', function () {
            self[self.buttonData.id]();
        });
		
	}
}
class NavigationButtons {
	static get directionsTrackerMap() {
		return {
			navLeftButton: 'moveSelectionLeft',
			navRightButton: 'moveSelectionRight',
			navUpButton: 'moveSelectionUp',
			navDownButton: 'moveSelectionDown',
			navFastForward: 'moveSelectionRightMeasure',
			navRewind: 'moveSelectionLeftMeasure',
			navGrowLeft: 'growSelectionLeft',
			navGrowRight: 'growSelectionRight'
		};
	}
	constructor(parameters) {
		this.buttonElement = parameters.buttonElement;
		this.buttonData = parameters.buttonData;
		this.tracker = parameters.tracker;
	}

	_moveTracker() {
		this.tracker[NavigationButtons.directionsTrackerMap[this.buttonData.id]]();
	}
	bind() {
		var self = this;
		$(this.buttonElement).off('click').on('click', function () {
			self._moveTracker();
		});
	}
}
class ArticulationButtons {
	static get articulationIdMap() {
		return {
			accentAboveButton: SmoArticulation.articulations.accent,
			accentBelowButton: SmoArticulation.articulations.accent,
			tenutoAboveButton: SmoArticulation.articulations.tenuto,
			tenutoBelowButton: SmoArticulation.articulations.tenuto,
			staccatoAboveButton: SmoArticulation.articulations.staccato,
			staccatoBelowButton: SmoArticulation.articulations.staccato,
			marcatoAboveButton: SmoArticulation.articulations.marcato,
			marcatoBelowButton: SmoArticulation.articulations.marcato,
			pizzicatoAboveButton: SmoArticulation.articulations.pizzicato,
			pizzicatoBelowButton: SmoArticulation.articulations.pizzicato,
			fermataAboveButton: SmoArticulation.articulations.fermata,
			fermataBelowButton: SmoArticulation.articulations.fermata
		};
	}
	static get placementIdMap() {
		return {
			accentAboveButton: SmoArticulation.positions.above,
			accentBelowButton: SmoArticulation.positions.below,
			tenutoAboveButton: SmoArticulation.positions.above,
			tenutoBelowButton: SmoArticulation.positions.below,
			staccatoAboveButton: SmoArticulation.positions.above,
			staccatoBelowButton: SmoArticulation.positions.below,
			marcatoAboveButton: SmoArticulation.positions.above,
			marcatoBelowButton: SmoArticulation.positions.below,
			pizzicatoAboveButton: SmoArticulation.positions.above,
			pizzicatoBelowButton: SmoArticulation.positions.below,
			fermataAboveButton: SmoArticulation.positions.above,
			fermataBelowButton: SmoArticulation.positions.below
		};
	}
	constructor(parameters) {
		this.buttonElement = parameters.buttonElement;
		this.buttonData = parameters.buttonData;
		this.editor = parameters.editor;
		this.articulation = ArticulationButtons.articulationIdMap[this.buttonData.id];
		this.placement = ArticulationButtons.placementIdMap[this.buttonData.id];
	}
	_toggleArticulation() {
		this.showState = !this.showState;

		this.editor.toggleArticulationCommand(this.articulation, this.placement);
	}
	bind() {
		var self = this;
		$(this.buttonElement).off('click').on('click', function () {
			self._toggleArticulation();
		});
	}
}

class CollapseRibbonControl {
	static get paramArray() {
		return ['ribbonButtons', 'editor', 'controller', 'tracker', 'menus', 'buttonData', 'buttonElement'];
	}
	constructor(parameters) {
		smoMusic.filteredMerge(CollapseRibbonControl.paramArray, parameters, this);
		this.childButtons = parameters.ribbonButtons.filter((cb) => {
				return cb.group === this.buttonData.group && cb.action === 'collapseChild';
			});
	}
	_toggleExpand() {
		this.childButtons.forEach((cb) => {

			var el = $('#' + cb.id);
			$(el).toggleClass('collapsed');
			$(el).toggleClass('expanded');
		});

		this.buttonElement.closest('div').toggleClass('expanded');
		this.buttonElement.toggleClass('expandedChildren');
		if (this.buttonElement.hasClass('expandedChildren')) {
			var leftSpan = $(this.buttonElement).find('.ribbon-button-text');
			$(leftSpan).text('');
			$(leftSpan).removeClass(this.buttonData.icon);
			$(this.buttonElement).addClass('icon icon-circle-left');
		} else {
			$(this.buttonElement).removeClass('icon-circle-left');
			var leftSpan = $(this.buttonElement).find('.ribbon-button-text');
			$(leftSpan).addClass(this.buttonData.icon);
			$(leftSpan).text(this.buttonData.leftText);
		}
		
		// Expand may change music dom, redraw
		this.controller.resizeEvent();
	}
	bind() {
		var self = this;
		$(this.buttonElement).closest('div').addClass('collapseContainer');
		$('#' + this.buttonData.id).off('click').on('click', function () {
			self._toggleExpand();
		});
		this.childButtons.forEach((cb) => {
			var ctor = eval(cb.ctor);
			var el = $('#' + cb.id);
			var btn = new ctor({
					buttonData: cb,
					buttonElement: el,
					editor: this.editor,
					tracker: this.tracker,
					controller: this.controller
				});
			btn.bind();
		});
	}
}
;class SuiStaffModifierDialog extends SuiDialogBase {
	 handleRemove() {
        $(this.context.svg).find('g.' + this.modifier.id).remove();
        SmoUndoable.staffSelectionOp(this.layout.score,this.selection,'removeStaffModifier',this.modifier,this.undo,'remove slur');
        this.tracker.clearModifierSelections();
    }

    _preview() {
        this.modifier.backupOriginal();
        this.components.forEach((component) => {
            this.modifier[component.smoName] = component.getValue();
        });
        this.layout.renderStaffModifierPreview(this.modifier)
    }

    changed() {
        this.modifier.backupOriginal();
        this.components.forEach((component) => {
            this.modifier[component.smoName] = component.getValue();
        });
        this.layout.renderStaffModifierPreview(this.modifier);
    }
}

class SuiSlurAttributesDialog extends SuiStaffModifierDialog {
    static get dialogElements() {
        return [{
                parameterName: 'spacing',
                smoName: 'spacing',
                defaultValue: 2,
                control: 'SuiRockerComponent',
                label: 'Spacing'
            }, {
                smoName: 'thickness',
                parameterName: 'thickness',
                defaultValue: 2,
                control: 'SuiRockerComponent',
                label: 'Thickness'
            }, {
                smoName: 'xOffset',
                parameterName: 'xOffset',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'X Offset'
            }, {
                smoName: 'yOffset',
                parameterName: 'yOffset',
                defaultValue: 10,
                control: 'SuiRockerComponent',
                label: 'Y Offset'
            }, {
                smoName: 'position',
                parameterName: 'position',
                defaultValue: SmoSlur.positions.HEAD,
                options: [{
                        value: SmoSlur.positions.HEAD,
                        label: 'Head'
                    }, {
                        value: SmoSlur.positions.TOP,
                        label: 'Top'
                    }
                ],
                control: 'SuiDropdownComponent',
                label: 'Start Position'
            }, {
                smoName: 'position_end',
                parameterName: 'position_end',
                defaultValue: SmoSlur.positions.HEAD,
                options: [{
                        value: SmoSlur.positions.HEAD,
                        label: 'Head'
                    }, {
                        value: SmoSlur.positions.TOP,
                        label: 'Top'
                    }
                ],
                control: 'SuiDropdownComponent',
                label: 'End Position'
            }, {
                smoName: 'invert',
                parameterName: 'invert',
                defaultValue: false,
                control: 'SuiToggleComponent',
                label: 'Invert'
            }, {
                parameterName: 'cp1x',
                smoName: 'cp1x',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'Control Point 1 X'
            }, {
                parameterName: 'cp1y',
                smoName: 'cp1y',
                defaultValue: 40,
                control: 'SuiRockerComponent',
                label: 'Control Point 1 Y'
            }, {
                parameterName: 'cp2x',
                smoName: 'cp2x',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'Control Point 2 X'
            }, {
                parameterName: 'cp2y',
                smoName: 'cp2y',
                defaultValue: 40,
                control: 'SuiRockerComponent',
                label: 'Control Point 2 Y'
            }
        ];
    }
    static createAndDisplay(parameters) {
        var dg = new SuiSlurAttributesDialog(parameters);
        dg.display();
        return dg;
    }
    constructor(parameters) {
        if (!parameters.modifier || !parameters.selection) {
            throw new Error('modifier attribute dialog must have modifier and selection');
        }

        super(SuiSlurAttributesDialog.dialogElements, {
            id: 'dialog-' + parameters.modifier.id,
            top: parameters.modifier.renderedBox.y,
            left: parameters.modifier.renderedBox.x,
            label: 'Slur Properties'
        });
        Vex.Merge(this, parameters);
    }
}

class SuiVoltaAttributeDialog extends SuiStaffModifierDialog {
	 static get dialogElements() {
        return [{
                parameterName: 'number',
                smoName: 'number',
                defaultValue: 1,
                control: 'SuiRockerComponent',
                label: 'number'
            }, {
                smoName: 'xOffsetStart',
                parameterName: 'xOffsetStart',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'X1 Offset'
            }, {
                smoName: 'xOffsetEnd',
                parameterName: 'xOffsetEnd',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'X2 Offset'
            }, {
                smoName: 'yOffset',
                parameterName: 'yOffset',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'Y Offset'
            }
        ];
	 }
	 static createAndDisplay(parameters) {
        var dg = new SuiVoltaAttributeDialog(parameters);
        dg.display();
        return dg;
    }
	handleRemove() {
        this.undo.addBuffer('Remove nth ending', 'score', null, this.layout.score);
		this.layout.score.staves.forEach((staff) => {
			staff.measures.forEach((measure) => {
				if (measure.measureNumber.measureNumber === this.modifier.startBar) {
					measure.removeNthEnding(this.modifier.number);
				}
			});
		});
        $(this.context.svg).find('g.' + this.modifier.endingId).remove();
        this.selection.staff.removeStaffModifier(this.modifier);
        this.tracker.clearModifierSelections();
    }
	_commit() {
        this.modifier.restoreOriginal();
		this.layout.score.staves.forEach((staff) => {
			staff.measures.forEach((measure) => {
				if (measure.measureNumber.measureNumber === this.modifier.startBar) {
					 var endings = measure.getNthEndings().filter((mm) => {
						 return mm.endingId === this.modifier.endingId;
					 });
					 if (endings.length) {
						 endings.forEach((ending) => {
							 this.components.forEach((component) => {
								ending[component.smoName] = component.getValue();
							 }); 
						 });
					 }
				}
			});
		});
       
        this.layout.renderStaffModifierPreview(this.modifier);
    }
    constructor(parameters) {
        if (!parameters.modifier || !parameters.selection) {
            throw new Error('modifier attribute dialog must have modifier and staff');
        }

        super(SuiVoltaAttributeDialog.dialogElements, {
            id: 'dialog-' + parameters.modifier.id,
            top: parameters.modifier.renderedBox.y,
            left: parameters.modifier.renderedBox.x,
            label: 'Hairpin Properties'
        });
        Vex.Merge(this, parameters);
		SmoVolta.editableAttributes.forEach((attr) => {
			var comp = this.components.find((cc)=>{return cc.smoName===attr});
			if (comp) {
				comp.defaultValue=this.modifier[attr];
			}
		});
    }
}
class SuiHairpinAttributesDialog extends SuiStaffModifierDialog {
    static get label() {
        return 'Hairpin Properties';
    }
    static get dialogElements() {
        return [{
                parameterName: 'height',
                smoName: 'height',
                defaultValue: 10,
                control: 'SuiRockerComponent',
                label: 'Height'
            }, {
                smoName: 'yOffset',
                parameterName: 'y_shift',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'Y Shift'
            }, {
                smoName: 'xOffsetRight',
                parameterName: 'right_shift_px',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'Right Shift'
            }, {
                smoName: 'xOffsetLeft',
                parameterName: 'left_shift_px',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'Left Shift'
            }
        ];
    }
    static createAndDisplay(parameters) {
        var dg = new SuiHairpinAttributesDialog(parameters);
        dg.display();
        return dg;
    }
    constructor(parameters) {
        if (!parameters.modifier || !parameters.selection) {
            throw new Error('modifier attribute dialog must have modifier and staff');
        }

        super(SuiHairpinAttributesDialog.dialogElements, {
            id: 'dialog-' + parameters.modifier.id,
            top: parameters.modifier.renderedBox.y,
            left: parameters.modifier.renderedBox.x,
            label: 'Hairpin Properties'
        });
        Vex.Merge(this, parameters);
		SmoStaffHairpin.editableAttributes.forEach((attr) => {
			var comp = this.components.find((cc)=>{return cc.smoName===attr});
			if (comp) {
				comp.defaultValue=this.modifier[attr];
			}
		});
    }
}
;

class SmoHelp {

    static displayHelp() {
        $('body').addClass('showHelpDialog');
        $('.helpDialog').html('');
        var b = htmlHelpers.buildDom;
        var r = b('div').classes('help-left');
        r.append(SmoHelp.navigationHtml);
        r.append(SmoHelp.noteHelpHtml);
        r.append(SmoHelp.durationHelpHtml);
        $('.helpDialog').append(r.dom());

        r = b('div').classes('help-right');
        r.append(SmoHelp.generalEditHtml);
        r.append(SmoHelp.menuHelpHtml);
        r.append(SmoHelp.dialogHelpHtml);
        $('.helpDialog').append(r.dom());

        $('.helpDialog').append(SmoHelp.closeButton.dom());
		$('button.help-title').off('click').on('click',function(ev) {
			$(this).closest('div.helpLine').toggleClass('showSection');
			$(this).find('span.icon').toggleClass('icon-plus');
			$(this).find('span.icon').toggleClass('icon-minus');
		});
        $('.helpDialog button.icon-cross').off('click').on('click', function () {
            $('body').removeClass('showHelpDialog');
        });
    }
		
    static helpControls() {
        $('body .controls-left').html('');
        $('body .controls-left').append(RibbonHtml.ribbonButton('help-button','Help','?'));
        $('.helpDialog button.icon-cross').focus();
    }

    static modeControls() {
        var b = htmlHelpers.buildDom;
        var r = b('div').classes('menu-status').append(
                b('div').attr('id', 'globMode').text('Next Key Chooses Menu')).append(
                b('div').classes('mode-subtitle').append(SmoHelp.shortMenuHelpHtml));
        $('body .controls-left').html('');
        $('body .controls-left').append(r.dom());
    }

    static get closeButton() {
        var b = htmlHelpers.buildDom;
        var r = b('button').classes('icon-cross close');
        return r;
    }

    static _helpButton(buttons) {
        var b = htmlHelpers.buildDom;
        var r = b('span').classes('keyContainer');
        buttons.forEach((button) => {
            button.text = (button.text ? button.text : ' ');
            button.separator = button.separator ? button.separator : ' ';
            button.icon = button.icon ? button.icon : ' ';
            r.append(b('span').classes(button.icon + ' helpKey').text(button.text))
            .append(b('span').classes('separator').text(button.separator));
        });
        return r;
    }

    static _buttonBlock(buttons, text, id) {
        var b = htmlHelpers.buildDom;
        var r = b('div').classes('keyBlock').attr('id', id);
        r.append(SmoHelp._helpButton(buttons)).append(
            b('label').attr('for', id).text(text));
        return r;
    }

    static _buildElements(helps, text) {
        var b = htmlHelpers.buildDom;
        var r = b('div').classes('helpLine').append(
				b('button').append(
				b('span').classes('icon icon-plus'))
				.classes('help-title').text(text));

        helps.forEach((help) => {
            r.append(SmoHelp._buttonBlock(help.keys, help.text, help.id));
        });
        return r;
    }

    static get navigationElements() {
        return [{
                keys:
                [{
                        icon: 'icon-arrow-right'
                    }, {
                        icon: 'icon-arrow-left'
                    }
                ],
                text: 'Move note selection left or right',
                id: 'navel1'
            }, {
                keys: [{
                        icon: '',
                        text: 'Ctrl',
                        separator: '+'

                    }, {
                        icon: 'icon-arrow-right',
                        separator: ','
                    }, {
                        icon: '',
                        text: 'Ctrl',
                        separator: '+'
                    }, {
                        icon: 'icon-arrow-left'
                    }
                ],
                text: 'Jump selection to next/last measure',
                id: 'navel2'
            }, {
                keys: [ {
                        icon: 'icon-arrow-down',
                    }, {
                        icon: 'icon-arrow-up'
                    }
                ],
                text: 'Jump selection to staff above/below',
                id: 'navel3'
            }, {
                keys: [{
                        icon: '',
                        text: 'Shift',
                        separator: '+'
                    }, {
                        icon: 'icon-arrow-right',
                        separator: ','
                    }, {
                        icon: '',
                        text: 'Shift',
                        separator: '+'
                    }, {
                        icon: 'icon-arrow-left'
                    }
                ],
                text: 'Grow selection left or right',
                id: 'navel4'
            }, {
                keys: [{
                        icon: '',
                        text: 'Alt',
                        separator: '+'
                    }, {
                        icon: 'icon-arrow-right',
                        separator: ''
                    }
                ],
                text: 'Select note or staff modifier (slur, dynamic)',
                id: 'navel5'
            }, {
                keys: [{
                        icon: '',
                        text: 'Shift',
                        separator: '+'
                    }, {
                        icon: 'icon-arrow-up',
                        separator: ','
                    }, {
                        icon: '',
                        text: 'Shift',
                        separator: '+'
                    }, {
                        icon: 'icon-arrow-down'
                    }
                ],
                text: 'Iterate through the notes of a chord',
                id: 'navel6'
            }
        ];
    }
    static get noteElements() {
        return [{
                keys:
                [{
                        text: 'a'
                    }, {
                        text: '...',
                        icon: 'help-ellipsis'
                    }, {
                        text: 'g'
                    }
                ],
                text: 'Enter letter note A-G at selection',
                id: 'noteElements1'
            }, {
                keys:
                [{
                        text: 'h'
                    }, {
                        text: '...',
                        icon: 'help-ellipsis'
                    }, {
                        text: 'l',
                        separator: ','
                    }
                ],
                text: 'Various articulations',
                id: 'noteElements1'
            }, {
                keys:
                [{
                        text: 'Shift',
                        separator: '+'
                    }, {
                        text: 'h'
                    }, {
                        text: '...',
                        icon: 'help-ellipsis'
                    }, {
                        text: 'l',
                        separator: ','
                    }
                ],
                text: 'Various articulations',
                id: 'noteElements1'
            }, {
                keys:
                [{
                        text: '-',
                        separator: ','
                    }, {
                        text: '='
                    }
                ],
                text: 'Transpose selected notes down/up 1/2 step',
                id: 'noteElements2'
            }, {
                keys: [{
                        text: 'Ctrl',
                        separator: '+'
                    }, {
                        text: '-',
                        separator: ','
                    }, {
                        text: 'Ctrl',
                        separator: '+'
                    }, {
                        text: '=',
                        separator: ''
                    }
                ],
                text: 'Transpose note up/down octave',
                id: 'noteElements3'
            }, {
                keys: [{
                        text: '2',
                        separator: ''
                    }, {
                        text: '...',
                        icon: 'help-ellipsis'

                    }, {
                        text: '7',
                        separator: ''
                    }
                ],
                text: 'Enter interval 2nd through 7th',
                id: 'noteElements4'
            }, {
                keys: [{
                        text: 'Shift',
                        separator: '+'
                    }, {
                        text: '2',
                        separator: ''
                    }, {
                        text: '...',
                        icon: 'help-ellipsis'

                    }, {
                        text: 'Shift',
                        separator: '+'
                    }, {
                        text: '7'
                    }
                ],
                text: 'Enter interval down 2nd through 7th',
                id: 'noteElements5'
            }, {
                keys: [{
                        text: 'r'
                    }
                ],
                text: 'Toggle note/rest',
                id: 'noteElements6'
            }, {
                keys: [{
                        text: 'x'
                    }
                ],
                text: 'Toggle break beam group',
                id: 'noteElements7'
            },{
                keys: [{
                        text: 'Alt',
						separator:'+'
                    },{
						text:'-'
					}
                ],
                text: 'Toggle courtesy accidental',
                id: 'noteElements8'
            }
        ];
    }
    static get durationElements() {
        return [{
                keys:
                [{
                        text: ',',
                        separator: ','
                    }, {
                        text: '.',
                    }
                ],
                text: 'Double/halve note duration',
                id: 'noteDuration1'
            }, {
                keys:
                [{
                        text: '<',
                        separator: ','
                    }, {
                        text: '>'
                    }
                ],
                text: 'Remove/Add dot to note',
                id: 'noteDuration2'
            }, {
                keys: [{
                        text: 'Ctrl',
                        separator: '+'
                    }, {
                        text: '3',
                    }
                ],
                text: 'Create triplet',
                id: 'noteDuration3'
            }, {
                keys: [{
                        text: 'Ctrl',
                        separator: '+'
                    }, {
                        text: '0',
                    }
                ],
                text: 'Remove triplet',
                id: 'noteDuration4'
            }
        ];
    }
    static get generalEditElements() {
        return [{
                keys:
                [{
                        text: 'Ctrl',
                        separator: '+'
                    }, {
                        text: 'c',
                    }
                ],
                text: 'Copy selection',
                id: 'editElements1'
            }, {
                keys:
                [{
                        text: 'Ctrl',
                        separator: '+'
                    }, {
                        text: 'v'
                    }
                ],
                text: 'Paste copied selection to selection target',
                id: 'editElements2'
            }, {
                keys: [{
                        text: 'Ctrl',
                        separator: '+'
                    }, {
                        text: 'z',
                    }
                ],
                text: 'Undo previous operation',
                id: 'editElements3'
            }, {
                keys: [{
                        text: 'Insert'
                    }
                ],
                text: 'Add measure',
                id: 'editElements4'
            }, {
                keys: [{
                        text: 'Delete'
                    }
                ],
                text: 'Delete measure',
                id: 'editElements4'
            }
        ];
    }
    static get menuModeElements() {
        return [{
                keys:
                [{
                        text: '/',
                        separator: ''
                    }
                ],
                text: 'Next key chooses menu',
                id: 'menuModeElements1'
            }, {
                keys:
                [{
                        text: 'k',
                        separator: ''
                    }
                ],
                text: 'Key signature menu',
                id: 'menuModeElements2'
            }, {
                keys:
                [{
                        text: 'e',
                        separator: ''
                    }
                ],
                text: 'Expression menu (slur, hairpin dynamics)',
                id: 'menuModeElements3'
            }, {
                keys:
                [{
                        text: 'd',
                        separator: ''
                    }
                ],
                text: 'Text dynamics menu',
                id: 'menuModeElements4'
            }, {
                keys:
                [{
                        text: 's',
                        separator: ''
                    }
                ],
                text: 'Add/Remove Staff menu',
                id: 'menuModeElements5'
            }, {
                keys:
                [{
                        text: 'Esc',
                        separator: ''
                    }
                ],
                text: 'Cancel slash menu mode',
                id: 'menuModeElements6'
            }
        ];
    }
    static get menuModeShort() {
        return [{
                keys:
                [{
                        text: 'k',
                        separator: ''
                    }
                ],
                text: 'Key signatures',
                id: 'menuModeElements2'
            }, {
                keys:
                [{
                        text: 'e',
                        separator: ''
                    }
                ],
                text: 'Expressions',
                id: 'menuModeElements3'
            }, {
                keys:
                [{
                        text: 'd',
                        separator: ''
                    }
                ],
                text: 'Dynamics',
                id: 'menuModeElements4'
            }, {
                keys:
                [{
                        text: 's',
                        separator: ''
                    }
                ],
                text: 'Add/Remove Staff',
                id: 'menuModeElements5'
            },{
                keys:
                [{
                        text: 'Esc',
                        separator: ''
                    }
                ],
                text: 'Continue Editing',
                id: 'menuModeElements6'
            }
        ];
    }
    static get dialogElements() {
        return [{
                keys:
                [{
                        text: 'p',
                        separator: ''
                    }
                ],
                text: 'Property dialog for selected modifier (see Score Navigation)',
                id: 'menuModeElements1'
            }
        ];
    }

    static get navigationHtml() {
        return SmoHelp._buildElements(SmoHelp.navigationElements, 'Score Navigation');
    }
    static get noteHelpHtml() {
        return SmoHelp._buildElements(SmoHelp.noteElements, 'Note Entry');
    }
    static get durationHelpHtml() {
        return SmoHelp._buildElements(SmoHelp.durationElements, 'Note Duration');
    }
    static get menuHelpHtml() {
        return SmoHelp._buildElements(SmoHelp.menuModeElements, 'Menus');
    }
    static get generalEditHtml() {
        return SmoHelp._buildElements(SmoHelp.generalEditElements, 'Editing');
    }
    static get shortMenuHelpHtml() {
        return SmoHelp._buildElements(SmoHelp.menuModeShort, 'Menus');
    }
    static get dialogHelpHtml() {
        return SmoHelp._buildElements(SmoHelp.dialogElements, 'Property Dialogs');
    }
}
;

// ## suiController
// ## Description:
// Manages DOM events and binds keyboard and mouse events
// to editor and menu commands, tracker and layout manager.
// ### Event model:
// Events can come from the following sources:
// 1. menus or dialogs can send dialogDismiss or menuDismiss event, indicating a modal has been dismissed.
// 2. window resize events
// 3. keyboard, when in editor mode.  When modals or dialogs are active, wait for dismiss event 
// 4. svg piano key events smo-piano-key
// 5. tracker change events tracker-selection
class suiController {

	constructor(params) {
		Vex.Merge(this, suiController.defaults);
		Vex.Merge(this, params);
		this.undoBuffer = new UndoBuffer();
		this.pasteBuffer = this.tracker.pasteBuffer;
		this.editor.undoBuffer = this.undoBuffer;
		this.editor.pasteBuffer = this.pasteBuffer;
		this.resizing = false;
		this.undoStatus=0;
		this.trackScrolling = false;
        this.keyboardActive = false;
		this.pollTime = 50;
		this.idleRedrawTime = 2000;
		this.waitingForIdleLayout = false;
		this.idleLayoutTimer = 0;

		this.ribbon = new RibbonButtons({
				ribbons: defaultRibbonLayout.ribbons,
				ribbonButtons: defaultRibbonLayout.ribbonButtons,
				menus: this.menus,
				editor: this.editor,
				tracker: this.tracker,
				score: this.score,
				controller: this
			});
            
        this.menus.setController(this);

		// create globbal exception instance
		this.exhandler = new SuiExceptionHandler(this);

		this.bindEvents();
		this.bindResize();
		if (!suiLayoutBase.debugLayout) {
			this.splash();
			this.pollRedraw();
		}

		this.piano();
		this.updateOffsets();
	}
	
	static get scrollable() {
		return '.musicRelief';
	}
	
	handleRedrawTimer() {
		    // If there has been a change, redraw the score 
			if (this.undoStatus != this.undoBuffer.opCount || this.layout.dirty) {				
				this.layout.dirty=true;				
				this.undoStatus = this.undoBuffer.opCount;
				this.idleLayoutTimer = Date.now();
                var state = this.layout.passState;
				this.render();
                if (state == suiLayoutBase.passStates.initial) {
                    this.render();
                }
			} else if (this.layout.passState === suiLayoutBase.passStates.replace) {
				// Do we need to refresh the score?
				if (!this.waitingForIdleLayout === false) {
					this.waitingForIdleLayout = false;
					this.idleLayoutTimer = Date.now();
				} else if (Date.now() - this.idleLayoutTimer > this.idleRedrawTime) {
					this.layout.setRefresh();
					this.waitingForIdleLayout = false;
				}
			}
	}
	
	// ### pollRedraw
	// if anything has changed over some period, prepare to redraw everything.
	pollRedraw() {		
		var self=this;
		setTimeout(function() {
			self.handleRedrawTimer();
			self.pollRedraw();
		},self.pollTime);
	}

	splash() {
		var b = htmlHelpers.buildDom;
		var r = b('div').classes('bug-modal').append(
				b('img').attr('src', '../styles/images/logo.png').classes('splash-logo'))
			.append(b('button').classes('icon icon-cross bug-dismiss-button'))
			.append(b('span').classes('splash-title').text('Sm'))
			.append(b('span').classes('splash-shine').text('ooooooooo'))
			.append(b('span').classes('splash-title').text('sic'));
		$('.bugDialog').append(r.dom());
		$('body').addClass('splashScreen modal');
		setTimeout(function () {
			$('body').removeClass('splashScreen modal');
		}, 1000);
	}
	piano() {
		this.piano = new suiPiano({elementId:'piano-svg'});
        $('.close-piano').click();
	}
	updateOffsets() {
		// the 100 is for the control offsets
		var padding =  Math.round((this.layout.screenWidth-this.layout.pageWidth)/2)-100;
		$('.workspace-container').css('padding-left',''+padding+'px');
		
		// Keep track of the scroll bar so we can adjust the map
		this.scrollPosition = $('body')[0].scrollTop;
	}
	resizeEvent() {
		var self = this;		
		if (this.resizing)
			return;
		this.resizing = true;
		setTimeout(function () {
			console.log('resizing');
			self.resizing = false;
			self.layout.setViewport(true);
			$('.musicRelief').height(window.innerHeight - $('.musicRelief').offset().top);
			self.piano.handleResize();
			self.updateOffsets();			
			
		}, 500);
	}
	
	// No action at present when cursor selection changes
	trackerChangeEvent() {
		
	}
	
	// If the user has selected a modifier via the mouse/touch, bring up mod dialog
	// for that modifier
	trackerModifierSelect() {
		var modSelection = this.tracker.getSelectedModifier();
		if (modSelection) {
			window.removeEventListener("keydown", this.keydownHandler, true);
			var dialog = this.showModifierDialog(modSelection);
			this.unbindKeyboardForDialog(dialog);
		}
		return;
	}

    // ### bindResize
	// This handles both resizing of the music area (scrolling) and resizing of the window.
	// The latter results in a redraw, the former just resets the client/logical map of elements
	// in the tracker.
	bindResize() {
		var self = this;
		var el = $(suiController.scrollable)[0];
		// unit test programs don't have resize html
		if (!el) {
			return;
		}
		$(suiController.scrollable).height(window.innerHeight - $('.musicRelief').offset().top);
		
		window.addEventListener('resize', function () {
			self.resizeEvent();
		});
				
		let scrollCallback = (el) => {
			if (self.trackScrolling) {
				return;
			}
			self.trackScrolling = true;
			setTimeout(function() {
				// self.scrollRedrawStatus = true;
				self.trackScrolling = false;
				self.tracker.updateMap(true);
			},500);
		};
		el.onscroll = scrollCallback;
	}
	
	static createDom() {
		 var b = htmlHelpers.buildDom;
		 var r=b('div').classes('dom-container')
			 .append(b('div').classes('modes'))
			 .append(b('div').classes('overlay'))
			 .append(b('div').classes('draganime hide'))
			 .append(b('div').classes('textEdit hide'))
			 .append(b('div').classes('attributeDialog'))
			 .append(b('div').classes('helpDialog'))
             .append(b('div').classes('saveLink'))
			 .append(b('div').classes('bugDialog'))
			 .append(b('div').classes('menuContainer'))
			 .append(b('h1').classes('testTitle').text('Smoosic'))
			 .append(b('div').classes('piano-container')
			     .append(b('div').classes('piano-keys')))
		     .append(b('div').classes('workspace-container')
			    .append(b('div').classes('workspace')
				    .append(b('div').classes('controls-top'))
					.append(b('div').classes('controls-left'))
					.append(b('div').classes('musicRelief')
					   .append(b('div').classes('musicContainer').attr('id','boo')))
                     .append(b('div').classes('musicReliefShadow')
					   .append(b('div').classes('musicContainerShadow').attr('id','booShadow')))));
	    $('#smoo').append(r.dom());
		var pianoDom=$('.piano-keys')[0];
		var svg=document.createElementNS(svgHelpers.namespace,'svg');
		svg.id='piano-svg';
		svg.setAttributeNS('','width',''+suiPiano.owidth*suiPiano.dimensions.octaves);
		svg.setAttributeNS('','height',''+suiPiano.dimensions.wheight);
		svg.setAttributeNS('','viewBox','0 0 '+suiPiano.owidth*suiPiano.dimensions.octaves+' '+suiPiano.dimensions.wheight);
		pianoDom.appendChild(svg);
	}

	// ## createUi
	// ### Description:
	// Convenience constructor, taking a renderElement and a score.
	static createUi(score,title) {
		suiController.createDom();
		if (title) {
			$('h1.testTitle').text(title);
		}
		var params = suiController.keyBindingDefaults;
		params.layout = suiScoreLayout.createScoreLayout(document.getElementById("boo"), document.getElementById("booShadow"),score);
		params.tracker = new suiTracker(params.layout);
		params.editor = new suiEditor(params);
		params.menus = new suiMenuManager(params);
		var controller = new suiController(params);
        var score = SmoScore.deserialize(inventionJson);
        params.layout.score = score;
		return controller;
	}
	
	static createDebugUi(score) {
		suiController.createDom();
		var params = suiController.keyBindingDefaults;
		params.layout = suiScoreLayout.createScoreLayout(document.getElementById("boo"), document.getElementById("booShadow"), score);
		suiLayoutBase.debugLayout=true;
		params.tracker = new suiTracker(params.layout);
		params.editor = new suiEditor(params);
		params.menus = new suiMenuManager(params);
		var controller = new suiController(params);
		return controller;
	}

	static start(debug) {
		var score = SmoScore.getEmptyScore();
		score.addDefaultMeasureWithNotes(0, {});
		if (!debug) {
			score.addDefaultMeasureWithNotes(1, {});
			score.addDefaultMeasureWithNotes(2, {});
			score.addDefaultMeasureWithNotes(3, {});
			score.addDefaultMeasureWithNotes(4, {});
			score.addStaff();
		}

		var controller = debug ? suiController.createDebugUi(score) : suiController.createUi(score);
	}

	// ### renderElement
	// return render element that is the DOM parent of the svg
	get renderElement() {
		return this.layout.renderElement;
	}

	// ## keyBindingDefaults
	// ### Description:
	// Different applications can create their own key bindings, these are the defaults.
	// Many editor commands can be reached by a single keystroke.  For more advanced things there
	// are menus.
	static get keyBindingDefaults() {
		var editorKeys = suiController.editorKeyBindingDefaults;
		editorKeys.forEach((key) => {
			key.module = 'editor'
		});
		var trackerKeys = suiController.trackerKeyBindingDefaults;
		trackerKeys.forEach((key) => {
			key.module = 'tracker'
		});
		return trackerKeys.concat(editorKeys);
	}

	// ## editorKeyBindingDefaults
	// ## Description:
	// execute a simple command on the editor, based on a keystroke.
	static get editorKeyBindingDefaults() {
		return defaultEditorKeys.keys;
	}

	// ## trackerKeyBindingDefaults
	// ### Description:
	// Key bindings for the tracker.  The tracker is the 'cursor' in the music
	// that lets you select and edit notes.
	static get trackerKeyBindingDefaults() {
		return defaultTrackerKeys.keys;
	}

	helpControls() {
		var self = this;
		var rebind = function () {
			self.render();
			self.bindEvents();
		}
		/* SmoHelp.helpControls();
		$('.controls-left button.help-button').off('click').on('click', function () {
		window.removeEventListener("keydown", self.keydownHandler, true);
		SmoHelp.displayHelp();
		htmlHelpers.closeDialogPromise().then(rebind);
		});   */
	}
	static set reentry(value) {
		suiController._reentry = value;
	}
	static get reentry() {
		if (typeof(suiController['_reentry']) == 'undefined') {
			suiController._reentry = false;
		}
		return suiController._reentry;
	}

	menuHelp() {
		SmoHelp.modeControls();
	}

	static get defaults() {
		return {
			keyBind: suiController.keyBindingDefaults
		};
	}
	remap() {
		var self=this;
		setTimeout(function() {
			if (self.layout.dirty == false) {
				self.tracker.updateMap();
			} else {
				self.remap();
			}
		},100);
	}

	showModifierDialog(modSelection) {
		return SuiDialogFactory.createDialog(modSelection, this.tracker.context, this.tracker, this.layout,this.undoBuffer)
	}
	
	unbindKeyboardForDialog(dialog) {
		var self=this;
		var rebind = function () {
			self.render();
			self.bindEvents();
		}
		window.removeEventListener("keydown", this.keydownHandler, true);
        this.keyboardActive = false;
		dialog.closeDialogPromise.then(rebind);		
	}
    
    unbindKeyboardForMenu(menuMgr) {

        window.removeEventListener("keydown", this.keydownHandler, true);
        var self=this;
        var rebind = function () {
            self.render();
            self.bindEvents();
        }
        this.keyboardActive = false;
        menuMgr.slashMenuMode().then(rebind);
    }
    
   
	handleKeydown(evdata) {
		var self = this;

		console.log("KeyboardEvent: key='" + event.key + "' | code='" +
			event.code + "'"
			 + " shift='" + event.shiftKey + "' control='" + event.ctrlKey + "'" + " alt='" + event.altKey + "'");
		event.preventDefault();

		if (evdata.key == '?') {
			SmoHelp.displayHelp();
		}

		if (evdata.key == '/') {
			this.menuHelp();
            this.unbindKeyboardForMenu(this.menus);
		}

		// TODO:  work dialogs into the scheme of things
		if (evdata.key == 'p') {
			self.trackerModifierSelect(evdata);
		}

		var binding = this.keyBind.find((ev) =>
				ev.event === 'keydown' && ev.key === evdata.key && ev.ctrlKey === evdata.ctrlKey &&
				ev.altKey === evdata.altKey && evdata.shiftKey === ev.shiftKey);

		if (binding) {
			try {
			this[binding.module][binding.action](evdata);
			} catch (e) {
				this.exhandler.exceptionHandler(e);
			}
		}
	}

	detach() {
		window.removeEventListener("keydown", this.keydownHandler, true);
		/* this.layout = null;
		this.tracker = null;
		this.editor = null;  */
	}

	render() {		
		this.layout.render();
		this.tracker.updateMap();
	}

	bindEvents() {
		var self = this;
		var tracker = this.tracker;
        if (this.keyboardActive) {
            return; // already bound.
        }
        this.keyboardActive = true;
		
		$('body').off('redrawScore').on('redrawScore',function() {
			self.handleRedrawTimer();
		});

		$(this.renderElement).off('mousemove').on('mousemove', function (ev) {
			tracker.intersectingArtifact({
				x: ev.clientX,
				y: ev.clientY
			});
		});

		$(this.renderElement).off('click').on('click', function (ev) {
			tracker.selectSuggestion(ev);
		});
		$('body').off('smo-piano-key').on('smo-piano-key',function(ev,obj) {
			obj=obj.selections;
			self.tracker.selections.forEach((sel) => {
				SmoOperation.addPitch(sel,obj);
				// sel.note.pitches=JSON.parse(JSON.stringify(obj));
			});
			self.render();
		});
		$('body').off('tracker-selection').on('tracker-selection',function(ev) {
			self.trackerChangeEvent(ev);
		});
				
		$('body').off('tracker-select-modifier').on('tracker-select-modifier',function(ev) {
			self.trackerModifierSelect(ev);
		});

		this.keydownHandler = this.handleKeydown.bind(this);

		this.helpControls();

		window.addEventListener("keydown", this.keydownHandler, true);
		this.ribbon.display();

		window.addEventListener('error', function (e) {
			SuiExceptionHandler.instance.exceptionHandler(e);
		});
	}

}
