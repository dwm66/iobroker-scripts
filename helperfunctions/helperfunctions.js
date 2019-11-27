// helper function - convert a date to a string hh:mm
function getTimeAsStr( theDate )
{
    var result = ("0" + (theDate.getHours()).toString(10)).slice(-2) + ':' +
                 ("0" + (theDate.getMinutes()).toString(10)).slice(-2);
    
    dwmlog ("Zeit: "+result,4);
    return result;
}

function sayItTimeTempMessage( messagebefore, messagebehind, sayTime, sayTemp, sayDate ) {
    var now = new Date();
    theTemp = Math.round(getState("hm-rpc.0.HEQ0237303.1.TEMPERATURE"/*Aussentemperatur Balkon:1.TEMPERATURE*/).val);
    
    if (sayTime === undefined) sayTime = true;
    if (sayTemp === undefined) sayTemp = true;
    if (sayDate === undefined) sayDate = true;
    
    var message = "";
    if (messagebefore !== undefined) message += messagebefore;
    if (sayTime) message += " Es ist " + formatDate(now, "h:mm")+" Uhr!";
    if (sayDate) message += " Heute ist "+formatDate(now, "WW, der DD. OO.");
    if (sayTemp) message += " Die Außentemperatur beträgt " + theTemp + "°";
    if (messagebehind !== undefined) message += '<break time="1s"/> '+messagebehind;
    
    message = '<speak><prosody rate="90%">' + message + '</prosody></speak>';
    
    dwmlog (message +" -- Länge: "+message.length,4);
    setState("sayit.0.tts.text"/*Text to speech*/,message);
}

function sayItTimeTempMessageIntro( messagebefore, messagebehind, sayTime, sayTemp, sayDate,intro, introlen ) {
    var now = new Date();
    theTemp = Math.round(getState("hm-rpc.0.HEQ0237303.1.TEMPERATURE"/*Aussentemperatur Balkon:1.TEMPERATURE*/).val);
    
    if (sayTime === undefined) sayTime = true;
    if (sayTemp === undefined) sayTemp = true;
    if (sayDate === undefined) sayDate = true;
    if (intro === undefined) {
        intro = null;
        introlen = 0;
    }
    
    var messagedelay = introlen;
    if (introlen>0) introlen+=500;
    
    var message = "";
    if (messagebefore !== undefined && messagebefore !== null) message += messagebefore;
    if (sayTime) message += " Es ist " + formatDate(now, "h:mm")+" Uhr!";
    if (sayDate) message += " Heute ist "+formatDate(now, "WW, der DD. OO.");
    if (sayTemp) message += " Die Außentemperatur beträgt " + theTemp + "°";
    if (messagebehind !== undefined && messagebehind !== null) message += '<break time="1s"/> '+messagebehind;
    
    message = '<speak><prosody rate="90%">' + message + '</prosody></speak>';
    
    dwmlog (message +" -- Länge: "+message.length,4);
    if (intro !== null ) {
        setState("sayit.0.tts.text"/*Text to speech*/,intro);
    }
    setStateDelayed("sayit.0.tts.text"/*Text to speech*/,message,messagedelay);
}
