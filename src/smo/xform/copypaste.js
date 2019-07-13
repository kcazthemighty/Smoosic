


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
            var note = SmoNote.clone(selection.note);
            if (selection.note.isTuplet) {
                var tuplet = selection.measure.getTupletForNote(selection.note);
                var index = tuplet.getIndexOfNote(selection.note);
                if (index > 0) {
                    currentTupletNotes.push(note);
                } else {
                    currentTupletNotes = [note];
                    currentTupletParameters = tuplet.clonedParams;
                }
                if (index === tuplet.notes.length - 1) {
                    currentTupletParameters.notes = currentTupletNotes;
                    var ntuplet = new SmoTuplet(currentTupletParameters);
					
					// Create a map of the first note in the tuplet for later 
					// when we create the measures.
					this.tupletNoteMap[currentTupletNotes[0].id]=ntuplet;
                    currentTupletParameters = null;
                }
            }
            this.notes.push({
                selector: selector,
                note: note
            });
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
            if (currentDuration + selection.note.tickCount >= tickmap.totalDuration) {
                // If this note will overlap the measure boundary, the note will be split in 2 with the
                // remainder going to the next measure.  If they line up exactly, the remainder is 0.
                var remainder = tickmap.totalDuration - (currentDuration + selection.note.tickCount);

                measureSelection = SmoSelection.measureSelection(this.score, this.measureSelection.staffIndex, this.measureSelection.measureIndex + 1);

                // If the paste buffer overlaps the end of the score, we can't paste (TODO:  add a measure in this case)
                if (measureSelection != null) {
                    this.measures.push(measureSelection.measure);
                    currentDuration = selection.note.tickCount - remainder;
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
        for (var i = 0; i < measure.voices[voiceIndex].notes.length; ++i) {

            var note = measure.voices[voiceIndex].notes[i];
            if (ticksToFill >= note.tickCount) {
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
        var voice = this._populatePre(voiceIndex, measure, this.destination.tick, tickmap);
        measureVoices.push(voice);
        while (this.measureIndex < measures.length) {
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
                measure = measure[this.measureIndex];
                tickmap = measure.tickmap();
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
                var tuplet = this.tupletNoteMap[note.id];
                var index = tuplet.getIndexOfNote(note);
                // If the tuplet fits in the rest of the measure, just paste all the notes
                // Note they are not cloned.
                if (index === 0) {
                    if (currentDuration + tuplet.tickCount <= totalDuration && this.remainder === 0) {
                        currentDuration += tuplet.tickCount;
                        tuplet.notes.forEach((tnote) => {
                            voice.notes.push(tnote);
                        });
                        this.noteIndex += tuplet.notes.length;
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
            existingIndex = (existingIndex < 0) ? measure.voices[voiceIndex].length - 1 : existingIndex;
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

        var voices = this._populateVoice(this.destination.staff);
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
            tupletKeys.forEach((key) => {
                nmeasure.tuplets.push(this.tupletNoteMap[key]);
            });
            this.score.replaceMeasure(measureSel, nmeasure);
            measureSel.measure += 1;
        }

    }
}