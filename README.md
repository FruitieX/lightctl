homectl
=======

Motivation
----------

This project started with the need to have an insight into the current state
of a Philips Hue light setup. The standard Hue setup provides no means to:

- Check currently active scene
- Making dynamically changing scenes (such as adjusting color temperature based on time)
- Coordinating which applications can set light state based on e.g. active scene
- Trigger custom actions based on light switch button presses
- Automatically filter out unnecessary commands from requests. E.g. if you want to ensure a light is
  on you must send `{state: 'on'}` but you shouldn't send this unnecessarily as it
  causes extra traffic on the ZigBee network. This is something the bridge could filter out
  if it already knows the light is on.

Note that there already exists Hue applications that e.g. set color temperature based on time. However,
these all have to write directly to the current light states at periodic intervals and as such
will interfere with other similar applications, as well as users manually adjusting the
lights. Applications have no way of telling if they are "allowed" to write to the light state at
the moment or not. You end up having to manually ensure only one such application is running at
a time, and that it's running only when you want it to control the lights. Kind of a bummer.

homectl aims to solve these problems with the Hue system, as well as add some other extras:

- Support for multiple home automation systems through "gateway" plugins:
  - Hue gateway: Control Philips Hue lights
  - Websockets: Control anything you can connect via websockets
- All different home automation systems are combined into one
- Multiple "api" plugins allow controlling all lightctl lights through your app of choice:
  - Hue API: Official Philips Hue phone apps
  - Websockets: Easily create your own web/mobile/etc user interface
- Remember the state of each light bulb in lightctl
  - Querying the current state is instant
  - Changes to state can be compared against current state, only necessary commands sent to bulbs
- Get rid of conflicting concepts such as on/off state vs brightness value (0 brightness means off in lightctl)
- Plugin based architecture

Setup
-----

1. Clone the repo, run `npm install`
2. Create a file with name `.env` in the root of the repository.
   Add the following lines to it, and edit them to match your setup:

   ```
   # IP address of the target Hue bridge
   hue.bridgeAddr=192.168.1.111

   # Name of the forwarded bridge
   BRIDGE_NAME="Philips Hue (Forwarded)"

   # FORWARDER_PORT is the listen port of this service.
   # Hue apps will only try port 80, so this service has to be reachable
   # on port 80 either directly or through a reverse proxy.
   FORWARDER_PORT=5678

   # Spoof all IP addresses with FORWARDER_IP, should match IP of this service
   FORWARDER_IP=192.168.1.101

   # This probably doesn't matter, as long as it's unique in your setup
   FORWARDER_MAC=de:ad:be:ef:13:37

   # Some plugins (such as scene-spy) may require a Hue username to
   # e.g. perform actions right at server startup.
   # You can generate a new username using:
   # `http POST <hue-ip>/api devicetype=hue-forwarder#scene-spy`
   USERNAME=<any whitelisted username>
   ```

   NOTE: If you already run something at port 80 (standard HTTP port) you will
   likely need to set up reverse proxying. I found the following nginx config
   to work well:

   ```
   location /api {
     proxy_pass http://127.0.0.1:5678;
     proxy_redirect off;
   }

   location /description.xml {
     proxy_pass http://127.0.0.1:5678;
     proxy_redirect off;
   }
   ```

   If not, just set `FORWARDER_PORT` to 80 and use setcap to allow node processes to bind
   ports < 1024 without root privileges:
   https://gist.github.com/firstdoit/6389682

3. Run hue-forwarder with `npm start`
4. Now you should be able to find a new Hue bridge in the Philips Hue app,
   named according to what you set as `BRIDGE_NAME`
5. With the hue-forwarder bridge selected in the Philips Hue app, as you use
   the app you should see similar output in the hue-forwarder console:

   ```
   Light 1 state changed to: { bri: 91 }
   Light 1 state changed to: { bri: 135 }
   Light 1 state changed to: { bri: 178 }
   Light 1 state changed to: { bri: 180 }
   Forwarding: get /api/{username}/lights
   Forwarding: get /api/{username}/groups
   Forwarding: get /api/{username}/lights
   Forwarding: get /api/{username}/groups
   Group 0 scene changed to: bO7ulRHLp5iDaTo
   Forwarding: get /api/{username}/lights
   Forwarding: get /api/{username}/groups
   ...
   ```

6. Now you can add your own handlers to `index.js` to do anything you want in
   response to API calls, or maybe spoof more API calls (like return more
   lights than you really have in the `/api/{username}/lights` calls, using this
   you could control any lights through your Hue apps even though Hue doesn't
   normally support them)

Notes
-----

* The forwarding isn't perfect, e.g. headers may not always be identical to
  what the Hue bridge returns. In practice I have found out this doesn't matter
  with the official Philips Hue app at least.
* For whatever reason, latency seems to play a huge part when using the
  official Philips Hue app. E.g. adjusting brightness of light groups with many
  lights was extremely slow in trials where I ran hue-forwarder over WiFi, but
  flawless when I switched to wired. This occurred even though network latency
  was nowhere near as bad as the delays caused.
