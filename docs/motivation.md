## Motivation

This project started with the need to have an insight into the current state
of a Philips Hue light setup. The standard Hue setup provides no means to:

* Check currently active scene
* Making dynamically changing scenes (such as adjusting color temperature based on time)
* Coordinating which applications can set light state based on e.g. active scene
* Trigger custom actions based on light switch button presses
* Automatically filter out unnecessary commands from requests. E.g. if you want to ensure a light is
  on you must send `{state: 'on'}` but you shouldn't send this unnecessarily as it
  causes extra traffic on the ZigBee network. This is something the bridge could filter out
  if it already knows the light is on.

Note that there already exists Hue applications that e.g. set color temperature based on time. However,
these all have to write directly to the current light states at periodic intervals and as such
will interfere with other similar applications, as well as users manually adjusting the
lights. Applications have no way of telling if they are "allowed" to write to the light state at
the moment or not. You end up having to manually ensure only one such application is running at
a time, and that it's running only when you want it to control the lights. Kind of a bummer.

lightctl aims to solve these problems with the Hue system, as well as add some other extras:

* Plugin based architecture
* Support for multiple home automation systems through "gateway" plugins:
  * Hue gateway: Control Philips Hue lights
  * Websockets: Control anything you can connect via websockets
* All different home automation systems are combined into one
* Multiple "api" plugins allow controlling all lightctl lights through your app of choice:
  * Hue API: Official Philips Hue phone apps
  * Websockets: Easily create your own web/mobile/etc user interface
* Remember the state of each light bulb in lightctl
  * Querying the current state is instant
  * Changes to state can be compared against current state, only necessary commands sent to bulbs
* Get rid of conflicting concepts such as on/off state vs brightness value (0 brightness means off in lightctl)
