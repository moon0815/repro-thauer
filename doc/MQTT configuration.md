# MQTT configuration

HA Integrations supported by MQTT:

Supported MQTT integrations:
* [sensor](https://www.home-assistant.io/integrations/sensor/)
    * device_class: temperature (°C, °F or K), illuminance (lx), wind_speed, precipitation_intensity
* [cover](https://www.home-assistant.io/integrations/cover/)
	* device_class: awning, blind, (shutter)


# MQTT sensor

```yaml
mqtt:
    - sensor: 
        unique_id: STRING
        availability_topic: STRING 
        state_topic: STRING

        device_class: STRING
        valute_template: template
        device:
            identifiers: STRING
            manufacturer: STRING
            model: STRING 
            name: STRING

```

# MQTT cover
```yaml
mqtt:
    - cover:
        unique_id: STRING
        availability_topic: STRING
        state_topic: STRING        
        position_topic: STRING
        command_topic: STRING
        tilt_command_topic: STRING
        tilt_status_topic: STRING

        device_class: STRING
        device: 
            identifiers: STRING
            manufacturer: STRING
            model: STRING 
            name: STRING
```

# MQTT discovery

`<discovery_prefix>/<component>/[<node_id>/]<object_id>/config`

# MQTT tree
* homeassistant
    * sensor
        * warema
            * 968513
                * state

    * cover
        * warema
            * XXXXXX
                * state
                * command

