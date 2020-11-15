// ## SmoScoreModifierBase
// A score modifier is something that appears in the score, but not
// associated with a measure of music.
// eslint-disable-next-line no-unused-vars
class SmoScoreModifierBase {
  constructor(ctor) {
    this.ctor = ctor;
    if (!this.attrs) {
      this.attrs = {
        id: VF.Element.newID(),
        type: ctor
      };
    }
  }

  static deserialize(jsonObj) {
    const ctor = eval(jsonObj.ctor);
    const rv = new ctor(jsonObj);
    return rv;
  }
}

// ## SmoSystemGroup
// System group is the grouping of staves into a system.
// eslint-disable-next-line no-unused-vars
class SmoSystemGroup extends SmoScoreModifierBase {
  constructor(params) {
    super('SmoSystemGroup');
    smoSerialize.serializedMerge(SmoSystemGroup.attributes, SmoSystemGroup.defaults, this);
    smoSerialize.serializedMerge(SmoSystemGroup.attributes, params, this);

    if (!this.attrs) {
      this.attrs = {
        id: VF.Element.newID(),
        type: 'SmoStaffHairpin'
      };
    }
  }
  static get defaults() {
    return {
      leftConnector: SmoSystemGroup.connectorTypes.single,
      rightConnector: SmoSystemGroup.connectorTypes.single,
      mapType: SmoSystemGroup.mapTypes.allMeasures,
      text: '',
      shortText: '',
      justify: true,
      startSelector: { staff: 0, measure: 0 },
      endSelector: { staff: 0, measure: 0 }
    };
  }
  leftConnectorVx() {
    switch (this.leftConnector) {
      case SmoSystemGroup.connectorTypes.single:
        return VF.StaveConnector.type.SINGLE_LEFT;
      case SmoSystemGroup.connectorTypes.double:
        return VF.StaveConnector.type.DOUBLE_LEFT;
      case SmoSystemGroup.connectorTypes.brace:
        return VF.StaveConnector.type.BRACE;
      case SmoSystemGroup.connectorTypes.bracket:
      default:
        return VF.StaveConnector.type.BRACKET;
    }
  }
  rightConnectorVx() {
    switch (this.rightConnector) {
      case SmoSystemGroup.connectorTypes.single:
        return StaveConnector.type.SINGLE_RIGHT;
      case SmoSystemGroup.connectorTypes.double:
      default:
        return StaveConnector.type.DOUBLE_RIGHT;
    }
  }
  static get connectorTypes() {
    return { brace: 0, bracket: 1, single: 2, double: 3 };
  }
  static get mapTypes() {
    return { allMeasures: 0, range: 1 };
  }
  static get attributes() {
    return ['leftConnector', 'rightConnector', 'text', 'shortText', 'justify',
      'startSelector', 'endSelector', 'mapType'];
  }
  serialize() {
    const params = {};
    smoSerialize.serializedMergeNonDefault(SmoSystemGroup.defaults, SmoSystemGroup.attributes, this, params);
    params.ctor = 'SmoSystemGroup';
    return params;
  }
}

// ## SmoTextGroup
// A grouping of text that can be used as a block for
// justification, alignment etc.
// eslint-disable-next-line no-unused-vars
class SmoTextGroup extends SmoScoreModifierBase {
  static get justifications() {
    return {
      LEFT: 1,
      RIGHT: 2,
      CENTER: 3
    };
  }
  static get paginations() {
    return { EVERY: 1, EVENT: 2, ODD: 3, ONCE: 4, SUBSEQUENT: 5 };
  }

  // ### getPagedTextGroups
  // If this text is repeated on page, create duplicates for each page, and
  // resolve page numbers;
  static getPagedTextGroups(tg, pages, pageHeight) {
    const rv = [];
    let i = 0;
    if (tg.pagination === SmoTextGroup.paginations.ONCE) {
      rv.push(tg);
      return rv;
    }
    for (i = 0; i < pages; ++i) {
      const ix = i;
      const nblocks = [];
      // deep copy the blocks so the page offsets don't bleed into
      // original.
      tg.textBlocks.forEach((block) => {
        const nscoreText = new SmoScoreText(block.text);
        nblocks.push({
          text: nscoreText, position: block.position
        });
      });
      const params = {};
      SmoTextGroup.attributes.forEach((attr) => {
        if (attr !== 'textBlocks') {
          params[attr] = tg[attr];
        }
      });
      params.blocks = nblocks;
      const ngroup = new SmoTextGroup(params);
      ngroup.textBlocks.forEach((block) => {
        const xx = block.text;
        xx.classes = 'score-text ' + xx.attrs.id;
        xx.text = xx.text.replace('###', ix + 1); /// page number
        xx.text = xx.text.replace('@@@', pages); /// page number
        xx.y += pageHeight * ix;
      });
      rv.push(ngroup);
    }
    return rv;
  }

  // The position of block n relative to block n-1.  Each block
  // has it's own position.  Justification is inter-block.
  static get relativePositions() {
    return { ABOVE: 1, BELOW: 2, LEFT: 3, RIGHT: 4 };
  }
  static get defaults() {
    return { textBlocks: [],
      justification: SmoTextGroup.justifications.LEFT,
      relativePosition: SmoTextGroup.relativePositions.RIGHT,
      pagination: SmoTextGroup.paginations.ONCE,
      spacing: 0
    };
  }
  static get attributes() {
    return ['textBlocks', 'justification', 'relativePosition', 'spacing', 'pagination'];
  }
  static deserialize(jObj) {
    const blocks = [];
    const params = {};

    // Create new scoreText object for the text blocks
    jObj.textBlocks.forEach((st) => {
      const tx = new SmoScoreText(st.text);
      blocks.push({ text: tx, position: st.position });
    });
    // fill in the textBlock configuration
    SmoTextGroup.attributes.forEach((attr) => {
      if (attr !== 'textBlocks') {
        if (typeof(jObj[attr]) !== 'undefined') {
          params[attr] = jObj[attr];
        }
      }
    });
    params.blocks = blocks;
    return new SmoTextGroup(params);
  }
  serialize() {
    const params = {};
    smoSerialize.serializedMergeNonDefault(SmoTextGroup.defaults, SmoTextGroup.attributes, this, params);
    params.ctor = 'SmoTextGroup';
    return params;
  }
  _isScoreText(st) {
    return st.ctor && st.ctor === 'SmoScoreText';
  }
  constructor(params) {
    super('SmoTextGroup');
    if (typeof(params) === 'undefined') {
      params = {};
    }
    this.textBlocks = [];
    this.backupBlocks = [];
    Vex.Merge(this, SmoTextGroup.defaults);
    Vex.Merge(this, params);
    if (params.blocks) {
      params.blocks.forEach((block) => {
        if (this._isScoreText(block)) {
          this.textBlocks.push({ text: block, position: SmoTextGroup.relativePositions.RIGHT });
        } else if (this._isScoreText(block.text)) {
          this.textBlocks.push(block);
        } else {
          throw 'Invalid object in SmoTextGroup';
        }
      });
    }
  }
  // ### setActiveBlock
  // let the UI know which block is being edited.  Parameter null means reset all
  setActiveBlock(scoreText) {
    this.textBlocks.forEach((block) => {
      if (scoreText != null && block.text.attrs.id === scoreText.attrs.id) {
        block.activeText = true;
      } else {
        block.activeText = false;
      }
    });
  }
  setRelativePosition(position) {
    this.textBlocks.forEach((block) => {
      block.position = position;
    });
    this.relativePosition = position;
  }
  firstBlock() {
    return this.textBlocks[0].text;
  }
  indexOf(scoreText) {
    return this.textBlocks.findIndex((block) => block.text.attrs.id === scoreText.attrs.id);
  }
  addScoreText(scoreText, prevBlock, position) {
    if (!this._isScoreText(scoreText)) {
      throw 'Need SmoScoreText to add to TextGroup';
    }
    if (typeof(position) === 'undefined') {
      position = this.relativePosition;
    }
    if (!prevBlock) {
      this.textBlocks.push({ text: scoreText, position });
    } else {
      const bbid =  (typeof(prevBlock) === 'string') ? prevBlock : prevBlock.attrs.id;
      const ix = this.textBlocks.findIndex((bb) => bb.attrs.id === bbid);
      this.textBlocks.splice(ix, 0, nextBlock);
    }
  }
  ul() {
    const rv = { x: 0, y: 0 };
    this.textBlocks.forEach((block) => {
      rv.x = block.text.x > rv.x ? block.text.x : rv.x;
      rv.y = block.text.y > rv.y ? block.text.y : rv.y;
    });
    return rv;
  }
  removeBlock(scoreText) {
    if (!this._isScoreText(scoreText)) {
      throw 'Need SmoScoreText to add to TextGroup';
    }
    const bbid = (typeof(scoreText) === 'string') ? scoreText : scoreText.attrs.id;
    const ix = this.textBlocks.findIndex((bb) => bb.text.attrs.id === bbid);
    this.textBlocks.splice(ix, 1);
  }
  offsetX(offset) {
    this.textBlocks.forEach((block) => {
      block.text.offsetX(offset);
    });
  }
  offsetY(offset) {
    this.textBlocks.forEach((block) => {
      block.text.offsetY(offset);
    });
  }

  scaleInPlace(factor) {
    this.textBlocks.forEach((block) => {
      block.text.scaleInPlace(factor);
    });
  }
  scaleXInPlace(factor) {
    this.textBlocks.forEach((block) => {
      block.text.scaleXInPlace(factor);
    });
  }
  scaleYInPlace(factor) {
    this.textBlocks.forEach((block) => {
      block.text.scaleYInPlace(factor);
    });
  }

  backupParams() {
    this.textBlocks.forEach((block) => {
      block.text.backupParams();
    });
  }

  restoreParams() {
    this.textBlocks.forEach((block) => {
      block.text.restoreParams();
    });
  }
}
// ## SmoScoreText
// Identify some text in the score, not associated with any musical element, like page
// decorations, titles etc.
// eslint-disable-next-line no-unused-vars
class SmoScoreText extends SmoScoreModifierBase {
  // convert EM to a number, or leave as a number etc.
  static fontPointSize(size) {
    let rv = 12;
    if (typeof(size) === 'number') {
      return size;
    }
    const ptString = size.substring(0, size.length - 2);
    rv = parseFloat(ptString);
    if (size.indexOf('em') > 0) {
      rv *= 14;
    } else if (size.indexOf('px') > 0) {
      rv *= (96.0 / 72.0);
    }
    return rv;
  }

  // ### weightString
  // Convert a numeric or string weight into either 'bold' or 'normal'
  static weightString(fontWeight) {
    let rv = 'normal';
    if (fontWeight) {
      const numForm = parseInt(fontWeight, 10);
      if (isNaN(numForm)) {
        rv = fontWeight;
      } else if (numForm > 500) {
        rv = 'bold';
      }
    }
    return rv;
  }

  static get paginations() {
    return { every: 'every', even: 'even', odd: 'odd', once: 'once', subsequent: 'subsequent' };
  }
  static get positions() {
    return { title: 'title', copyright: 'copyright', footer: 'footer', header: 'header', custom: 'custom' };
  }
  static get justifications() {
    return { left: 'left', right: 'right', center: 'center' };
  }
  static get fontFamilies() {
    return { serif: 'Merriweather', sansSerif: 'Roboto,sans-serif', monospace: 'monospace', cursive: 'cursive',
      times: 'Merriweather', arial: 'Arial' };
  }
  // If box model is 'none', the font and location determine the size.
  // spacing and spacingGlyph fit the box into a container based on the svg policy
  static get boxModels() {
    return { none: 'none', spacing: 'spacing', spacingAndGlyphs: 'spacingAndGlyphs', wrap: 'wrap' };
  }
  static get defaults() {
    return {
      x: 15,
      y: 15,
      width: 0,
      height: 0,
      text: 'Smoosic',
      fontInfo: {
        size: '1em',
        family: SmoScoreText.fontFamilies.serif,
        style: 'normal',
        weight: 'normal'
      },
      fill: 'black',
      rotate: 0,
      justification: SmoScoreText.justifications.left,
      classes: 'score-text',
      boxModel: 'none',
      scaleX: 1.0,
      scaleY: 1.0,
      translateX: 0,
      translateY: 0,
      pagination: 'once',
      position: 'custom',
      autoLayout: false // set to true if one of the pre-canned positions are used.
    };
  }
  static toSvgAttributes(inst) {
    const rv = [];
    const fkeys = Object.keys(inst.fontInfo);
    const fontFamily = SmoScoreText[inst.fontInfo.family] ? SmoScoreText[inst.fontInfo.family] : inst.fontInfo.family;
    fkeys.forEach((key) => {
      var n = JSON.parse('{"font-' + key + '":"' + inst.fontInfo[key] + '"}');
      if (n['font-family']) {
        n['font-family'] = fontFamily;
      }
      rv.push(n);
    });

    rv.push({ fill: inst.fill });
    rv.push({ x: inst.x });
    rv.push({ y: inst.y });
    if (inst.boxModel !== 'none' && inst.width) {
      const len = '' + inst.width + 'px';
      rv.push({ textLength: len });
    }
    rv.push({ transform: 'translate (' + inst.translateX + ' ' + inst.translateY + ') scale (' +
        inst.scaleX + ' ' + inst.scaleY + ')' });
    return rv;
  }

  getText() {
    return this.text;
  }

  toSvgAttributes() {
    return SmoScoreText.toSvgAttributes(this);
  }

  // ### backupParams
  // For animation or estimation, create a copy of the attributes that can be modified without affecting settings.
  backupParams() {
    this.backup = {};
    smoSerialize.serializedMerge(SmoScoreText.attributes, this, this.backup);
    return this.backup;
  }

  restoreParams() {
    smoSerialize.serializedMerge(SmoScoreText.attributes, this.backup, this);
  }

  offsetX(offset) {
    this.x += offset;
  }
  offsetY(offset) {
    this.y += offset;
  }

  serialize() {
    const params = {};
    smoSerialize.serializedMergeNonDefault(SmoScoreText.defaults, SmoScoreText.attributes, this, params);
    params.ctor = 'SmoScoreText';
    return params;
  }
  static get attributes() {
    return ['x', 'y', 'text', 'pagination', 'position', 'fontInfo', 'classes',
      'boxModel', 'justification', 'fill', 'width', 'height', 'scaleX', 'scaleY',
      'translateX', 'translateY', 'autoLayout'];
  }

  // scale the text without moving it.
  scaleInPlace(factor) {
    this.fontInfo.size = SmoScoreText.fontPointSize(this.fontInfo.size) * factor;
  }
  scaleXInPlace(factor) {
    this.scaleX = factor;
    const deltax = this.x - this.x * this.scaleX;
    this.translateX = deltax;
  }
  scaleYInPlace(factor) {
    this.scaleY = factor;
    const deltay = this.y - this.y * this.scaleY;
    this.translateY = deltay;
  }
  constructor(parameters) {
    super('SmoScoreText');
    this.backup = {};
    this.edited = false; // indicate to UI that the actual text has not been edited.

    smoSerialize.serializedMerge(SmoScoreText.attributes, SmoScoreText.defaults, this);
    smoSerialize.serializedMerge(SmoScoreText.attributes, parameters, this);
    if (!this.classes) {
      this.classes = '';
    }
    if (this.classes.indexOf(this.attrs.id) < 0) {
      this.classes += ' ' + this.attrs.id;
    }
    if (this.boxModel === SmoScoreText.boxModels.wrap) {
      this.width = parameters.width ? this.width : 200;
      this.height = parameters.height ? this.height : 150;
      if (!parameters.justification) {
        this.justification = this.position === SmoScoreText.positions.copyright
          ? SmoScoreText.justifications.right : SmoScoreText.justifications.center;
      }
    }
    if (this.position !== SmoScoreText.positions.custom && !parameters.autoLayout) {
      this.autoLayout = true;
      if (this.position === SmoScoreText.positions.title) {
        this.fontInfo.size = '1.8em';
      } else {
        this.fontInfo.size = '.6em';
      }
    }
    const weight = parameters.fontInfo ? parameters.fontInfo.weight : 'normal';
    this.fontInfo.weight = SmoScoreText.weightString(weight);
  }
}
