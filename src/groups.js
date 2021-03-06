/**
 * groups
 *
 * Groups allow grouping together luminaires to form for example rooms of a house,
 * or even grouping together only some of the luminaires in a room. Luminaires can be
 * part of many groups at once. Groups can then be controlled as one unit,
 * with each luminaire in the group receiving the same commands.
 *
 * Sample configuration:
 *
 * groups:
 *   Living room:
 *     - IKEA lamp
 *     - Old lamp
 *     - Fancy lamp
 *   Bedroom:
 *     - Nightstand
 */

const state = require('./state');

const register = async (server, groups) => {
  state.set(['groups'], groups);

  server.event({ name: 'setGroupState', clone: true });

  server.events.on('start', () => {
    server.events.on('setGroupState', setGroupState);
  });

  server.events.on('luminaireDidRegister', luminaire => {
    // Insert newly registered luminaire to any groups it belongs to
    Object.entries(state.get(['groups'])).forEach(([groupId, group]) => {
      state.set(
        ['groups', groupId],
        group.map(groupLuminaire => {
          // If groupLuminaire is still a string, test if this luminaire should replace it
          if (
            typeof groupLuminaire === 'string' &&
            groupLuminaire === luminaire.id
          ) {
            return luminaire;
          }

          // Otherwise don't modify groupLuminaire
          return groupLuminaire;
        }),
      );
    });
  });
};

const groupExists = groupId => !!state.get(['groups', groupId]);

const getGroup = groupId => {
  let result = [];

  const group = state.get(['groups', groupId]);

  if (!group) {
    return console.log('Group not found with groupId', groupId);
  }

  // Return only luminaires which have registered
  group.forEach(groupLuminaire => {
    if (typeof groupLuminaire !== 'string') {
      result.push(groupLuminaire);
    }
  });

  return result;
};

const setGroupState = ({ groupId, state: nextState, options }) => {
  const group = getGroup(groupId);

  if (!group) return;

  // Setting group state will reset active scene
  state.set(['scenes', 'prev'], state.get(['scenes', 'active']));
  state.set(['scenes', 'active'], null);

  group.forEach(luminaire => luminaire.setState(nextState, options));
};

module.exports = {
  name: 'groups',
  version: '1.0.0',
  register,
  getGroup,
  groupExists,
  setGroupState,
};
