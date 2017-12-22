let groups = {};

const register = async (server, options) => {
  groups = options;

  server.events.on('luminaireDidRegister', luminaire => {
    // Insert newly registered luminaire to any groups it belongs to
    Object.entries(groups).forEach(([groupId, group]) => {
      groups[groupId] = group.map(groupLuminaire => {
        // If groupLuminaire is still a string, test if this luminaire should replace it
        if (
          typeof groupLuminaire === 'string' &&
          groupLuminaire === luminaire.id
        ) {
          return luminaire;
        }

        // Otherwise don't modify groupLuminaire
        return groupLuminaire;
      });
    });
  });
};

const groupExists = groupId => !!groups[groupId];

const getGroup = groupId => {
  let result = [];

  const group = groups[groupId];

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

module.exports = {
  name: 'groups',
  version: '1.0.0',
  register,
  getGroup,
  groupExists,
};
