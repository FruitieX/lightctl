//const { miredToRgb, xyToRgb } = require('../../../src/utils');
const convert = require('color-convert');

exports.black = { r: 0, g: 0, b: 0 };

// Get color of single light bulb
exports.getColor = lamp => {
  let lampColor;

  if (!lamp.state.on) {
    lampColor = exports.black;
  } else if (lamp.state.colormode === 'ct') {
    const [r, g, b] = convert.mired.rgb.raw(lamp.state.ct);
    lampColor = { r, g, b };
  } else if (lamp.state.colormode === 'xy') {
    const [r, g, b] = convert.xyY.rgb.raw(
      ...lamp.state.xy,
      lamp.state.bri / 2.55,
    );
    lampColor = { r, g, b };
  } else {
    lampColor = exports.black;
  }

  return lampColor;
};
