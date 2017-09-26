/*
 * scene-spy
 *
 * Store id of currently active scene in a Hue bridge sensor.
 * Additionally, we poll for the currently active scene and store it in
 * sceneForGroup. Other plugins can import sceneForGroup and perform logic
 * based on the current active scene.
 *
 * Any scene change through the API will trigger this function.
 * Any light state changes will reset the scene value to "null".
 *
 * SETUP:
 *
 * - Register plugin in index.js:
 *
 * ```
 * server.register(
 *   [
 *     {
 *       register: require('./plugins/scene-spy'),
 *       options: { groups: [ 0, 1 ], pollDelay: 100, duplicateSceneChange: true }
 *     },
 * ...
 * ```
 *
 * - If you want your Dimmer Switches to also sync the active scene, append the
 *   following to the actions array of each dimmer switch rule (replace
 *   ${SENSOR_ID} and ${SCENE_ID} with relevant values):
 *
 * ```
 * {
 *   "address": "/sensors/${SENSOR_ID}",
 *   "method": "PUT",
 *   "body": {
 *     "name": "${SCENE_ID}"
 *   }
 * }
 * ```
 *
 * NOTE: Special scenes include:
 *
 * - "null": No scene active (light states changed manually since last scene recall)
 * - "off": Can be reported by dimmer switches to signify turning group off
 *
 */

const EventEmitter = require('events').EventEmitter;
const request = require('request-promise-native');

const groupActionRegex = /\/api\/([\w-]+)\/groups\/(\d+)\/action/;
const lightStateRegex = /\/api\/([\w-]+)\/lights\/(\d+)\/state/;

const sceneSensorForGroup = {};
const sceneForGroup = {};

let groups = {};

// Contain IDs of registered scenes that should be excempt from recall duplication
const registeredScenes = {};

exports.registerScene = async sceneId => {
  if (registeredScenes[sceneId]) {
    throw 'Scene already registered!';
  }

  // Fetch scene from bridge
  scene = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/scenes/${sceneId}`,
    json: true,
  });

  registeredScenes[sceneId] = {
    ...scene,
    events: new EventEmitter(),
  };

  return registeredScenes[sceneId];
};

const emitSceneChange = ({ sceneId, prevSceneId, groupId }) => {
  const scene = registeredScenes[sceneId];
  const prevScene = registeredScenes[prevSceneId];

  if (scene) {
    scene.events.emit('activate', { sceneId, prevSceneId, groupId });
  }
  if (prevScene && prevScene !== scene) {
    prevScene.events.emit('deactivate', { sceneId, prevSceneId, groupId });
  }
};

// TODO: only run this upon changes
const storeSceneId = (sceneId, groupId, username, override) => {
  request({
    url: `http://${process.env.HUE_IP}/api/${username}/sensors/${sceneSensorForGroup[groupId]}`,
    method: 'PUT',
    body: JSON.stringify({ name: sceneId || 'null' }),
  });

  // Provide an option to immediately override the active scene in sceneForGroup.
  // Useful when a scene plugin wants to "silently" activate their scene,
  // and not get initial light states forcibly recalled by duplicateSceneChange
  if (override) {
    emitSceneChange({ groupId, sceneId, prevSceneId: sceneForGroup[groupId] });
    sceneForGroup[groupId] = sceneId;
  }
};

exports.storeSceneId = storeSceneId;

const onPreHandler = (req, reply) => {
  let match;

  if (req.method === 'put') {
    if (match = req.path.match(groupActionRegex)) {
      // Scene changed for group
      const [ result, username, groupId ] = match;

      //console.log(`scene-spy: Group ${groupId} scene changed to: ${req.payload.scene}`);

      if (groupId !== 0) {
        storeSceneId(req.payload.scene, groupId, username);
      }

      // Any scene change results in group 0 (all lights) scene getting set!
      storeSceneId(req.payload.scene, 0, username);
    } else if (match = req.path.match(lightStateRegex)) {
      // Light state changed, reset stored scene id to "null"
      const [ result, username, lightId ] = match;

      // Figure out which group(s) light is part of
      // TODO: can a light be part of multiple groups?
      const groupId = Object.keys(groups).find(groupId =>
        groups[groupId].lights.includes(lightId)
      );

      //console.log(`scene-spy: Light ${lightId} state changed, scene reset for group ${groupId}`);

      if (groupId !== 0) {
        storeSceneId(undefined, groupId, username);
      }

      // Any light state change results in group 0 (all lights) scene getting reset!
      storeSceneId(undefined, 0, username);
    }
  }

  return reply.continue();
};

const delay = ms =>
  new Promise((resolve, reject) =>
    setTimeout(resolve, ms)
  );

const startPolling = async (server, options) => {
  while (true) {
    const sensors = await request({
      url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
      json: true,
    });

    for (let groupId in options.groups) {
      //console.log('poll took', new Date().getTime() - time, 'ms');
      const sensorId = sceneSensorForGroup[groupId];
      const sceneId = sensors[sensorId].name;

      // Scene Sensor has changed since previous poll
      if (sceneId !== 'handled') {
        // Notify registered scenes
        emitSceneChange({ groupId, sceneId, prevSceneId: sceneForGroup[groupId] });

        // Store the new sceneId
        sceneForGroup[groupId] = sceneId;

        console.log(`scene-spy: Group ${groupId} scene activation detected! (${sceneId})`);

        // Work around a race-condition issue where another plugin relying
        // on our `sceneForGroup` state might in some cases overrule the light
        // state changes initiated by a recent scene recall.
        //
        // The "fix" here is to re-send the scene recall to the bridge whenever
        // we notice the active scene has just changed.

        // TODO: handle 'off' scene (turn off group)
        if (options.duplicateSceneChange && sceneId !== 'null' && !registeredScenes[sceneId]) {
          console.log(`scene-spy: Re-sending scene change to ${sceneId}`);
          await request({
            url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/groups/${groupId}/action`,
            method: 'PUT',
            body: {
              scene: sceneId
            },
            json: true,
          });
        }

        // Mark scene activation as handled
        await request({
          url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors/${sensorId}`,
          method: 'PUT',
          body: {
            name: 'handled'
          },
          json: true,
        });
      }
    }

    await delay(options.pollDelay || 100);
  }
};

exports.register = async function (server, options, next) {
  if (!process.env.USERNAME) {
    return next('scene-spy: USERNAME env var not supplied, aborting...');
  }

  server.ext('onPreHandler', onPreHandler);

  // Discover existing groups
  groups = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/groups`,
    json: true,
  });

  // Discover existing sensors
  const sensors = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
    json: true,
  });

  // Try matching groups to scene sensors
  for (let groupId in options.groups) {
    let sensorId = Object.keys(sensors).find(sensorId =>
      sensors[sensorId].modelid === `Group ${groupId} Scene Sensor`
    );

    if (sensorId === undefined) {
      // If scene sensor for group not found, create it
      const generated = await request({
        url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
        method: 'POST',
        body: {
          name: 'null',
          modelid: `Group ${groupId} Scene Sensor`,
          swversion: '1',
          type: 'CLIPGenericStatus',
          uniqueid: `group${groupId}`,
          manufacturername: 'Scene Sensor',
        },
        json: true,
      });
      sensorId = generated[0].success.id;
      console.log(`scene-spy: Created scene sensor (ID ${sensorId}) for group ${groupId}`);
    }

    sceneSensorForGroup[groupId] = sensorId;
  };

  console.log(`scene-spy: Detected {groupId:sceneSensor} pairs: ${JSON.stringify(sceneSensorForGroup)}`);

  server.on('start', () => {
    console.log(`scene-spy: Starting polling Scene Sensors...`);
    startPolling(server, options);
  });

  next();
};

exports.register.attributes = {
  name: 'scene-spy',
  version: '1.0.0'
};
