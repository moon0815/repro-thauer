# Warema protocol

## The Stick
Baud rate: 125000, Parity: None, Data bits: 8, Stop bits: 1
Messages to and from are enclosed in braces "{}"

The whitespace in the messages are not there, it's for readability only

### Responses: 
* `{a}` : ACK
* `{f}` : Failure

## Commands

### Check stick 
* `SND {G}`
* `RCV {gWMS USB stick}`

### Get version
* `SND {V}`
* `RCV {vVVVVVVVV }`

### Set network AES Key 
* `SND {K401 KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK}`
* `RCV {a}`

### Set wireless channel, PANID and Filter (%-broadcast,#-nobroadcast)
* `SND {M% CC PPPP}`
* `RCV {a}`

### Weather broadcast
* `RCV {r AAAAAA 7080 00WWL1FFFFFFL2FFRRTT FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF}`

### Ping device - 50AC
* `SND {R01 AAAAAA 50AC}`
* `RCV {a}`
* `RCV {r AAAAAA 50AC ????}` (cover)
* `RCV {r AAAAAA 7080 00WWL1FFFFFFL2FFRRTT FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF}` (weather station)
* Examples: 
    * East 1: `{R01682A1250AC}`
    * Norht-east weather: `{R019B851350AC}`


### Cover status - 8010
* `SND {R06 AAAAAA 8010 01000005}`
* `RCV {r AAAAAA 8011 01000005 PPWWV1V200}`
    * PP: position in % * 2 (hex)
    * WW: angle + 127 (hex)
    * V1, V2: position valance 1, 2
* Example:
    * East 1: `{R06682A12801001000005}`

| position  |   | *2  | hex  |
|---|---:|---:|---:|
| OPEN    | 0%   | 0    | 0  |
| CLOSED  | 100% | 200  | C8  |

| angle  |   | +127  | hex  |
|---|---:|---:|---:|
| open    | 0°   | 127    | 7F  |
| (down)  | 38° | 163  | A5 |
| closed  | 80° | 207  | CF  |


### Move cover to position
* `SND {R06 AAAAAA 7070 03 PPWWV1V2}`
    * PP: position in % * 2 (hex)
    * WW: angle + 127 (hex)
* Example
    * Open East 1: `{R06682A1270700300000000}`

### Stop cover move
* `SND {R06 AAAAAA 7070 01 FFFFFFFF00}`

### Set automatic operation on/off PP=00/01
* `SND {R06 AAAAAA 8020 0D040001 PP}`
* PP: 00-off, 01-on