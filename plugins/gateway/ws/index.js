const Nes = require('nes');
const { registerLuminaire } = require('../../../src/lights');

const register = async function(server, options) {
  await server.register(Nes);

  server.subscription('/luminaires/{luminaireId}');
  server.events.on('luminaireUpdate', luminaire => {
    server.publish(`/luminaires/${luminaire.id}`, luminaire.lights);
  });

  server.route({
    method: 'POST',
    path: '/register',
    config: {
      id: 'register',
      handler: (req, h) => {
        registerLuminaire({
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
