import * as dotenv from 'dotenv';
import * as dns from 'dns';
import * as os from 'os';

export type Config = {
  HUE_IP: string;
  USERNAME: string;
  BRIDGE_NAME: string;
  FORWARDER_PORT: number;
  FORWARDER_IP: string;
  FORWARDER_MAC: string;
  SERIAL_NUMBER: string;
  BRIDGE_ID: string;
};

declare var process: {
  env: Config;
};

dotenv.config();

const initConfig = async (): Promise<Config> => {
  const config = {
    HUE_IP: process.env.HUE_IP,
    USERNAME: process.env.USERNAME,
    BRIDGE_NAME: process.env.BRIDGE_NAME || 'Philips Hue (Forwarded)',
    FORWARDER_PORT: process.env.FORWARDER_PORT || 5678,
    // TODO: autodetect IP
    FORWARDER_IP: process.env.FORWARDER_IP,
    FORWARDER_MAC: process.env.FORWARDER_MAC || 'de:ad:be:ef:56:78',
    SERIAL_NUMBER: '',
    BRIDGE_ID: '',
  };

  config.SERIAL_NUMBER = config.FORWARDER_MAC.replace(/:/g, '');
  config.BRIDGE_ID = [
    config.SERIAL_NUMBER.slice(0, 6),
    'fffe',
    config.SERIAL_NUMBER.slice(6),
  ]
    .join('')
    .toUpperCase();

  return config;
};

export default initConfig;
