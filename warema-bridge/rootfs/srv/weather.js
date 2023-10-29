const { createLogger, format, transports } = require('winston');
const logger = createLogger({
    level: process.env.LOGLEVEL || "warn",
    format: format.simple(),
    transports: [ new transports.Console()  ],
});

const WmsMessage = require('./WmsMessage.js');

process.on('SIGINT', function() {
    process.exit(0);
});

/**
 * MQTT connect and subscribe
 */
const MQTT = require('mqtt')
const mqtt = MQTT.connect( process.env.MQTT_SERVER,
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
mqtt.publish_withlog = function(topic, message) {
  logger.silly("MQTT SND >> " + topic + " , " + message );
  this.publish(topic, message)
}

/**
 * Subscribe to MQTT channels homeassistant/cover/warema/#, homeassistant/sensor/warema/#
 */
mqtt.on('connect', function (connack) {
    var subscriptions=['homeassistant/cover/warema/#', 'homeassistant/sensor/warema/#', 'tomi'];
    logger.info('Connected to MQTT, subscribing to ' + subscriptions.join(", "))
    subscriptions.forEach(s => this.subscribe(s));
})

/**
 * SerialPort connect 
 */
const { SerialPort } = require('serialport');
const stick = new SerialPort( { path: process.env.WMS_SERIAL_PORT , baudRate: 125000 });
stick.send = function(stringToSend) {
    logger.debug("WMS SND " + stringToSend);
    stick.write(stringToSend);
}
stick.on('open', () => {
    setTimeout( () => { stick.send("{G}")  }, 50);
    setTimeout( () => { stick.send("{V}")  }, 100);
    setTimeout( () => { stick.send("{K401"  + process.env.WMS_KEY + "}")  }, 150);
    setTimeout( () => { stick.send("{M#"    + process.env.WMS_CHANNEL + process.env.WMS_PAN_ID + "}")}, 200);
// M#: no broadcast, M%: yes broadcast
})

const { DelimiterParser }  = require('@serialport/parser-delimiter')
const DelimiterChar = '}';
parser = stick.pipe(new DelimiterParser({ delimiter: DelimiterChar }));
/**
 * Event handler to process received data events on the serialPort
 */
parser.on('data', (data) => {
    received = data.toString('utf8') + DelimiterChar;
    logger.silly("USB RCV " + received);
    var wmsMessage = new WmsMessage(received);

    if(wmsMessage.type == "Weather Broadcast") {
      mqtt.publish_withlog('homeassistant/sensor/warema/' + wmsMessage.snr + '/state', 
                           JSON.stringify(wmsMessage));
    }

    if(wmsMessage.type == "Cover Position") {
      mqtt.publish_withlog('homeassistant/cover/warema/' + wmsMessage.snr + '/state', 
                           JSON.stringify(wmsMessage));
    }
});

/**
 * Event handler to process received data events on MQTT 
 */
mqtt.on('message', function (topic, message) {
  logger.silly("MQTT RCV " + topic + " << " + message);
  if(topic=="tomi"){
    stick.send(message);
    return;
  }

  matched = topic.match( /homeassistant\/cover\/warema.(?<snr>......)\/(?<topic>.*command)$/ );
  if(matched) {
    if(matched.groups.topic == "command") {
      switch(message.toString()){
        case "OPEN":
          stick.send("{R06" + matched.groups.snr + "707003" + "00" + "00" + "0000}")
          break;
        case "CLOSE":
          stick.send("{R06" + matched.groups.snr + "707003" + "C8" + "A5" + "0000}")
          break;
        case "STOP":
          stick.send("{R06" + matched.groups.snr + "707001" + "FFFFFFFF00}")
          break;
        default:
          logger.warning("something else")
      }
    } else if (matched.groups.topic == "tilt_command") {
      stick.send("{R06" + matched.groups.snr + "707003" + "C8" + "00" + "0000}")
    }
    setTimeout( () => { stick.send("{R06" + matched.groups.snr + "801001000005}")  }, 100);
  }
})
  