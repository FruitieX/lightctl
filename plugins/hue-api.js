/*
 * hue-api
 *
 * Make & cache requests to the Hue API
 */

const request = require('request-promise-native');

let lights = {};
let groups = {};
let scenes = {};
let sensors = {};
let rules = {};

const register = async (server, options) => {
  if (!server.config.HUE_IP || !server.config.USERNAME) {
    throw 'hue-api: HUE_IP or USERNAME not found in config!';
  }

  // Discover existing lights
  lights = await request({
    url: `http://${server.config.HUE_IP}/api/${server.config.USERNAME}/lights`,
    timeout: 1000,
    json: true,
  });
  console.log('hue-api: cached existing lights');

  // Discover existing groups
  groups = await request({
    url: `http://${server.config.HUE_IP}/api/${server.config.USERNAME}/groups`,
    timeout: 1000,
    json: true,
  });
  console.log('hue-api: cached existing groups');

  // Discover existing scenes
  scenes = await request({
    url: `http://${server.config.HUE_IP}/api/${server.config.USERNAME}/scenes`,
    timeout: 1000,
    json: true,
  });
  for (const sceneId in scenes) {
    const scene = scenes[sceneId];
    scene.lightstates = (await request({
      url: `http://${server.config.HUE_IP}/api/${
        server.config.USERNAME
      }/scenes/${sceneId}`,
      timeout: 1000,
      json: true,
    })).lightstates;
  }
  console.log('hue-api: cached existing scenes');

  // Discover existing sensors
  sensors = await request({
    url: `http://${server.config.HUE_IP}/api/${server.config.USERNAME}/sensors`,
    timeout: 1000,
    json: true,
  });
  console.log('hue-api: cached existing sensors');

  // Discover existing rules
  rules = await request({
    url: `http://${server.config.HUE_IP}/api/${server.config.USERNAME}/rules`,
    timeout: 1000,
    json: true,
  });
  console.log('hue-api: cached existing rules');

  server.event('getGroups');
  server.event('getLights');
  server.event('getScenes');
  server.event('getSensors');
  server.event('getRules');

  server.on('getGroups', promises => promises.push(groups));
  server.on('getLights', promises => promises.push(lights));
  server.on('getScenes', promises => promises.push(scenes));
  server.on('getSensors', promises => promises.push(sensors));
  server.on('getRules', promises => promises.push(rules));
};

module.exports = {
  name: 'hue-api',
  version: '1.0.0',
  register,
};
