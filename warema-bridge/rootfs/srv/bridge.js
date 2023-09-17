const warema = require('warema-wms-api');
var mqtt = require('mqtt')

process.on('SIGINT', function() {
    process.exit(0);
});


const ignoredDevices = process.env.IGNORED_DEVICES ? process.env.IGNORED_DEVICES.split(',') : []
const forceDevices = process.env.FORCE_DEVICES ? process.env.FORCE_DEVICES.split(',') : []
const knownDevices = process.env.KNOWN_DEVICES ? 
        process.env.KNOWN_DEVICES.split("\n").map( x => JSON.parse(x)) : []

const settingsPar = {
    wmsChannel   : process.env.WMS_CHANNEL     || 17,
    wmsKey       : process.env.WMS_KEY         || '00112233445566778899AABBCCDDEEFF',
    wmsPanid     : process.env.WMS_PAN_ID      || 'FFFF',
    wmsSerialPort: process.env.WMS_SERIAL_PORT || '/dev/ttyUSB0',
  };

var registered_shades = []
var shade_position = []

function registerDevice(element) {
  console.log('Registering ' + element.snr)
  if(element.name == undefined) {
	  element.name=element.snr.toString()
  }
  var topic = 'homeassistant/cover/' + element.snr + '/' + element.snr + '/config'
  var availability_topic = 'warema/' + element.snr + '/availability'

  var base_payload = {
    name: element.snr,
    availability: [
      {topic: 'warema/bridge/state'},
      {topic: availability_topic}
    ],
    unique_id: element.snr
  }

  var base_device = {
    identifiers: element.snr,
    manufacturer: "Warema",
    name: element.snr
  }

  var model
  var payload
  switch (parseInt(element.type)) {
    case 6:
      model = 'Weather station'
      payload = {
        ...base_payload,
        device: {
          ...base_device,
          model: model
        }
      }
      break
    case 20:
      model = 'Plug receiver'
      payload = {
        ...base_payload,
        device: {
          ...base_device,
          model: model
        },
        position_open: 0,
        position_closed: 100,
        command_topic: 'warema/' + element.snr + '/set',
        position_topic: 'warema/' + element.snr + '/position',
        tilt_status_topic: 'warema/' + element.snr + '/tilt',
        set_position_topic: 'warema/' + element.snr + '/set_position',
        tilt_command_topic: 'warema/' + element.snr + '/set_tilt',
        tilt_closed_value: 100,
        tilt_opened_value: -100,
        tilt_min: -100,
        tilt_max: 100,
      }
      break
    case 25:
      model = 'Vertical awning'
      payload = {
        ...base_payload,
        device: {
          ...base_device,
          model: model
        },
        position_open: 0,
        position_closed: 100,
        command_topic: 'warema/' + element.snr + '/set',
        position_topic: 'warema/' + element.snr + '/position',
        set_position_topic: 'warema/' + element.snr + '/set_position',
      }
      break
    default:
      console.log('Unrecognized device type: ' + element.type)
      model = 'Unknown model ' + element.type
      return
  }

  if (ignoredDevices.includes(element.snr.toString())) {
    console.log('Ignoring and removing device ' + element.snr + ' (type ' + element.type + ')')
  } else {
    console.log('Adding device ' + element.snr + ' (type ' + element.type + ')')

    stickUsb.vnBlindAdd(parseInt(element.snr), element.name);
    registered_shades += element.snr
    client.publish(availability_topic, 'online', {retain: true})
  }
  client.publish(topic, JSON.stringify(payload))
}

function registerDevices() {
  console.log('Registering ...')
  knownDevices.forEach(x => registerDevice(x))
}

function callback(err, msg) {
  console.log("Callback(" + err + ", msg: " + msg + ")");
  if(err) {
    console.log('ERROR: ' + err);
  }
  if(msg) {
    switch (msg.topic) {
      case 'wms-vb-init-completion':
        console.log('Warema init completed')
        registerDevices()
        stickUsb.setPosUpdInterval(30000);
        break
      case 'wms-vb-rcv-weather-broadcast':
	var topic_base = 'homeassistant/sensor/warema/' + msg.payload.weather.snr;
        if (registered_shades.includes(msg.payload.weather.snr)) {
	  client.publish(topic_base + '/state', JSON.stringify( msg.payload.weather ));
        } else {
          var payload = {
            availability: [
              {topic: 'warema/bridge/state'},
              {topic: topic_base + '/availability'}
            ],
	    state_topic: topic_base + '/state',
            device: {
              identifiers: msg.payload.weather.snr,
              manufacturer: 'Warema',
              model: 'Weather Station',
            },
            force_update: true
          }

          var illuminance_payload = {
            ...payload,
            device_class: 'illuminance',
            unique_id: msg.payload.weather.snr + '_illuminance',
            unit_of_measurement: 'lx',
	    value_template: '{{value_json.lumen}}',
          }
          client.publish( topic_base + '_illuminance/config', JSON.stringify(illuminance_payload))

          var temperature_payload = {
            ...payload,
            device_class: 'temperature',
            unique_id: msg.payload.weather.snr + '_temperature',
            unit_of_measurement: '°C',
	    value_template: '{{value_json.temp}}',
          }
          client.publish( topic_base + '_temperature/config', JSON.stringify(temperature_payload))

	  var wind_payload = {
	    ...payload,
	    unique_id: msg.payload.weather.snr + '_wind',
	    value_template: '{{value_json.wind}}',
	  }
	  client.publish( topic_base + '_wind/config', JSON.stringify(wind_payload))

	  var rain_payload = {
	    ...payload,
	    unique_id: msg.payload.weather.snr + '_rain',
	    value_template: '{{value_json.rain}}',
	  }
	  client.publish( topic_base + '_rain/config', JSON.stringify(rain_payload))
	  
          client.publish( topic_base + '/availability', 'online', {retain: true})
          registered_shades += msg.payload.weather.snr
        }
        break
      case 'wms-vb-blind-position-update':
        client.publish('warema/' + msg.payload.snr + '/position', msg.payload.position.toString())
        client.publish('warema/' + msg.payload.snr + '/tilt', msg.payload.angle.toString())
        shade_position[msg.payload.snr] = {
          position: msg.payload.position,
          angle: msg.payload.angle
        }
        break
      case 'wms-vb-scanned-devices':
        console.log('Scanned devices.')
        msg.payload.devices.forEach(element => registerDevice(element))
        console.log(stickUsb.vnBlindsList())
        break
      default:
        console.log('UNKNOWN MESSAGE: ' + JSON.stringify(msg));
    }
  }
}

var client = mqtt.connect(
  process.env.MQTT_SERVER,
  {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD,
    will: {
      topic: 'warema/bridge/state',
      payload: 'offline',
      retain: true
    }
  }
)

var stickUsb

client.on('connect', function (connack) {
  console.log('Connected to MQTT')
  client.subscribe('warema/#')
  client.subscribe('homeassistant/status')
  stickUsb = new warema(settingsPar.wmsSerialPort,
    settingsPar.wmsChannel,
    settingsPar.wmsPanid,
    settingsPar.wmsKey,
    {},
    callback
  );
})

client.on('error', function (error) {
  console.log('MQTT Error: ' + error.toString())
})

client.on('message', function (topic, message) {
  console.log("client.on <<<" + topic + ':' + message.toString())
  var scope = topic.split('/')[0]
  if (scope == 'warema') {
    var device = parseInt(topic.split('/')[1])
    var command = topic.split('/')[2]
    console.log("command: " + command)
    switch (command) {
      case 'rain':
      case 'wind':
      case 'temperature':
      case 'illuminance':
	break
      default:
//	console.log(topic + ':' + message.toString());
//	console.log('device: ' + device + ' === command: ' + command);
    }
    switch (command) {
      case 'set':
        switch (message.toString()) {
          case 'CLOSE':
            stickUsb.vnBlindSetPosition(device, 100, 0)
            break;
          case 'OPEN':
            stickUsb.vnBlindSetPosition(device, 0, -100)
            break;
          case 'STOP':
            stickUsb.vnBlindStop(device)
            break;
        }
        break
      case 'set_position':
        stickUsb.vnBlindSetPosition(device, parseInt(message), parseInt(shade_position[device]['angle']))
        break
      case 'set_tilt':
        stickUsb.vnBlindSetPosition(device, parseInt(shade_position[device]['position']), parseInt(message))
        break
      //default:
      //  console.log('Unrecognised command from HA')
    }
  } else if (scope == 'homeassistant') {
    if (topic.split('/')[1] == 'status' && message.toString() == 'online') {
      registerDevices()
    }
  }
  console.log("client.on ENDs")
})
