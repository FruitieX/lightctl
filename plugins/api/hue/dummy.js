exports.setLightSuccess = (lightId, values) => {
  const success = {};

  Object.entries(values).forEach(
    ([key, value]) => (success[`/lights/${lightId}/state/${key}`] = value),
  );

  return [{ success }];
};

exports.setSuccess = entities => [{ success: entities }];

exports.getScenes = () => ({
  '1Y-uBXA0TK6gwnU': {
    appdata: {
      data: 'QSQnK_r01_d99',
      version: 1,
    },
    lastupdated: '2017-09-24T11:20:16',
    lights: ['1', '2'],
    locked: false,
    name: 'Dummy Scene',
    owner: 'X7ypGxBXy9nZ9gVM6lQQ3s32JyTFOWTxC1abmcnP',
    picture: '',
    recycle: false,
    version: 2,
  },
});

exports.getScene = () => ({
  appdata: {
    data: 'QSQnK_r01_d99',
    version: 1,
  },
  lastupdated: '2017-09-24T11:20:16',
  lights: ['1', '2'],
  lightstates: {
    '1': {
      bri: 254,
      on: true,
      xy: [0.1633, 0.2071],
    },
    '2': {
      bri: 254,
      on: true,
      xy: [0.3031, 0.3181],
    },
  },
  locked: false,
  name: 'Dummy Scene',
  owner: 'X7ypGxBXy9nZ9gVM6lQQ3s32JyTFOWTxC1abmcnP',
  picture: '',
  recycle: false,
  version: 2,
});

exports.getGroups = () => ({
  '1': {
    action: {
      alert: 'none',
      bri: 136,
      colormode: 'xy',
      ct: 500,
      effect: 'none',
      hue: 7170,
      on: true,
      sat: 225,
      xy: [0.5266, 0.4133],
    },
    class: 'Living room',
    lights: ['1', '2'],
    name: 'Dummy Room 1',
    recycle: false,
    state: {
      all_on: true,
      any_on: true,
    },
    type: 'Room',
  },
});

exports.getLights = hueConfig => {
  const dummyLight = {
    capabilities: {
      streaming: {
        proxy: true,
        renderer: true,
      },
    },
    manufacturername: 'Philips',
    modelid: 'LCT010',
    name: 'Dummy light 1',
    productid: 'Philips-LCT010-1-A19ECLv4',
    state: {
      alert: 'none',
      bri: 138,
      colormode: 'xy',
      ct: 500,
      effect: 'none',
      hue: 7170,
      mode: 'homeautomation',
      on: true,
      reachable: true,
      sat: 225,
      xy: [0.5266, 0.4133],
    },
    swconfigid: '6A139B19',
    swupdate: {
      lastinstall: '2017-12-04T07:15:47',
      state: 'noupdates',
    },
    swversion: '1.29.0_r21169',
    type: 'Extended color light',
    uniqueid: '00:17:88:01:02:13:37:52-0b',
  };

  const lightIds = (hueConfig && hueConfig.dummyLights) || [
    'Dummy light 1',
    'Dummy light 2',
  ];

  const lights = {};

  lightIds.forEach((lightId, index) => {
    lights[String(index + 1)] = {
      ...dummyLight,
      name: lightId,
      uniqueid: lightId,
    };
  });

  return lights;
};

exports.putConfigUTC = hueConfig => [
  {
    error: {
      address: '/config/UTC',
      description: 'parameter, UTC, is not modifiable',
      type: 8,
    },
  },
];

exports.getNewDevices = hueConfig => ({
  lastscan: 'none',
});

exports.getConfigUnauthenticated = hueConfig => ({
  name: hueConfig.forwarderName,
  datastoreversion: '65',
  swversion: '1711151408',
  apiversion: '1.22.0',
  mac: hueConfig.forwarderMac,
  bridgeid: hueConfig.forwarderID,
  factorynew: false,
  replacesbridgeid: null,
  modelid: 'BSB002',
  starterkitid: '',
});

exports.dateToHue = d =>
  `${d.getFullYear()}-${d.getMonth() +
    1}-${d.getDate()}T${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;

exports.dateToHueUTC = d =>
  `${d.getUTCFullYear()}-${d.getUTCMonth() +
    1}-${d.getUTCDate()}T${d.getUTCHours()}:${d.getUTCMinutes()}:${d.getUTCSeconds()}`;

exports.getConfigAuthenticated = hueConfig => {
  const d = new Date();

  return {
    name: hueConfig.forwarderName,
    zigbeechannel: 15,
    bridgeid: hueConfig.forwarderID,
    mac: hueConfig.forwarderMac,
    dhcp: true,
    ipaddress: hueConfig.forwarderAddr,
    netmask: '255.255.255.0',
    gateway: '192.168.1.1',
    proxyaddress: 'none',
    proxyport: 0,
    UTC: exports.dateToHueUTC(d),
    localtime: exports.dateToHue(d),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    modelid: 'BSB002',
    datastoreversion: '65',
    swversion: '1711151408',
    apiversion: '1.22.0',
    swupdate: {
      updatestate: 0,
      checkforupdate: false,
      devicetypes: { bridge: false, lights: [], sensors: [] },
      url: '',
      text: '',
      notify: true,
    },
    swupdate2: {
      checkforupdate: false,
      lastchange: '2017-12-09T12:12:25',
      bridge: {
        state: 'noupdates',
        lastinstall: '2017-12-09T12:08:56',
      },
      state: 'noupdates',
      autoinstall: { updatetime: 'T14:00:00', on: true },
    },
    linkbutton: false,
    portalservices: true,
    portalconnection: 'connected',
    portalstate: {
      signedon: true,
      incoming: false,
      outgoing: true,
      communication: 'disconnected',
    },
    internetservices: {
      internet: 'connected',
      remoteaccess: 'connected',
      time: 'connected',
      swupdate: 'connected',
    },
    factorynew: false,
    replacesbridgeid: null,
    backup: { status: 'idle', errorcode: 0 },
    starterkitid: '',
    whitelist: {
      dummyuser: {
        'last use date': exports.dateToHue(d),
        'create date': '2017-12-11T17:17:23',
        name: 'Hue 2#Samsung SM-G950F',
      },
    },
  };
};

exports.getSensors = hueConfig => ({
  '1': {
    state: {
      daylight: true,
      lastupdated: exports.dateToHue(new Date()),
    },
    config: {
      on: true,
      configured: true,
      sunriseoffset: 30,
      sunsetoffset: -30,
    },
    name: 'Daylight',
    type: 'Daylight',
    modelid: 'PHDL00',
    manufacturername: 'Philips',
    swversion: '1.0',
  },
});

exports.getSchedules = hueConfig => ({});
exports.getRules = hueConfig => ({});
exports.getResourcelinks = hueConfig => ({});

exports.getAllAuthenticated = hueConfig => ({
  lights: exports.getLights(hueConfig),
  groups: exports.getGroups(hueConfig),
  config: exports.getConfigAuthenticated(hueConfig),
  schedules: exports.getSchedules(hueConfig),
  scenes: exports.getScenes(hueConfig),
  rules: exports.getRules(hueConfig),
  sensors: exports.getSensors(hueConfig),
  resourcelinks: exports.getResourcelinks(hueConfig),
});

exports.getAllUnauthenticated = hueConfig => [
  {
    error: {
      type: 1,
      address: '/',
      description: 'unauthorized user',
    },
  },
];

exports.linkButtonSuccess = hueConfig => [
  {
    success: {
      username: 'dummyuser',
    },
  },
];

exports.linkButtonFail = hueConfig => [
  {
    error: {
      address: '',
      description: 'link button not pressed',
      type: 101,
    },
  },
];
