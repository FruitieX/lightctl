/*
 * nightlight
 *
 * When `options.sceneId` is active, activates nightlights by fading out
 * lights slowly to a very warm color, then turning off all lights except
 * ones with "on=true" in the bridge scene
 *
 * DEPENDENCIES:
 *
 * - dynamic-scenes
 *
 * SETUP:
 *
 * - Create a nightlight scene through the Hue app with desired lights left on
 *   at desired brightness, note down the sceneId
 *
 * - Register dependencies and plugin in index.js:
 *
 * ```
 * server.register(
 *   [
 *     {
 *       register: require('./plugins/scenes/nightlight'),
 *       options: { sceneId: '<id of nightlight Hue scene>' }
 *     ...
 *   ]
 * ...
 * ```
 */

const forEach = require('lodash/forEach');
const cloneDeep = require('lodash/cloneDeep');
const omit = require('lodash/omit');
const shuffle = require('lodash/shuffle');

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

const runScene = async (server, options, scene, prevScene) => {
  clearTimeout(timeout);
  await delay(1000);

  // Fade back to previous scene
  if (prevScene) {
    await fadeBack(server, options, prevScene);
  }

  await delay(1000);

  const lightsToFade = shuffle(scene.lights);

  const lightstates = cloneDeep(removeTransitiontime(prevScene.lightstates));

  // Fade out lights one by one
  for (const lightId of lightsToFade) {
    const light = scene.lightstates[lightId];

    console.log('fading light', lightId);

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

    server.events.emit('modifyScene', {
      sceneId: options.sceneId,
      payload: {
        lightstates,
      },
    });

    await delay(fadeTime / lightsToFade.length);

    // Now turn light off if it should be off
    if (!light.on) {
      lightstates[lightId] = {
        on: false,
        // TODO: this bri: 0 hack is needed to avoid auto-brightness middleware from kicking in
        bri: 0,
      };

      server.events.emit('modifyScene', {
        sceneId: options.sceneId,
        payload: {
          lightstates,
        },
      });
    }
  }
};

const sceneMiddleware = (server, options, scene) => ({
  sceneId,
  prevSceneId,
  prevScene,
  scene: middlewareScene,
}) => {
  if (sceneId === options.sceneId && prevSceneId !== sceneId) {
    // Scene was just activated

    // Instant transition to black to indicate activation
    for (const lightId in middlewareScene.lightstates) {
      middlewareScene.lightstates[lightId] = scene.lightstates[lightId];
    }

    removeTransitiontime(middlewareScene.lightstates);

    runScene(server, options, cloneDeep(scene), cloneDeep(prevScene));
  }
};

const register = async function(server, options) {
  server.events.on('start', () => {
    scene = server.plugins['virtualized-scenes'].scenes[options.sceneId];

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