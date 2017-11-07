import * as dotenv from 'dotenv';

declare var process: {
  env: {
    HUE_IP: string;
    BRIDGE_NAME: string;
    FORWARDER_PORT: string;
    FORWARDER_IP: string;
    FORWARDER_MAC: string;
    USERNAME: string;
  };
};

dotenv.config();

const SERIAL_NUMBER = process.env.FORWARDER_MAC.replace(/:/g, '');
const BRIDGE_ID = [SERIAL_NUMBER.slice(0, 6), 'fffe', SERIAL_NUMBER.slice(6)]
  .join('')
  .toUpperCase();

export default {
  HUE_IP: process.env.HUE_IP,
  BRIDGE_NAME: process.env.BRIDGE_NAME,
  FORWARDER_PORT: process.env.FORWARDER_PORT,
  FORWARDER_IP: process.env.FORWARDER_IP,
  FORWARDER_MAC: process.env.FORWARDER_MAC,
  USERNAME: process.env.USERNAME,
  SERIAL_NUMBER,
  BRIDGE_ID,
};
