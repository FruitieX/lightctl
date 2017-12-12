exports.delay = ms =>
  new Promise((resolve, reject) => (timeout = setTimeout(resolve, ms)));
