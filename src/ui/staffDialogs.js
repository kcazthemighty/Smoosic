class SuiStaffModifierDialog extends SuiDialogBase {
	 handleRemove() {
        $(this.context.svg).find('g.' + this.modifier.id).remove();
        this.selection.staff.removeStaffModifier(this.modifier);
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
            }, {
                smoName: 'startBar',
                parameterName: 'startBar',
                defaultValue: 1,
                control: 'SuiRockerComponent',
                label: 'Start Bar'
            }, {
                smoName: 'endBar',
                parameterName: 'endBar',
                defaultValue: 0,
                control: 'SuiRockerComponent',
                label: 'End Bar'
            }
        ];
	 }
	 static createAndDisplay(parameters) {
        var dg = new SuiVoltaAttributeDialog(parameters);
        dg.display();
        return dg;
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
