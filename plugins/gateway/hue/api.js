/*
 * hue-api
 *
 * Make & cache requests to the Hue API
 */

const dummy = require('../../api/hue/dummy');
const convert = require('color-convert');
const request = require('request-promise-native');
const { luminaireRegister } = require('../../../src/lights');
const { getColor } = require('./utils');
const state = require('../../../src/state');

let lights = {};
let groups = {};
// let scenes = {};
// let sensors = {};
// let rules = {};

const fromHueLights = hueLights => {
  const lights = [];

  Object.entries(hueLights).forEach(([id, hueLight]) => {
    lights.push({
      id: hueLight.name,
      gateway: 'hue',
      initialStates: [getColor(hueLight)],
    });
  });

  return lights;
};

const xyDigits = 4;
const xyRound = (xy, digits) => [
  Number(xy[0].toFixed(digits)),
  Number(xy[1].toFixed(digits)),
];

const xyDelta = 0.0075;
const isInDelta = (oldXY, newXY, delta) =>
  Math.sqrt((oldXY[0] - newXY[0]) ** 2 + (oldXY[1] - newXY[1]) ** 2) < delta;

const toHueCmd = (state, prevState) => {
  const hsv = state.nextState;

  // xyY seems to work best in Hue (fastest response times), so we'll
  // convert to that. Assume value component is 100 in hsv->xyY conversion.
  const [x, y] = convert['hsv']['xyY'].raw([hsv[0], hsv[1], 100]);

  const bri = Math.round(hsv[2] * 2.55);
  const off = hsv[2] === 0;

  // Hue transitiontime uses units of 0.1s
  const transitiontime = Math.round(state.transitionTime / 100);

  const cmd = {
    body: {},
  };

  // Avoid sending transitiontime if it's either the Hue default of 400ms, or
  // the hue-forwarder default of 500ms (which is maybe close enough to 400ms).
  // This is an optimisation as any extra commands will cause extra load on the
  // ZigBee network
  if (transitiontime !== 4 && transitiontime !== 5) {
    cmd.body.transitiontime = transitiontime;
  }

  if (off) {
    // For whatever reason turning Hue bulbs off with a long transitiontime
    // makes the transition "cut off" at the end, instantly turning off the bulb.
    // Here's a workaround which first fades the light to brightness 0, and
    // sets a transitionHack flag to the time when the light should receive an
    // additional on=false command.
    if (transitiontime > 5) {
      cmd.body.bri = 0;
      cmd.transitionHack = state.transitionTime;
    } else {
      cmd.body.on = false;
    }
  } else {
    // Don't assume an off Hue bulb remembers its state
    let useCache = prevState.on;

    if (!prevState.on) {
      cmd.body.on = true;
    }
    if (!useCache || prevState.bri !== bri) {
      cmd.body.bri = bri;
    }
    if (!useCache || !isInDelta(prevState.xy, [x, y], xyDelta)) {
      cmd.body.xy = xyRound([x, y], xyDigits);
    }
  }

  // Did this command actually end up doing something?
  if (
    cmd.body.on === undefined &&
    cmd.body.bri === undefined &&
    cmd.body.xy === undefined
  ) {
    return null;
  }

  return cmd;
};

exports.initApi = async (server, hueConfig) => {
  const makeRequest = async fields => {
    if (hueConfig.dummy) {
      return console.log('hue-gateway: Would make request:', fields);
    } else {
      return await request(fields);
    }
  };

  if (hueConfig.dummy) {
    hueConfig.bridgeAddr = 'hue-bridge-addr';

    lights = dummy.getLights(hueConfig);
    groups = dummy.getGroups();
    // scenes = dummy.getScenes();
    // for (const sceneId in scenes) {
    //   const scene = scenes[sceneId];
    //   scene.lightstates = dummy.getScene(sceneId).lightstates;
    // }
    // sensors = dummy.getSensors();
    // rules = dummy.getRules();
  } else {
    if (!hueConfig.bridgeAddr || !hueConfig.username) {
      throw 'hue-api: hue.bridgeAddr or username not found in config!';
    }

    // "Catch-all" route
    /*
    server.route({
      method: '*',
      path: '/{p*}',
      // handler: async (req: Hapi.Request, reply: Hapi.ReplyNoContinue) => {
      handler: async (req, h) => {
        console.log(`Forwarding: ${req.method} ${req.url.path}`);

        const response = await request({
          url: `http://${hueConfig.bridgeAddr}${req.url.path}`,
          method: req.method,
          body: req.payload || undefined,
          json: true,
        });

        console.log('response:', response);

        return response;
      },
    });
    */

    // Discover existing lights
    lights = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/lights`,
      timeout: 1000,
      json: true,
    });
    console.log('hue-api: cached existing lights');

    // Discover existing groups
    groups = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/groups`,
      timeout: 1000,
      json: true,
    });
    console.log('hue-api: cached existing groups');

    // Discover existing scenes
    // scenes = await request({
    //   url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/scenes`,
    //   timeout: 1000,
    //   json: true,
    // });
    // for (const sceneId in scenes) {
    //   const scene = scenes[sceneId];
    //   scene.lightstates = (await request({
    //     url: `http://${hueConfig.bridgeAddr}/api/${
    //       hueConfig.username
    //     }/scenes/${sceneId}`,
    //     timeout: 1000,
    //     json: true,
    //   })).lightstates;
    // }
    // console.log('hue-api: cached existing scenes');

    // Discover existing sensors
    // sensors = await request({
    //   url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/sensors`,
    //   timeout: 1000,
    //   json: true,
    // });
    // console.log('hue-api: cached existing sensors');
    //
    // // Discover existing rules
    // rules = await request({
    //   url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/rules`,
    //   timeout: 1000,
    //   json: true,
    // });
    // console.log('hue-api: cached existing rules');
  }

  // Register all lights
  fromHueLights(lights).forEach(luminaireRegister);

  const lightStates = {};

  Object.entries(lights).forEach(([lightId, light]) => {
    lightStates[lightId] = light.state;
  });

  state.set(['hue', 'lights'], lightStates);

  // TODO: wat do about these
  // server.event('getSensors');
  // server.event('getRules');

  //server.events.on('getGroups', promises => promises.push(groups));
  //server.events.on('getLights', promises => promises.push(lights));
  //server.events.on('getScenes', promises => promises.push(scenes));
  //server.events.on('getSensors', promises => promises.push(sensors));
  //server.events.on('getRules', promises => promises.push(rules));

  server.events.on('luminaireUpdate', async luminaire => {
    // Ignore non-Hue luminaires
    if (luminaire.gateway !== 'hue') {
      return;
    }

    const result = Object.entries(lights).find(
      ([lightId, hueLight]) => hueLight.name === luminaire.id,
    );

    if (!result) {
      console.log('hue-api: Unknown light id', luminaire.id);
      return;
    }

    const lightId = result[0];
    const light = luminaire.lights[0];
    let prevState = state.get(['hue', 'lights', lightId]);
    //console.log('prevState', prevState);

    // Get rid of possible existing transition hack timeout
    clearTimeout(prevState.transitionHackTimeout);

    const cmd = toHueCmd(light.getState(), prevState);

    if (!cmd) {
      // Nothing to send
      return;
    }

    // Send delayed off command
    if (cmd.transitionHack) {
      const transitionHackTimeout = setTimeout(
        () =>
          makeRequest({
            url: `http://${hueConfig.bridgeAddr}/api/${
              hueConfig.username
            }/lights/${lightId}/state`,
            method: 'PUT',
            body: { on: false },
            json: true,
            timeout: 1000,
          }),
        cmd.transitionHack,
      );

      prevState = state.set(['hue', 'lights', lightId], {
        ...prevState,
        transitionHackTimeout,
      });
    }

    console.log('sending hue cmd to', luminaire.id, cmd.body);

    // Hue bulbs are represented by single-light luminaires
    await makeRequest({
      url: `http://${hueConfig.bridgeAddr}/api/${
        hueConfig.username
      }/lights/${lightId}/state`,
      method: 'PUT',
      body: cmd.body,
      json: true,
      timeout: 1000,
    });

    state.set(['hue', 'lights', lightId], {
      ...prevState,
      ...cmd.body,
    });
  });
};
