//const { miredToRgb, xyToRgb } = require('../../../src/utils');
const convert = require('color-convert');

exports.black = { rgb: [0, 0, 0] };

// Get color of single light bulb
exports.getColor = lamp => {
  let lampColor;

  if (lamp.state.on === false) {
    lampColor = exports.black;
  } else if (lamp.state.colormode === 'ct') {
    lampColor = { ct: convert.mired.ct.raw(lamp.state.ct) };
  } else if (lamp.state.colormode === 'xy') {
    lampColor = { xyY: [...lamp.state.xy, lamp.state.bri / 2.55] };
  } else {
    lampColor = exports.black;
  }

  return lampColor;
};
