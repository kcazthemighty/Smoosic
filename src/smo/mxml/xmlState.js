// eslint-disable-next-line no-unused-vars
class XmlState {
  static get defaults() {
    return {
      divisions: 1, tempo: new SmoTempoText(), timeSignature: '4/4', keySignature: 'C',
      clefInfo: [], staffGroups: [], smoStaves: []
    };
  }
  constructor() {
    Vex.Merge(this, XmlState.defaults);
  }

  // Initialize things that persist throughout a staff
  // likc hairpins and slurs
  initializeForPart() {
    this.slurs = {};
    this.wedges = {};
    this.hairpins = [];
    this.globalCursor = 0;
    this.staffVoiceHash = {};
    this.measureIndex = -1;
  }
  // ### initializeForMeasure
  // reset state for a new measure:  beam groups, tuplets
  // etc. that don't cross measure boundaries
  initializeForMeasure(measureElement) {
    const oldMeasure = this.measureNumber;
    this.measureNumber =
      parseInt(measureElement.getAttribute('number'), 10) - 1;
    if (isNaN(this.measureNumber)) {
      this.measureNumber = oldMeasure + 1;
    }
    this.tuplets = {};
    this.tickCursor = 0;
    this.tempo = SmoMeasureModifierBase.deserialize(this.tempo.serialize());
    this.tempo.display = false;
    this.staffArray = [];
    this.graceNotes = [];
    this.currentDuration = 0;
    this.beamGroups = {};
    this.completedSlurs = [];
    this.completedTuplets = [];
    this.dynamics = [];
    this.previousNote = {};
    this.measureIndex += 1;
  }
  // ### initializeStaff
  // voices are not sequential, seem to have artitrary numbers and
  // persist per part, so we treat them as a hash.
  // staff IDs persist per part but are sequential.
  initializeStaff(staffIndex, voiceIndex) {
    if (typeof(this.staffArray[staffIndex].voices[voiceIndex]) === 'undefined') {
      this.staffArray[staffIndex].voices[voiceIndex] = { notes: [] };
      this.staffArray[staffIndex].voices[voiceIndex].ticksUsed = 0;
      // keep track of 0-indexed voice for slurs and other modifiers
      if (!this.staffVoiceHash[staffIndex]) {
        this.staffVoiceHash[staffIndex] = [];
      }
      if (this.staffVoiceHash[staffIndex].indexOf(voiceIndex) < 0) {
        this.staffVoiceHash[staffIndex].push(voiceIndex);
      }
      this.beamGroups[voiceIndex] = 0;
    }
  }
  // ### updateStaffGroups
  // once everything is parsed, figure out how to group the staves
  updateStaffGroups() {
    this.systems = [];
    this.staffGroups.forEach((staffGroup) => {
      const len = this.smoStaves[staffGroup.start].measures.length;
      const startSelector = { staff: staffGroup.start, measure: 0 };
      const endSelector = { staff: staffGroup.start + (staffGroup.length - 1),
        measure: len };
      this.systems.push(
        new SmoSystemGroup({
          startSelector, endSelector, leftConnector: SmoSystemGroup.connectorTypes.brace
        })
      );
    });
  }
  // ### processWedge (hairpin)
  processWedge(wedgeInfo) {
    if (wedgeInfo.type) {
      // If we already know about this wedge, it must have been
      // started, so complete it
      if (this.wedges.type) {
        this.hairpins.push({ type: this.wedges.type,
          start: this.wedges.start,
          end: this.tickCursor + this.globalCursor });
        this.wedges = {};
      } else {
        this.wedges.type = wedgeInfo.type;
        this.wedges.start = this.tickCursor + this.globalCursor;
      }
    }
  }
  // ### backtrackHairpins
  // For the measure just parsed, find the correct tick for the
  // beginning and end of hairpins, if a hairpin stop directive
  // was received.  These are not associated with a staff or voice, so
  // we use the first one in the measure element for both
  backtrackHairpins(smoStaff, staffId) {
    this.hairpins.forEach((hairpin) => {
      let hpMeasureIndex = this.measureIndex;
      let hpMeasure = smoStaff.measures[hpMeasureIndex];
      let startTick = hpMeasure.voices[0].notes.length - 1;
      let hpTickCount = hairpin.end;
      const endSelector = {
        staff: staffId - 1, measure: hpMeasureIndex, voice: 0,
        tick: -1
      };
      while (hpMeasureIndex >= 0 && hpTickCount > hairpin.start) {
        if (endSelector.tick < 0 && hpTickCount <= hairpin.end) {
          endSelector.tick = startTick;
        }
        hpTickCount -= hpMeasure.voices[0].notes[startTick].ticks.numerator;
        if (hpTickCount > hairpin.start) {
          startTick -= 1;
          if (startTick < 0) {
            hpMeasureIndex -= 1;
            hpMeasure = smoStaff.measures[hpMeasureIndex];
            startTick = hpMeasure.voices[0].notes.length - 1;
          }
        }
      }
      const startSelector = {
        staff: staffId - 1, measure: hpMeasureIndex, voice: 0, tick: startTick
      };
      const smoHp = new SmoStaffHairpin({
        startSelector, endSelector, hairpinType: hairpin.type === 'crescendo' ?
          SmoStaffHairpin.types.CRESCENDO :
          SmoStaffHairpin.types.DECRESCENDO
      });
      smoStaff.modifiers.push(smoHp);
    });
    this.hairpins = [];
  }

  // ### updateDynamics
  // Based on note just parsed, put the dynamics on the closest
  // note, based on the offset of dynamic
  updateDynamics() {
    const smoNote = this.previousNote;
    const tickCursor = this.tickCursor;
    const newArray = [];
    this.dynamics.forEach((dynamic) => {
      if (tickCursor >= dynamic.offset) {
        // TODO: change the smonote name of this interface
        smoNote.addModifier(new SmoDynamicText({ text: dynamic.dynamic }));
      } else {
        newArray.push(dynamic);
      }
    });
    this.dynamics = newArray;
  }
  // For the given voice, beam the notes according to the
  // note beam length
  backtrackBeamGroup(voice, beamLength) {
    let i = 0;
    for (i = 0; i < beamLength; ++i) {
      const note = voice.notes[voice.notes.length - (i + 1)];
      if (!note) {
        console.warn('no note for beam group');
        return;
      }
      note.endBeam = i === 0;
    }
  }
  // ### updateBeamState
  // Keep track of beam instructions found while parsing note element
  updateBeamState(beamState, voice, voiceIndex) {
    if (beamState === mxmlHelpers.beamStates.BEGIN) {
      this.beamGroups[voiceIndex] = 1;
    } else if (this.beamGroups[voiceIndex]) {
      this.beamGroups[voiceIndex] += 1;
      if (beamState === mxmlHelpers.beamStates.END) {
        this.backtrackBeamGroup(voice, this.beamGroups[voiceIndex]);
        this.beamGroups[voiceIndex] = 0;
      }
    }
  }
  // ### updateSlurStates
  // While parsing a measure,
  // on a slur element, either complete a started
  // slur or start a new one.
  updateSlurStates(slurInfos,
    staffIndex, voiceIndex, tick) {
    let add = true;
    slurInfos.forEach((slurInfo) =>  {
      if (slurInfo.type === 'start') {
        this.slurs[slurInfo.number] = { start: {
          staff: staffIndex, voice: voiceIndex,
          measure: this.measureNumber, tick }
        };
      } else if (slurInfo.type === 'stop') {
        if (this.slurs[slurInfo.number]) {
          this.slurs[slurInfo.number].end = {
            staff: staffIndex, voice: voiceIndex,
            measure: this.measureNumber, tick
          };
          ['staff', 'voice', 'measure', 'tick'].forEach((field) => {
            if (typeof(this.slurs[slurInfo.number].start[field]) !== 'number' ||
              typeof(this.slurs[slurInfo.number].end[field]) !== 'number') {
              console.warn('bad slur in xml, dropping');
              add = false;
            }
          });
          if (add) {
            this.completedSlurs.push(
              JSON.parse(JSON.stringify(this.slurs[slurInfo.number])));
          }
        }
      }
    });
  }
  // ### completeSlurs
  // After reading in a measure, update any completed slurs and make them
  // into SmoSlur and add them to the SmoSystemGroup objects.
  // staffIndexOffset is the offset from the xml staffId and the score staff Id
  // (i.e. the staves that have already been parsed in other parts)
  completeSlurs(stavesForPart, staffIndexOffset) {
    this.completedSlurs.forEach((slur) => {
      const staffIx = slur.start.staff;
      slur.start.voice = this.staffVoiceHash[slur.start.staff].indexOf(slur.start.voice);
      slur.end.voice = this.staffVoiceHash[slur.end.staff].indexOf(slur.end.voice);
      slur.start.staff += staffIndexOffset;
      slur.end.staff += staffIndexOffset;
      const smoSlur = new SmoSlur({
        startSelector: JSON.parse(JSON.stringify(slur.start)),
        endSelector: JSON.parse(JSON.stringify(slur.end))
      });
      stavesForPart[staffIx].addStaffModifier(smoSlur);
    });
  }
  // ### backtrackTuplets
  // If we received a tuplet end, go back through the voice
  // and construct the SmoTuplet.
  backtrackTuplets(voice, tupletNumber, staffId, voiceId) {
    const tupletState = this.tuplets[tupletNumber];
    let i = tupletState.start.tick;
    const notes = [];
    const durationMap = [];
    while (i < voice.notes.length) {
      const note = voice.notes[i];
      notes.push(note);
      if (i === tupletState.start.tick) {
        durationMap.push(1.0);
      } else {
        const prev = voice.notes[i - 1];
        durationMap.push(note.ticks.numerator / prev.ticks.numerator);
      }
      i += 1;
    }
    const tuplet = new SmoTuplet({
      notes,
      durationMap
    });
    // Store the tuplet with the staff ID and voice so we
    // can add it to the right measure when it's created.
    this.completedTuplets.push({ tuplet, staffId, voiceId });
  }
  // ### updateTupletStates
  // react to a tuplet start or stop directive
  updateTupletStates(tupletInfos, voice, staffIndex, voiceIndex) {
    const tick = voice.notes.length - 1;
    tupletInfos.forEach((tupletInfo) =>  {
      if (tupletInfo.type === 'start') {
        this.tuplets[tupletInfo.number] = {
          start: { staff: staffIndex, voice: voiceIndex, tick }
        };
      } else if (tupletInfo.type === 'stop') {
        this.tuplets[tupletInfo.number].end = {
          staff: staffIndex, voice: voiceIndex, tick
        };
        this.backtrackTuplets(voice, tupletInfo.number, staffIndex, voiceIndex);
      }
    });
  }
  addTupletsToMeasure(smoMeasure, staffId, voiceId) {
    const completed = [];
    this.completedTuplets.forEach((tuplet) => {
      if (tuplet.voiceId === voiceId && tuplet.staffId === staffId) {
        smoMeasure.tuplets.push(tuplet.tuplet);
      } else {
        completed.push(tuplet);
      }
    });
    this.completedTuplets = completed;
  }
}
