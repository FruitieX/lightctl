const convert = require('color-convert');

exports.black = [0, 0, 0];

// Get color of single light bulb
exports.getColor = lamp => {
  let lampColor;

  if (lamp.state.on === false) {
    lampColor = exports.black;
  } else if (lamp.state.colormode === 'hs') {
    lampColor = [
      lamp.state.hue / 65536 * 360,
      lamp.state.sat / 254 * 100,
      lamp.state.bri / 254 * 100,
    ];
  } else if (lamp.state.colormode === 'ct') {
    lampColor = convert.mired.hsv.raw(
      lamp.state.ct,
      lamp.state.bri / 254 * 100,
    );
  } else if (lamp.state.colormode === 'xy') {
    lampColor = convert.xyY.hsv.raw(
      ...lamp.state.xy,
      lamp.state.bri / 254 * 100,
    );
  } else {
    lampColor = exports.black;
  }

  return lampColor;
};
