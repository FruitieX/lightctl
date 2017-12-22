const { getGroup, groupExists } = require('./groups');
const { getLuminaire } = require('./lights');

let scenes = {};
let prevScene = null;
let activeScene = null;

const register = async (server, options) => {
  scenes = options;
};

const getScenes = () => scenes;
const getScene = sceneId => scenes[sceneId];

const getSceneCmds = sceneId => {
  const scene = scenes[sceneId];
  if (!scene) {
    return console.log('No scene found with sceneId', sceneId);
  }

  const sceneCmds = [];
  Object.entries(scene).forEach(([sceneGroupId, cmds]) => {
    if (groupExists(sceneGroupId)) {
      const group = getGroup(sceneGroupId);
      group.forEach((luminaire, index) => {
        const sceneCmd = {};
        sceneCmd.luminaire = luminaire;

        if (!Array.isArray(cmds)) {
          sceneCmd.cmd = cmds;
        } else if (cmds.length === 1) {
          sceneCmd.cmd = cmds[0];
        } else {
          // TODO: this is a weird case to support
          sceneCmd.cmd = cmds[index];
        }

        sceneCmds.push(sceneCmd);
      });
    } else {
      const luminaire = getLuminaire(sceneGroupId);

      const sceneCmd = {};

      sceneCmd.luminaire = luminaire;
      sceneCmd.cmd = cmds;

      sceneCmds.push(sceneCmd);
    }
  });

  return sceneCmds;
};

const activateScene = sceneId => {
  console.log('activateScene', sceneId);

  const scene = scenes[sceneId];
  if (!scene) {
    return console.log('No scene found with sceneId', sceneId);
  }

  prevScene = activeScene;
  activeScene = sceneId;

  const sceneCmds = getSceneCmds(sceneId);

  sceneCmds.forEach(({ luminaire, cmd }) => {
    if (Array.isArray(cmd)) {
      cmd.forEach((state, index) => luminaire.lights[index].setState(state));
    } else {
      luminaire.lights.forEach(light => light.setState(cmd));
    }
  });
};

module.exports = {
  name: 'scenes',
  version: '1.0.0',
  register,
  getScenes,
  getScene,
  getSceneCmds,
  activateScene,
};
