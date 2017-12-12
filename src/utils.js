exports.delay = ms =>
  new Promise((resolve, reject) => (timeout = setTimeout(resolve, ms)));

/**
 * This function is a rough approximation of the reversal of RGB to xy transform. It is a gross approximation and does
 * get close, but is not exact.
 * @param x
 * @param y
 * @param brightness
 * @returns {Array} RGB values
 * @private
 *
 * This function is stolen from https://github.com/peter-murray/node-hue-api/blob/master/hue-api/rgb.js
 * which in turn is a modification of the one found at https://github.com/bjohnso5/hue-hacking/blob/master/src/colors.js#L251
 *
 * The last rgb.map() was modified not to round down to nearest integers, since rgbd supports
 * dithering of floating point values.
 */
exports.xyToRgb = (xy, brightness) => {
  const x = xy[0];
  const y = xy[1];

  var Y = brightness,
    X = Y / y * x,
    Z = Y / y * (1 - x - y),
    rgb = [
      X * 1.612 - Y * 0.203 - Z * 0.302,
      -X * 0.509 + Y * 1.412 + Z * 0.066,
      X * 0.026 - Y * 0.072 + Z * 0.962,
    ];

  // Apply reverse gamma correction.
  rgb = rgb.map(function(x) {
    return x <= 0.0031308
      ? 12.92 * x
      : (1.0 + 0.055) * Math.pow(x, 1.0 / 2.4) - 0.055;
  });

  // Bring all negative components to zero.
  rgb = rgb.map(function(x) {
    return Math.max(0, x);
  });

  // If one component is greater than 1, weight components by that value.
  var max = Math.max(rgb[0], rgb[1], rgb[2]);
  if (max > 1) {
    rgb = rgb.map(function(x) {
      return x / max;
    });
  }

  rgb = rgb.map(function(x) {
    return x * 255;
  });

  return {
    r: rgb[0],
    g: rgb[1],
    b: rgb[2],
  };
};

exports.gammaCorrection = value => {
  var result = value;
  if (value > 0.04045) {
    result = Math.pow((value + 0.055) / (1.0 + 0.055), 2.4);
  } else {
    result = value / 12.92;
  }
  return result;
};

exports.rgbToXy = (red, green, blue, limits) => {
  var r = exports.gammaCorrection(red),
    g = exports.gammaCorrection(green),
    b = exports.gammaCorrection(blue),
    X = r * 0.4360747 + g * 0.3850649 + b * 0.0930804,
    Y = r * 0.2225045 + g * 0.7168786 + b * 0.0406169,
    Z = r * 0.0139322 + g * 0.0971045 + b * 0.7141733,
    cx = X / (X + Y + Z),
    cy = Y / (X + Y + Z),
    xyPoint;

  cx = isNaN(cx) ? 0.0 : cx;
  cy = isNaN(cy) ? 0.0 : cy;

  //xyPoint = new XY(cx, cy);

  /*
  if (!_isInColorGamut(xyPoint, limits)) {
    xyPoint = _resolveXYPointForLamp(xyPoint, limits);
  }
  */

  return [cx, cy];
};

// From pseudocode at http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/
// Converts a temperature value in mired to rgb
exports.miredToRgb = mired => {
  let temp = 1000000 / mired;

  temp = temp / 100;

  let r, g, b;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
  }
  r = Math.min(255, Math.max(0, r));

  // Green
  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
  }
  g = Math.min(255, Math.max(0, g));

  // Blue
  if (temp >= 66) {
    b = 255;
  } else {
    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  }
  b = Math.min(255, Math.max(0, b));

  return { r, g, b };
};
