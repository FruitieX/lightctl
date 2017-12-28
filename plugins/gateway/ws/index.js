const Nes = require('nes');
const { luminaireRegister } = require('../../../src/lights');

const register = async function(server, options) {
  await server.register(Nes);

  server.subscription('/luminaires/{luminaireId}');
  server.subscription('/luminaires/all');

  server.events.on('luminaireUpdate', luminaire => {
    server.publish(`/luminaires/${luminaire.id}`, luminaire.lights);
    server.publish(`/luminaires/all`, luminaire);
  });
  server.events.on('luminaireDidRegister', luminaire => {
    server.publish(`/luminaires/${luminaire.id}`, luminaire.lights);
    server.publish(`/luminaires/all`, luminaire);
  });

  server.route({
    method: 'POST',
    path: '/register',
    config: {
      id: 'register',
      handler: (req, h) => {
        luminaireRegister({
          ...req.payload,
          id: req.payload.id,
          gateway: 'ws',
        });

        return { status: 'ok' };
      },
    },
  });
};

module.exports = {
  name: 'gateway/ws',
  version: '1.0.0',
  register,
};
