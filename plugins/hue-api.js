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

exports.register = async function(server, options, next) {
  // Discover existing lights
  lights = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/lights`,
    timeout: 1000,
    json: true,
  });
  console.log('hue-api: cached existing lights');

  // Discover existing groups
  groups = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/groups`,
    timeout: 1000,
    json: true,
  });
  console.log('hue-api: cached existing groups');

  // Discover existing scenes
  scenes = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/scenes`,
    timeout: 1000,
    json: true,
  });
  for (const sceneId in scenes) {
    const scene = scenes[sceneId];
    scene.lightstates = (await request({
      url: `http://${process.env.HUE_IP}/api/${process.env
        .USERNAME}/scenes/${sceneId}`,
      timeout: 1000,
      json: true,
    })).lightstates;
  }
  console.log('hue-api: cached existing scenes');

  // Discover existing sensors
  sensors = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
    timeout: 1000,
    json: true,
  });
  console.log('hue-api: cached existing sensors');

  // Discover existing rules
  rules = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/rules`,
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

  next();
};

exports.register.attributes = {
  name: 'hue-api',
  version: '1.0.0',
};
