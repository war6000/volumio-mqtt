var version = "2018-05-13 08:25";
var config = require('./config');
var mqtt = require('mqtt');
var io=require('socket.io-client');
var socket= io.connect(config.volumio_host);

var mqttClient = mqtt.connect(config.mqttHost);

mqttClient.subscribe(config.mqtt_devicename+"/set/#");
mqttClient.subscribe(config.mqtt_devicename+"/get/#");
if (config.mqtt_tvenabledtopic!=="") mqttClient.subscribe(config.mqtt_tvenabledtopic);

mqttClient.on('message', function (topic, rawMessage) {
    try {
        var msg = rawMessage.toString();
        if (config.debug) printLog( "Received MQTT topic: " + topic.toString() );

        if (topic===config.mqtt_tvenabledtopic) {
            // Turn off radio player when TV is turned on
            if (msg==="true") socket.emit('stop');
            return;
        }

        var arr = topic.split('/');
        var action = arr[2];
        if (arr[1]=="set") {        
            if (action==="volume") { // numeric value between 0 and 100, mute, umute, +, -
                if (arr[3]==="percent") {
                    socket.emit('volume', Number(msg) );
                } else if (arr[3]==="mute") { // true | false
                    socket.emit('volume', msg==="true"?"mute":"umute" );
                } else if (arr[3]==="push") { // + | -
                    socket.emit('volume', msg );
                } else if (arr[3]==="up") {
                    socket.emit('volume', "+" );
                } else if (arr[3]==="down") {
                    socket.emit('volume', "-" );
                }
            } else if (action=="play") {
                var num = Number(msg);
                if (config.debug) printLog("Message: " + msg + " | Number: " + num.toString());
                if (msg != "" && !isNaN(num))
                {
                    if (config.debug) printLog("Play with number " + num.toString());
                    socket.emit('play', {value: num});
                } else {
                    if (config.debug) printLog("Play without number");
                    socket.emit('play');
                }
            } else if (action=="pause") {
                socket.emit('pause');
            } else if (action=="stop") {
                socket.emit('stop');
            } else if (action=="power") {
                socket.emit( msg==="true"?'play':'stop');
            } else if (action=="seek") {
                socket.emit('seek', Number(msg));
            } else if (action=="playPlaylist") {
                socket.emit('playPlaylist', {"name": msg} );
            } else if (action=="addPlay") {
                // e.g. {"service":"webradio","title":webradioname,"uri":webradioUri}
                socket.emit('addPlay', JSON.parse(msg));        
            }
        } else if (arr[1]==="get") {
            if (arr[2]==="status") {
                socket.emit('getState');      
            } else if (arr[2]==="multiroomdevices") {
                socket.emit('getMultiRoomDevices');
            } else if (arr[2]==="browsesources") {
                socket.emit('getBrowseSources');
            }
        }
    } catch (e) {
        console.log(e);
    }
});
socket.on('connect', function(){
    printLog( config.mqtt_devicename + " connected" );
    mqttClient.publish(config.mqtt_devicename+"/status/connected", "true", { retain: false });
});
socket.on('disconnect', function(){
    printLog( config.mqtt_devicename + " disconnected" );
    mqttClient.publish(config.mqtt_devicename+"/status/connected", "false", { retain: false });
});
socket.on('pushState', function(data){
    mqttClient.publish(config.mqtt_devicename+"/status/info", JSON.stringify(data), { retain: false });
    if (data.status==="play") {
        setOutlet(true);
    } else if (data.status==="stop") {
        setOutlet(false);
    }

    vol = Number(data.volume);
    if ( !isNaN(vol) )
        mqttClient.publish(config.mqtt_devicename+"/status/volume", vol.toString(), {retain: false});
    
    mut = Boolean(data.mute);
    if ( typeof mut === "boolean" )
        mqttClient.publish(config.mqtt_devicename+"/status/volume/mute", mut.toString(), {retain: false});
});
socket.on('pushMultiRoomDevices', function(data){
    mqttClient.publish(config.mqtt_devicename+"/status/multiroomdevices", JSON.stringify(data), { retain: false });
});
socket.on('pushBrowseSources', function(data){
    mqttClient.publish(config.mqtt_devicename+"/status/browsesources", JSON.stringify(data), { retain: false });
});
function setOutlet(bON) {
    if (config.mqtt_powerToggleAddr!=="") {
        printLog("Turning outlet "+ (bON?"ON":"OFF"));
        mqttClient.publish(config.mqtt_powerToggleAddr, (bON?"true":"false"), { retain: false });
    }
};
function printLog(txt) {
    console.log( "["+ new Date().toLocaleString() +"]", txt);
}
