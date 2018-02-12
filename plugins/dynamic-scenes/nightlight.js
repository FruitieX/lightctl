/*
 * nightlight
 *
 * When scene with sceneId matching options.sceneId is activated, slowly fades
 * lights one by one to the states as set by the scene.
 *
 * Options:
 * - sceneId: Required, name of scene to take over
 *
 * Sample configuration:
 *
 * ./plugins/dynamic-scenes/nightlight:
 *   sceneId: Nightlight
 */

const forEach = require('lodash/forEach');
const cloneDeep = require('lodash/cloneDeep');
const omit = require('lodash/omit');
const shuffle = require('lodash/shuffle');

const {
  modifyScene,
  getSceneLuminaires,
  getSceneLightCmds,
} = require('../../src/scenes');
const { getLuminaires } = require('../../src/lights');
const state = require('../../src/state');

let scene = null;
let timeout = null;
let config = null;

const delay = ms =>
  new Promise((resolve, reject) => (timeout = setTimeout(resolve, ms)));

const removeTransitiontime = lightstates => {
  forEach(
    lightstates,
    (light, lightId) => (lightstates[lightId] = omit(light, 'transitiontime')),
  );

  return lightstates;
};

const fadeBack = async (server, options, prevScene) => {
  server.events.emit('modifyScene', {
    sceneId: options.sceneId,
    payload: {
      lightstates: removeTransitiontime(prevScene.lightstates),
    },
  });
};

const fadeTime = 30 * 1000;

const runScene = async sceneId => {
  clearTimeout(timeout);

  const sceneLightCmds = getSceneLightCmds(sceneId, true);

  const restoreLightCmds = [];

  // For each light in the Nightlight scene, find the current light state and
  // store it in restoreLightCmds
  sceneLightCmds.forEach(({ light, cmd }) => {
    restoreLightCmds.push({
      light,
      cmd: { hsv: light.getState().currentState },
    });
  });

  await delay(1000);

  // Restore lights
  modifyScene({
    sceneId,
    lightCmds: restoreLightCmds,
    skipMiddleware: true,
  });

  await delay(1000);

  const lightsToFade = shuffle(sceneLightCmds);

  const curSceneCmds = restoreLightCmds;

  // Fade out lights one by one
  for (const lightCmd of lightsToFade) {
    /*
    // For whatever reason, fading a light to 0 brightness and then turning it
    // off results in a much smoother fade end than simply fading to off state
    // with a long transitiontime
    lightstates[lightId] = {
      ...light,
      transitiontime: Math.round((fadeTime / lightsToFade.length + 1000) / 100),
      on: true,
      bri: light.on ? light.bri : 0,
      xy: light.xy ? light.xy : [0.6, 0.4],
    };
    */

    console.log('Fading out', lightCmd.light.parentLuminaire.id);

    const lightIndex = curSceneCmds.findIndex(
      candidate => candidate.light.uuid === lightCmd.light.uuid,
    );

    curSceneCmds[lightIndex] = lightCmd;

    // TODO: we need a nicer API... currently feeding in all lights at once
    // means that middleware will mess up lights that we don't want to touch yet
    // (e.g. brightness gets applied twice...)
    modifyScene({
      sceneId,
      lightCmds: curSceneCmds,
      transitionTime: fadeTime / lightsToFade.length + 1000,
      skipMiddleware: true,
    });

    await delay(fadeTime / lightsToFade.length);
  }

  // One more time without skipMiddleware to allow e.g. final brightness adjustments
  modifyScene({
    sceneId,
    lightCmds: curSceneCmds,
  });
};

const sceneMiddleware = (server, options, scene) => ({
  sceneId,
  lightCmds,
  activated,
}) => {
  if (sceneId === options.sceneId && activated) {
    lightCmds.forEach(lightCmd => {
      const { cmd } = lightCmd;

      // Instant transition to black to indicate activation
      cmd.rgb = [0, 0, 0];

      // TODO: some way of handling this color conversion crap
      delete cmd.xyY;
      delete cmd.ct;
      delete cmd.hsv;
    });

    runScene(options.sceneId);
  }
};

const register = async function(server, options) {
  server.events.on('start', () => {
    server.events.on(
      'sceneMiddleware',
      sceneMiddleware(server, options, scene),
    );
  });
};

module.exports = {
  name: 'scenes/nightlight',
  version: '1.0.0',
  register,
};
