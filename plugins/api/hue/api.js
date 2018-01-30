/*
 * hue-api
 *
 * Make & cache requests to the Hue API
 */

const c0lor = require('c0lor');
const convert = require('color-convert');
const dummy = require('./dummy');
const request = require('request-promise-native');
const { getLuminaires, setLight, Luminaire } = require('../../../src/lights');
const {
  activateScene,
  getScenes,
  getScene,
  getSceneLightCmds,
} = require('../../../src/scenes');
const { getColor } = require('../../gateway/hue/utils');
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

const multisourceRE = /(.*) \(#(\d+)\)/;
const toHueLights = luminaires => {
  const hueLights = {};

  luminaires.forEach(luminaire => {
    luminaire.lights.forEach((light, index) => {
      const hueLight = {
        ...dummy.getLights()['1'],
      };

      const postfix = luminaire.lights.length > 1 ? ` (#${index + 1})` : '';

      hueLight.name = luminaire.id + postfix;
      hueLight.uniqueid = luminaire.id + postfix;

      // HSV gives us much better representation of Hue's "bri" parameter than xyY
      const hsv = luminaire.lights[0].getState().currentState;
      const [x, y] = convert['hsv']['xyY'].raw(hsv);

      //hueLight.state.colormode = 'hs';
      //hueLight.state.hue = Math.round(hsv[0] / 360 * 65536);
      //hueLight.state.sat = Math.round(hsv[1] / 100 * 254);
      hueLight.state.bri = Math.round(hsv[2] / 100 * 254);

      hueLight.state.xy = [x, y];

      hueLights[hueLight.uniqueid] = hueLight;
    });
  });

  return hueLights;
};

const crypto = require('crypto');
const getSceneAppdata = sceneId => {
  const hash = crypto.createHash('sha256');
  hash.update(sceneId);

  let digest = hash.digest('hex');
  digest = digest.slice(0, 5);

  // TODO: 'r01' means room number?
  return {
    data: `${digest}_r01_d99`,
    version: 1,
  };
};

const getHueScenes = () => {
  const scenes = { ...getScenes() };

  /*
  Object.entries(scenes).forEach(([sceneId, scene]) => {
    scenes[sceneId] = {
      ...dummy.getScene(),
    };

    scenes[sceneId].name = sceneId;
    // TODO: multisource
    scenes[sceneId].lights = [];

    getSceneLightCmds(sceneId).forEach(({ luminaire }) => {
      const hueLights = toHueLights([luminaire]);
      Object.keys(hueLights).forEach(lightId =>
        scenes[sceneId].lights.push(lightId),
      );
    });

    scenes[sceneId].appdata = getSceneAppdata(sceneId);

    // Scene list does not contain lightstates
    delete scenes[sceneId].lightstates;
  });
  */

  return scenes;
};

const getHueScene = sceneId => {
  const scene = getScene(sceneId);

  if (!scene) {
    return null;
  }

  const hueScene = { ...dummy.getScene() };
  const sceneCmds = getSceneCmds(sceneId);

  hueScene.name = sceneId;
  hueScene.lights = [];
  hueScene.lightstates = {};
  hueScene.appdata = getSceneAppdata(sceneId);

  sceneCmds.forEach(({ luminaire, cmd }) => {
    const hueLights = toHueLights([luminaire]);
    console.log('cmd', cmd);
    const cmdLuminaire = new Luminaire({
      numLights: cmd.length || 1,
      initialStates: Array.isArray(cmd) ? cmd : [cmd],
    });

    console.log(cmdLuminaire);
    Object.keys(hueLights).forEach((lightId, index) => {
      hueScene.lights.push(lightId);

      if (cmdLuminaire.lights.length === 1) {
        index = 0;
      }

      // TODO: outdated
      const [x, y] = cmdLuminaire.lights[index].getState('xyY').currentState;
      const bri = cmdLuminaire.lights[index].getState('hsv').currentState[2];

      hueScene.lightstates[lightId] = {
        bri: Math.round(bri * 2.55),
        on: !!bri, // TODO
        xy: [x, y],
      };
    });
  });

  return hueScene;
};

const getHueLights = () => toHueLights(getLuminaires());

const getHueGroups = () => {
  const groups = dummy.getGroups();

  const hueLights = toHueLights(getLuminaires());
  // console.log(hueLights);
  // console.log(JSON.stringify(getLuminaires()));

  // Just spam all existing lights into the first group... for now?
  groups['1'].lights = Object.keys(hueLights);

  return groups;
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
    handler: () => ({
      lights: getHueLights(),
      groups: getHueGroups(),
      config: dummy.getConfigAuthenticated(hueConfig),
      schedules: dummy.getSchedules(hueConfig),
      scenes: getHueScenes(),
      rules: dummy.getRules(hueConfig),
      sensors: dummy.getSensors(hueConfig),
      resourcelinks: dummy.getResourcelinks(hueConfig),
    }),
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
    handler: getHueLights,
  });
  server.route({
    method: 'put',
    path: '/api/{username}/lights/{lightId}/state',
    //handler: () => dummy.getLights(hueConfig),
    handler: req => {
      const hueLights = toHueLights(getLuminaires());

      // First assume single light luminaire
      let luminaireId = req.params.lightId;
      let lightId = 0;

      // Test for multi light luminaire
      let results = null;
      if ((results = multisourceRE.exec(luminaireId))) {
        luminaireId = results[1];
        lightId = results[2] - 1;
      }

      const hueLight = hueLights[req.params.lightId];

      // Toggle power
      if (req.payload.on !== undefined) {
        hueLight.state.on = req.payload.on;
      }

      // Brightness
      if (req.payload.bri) {
        hueLight.state.bri = req.payload.bri;
      }

      // Colors
      if (req.payload.xy) {
        hueLight.state.xy = req.payload.xy;
        hueLight.state.colormode = 'xy';
      } else if (req.payload.ct) {
        hueLight.state.ct = req.payload.ct;
        hueLight.state.colormode = 'ct';
      } else if (req.payload.hue || req.payload.sat) {
        hueLight.state.hue = req.payload.hue;
        hueLight.state.sat = req.payload.sat;
        hueLight.state.colormode = 'hs';
      }

      const state = getColor(hueLight);

      const options = {};
      // Transition time defaults to 400. Note that Hue transitiontime uses multiples of 100ms
      options.transitionTime = Number.isInteger(req.payload.transitiontime)
        ? req.payload.transitiontime * 100
        : 400;

      setLight({ luminaireId, lightId, state, options });

      return dummy.setLightSuccess(req.params.lightId, req.payload);
    },
  });

  server.route({
    method: 'get',
    path: '/api/{username}/groups',
    // handler: () => dummy.getGroups(hueConfig),
    handler: getHueGroups,
  });

  server.route({
    method: 'get',
    path: '/api/{username}/scenes',
    handler: getHueScenes,
  });

  server.route({
    method: 'put',
    path: '/api/{username}/groups/{groupId}/action',
    //handler: () => dummy.getLights(hueConfig),
    handler: req => {
      if (req.payload.scene) {
        activateScene({ sceneId: req.payload.scene });
        return dummy.setSuccess({
          [`/groups/${req.params.groupId}/action/scene`]: req.payload.scene,
        });
      } else if (req.payload.on !== undefined) {
      } else {
        console.log('Unhandled group action', req.payload);
      }
    },
  }),
    server.route({
      method: 'get',
      path: '/api/{username}/scenes/{sceneId}',
      handler: req => getHueScene(req.params.sceneId), //(req) => dummy.getScene(hueConfig),
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
