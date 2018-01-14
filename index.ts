import * as Hapi from 'hapi';
import * as request from 'request-promise-native';

const configPromise = require('./config');

const initServer = async () => {
  const config = await configPromise;

  // Server setup
  // TODO: port is same as hue.forwarderPort?
  const server = new Hapi.Server({
    // @ts-ignore: until @types/hapi v17
    port: config.port || 5678,
  });

  // @ts-ignore: until @types/hapi v17
  server.events.on('response', function(request) {
    console.log(
      request.info.remoteAddress +
        ': ' +
        request.method.toUpperCase() +
        ' ' +
        request.url.path +
        ' --> ' +
        request.response.statusCode,
    );
  });

  // Helper for emitting events and awaiting results from listeners
  const emitAwait = async (event: string) => {
    const promises: any[] = [];
    await server.events.emit(event, promises);
    const results = await promises;
    return Object.assign({}, ...results);
  };
  server.decorate('server', 'emitAwait', emitAwait);

  server.decorate('server', 'config', config);

  // Load all core plugins
  try {
    await server.register([
      {
        plugin: require('./src/scenes'),
        options: config.scenes,
      },
      {
        plugin: require('./src/lights'),
        options: config.lights, // unused
      },
      {
        plugin: require('./src/groups'),
        options: config.groups,
      },
    ]);
  } catch (e) {
    console.log('Error while registering core plugins:', e);
    process.exit(1);
  }

  if (config.plugins) {
    // @ts-ignore
    const plugins = [];

    // @ts-ignore
    Object.entries(config.plugins).forEach(([key, value]) => {
      // @ts-ignore
      plugins.push({
        // @ts-ignore
        plugin: require(key),
        // @ts-ignore
        options: value,
      });
    });

    // Load any plugins
    try {
      // @ts-ignore
      await server.register(plugins);
    } catch (e) {
      console.log('Error while registering plugins:', e);
      process.exit(1);
    }
  }

  await server.start();
  console.log(`Server running at: ${server.info.uri}`);
};

initServer();
