const request = require('request-promise-native');
const delay = require('../../src/utils').delay;

// Have the physical Hue bridge generate us a username
const getUsername = async options => {
  console.log(
    'Warning: Hue plugin config variable "bridgeUsername" not set, authenticating with bridge...',
  );
  console.log(
    'Please press the link button on your Hue bridge to obtain a username.',
  );

  let bridgeUsername = null;

  while (!bridgeUsername) {
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
        bridgeUsername = response.success.username;
      }
    } catch (e) {
      console.log('Error while obtaining Hue username:', e);
    }
  }

  console.log('Your Hue Bridge username is:', bridgeUsername);
  console.log(
    'Please copy-paste this into your Hue plugin config under variable "bridgeUsername" and then restart hue-forwarder.',
  );

  return bridgeUsername;
};

// Guess user's network interface
// Used in case the config does not contain the IP or MAC addresses of this machine.
const guessNetworkInterface = () => {
  let interfaces = require('os').networkInterfaces();

  let aliases = [];

  Object.entries(interfaces).forEach(([name, interface]) =>
    aliases.push(...interface),
  );

  // Doubt the Hue bridge does IPv6 anyway
  aliases = aliases.filter(alias => alias.family === 'IPv4');

  // Filter out localhost
  aliases = aliases.filter(alias => !alias.internal);

  const guess = aliases[0];

  if (!guess) {
    console.log(
      'ERROR: Unable to autodetect network interface of this machine!',
    );
    console.log(
      'Please set up Hue plugin config variables "forwarderAddr" and "forwarderMac" in your config.',
    );
    process.exit(1);
  }

  return guess;
};

const getLocalAddr = () => {
  const interface = guessNetworkInterface();
  console.log('Autodetected local IP address as:', interface.address);
  return interface.address;
};

const getLocalMac = () => {
  const interface = guessNetworkInterface();
  console.log('Autodetected local MAC address as:', interface.mac);
  return interface.mac;
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
    hue.bridgeUsername = 'dummyusername';
  }

  if (!hue.dummy && !hue.bridgeUsername) {
    hue.bridgeUsername = await getUsername(options);
    process.exit(1);
  }

  hue.forwarderName = hue.forwarderName || 'Philips Hue (Forwarded)';
  hue.forwarderAddr = hue.forwarderAddr || getLocalAddr();
  hue.forwarderMac = hue.forwarderMac || getLocalMac();

  // This seems to be how the following fields are generated for the real thing
  hue.forwarderSN = hue.forwarderMac.replace(/:/g, '');
  hue.forwarderID = [
    hue.forwarderSN.slice(0, 6),
    'fffe',
    hue.forwarderSN.slice(6),
  ]
    .join('')
    .toUpperCase();

  return hue;
};
