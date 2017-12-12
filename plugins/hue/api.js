/*
 * hue-api
 *
 * Make & cache requests to the Hue API
 */

const dummy = require('./dummy');
const request = require('request-promise-native');

let lights = {};
let groups = {};
let scenes = {};
let sensors = {};
let rules = {};

exports.initApi = async (server, hueConfig) => {
  if (hueConfig.dummy) {
    server.route({
      method: 'post',
      path: '/api/',
      handler: () => dummy.linkButtonSuccess(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}',
      handler: () => dummy.getAllAuthenticated(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/nouser',
      handler: () => dummy.getAllUnauthenticated(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}/lights',
      handler: () => dummy.getLights(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}/groups',
      handler: () => dummy.getGroups(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}/scenes',
      handler: () => dummy.getScenes(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}/scenes/{sceneId}',
      handler: () => dummy.getScene(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}/sensors',
      handler: () => dummy.getSensors(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}/schedules',
      handler: () => dummy.getSchedules(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}/rules',
      handler: () => dummy.getRules(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}/resourcelinks',
      handler: () => dummy.getResourcelinks(hueConfig),
    });

    server.route({
      method: 'put',
      path: '/api/{username}/config',
      handler: () => dummy.putConfigUTC(hueConfig),
    });

    server.route({
      method: 'get',
      path: '/api/{username}/{device}/new',
      handler: () => dummy.getNewDevices(hueConfig),
    });

    server.route({
      method: '*',
      path: '/{p*}',
      // handler: async (req: Hapi.Request, reply: Hapi.ReplyNoContinue) => {
      handler: async (req, h) => {
        console.log(`Unhandled method: ${req.method} ${req.url.path}`);
        console.log(`Payload:`, req.payload);

        return null;
      },
    });
  } else {
    if (!hueConfig.bridgeAddr || !hueConfig.bridgeUsername) {
      throw 'hue-api: hue.bridgeAddr or USERNAME not found in config!';
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
      url: `http://${hueConfig.bridgeAddr}/api/${
        hueConfig.bridgeUsername
      }/lights`,
      timeout: 1000,
      json: true,
    });
    console.log('hue-api: cached existing lights');

    // Discover existing groups
    groups = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${
        hueConfig.bridgeUsername
      }/groups`,
      timeout: 1000,
      json: true,
    });
    console.log('hue-api: cached existing groups');

    // Discover existing scenes
    scenes = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${
        hueConfig.bridgeUsername
      }/scenes`,
      timeout: 1000,
      json: true,
    });
    for (const sceneId in scenes) {
      const scene = scenes[sceneId];
      scene.lightstates = (await request({
        url: `http://${hueConfig.bridgeAddr}/api/${
          hueConfig.bridgeUsername
        }/scenes/${sceneId}`,
        timeout: 1000,
        json: true,
      })).lightstates;
    }
    console.log('hue-api: cached existing scenes');

    // Discover existing sensors
    sensors = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${
        hueConfig.bridgeUsername
      }/sensors`,
      timeout: 1000,
      json: true,
    });
    console.log('hue-api: cached existing sensors');

    // Discover existing rules
    rules = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${
        hueConfig.bridgeUsername
      }/rules`,
      timeout: 1000,
      json: true,
    });
    console.log('hue-api: cached existing rules');
  }

  // TODO: wat do about these
  server.event('getSensors');
  server.event('getRules');

  server.events.on('getGroups', promises => promises.push(groups));
  server.events.on('getLights', promises => promises.push(lights));
  server.events.on('getScenes', promises => promises.push(scenes));
  server.events.on('getSensors', promises => promises.push(sensors));
  server.events.on('getRules', promises => promises.push(rules));
};
