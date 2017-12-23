/*
 * hue-api
 *
 * Make & cache requests to the Hue API
 */

const dummy = require('../../api/hue/dummy');
const request = require('request-promise-native');
const { luminaireRegister } = require('../../../src/lights');
const { getColor } = require('./utils');

let lights = {};
let groups = {};
let scenes = {};
let sensors = {};
let rules = {};

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

exports.initApi = async (server, hueConfig) => {
  const makeRequest = fields => {
    if (hueConfig.dummy) {
      return console.log('hue-gateway: Would make request:', fields);
    } else {
      return request(fields);
    }
  };

  if (hueConfig.dummy) {
    hueConfig.bridgeAddr = 'hue-bridge-addr';

    lights = dummy.getLights(hueConfig);
    groups = dummy.getGroups();
    scenes = dummy.getScenes();
    for (const sceneId in scenes) {
      const scene = scenes[sceneId];
      scene.lightstates = dummy.getScene(sceneId).lightstates;
    }
    sensors = dummy.getSensors();
    rules = dummy.getRules();
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
    scenes = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/scenes`,
      timeout: 1000,
      json: true,
    });
    for (const sceneId in scenes) {
      const scene = scenes[sceneId];
      scene.lightstates = (await request({
        url: `http://${hueConfig.bridgeAddr}/api/${
          hueConfig.username
        }/scenes/${sceneId}`,
        timeout: 1000,
        json: true,
      })).lightstates;
    }
    console.log('hue-api: cached existing scenes');

    // Discover existing sensors
    sensors = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/sensors`,
      timeout: 1000,
      json: true,
    });
    console.log('hue-api: cached existing sensors');

    // Discover existing rules
    rules = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/rules`,
      timeout: 1000,
      json: true,
    });
    console.log('hue-api: cached existing rules');
  }

  // Register all lights
  fromHueLights(lights).forEach(luminaireRegister);

  // TODO: wat do about these
  server.event('getSensors');
  server.event('getRules');

  //server.events.on('getGroups', promises => promises.push(groups));
  //server.events.on('getLights', promises => promises.push(lights));
  //server.events.on('getScenes', promises => promises.push(scenes));
  //server.events.on('getSensors', promises => promises.push(sensors));
  //server.events.on('getRules', promises => promises.push(rules));

  server.events.on('luminaireUpdate', luminaire => {
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
    const state = luminaire.lights[0].getState('xyY');
    const body = {};

    const [x, y, Y] = state.nextState;

    if (Y === 0) {
      // We assume brightness 0 is darkness (unlike Hue)
      body.on = false;
    } else {
      // TODO: must cache many of these fields and prevent sending dupes
      body.on = true;

      body.bri = Math.round(Y * 2.55);
      body.xy = [x, y];

      // Hue counts time as multiples of 100 ms...
      body.transitiontime = Math.round(state.transitionTime / 100);

      // 400 ms is the default, avoid sending it as an optimisation
      if (body.transitiontime === 4) {
        delete body.transitiontime;
      }
    }

    console.log('body:', body);

    // Hue bulbs are represented by single-light luminaires
    makeRequest({
      url: `http://${hueConfig.bridgeAddr}/api/${
        hueConfig.username
      }/lights/${lightId}/state`,
      method: 'PUT',
      body,
      json: true,
      timeout: 1000,
    });
    //server.publish(`/luminaires/${luminaire.id}`, luminaire.lights);
  });
};
