const state = require('./state');
const R = require('ramda');
const { getGroup, groupExists } = require('./groups');
const { getLuminaire } = require('./lights');
const convert = require('color-convert');

let server = null;

const register = async (_server, scenes) => {
  server = _server;
  state.set(['scenes', 'entries'], scenes);
  state.set(['scenes', 'unmodified'], scenes);

  // Default to first scene
  state.set(['scenes', 'active'], Object.keys(scenes)[0]);

  server.event({ name: 'modifyScene', clone: true });
  server.event({ name: 'activateScene', clone: true });
  server.event({ name: 'forceSceneUpdate', clone: true });
  server.event({ name: 'cycleScenes', clone: true });
  server.event({ name: 'sceneMiddleware' });

  server.events.on('start', () => {
    server.events.on('modifyScene', modifyScene);
    server.events.on('activateScene', activateScene);
    server.events.on('forceSceneUpdate', doSceneUpdate);
    server.events.on('cycleScenes', cycleScenes);
  });
};

const getScenes = () => state.get(['scenes', 'entries']);
const getScene = (sceneId, unmodified) =>
  state.get(['scenes', unmodified ? 'unmodified' : 'entries', sceneId]);
const getActiveSceneId = () => state.get(['scenes', 'active']);
const getPrevSceneId = () => state.get(['scenes', 'prev']);

const modifyScene = ({
  sceneId,
  scene,
  lightCmds,
  transitionTime,
  skipMiddleware,
}) => {
  if (scene) {
    state.set(['scenes', 'entries', sceneId], scene);
  }
  if (lightCmds) {
    const newScene = {};

    lightCmds.forEach(({ light, cmd }) => {
      const luminaire = light.parentLuminaire;

      // Initialize luminaire command array if it doesn't exist yet
      if (!newScene[luminaire.id]) {
        newScene[luminaire.id] = [];
      }

      newScene[luminaire.id][light.index] = cmd;
    });

    console.log(
      'scene',
      JSON.stringify(state.get(['scenes', 'entries', sceneId])),
    );
    state.set(['scenes', 'entries', sceneId], newScene);
    console.log('newScene', JSON.stringify(newScene));
  }

  if (sceneId === getActiveSceneId()) {
    doSceneUpdate({
      transitionTime,
      useExistingTransition: true,
      skipMiddleware,
    });
  }
};

const getSceneLuminaires = sceneId => {
  const scene = getScene(sceneId);
  if (!scene) {
    console.log('No scene found with sceneId', sceneId);
    return [];
  }

  const luminaires = [];
  Object.entries(scene).forEach(([sceneGroupId]) => {
    if (groupExists(sceneGroupId)) {
      const group = getGroup(sceneGroupId);
      group.forEach(luminaire => {
        luminaires.push(luminaire);
      });
    } else {
      luminaires.push(getLuminaire(sceneGroupId));
    }
  });

  return luminaires;
};

const getLightCmdsForLuminaire = (luminaire, cmds) => {
  const lightCmds = [];

  luminaire.lights.forEach((light, lightId) => {
    const cmd = Array.isArray(cmds) ? cmds[lightId] : cmds;

    lightCmds.push({
      light,
      cmd,
    });
  });

  return lightCmds;
};

const getSceneLightCmds = (sceneId, unmodified = false) => {
  const scene = getScene(sceneId, unmodified);
  if (!scene) {
    console.log('No scene found with sceneId', sceneId);
    return [];
  }

  const lightCmds = [];
  Object.entries(scene).forEach(([cmdGroup, cmds]) => {
    // cmdGroup is either a groupId or a luminaireId
    if (groupExists(cmdGroup)) {
      const group = getGroup(cmdGroup);
      group.forEach((luminaire, index) => {
        // For each luminaire in the group
        const luminaireLightCmds = getLightCmdsForLuminaire(luminaire, cmds);
        lightCmds.push(...luminaireLightCmds);
      });
    } else {
      const luminaire = getLuminaire(cmdGroup);

      const luminaireLightCmds = getLightCmdsForLuminaire(luminaire, cmds);
      lightCmds.push(...luminaireLightCmds);
    }
  });

  return lightCmds;
};

const doSceneUpdate = async ({
  sceneId = getActiveSceneId(),
  transitionTime = 500,
  useExistingTransition = false,
  activated = false,
  skipMiddleware = false,
} = {}) => {
  let lightCmds = getSceneLightCmds(sceneId);

  // Let scene middleware modify a deep clone of cmd
  lightCmds = lightCmds.map(lightCmd => ({
    ...lightCmd,
    cmd: JSON.parse(JSON.stringify(lightCmd.cmd)),
  }));

  if (!skipMiddleware) {
    await server.events.emit('sceneMiddleware', {
      sceneId,
      lightCmds,
      activated,
    });
  }

  lightCmds.forEach(({ light, cmd }) =>
    applySceneCmd(sceneId, light, {
      ...cmd,
      transitionTime,
      useExistingTransition,
    }),
  );
};

const activateScene = ({ sceneId, transitionTime }) => {
  console.log('activateScene', sceneId);

  const scene = getScene(sceneId);
  if (!scene) {
    return console.log('No scene found with sceneId', sceneId);
  }

  state.set(['scenes', 'prev'], getActiveSceneId());
  state.set(['scenes', 'active'], sceneId);

  // Was the scene just activated?
  const activated = sceneId !== getPrevSceneId();

  doSceneUpdate({ sceneId, transitionTime, activated });
};

const applySceneCmd = async (sceneId, light, cmd) => {
  // If useExistingTransition was specified, use transitionTime from ongoing
  // transition if it is longer than cmd.transitionTime.
  if (cmd.useExistingTransition) {
    cmd.transitionTime = Math.max(
      cmd.transitionTime,
      light.getState().transitionTime,
    );
  }

  const { xyY, ct, rgb, hsv, ...options } = cmd;

  let state = [0, 0, 0];
  if (hsv) {
    state = hsv;
  } else if (xyY) {
    state = convert['xyY']['hsv'].raw(xyY);
  } else if (ct) {
    state = convert['ct']['hsv'].raw(ct);
  } else if (rgb) {
    state = convert['rgb']['hsv'].raw(rgb);
  }

  light.setState(state, options);
};

const cycleScenes = ({ scenes }) => {
  const currentIndex = scenes.indexOf(getActiveSceneId());

  activateScene({ sceneId: scenes[(currentIndex + 1) % scenes.length] });
};

module.exports = {
  name: 'scenes',
  version: '1.0.0',
  register,
  getScenes,
  getScene,
  getSceneLightCmds,
  getSceneLuminaires,
  modifyScene,
  activateScene,
};
