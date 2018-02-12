const cosmiconfig = require('cosmiconfig');

const explorer = cosmiconfig('lightctl');

module.exports = explorer.load('.').then(result => {
  if (result === null) {
    console.log('No config found, using defaults...');

    result = {};
  } else {
    console.log('Using config from', result.filepath);

    result = result.config;
  }

  //console.log(JSON.stringify(result, null, 2));

  return result;
});
