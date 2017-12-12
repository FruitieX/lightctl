/*
 * hue-api
 *
 * Make & cache requests to the Hue API
 */

const dummy = require('../../api/hue/dummy');
const request = require('request-promise-native');
const { setLights } = require('../../../src/lights');
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
      id: `hue/${id}`,
      name: hueLight.name,
      state: [getColor(hueLight)],
    });
  });

  return lights;
};

exports.initApi = async (server, hueConfig) => {
  if (hueConfig.dummy) {
    lights = dummy.getLights();
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
        url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/scenes/${
          sceneId
        }`,
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

  setLights(fromHueLights(lights));
  //setLights();

  // TODO: wat do about these
  server.event('getSensors');
  server.event('getRules');

  server.events.on('getGroups', promises => promises.push(groups));
  //server.events.on('getLights', promises => promises.push(lights));
  server.events.on('getScenes', promises => promises.push(scenes));
  server.events.on('getSensors', promises => promises.push(sensors));
  server.events.on('getRules', promises => promises.push(rules));
};
