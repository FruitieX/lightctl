const request = require('request-promise-native');
const delay = require('../../../src/utils').delay;

// Have the physical Hue bridge generate us a username
const getUsername = async options => {
  console.log(
    'Warning: Hue plugin config variable "username" not set, authenticating with bridge...',
  );
  console.log(
    'Please press the link button on your Hue bridge to obtain a username.',
  );

  let username = null;

  while (!username) {
    await delay(1000);
    try {
      const response = (await request({
        url: `http://${options.bridgeAddr}/api`,
        timeout: 1000,
        method: 'POST',
        body: {
          devicetype: 'hue-forwarder',
        },
        json: true,
      }))[0];

      if (response.success) {
        username = response.success.username;
      }
    } catch (e) {
      console.log('Error while obtaining Hue username:', e);
    }
  }

  console.log('Your Hue Bridge username is:', username);
  console.log(
    'Please copy-paste this into your Hue plugin config under variable "username" and then restart hue-forwarder.',
  );

  return username;
};

// Combines given config options with default values where needed
exports.initConfig = async options => {
  const hue = options ? { ...options } : {};

  if (!hue.bridgeAddr) {
    // TODO: autodiscover bridge using SSDP?
    console.log(
      'Warning: Hue plugin config variable "bridgeAddr" not set, forcing dummy mode',
    );
    hue.dummy = true;
    hue.username = 'dummyusername';
  }

  if (!hue.dummy && !hue.username) {
    hue.username = await getUsername(options);
    process.exit(1);
  }

  return hue;
};
