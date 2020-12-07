class CheckboxDropdownComponent extends SuiComponentBase {
  // { dropdownElement: {...}, toggleElement: }
  constructor(dialog, parameter) {
    super(parameter);
    smoSerialize.filteredMerge(
      ['parameterName', 'smoName', 'defaultValue', 'options', 'control', 'label', 'dataType'], parameter, this);
    this.dialog = dialog;
    parameter.toggleElement.parentControl = this;
    parameter.dropdownElement.parentControl = this;
    this.toggleCtrl = new SuiToggleComposite(this.dialog, parameter.toggleElement);
    this.dropdownCtrl = new SuiDropdownComposite(this.dialog, parameter.dropdownElement);
  }
  get html() {
    const b = htmlHelpers.buildDom;
    const q = b('div').classes(this.makeClasses('multiControl smoControl checkboxDropdown'))
      .attr('id',this.parameterId);
    q.append(this.toggleCtrl.html);
    q.append(this.dropdownCtrl.html);
    return q;
  }
  get parameterId() {
    return this.dialog.id + '-' + this.parameterName;
  }
  bind() {
    this.toggleCtrl.bind();
    this.dropdownCtrl.bind();
  }
  changed() {
    if (this.toggleCtrl.getValue()) {
      $('#'+this.parameterId).addClass('checked');
    } else {
      $('#'+this.parameterId).removeClass('checked');
    }
    this.handleChanged();
  }
}

class StaffCheckComponent extends SuiComponentBase {
  constructor(dialog, parameter) {
    let i = 0;
    super(parameter);
    smoSerialize.filteredMerge(
      ['parameterName', 'smoName', 'defaultValue', 'options', 'control', 'label', 'dataType'], parameter, this);
    if (!this.defaultValue) {
      this.defaultValue = 0;
    }
    if (!this.dataType) {
      this.dataType = 'string';
    }
    this.dialog = dialog;
    this.view = this.dialog.view;
    this.staffRows = [];
    this.view.storeScore.staves.forEach((staff) => {
      const name = 'View Staff ' + (i + 1);
      const id = 'show-' + i;
      const rowElement = new SuiToggleComponent(this.dialog, {
        smoName: id,
        parameterName: id,
        defaultValue: true,
        classes: 'hide-when-editing',
        control: 'SuiToggleComponent',
        label: name
      });
      this.staffRows.push({
        showCtrl: rowElement
      });
      i += 1;
    });
  }
  get html() {
    const b = htmlHelpers.buildDom;
    const q = b('div').classes(this.makeClasses('multiControl smoControl staffContainer'));
    this.staffRows.forEach((row) => {
      q.append(row.showCtrl.html);
    });
    return q;
  }
  // Is this used for compound controls?
  _getInputElement() {
    var pid = this.parameterId;
    return $(this.dialog.dgDom.element).find('#' + pid).find('.staffContainer');
  }
  getValue() {
    const rv = [];
    let i = 0;
    for (i = 0;i < this.staffRows.length; ++i) {
      const show = this.staffRows[i].showCtrl.getValue();
      rv.push({show: show});
    }
    return rv;
  }
  setValue(rows) {
    let i = 0;
    rows.forEach((row) => {
      this.staffRows[i].showCtrl.setValue(row.show);
      i += 1;
    });
  }
  changed() {
    this.handleChanged();
  }
  bind() {
    this.staffRows.forEach((row) => {
      row.showCtrl.bind();
    });
  }
}