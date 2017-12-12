/*
 * hue-api
 *
 * Make & cache requests to the Hue API
 */

const convert = require('color-convert');
const dummy = require('./dummy');
const request = require('request-promise-native');
const { getLights, setLights } = require('../../../src/lights');
const { getColor } = require('./utils');
//const { rgbToXy } = require('../../../src/utils');

const modifyConfig = (body, hueConfig) => {
  let config = body.config ? body.config : body;

  if (config.name) {
    config.name = hueConfig.forwarderName;
  }
  if (config.ipaddress) {
    config.ipaddress = hueConfig.forwarderAddr;
  }
  if (config.mac) {
    config.mac = hueConfig.forwarderMac;
  }
  if (config.bridgeid) {
    config.bridgeid = hueConfig.forwarderID;
  }

  return body;
};

const toHueLights = lights => {
  const hueLights = {};

  Object.entries(lights).forEach(([id, light]) => {
    const hueLight = {
      ...dummy.getLights()['1'],
    };

    hueLight.name = light.name;
    hueLight.uniqueid = id;

    const { r, g, b } = light.state[0];
    const [x, y, Y] = convert.rgb.xyY.raw(r, g, b);
    console.log(x, y, Y);
    hueLight.state.xy = [x, y];
    hueLight.state.bri = Y * 2.55;

    // TODO: id clashes?
    hueLights[id] = hueLight;
  });

  return hueLights;
};

const fromHueLights = hueLights => {
  const lights = [];

  Object.entries(hueLights).forEach(([id, hueLight]) => {
    lights.push({
      id,
      state: [getColor(hueLight)],
    });
  });

  return lights;
};

exports.initApi = async (server, hueConfig) => {
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
    //handler: () => dummy.getLights(hueConfig),
    handler: () => {
      const lights = toHueLights(getLights());

      return lights;
    },
  });
  server.route({
    method: 'put',
    path: '/api/{username}/lights/{lightId}/state',
    //handler: () => dummy.getLights(hueConfig),
    handler: req => {
      const lights = toHueLights(getLights());

      lights[req.params.lightId].state = {
        ...lights[req.params.lightId].state,
        ...req.payload,
      };

      setLights(
        fromHueLights({
          [req.params.lightId]: lights[req.params.lightId],
        }),
      );

      return dummy.setLightSuccess(req.params.lightId, req.payload);
    },
  });

  server.route({
    method: 'get',
    path: '/api/{username}/groups',
    // handler: () => dummy.getGroups(hueConfig),
    handler: req => {
      const groups = dummy.getGroups(hueConfig);

      console.log(groups);

      // Just spam all existing lights into the first group... for now?
      groups['1'].lights = Object.keys(getLights());

      return groups;
    },
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

  server.route([
    {
      method: 'GET',
      path: '/api/{username}/config',
      handler: async (req, h) => {
        // if (hueConfig.dummy) {
        if (req.params.username === 'nouser') {
          // Unauthenticated response
          return dummy.getConfigUnauthenticated(hueConfig);
        } else {
          // Authenticated response
          return dummy.getConfigAuthenticated(hueConfig);
        }
        // } else {
        //   console.log(
        //     `Forwarding (and spoofing): ${req.method} ${req.url.path}`,
        //   );
        //
        //   const response = await request({
        //     url: `http://${hueConfig.bridgeAddr}${req.url.path}`,
        //     method: req.method,
        //     body: req.payload || undefined,
        //     json: true,
        //   });
        //
        //   console.log('response', response);
        //
        //   return modifyConfig(response, hueConfig);
        // }
      },
    },
  ]);

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
};
