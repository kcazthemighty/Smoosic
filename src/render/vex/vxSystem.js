// ## Description:
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
		this.smoMeasures=[];
		this.vxMeasures=[];
        this.endcaps = [];
		this.endings=[];
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
		for (var i=0;i<this.vxMeasures;++i) {
			var vm = this.vxMeasures[i];
			if (vm.smoMeasure.id === smoMeasure.id) {
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

    renderModifier(modifier, vxStart, vxEnd) {
		// if it is split between lines, render one artifact for each line, with a common class for 
		// both if it is removed.
		var artifactId=modifier.attrs.id+'-'+this.lineIndex;
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
				height:modifier.height,
				y_shift:modifier.yOffset,
				left_shift_px:modifier.xOffsetLeft,
				right_shift_px:modifier.xOffsetRight
			});
            hairpin.setContext(this.context).setPosition(modifier.position).draw();
        } else if (modifier.type == 'SmoSlur') {
			var curve = new VF.Curve(
			vxStart,vxEnd,//first_indices:[0],last_indices:[0]});
			  {
              thickness: modifier.thickness,
              x_shift: modifier.xOffset,
              y_shift: modifier.yOffset,
              cps: modifier.controlPoints,
			  invert:modifier.invert,
			  position:modifier.position
		});
			curve.setContext(this.context).draw();
			
		}

        this.context.closeGroup();
		return group.getBoundingClientRect();
    }
	
	getEnds(smoMeasure) {
		this.smoMeasures.forEach((mm) => {
			mm.endData=[];
		});
		smoMeasure.getNthEndings().forEach((end) => {
			this.endings.push(end);
		});
		this.endings.forEach((end)=> {
			if (smoMeasure.measureNumber.systemIndex >= end.startBar && smoMeasure.measureNumber.systemIndex <= end.endBar) {
				smoMeasure.endData=[];
				smoMeasure.endData.push(new SmoVolta(JSON.parse(JSON.stringify(end))));
			}
		});
	}

    // ## renderMeasure
    // ## Description:
    // Create the graphical (VX) notes and render them on svg.  Also render the tuplets and beam
    // groups
    renderMeasure(staffIndex, smoMeasure) {
        var systemIndex = smoMeasure.measureNumber.systemIndex;
		this.smoMeasures.push(smoMeasure);
		
		// Handle nth endings.
		this.getEnds(smoMeasure);
		

        var vxMeasure = new VxMeasure(this.context, {
                smoMeasure: smoMeasure
            });

        vxMeasure.render();

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
