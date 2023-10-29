const { createLogger, format, transports } = require('winston');
const logger = createLogger({
    level: process.env.LOGLEVEL || "warn",
    format: format.simple(),
    transports: [ new transports.Console()  ],
});

class WmsMessage {
    constructor(x) {

        matched = received.match(/{a}/);                         // '{a}'
        if(matched !== null) {
            logger.debug("response: ACK");
            return;
        }

        matched = received.match(/{f}/);                         // '{f}'
        if(matched !== null) {
            logger.debug("response: FAIL");
            return;
        }

        var matched = received.match(/{g(?<name>.+)}/);          // '{gWMS USB-Stick}'
        if(matched !== null) {
            logger.debug("response[g]: " + matched.groups.name);
            return;
        }

        matched = received.match(/{v(?<version>.+)}/);           // '{v...}'
        if(matched !== null) {
            logger.debug("response[v]: " + matched.groups.version);
            return;
        }
    
        matched = received.match(/{a}/);                         // '{a}'
        if(matched !== null) {
            logger.debug("response: ACK");
            return;
        }

        /**
         * Weather Station Broadcast {r AAAAAA 7080 ?? WI LU ?????? LU ?? RA TE
         */
        if(received.match( /^{r......7080/ )) {
            matched = received.match( /{r(?<snr>......)7080..(?<ww>..)(?<i1>..).{6}(?<i2>..)..(?<rr>..)(?<tt>..).+}/ );
            this.type = "Weather Broadcast"
            this.snr = matched.groups.snr;
            this.availability = "online"
            this.wind = parseInt(matched.groups.ww, 16);
            this.illuminance = (matched.groups.i1 === '00' ? 1 : parseInt(matched.groups.i1, 16)) * parseInt(matched.groups.i2, 16) * 2;
            this.rain = (matched.groups.rr === 'C8')
            this.temperature = parseInt(matched.groups.tt, 16) / 2 - 35
            return;
        };

        /**
         * Blinds position report {r AAAAAA 8011 01000005 PPWWV1V200}
         */
        if(received.match( /^{r......8011/ )) {
            matched = received.match(/{r(?<snr>.{6})(8011)(01000005)(?<pp>..)(?<ww>..)(?<v1>..)(?<v2>..)(?<moving>..)}/);
            this.type = "Cover Position"
            this.snr = matched.groups.snr;
            this.availability = "online"
            this.position = parseInt(matched.groups.pp, 16) / 2
            this.tilt_status = parseInt(matched.groups.ww, 16) - 127
            if(this.position == 0) {
                this.state = "open"
            } else if(this.position == 100) {
                this.state = "closed"
            } else if(matched.groups.moving == "00") {
                this.state = "stopped"
            } else {
                this.state = "opening"
            }
            return;
        }

        if(received.match( /^{r......50AC/ )) {
            matched = received.match(/{r(?<snr>.{6})(50AC)(?<payload>.+)}/);
            logger.debug("response: 50AC[" + matched.groups.snr + "] " + matched.groups.payload)
            return;
        }
    }

    toString() {
        return this.type + this.snr;
    }
}

module.exports = WmsMessage;