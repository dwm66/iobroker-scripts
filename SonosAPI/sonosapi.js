var http = require('http');
var url  = require('url');

var debuglevel = 3;
var debugchannel = 'info';

var AdapterId = "javascript."+instance;
var develMode = false;

var version = "0.9.6";

/**********************************************************************************************/
// Modify these settings
// BaseURL: the URL of the SonosAPI. Example: "http://10.22.1.40:5005"
var BaseURL = "http://10.22.1.40:5005";

// SonosAPIAuth: Authentication data for the Sonos API, if there a user and password is 
// declared.
// Example: 
// var SonosAPIAuth = "Basic " + new Buffer("username" + ":" + "Password123").toString("base64");
var SonosAPIAuth = "Basic " + new Buffer("admin" + ":" + "12345678").toString("base64");

// the port where this script should be reachable from the SonosAPI webhook mechanism.
// example: 
// var webHookPort = 1884;
// using this example, the settings.json on the Sonos API must contain:
// {
//   "webhook": "http://iobroker_uri:1884/"
// }
// replace "iobroker_uri" with the address of your iobroker machine.
var webHookPort = 1884;

// SSML Mode für sayEx. Unterstützt nur "Polly". Wenn auf "Polly gestellt ist, wird die Stimme auf"
// 90% Geschwindigkeit gesetzt. 
var SSMLMode = "Polly";

// datapoint where the sayEx function can get the current temperature 
var TempSensorId = "hm-rpc.0.ZEQ1234567.1.TEMPERATURE"/*Aussentemperatur Balkon:1.TEMPERATURE*/;

// URL of a fallback album art picture
var fallbackAlbumURL = '/icons-mfd-svg/audio_sound.svg';
var TVAlbumURL = '/icons-mfd-svg/it_television.svg';

// If setting a Favorite, it is reset to "" after this time (seconds).
// If you don't want that behavior, set to 0.
var resetFavoriteTime = 5;

/**********************************************************************************************/


var basePath = AdapterId+".SonosAPI.Rooms";

// intermediate storage for paused Sonos in TV mode
// part of workaround for https://github.com/jishi/node-sonos-http-api/issues/741
var pauseTVBuffer = {};
var VolumeTimeout = null;

function requestSonosAPI( req, cb, cbParam ){

    var url = BaseURL+req;
    
    dwmlog("requestSonosAPI URL: "+url,3);
    
    if (develMode) return;

    request({  
        uri: url,
        method: "GET",
        timeout: 120000,
        followRedirect: true,
        maxRedirects: 10,
        headers : {
            "Authorization" : SonosAPIAuth
        }        
    }, function(error, response, body) {
        // dwmlog("Sonos Error " + error,2);
        // dwmlog("Sonos Response: " + JSON.stringify(response,0,4),4);
        // dwmlog("Sonos Body: " + body,4);
        
        if (error === null) {
            if (cb) cb(JSON.parse(body),cbParam);             
        } else {
            dwmlog ("Error occured during SonosAPI call: "+error,2,"warn");
        }
    });        
}

function createOrSetState(name,value,forceCreate,spec){
    dwmlog("createOrSetState "+name+" to: "+value,5);
    if (value === undefined ) value = "n/a";
    if (getState(name).notExist) {
        dwmlog("Variable "+name+" undefined yet",4);
        createState(name,value,forceCreate,spec);
    } else {
        setState(name,value,true);
    }
}

function setStateProtected(dp,val,ack){
    if (ack === undefined ) ack=false;
    if (val === undefined ) val = "n/a";

    setState(dp,val,ack);
}

function getAlbumUri(stateData,absolute){
    var result = "";
    // dwmlog ("getAlbumUri: "+JSON.stringify(stateData),3);
    if (absolute) result = stateData.currentTrack.absoluteAlbumArtUri; 
    // else result = stateData.currentTrack.albumArtUri;
    
    if (result === undefined) {
        if (absolute) result = fallbackAlbumURL; else {
            result = url.parse(fallbackAlbumURL,true).pathname;
        }
    }
    if (stateData.currentTrack.uri.startsWith("x-file-cifs")){
        result=fallbackAlbumURL;
    }
    if (isTVMode(stateData.currentTrack.uri)){
        result=TVAlbumURL;
    }
    // dwmlog ("getAlbumUri returning: "+result,3);
    return result;
}

function getNiceElement(stateElement,htmlElement){
    result = "";
    if (stateElement !== undefined && stateElement !== null && stateElement != "" && !stateElement.includes('x-sonos')){
        if (htmlElement !== "")
            result = "<"+htmlElement+">"+stateElement+"</"+htmlElement+"><br/>";
        else
            result = stateElement+'</br>';
    }

    return result;
}

function getURIType (stateData) {
    var result = stateData.currentTrack.type;

    return result;
}

function getNiceHTMLInfo(stateData) {
    let result = "";
    result += getNiceElement(stateData.currentTrack.title,'b');
    if ( stateData.currentTrack.type == 'radio' ){
        if (stateData.currentTrack.title != stateData.currentTrack.artist && stateData.currentTrack.artist != stateData.currentTrack.stationName)
            result += getNiceElement(stateData.currentTrack.artist,'i');
        if (stateData.currentTrack.album !== undefined )
            result += getNiceElement(stateData.currentTrack.album,'');
        if (stateData.currentTrack.title != stateData.currentTrack.stationName)
            result += getNiceElement(stateData.currentTrack.stationName,'');
        
    } else {
        if (stateData.currentTrack.title != stateData.currentTrack.artist && stateData.currentTrack.artist != stateData.currentTrack.album)
            result += getNiceElement(stateData.currentTrack.artist,'i');
        if (stateData.currentTrack.title != stateData.currentTrack.album)
            result += getNiceElement(stateData.currentTrack.album,'');
    }

    return result;
}

/** 
 * TV mode workaround:
 */

function isTVMode( uri ){
    dwmlog ("isTVMode called with uri: "+uri,4);
    if (typeof(uri)!=="string") return false;
    result = uri.startsWith('x-sonos-htastream:') && uri.endsWith ('spdif');
    return result;
}

function setTVModeBuffer(ZoneName, TVModeUri, sourceAction ){
    let data = { uri: TVModeUri, sourceAction: sourceAction };
    pauseTVBuffer[ZoneName] = data;
    dwmlog ("setTVModeBuffer for "+ZoneName+" pauseTVBuffer is: "+JSON.stringify(pauseTVBuffer),4);    
}

function checkTVModeDatapoint(ZoneName,stateData){
    dwmlog("Checking TV mode for "+ZoneName+" and uri "+stateData.currentTrack.uri,4);
    if (isTVMode(stateData.currentTrack.uri)){
        dwmlog ("TV mode detected",4);
        if ( getState(basePath+"."+ZoneName+".action.setTVMode").notExist ){
            createState(basePath+"."+ZoneName+".action.setTVMode",true,forceCreate,{ type: "boolean", name: "setTVMode action for "+ZoneName, role: "button"});
            dwmlog("Created TVMode datapoint for "+ZoneName);
        }
    }
}

function calcTVModeUri (ZoneName){
    return "x-sonos-htastream:"+getState(basePath+"."+ZoneName+".uuid").val+":spdif";
}

/************************************************************************************************/

function processState(ZoneName,stateData){
    dwmlog ("Sonos processState for Zone "+ZoneName+" with data: "+JSON.stringify(stateData),4);
    setStateProtected(basePath+"."+ZoneName+".state.volume",stateData.volume,true);


    setStateProtected(basePath+"."+ZoneName+".state.mute",stateData.mute,true);
    setStateProtected(basePath+"."+ZoneName+".state.playbackState",stateData.playbackState,true);
    setStateProtected(basePath+"."+ZoneName+".state.playbackStateSimple",stateData.playbackState=="PLAYING",true);

    // current track Information
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.artist",stateData.currentTrack.artist,true);
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.title",stateData.currentTrack.title,true);
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.album",stateData.currentTrack.album,true);
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.duration",stateData.currentTrack.duration,true);
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.uri",stateData.currentTrack.uri,true);
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.trackUri",stateData.currentTrack.trackUri,true);
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.type",stateData.currentTrack.type,true);
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.stationName",stateData.currentTrack.stationName,true);    
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.albumArtUri",getAlbumUri( stateData, false),true);
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.absoluteAlbumArtUri",getAlbumUri(stateData, true),true);
    setStateProtected(basePath+"."+ZoneName+".state.currentTrack.niceInfoHTML",getNiceHTMLInfo(stateData),true);

    setState(basePath+"."+ZoneName+".state.trackNo",stateData.trackNo,true);
    setState(basePath+"."+ZoneName+".state.elapsedTime",stateData.elapsedTime,true);
    setState(basePath+"."+ZoneName+".state.elapsedTimeFormatted",stateData.elapsedTimeFormatted,true);

    setState(basePath+"."+ZoneName+".state.playMode.repeat",stateData.playMode.repeat,true);
    setState(basePath+"."+ZoneName+".state.playMode.shuffle",stateData.playMode.shuffle,true);
    setState(basePath+"."+ZoneName+".state.playMode.crossfade",stateData.playMode.crossfade,true);

    checkTVModeDatapoint(ZoneName, stateData );

    dwmlog ("processState ends",4);
}

function initSingleZone(zoneData,coordinator,members,forceCreate){
    if (forceCreate === undefined) forceCreate=false;
    // forceCreate=true;

    dwmlog ("SingleZoneInit: "+JSON.stringify(zoneData),4);
    var ZoneName = zoneData.roomName;
    
    var group = zoneData.roomName;
    if (coordinator.roomName == zoneData.roomName ){
        group = coordinator.roomName ;
        if (members.length>0) group += ' / '+members.join(' / ');
    } else {
        group += " => "+coordinator.roomName;
    }
    
    createOrSetState(basePath+"."+ZoneName+".name",zoneData.roomName,forceCreate,{ type: "string", name: "Sonos Roomname for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".uuid",zoneData.uuid,forceCreate,{ type: "string", name: "Sonos UUID for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".coordinator",coordinator.roomName,forceCreate,{ type: "string", name: "Sonos Group Coordinator for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".group",group,forceCreate,{ type: "string", name: "Sonos group for "+zoneData.roomName});
    
    
    createOrSetState(basePath+"."+ZoneName+".state.volume",zoneData.state.volume,forceCreate,{ type: "number", name: "Sonos Volume for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.mute",zoneData.state.mute,forceCreate,{ type: "boolean", name: "Sonos Mute State for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.playbackState",zoneData.state.playbackState,forceCreate,{ type: "string", name: "Sonos Play State for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.playbackStateSimple",zoneData.state.playbackState=="PLAYING",forceCreate,{ type: "boolean", name: "Sonos Simple Play State for "+zoneData.roomName});

    createOrSetState(basePath+"."+ZoneName+".state.groupVolume",zoneData.groupState.volume,forceCreate,{ type: "number", name: "Sonos group volume for "+zoneData.roomName});

    // current track Information
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.artist",zoneData.state.currentTrack.artist,forceCreate,{ type: "string", name: "Sonos current track artist for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.title",zoneData.state.currentTrack.title,forceCreate,{ type: "string", name: "Sonos current track title for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.album",zoneData.state.currentTrack.album,forceCreate,{ type: "string", name: "Sonos current track album for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.duration",zoneData.state.currentTrack.duration,forceCreate,{ type: "number", name: "Sonos current track duration for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.uri",zoneData.state.currentTrack.uri,forceCreate,{ type: "string", name: "Sonos current uri for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.trackUri",zoneData.state.currentTrack.trackUri,forceCreate,{ type: "string", name: "Sonos current track uri for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.type",zoneData.state.currentTrack.type,forceCreate,{ type: "string", name: "Sonos current play type for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.stationName",zoneData.state.currentTrack.stationName,forceCreate,{ type: "string", name: "Sonos current station name for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.albumArtUri",getAlbumUri( zoneData.state, false),forceCreate,{ type: "string", name: "Sonos album art for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.absoluteAlbumArtUri",getAlbumUri( zoneData.state, true),forceCreate,{ type: "string", name: "Sonos absolute album art URI for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.currentTrack.niceInfoHTML",getNiceHTMLInfo( zoneData.state ),forceCreate,{ type: "string", name: "Sonos absolute album art URI for "+zoneData.roomName});

    createOrSetState(basePath+"."+ZoneName+".state.trackNo",zoneData.state.trackNo,forceCreate,{ type: "number", name: "Sonos track number for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.elapsedTime",zoneData.state.elapsedTime,forceCreate,{ type: "number", name: "Sonos track elapsed time for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.elapsedTimeFormatted",zoneData.state.elapsedTimeFormatted,forceCreate,{ type: "string", name: "Sonos track elapsed time formatted for "+zoneData.roomName});

    createOrSetState(basePath+"."+ZoneName+".state.playMode.repeat",zoneData.state.playMode.repeat,forceCreate,{ type: "string", name: "Sonos repeat playmode for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.playMode.shuffle",zoneData.state.playMode.shuffle,forceCreate,{ type: "boolean", name: "Sonos shuffle playmode for "+zoneData.roomName});
    createOrSetState(basePath+"."+ZoneName+".state.playMode.crossfade",zoneData.state.playMode.crossfade,forceCreate,{ type: "boolean", name: "Sonos crossfade playmode for "+zoneData.roomName});

    // create Actions
    createState(basePath+"."+ZoneName+".action.play",true,forceCreate,{ type: "boolean", name: "Play action for "+zoneData.roomName, role: "button"});
    createState(basePath+"."+ZoneName+".action.playpause",true,forceCreate,{ type: "boolean", name: "Toggle play action for "+zoneData.roomName, role: "button"});
    createState(basePath+"."+ZoneName+".action.pause",true,forceCreate,{ type: "boolean", name: "Pause action for "+zoneData.roomName, role: "button"});
    createState(basePath+"."+ZoneName+".action.next",true,forceCreate,{ type: "boolean", name: "Pause action for "+zoneData.roomName, role: "button"});
    createState(basePath+"."+ZoneName+".action.previous",true,forceCreate,{ type: "boolean", name: "Pause action for "+zoneData.roomName, role: "button"});

    // sayit Actions
    createState(basePath+"."+ZoneName+".action.say","",forceCreate,{ type: "string", name: "Say action for "+zoneData.roomName});
    createState(basePath+"."+ZoneName+".action.clip","",forceCreate,{ type: "string", name: "Clip action for "+zoneData.roomName});
    createState(basePath+"."+ZoneName+".settings.clipVolume",30,forceCreate,{ type: "number", name: "Clip and say volume for "+zoneData.roomName});

    // favorite action
    createState(basePath+"."+ZoneName+".action.favorite","",forceCreate,{ type: "string", name: "Set favorite action for "+zoneData.roomName});
    createState(basePath+"."+ZoneName+".action.playlist","",forceCreate,{ type: "string", name: "Set playlist action for "+zoneData.roomName});
    createState(basePath+"."+ZoneName+".settings.defaultFavorite","",forceCreate,{ type: "string", name: "Default favorite for "+zoneData.roomName});
    createState(basePath+"."+ZoneName+".settings.lastFavorite","",forceCreate,{ type: "string", name: "Last favorite selected for "+zoneData.roomName});
    createState(basePath+"."+ZoneName+".settings.lastPlaylist","",forceCreate,{ type: "string", name: "Last playlist selected for "+zoneData.roomName});

    // sayit Extended functionality
    createState(basePath+"."+ZoneName+".action.sayEx",{},forceCreate,{ type: "string", name: "Say extended action for "+zoneData.roomName});

    checkTVModeDatapoint(ZoneName, zoneData.state );
}

function initZone(zoneData,forceCreate){
    if (forceCreate === undefined) forceCreate=false;

    var ZoneName = zoneData.coordinator.roomName;
    var ZoneList = [];

    initSingleZone(zoneData.coordinator,zoneData.coordinator,forceCreate);
    ZoneListObj={ name: zoneData.coordinator.roomName, isCoordinator: true,  members:[] };

    for (let i = 0; i<zoneData.members.length; i++){
        if (zoneData.members[i].uuid != zoneData.coordinator.uuid){
            dwmlog("Group member for "+ZoneName+" detected: "+zoneData.members[i].roomName,4);
            initSingleZone(zoneData.members[i],zoneData.coordinator,forceCreate);
            ZoneListObj.members.push(zoneData.members[i].roomName);
            ZoneList.push({name: zoneData.members[i].roomName, isCoordinator: false, coordinator: ZoneListObj.name });
        }
    }

    initSingleZone(zoneData.coordinator,zoneData.coordinator,ZoneListObj.members,forceCreate);    
    ZoneList.push(ZoneListObj);

    dwmlog("ZoneList init: "+JSON.stringify(ZoneList),4);
    return ZoneList;
}

function getRoomFromObj(objName){
    objPathArr = objName.split(".");
    // dwmlog("Room is: "+objPathArr[4],4);
    return objPathArr[4];
}

/** 
 * canPlay - whats that?
 * After switching on Power, the current track is simply empty. 
 * If "Play" is pressed in that state, simply nothing happens - as there is nothing to play.
 * This function should detect such a state, so that the "play" handler can act accordingly.
 */
function canPlay(ZoneName){
    result = true;

    let base=basePath+"."+ZoneName+".state.currentTrack.";

    currentTrack={};
    currentTrack.title=getState(base+"title").val;
    currentTrack.artist=getState(base+"artist").val;
    currentTrack.duration=getState(base+"duration").val;
    currentTrack.album=getState(base+"album").val;
    currentTrack.uri=getState(base+"uri").val;

    dwmlog ("canPlay: currentTrack state for "+ZoneName+" is: "+JSON.stringify(currentTrack,null,4),4);
    
    if ( currentTrack.title == "" 
        && currentTrack.artist == "" 
        && currentTrack.duration == 0 
        && currentTrack.album == "" 
        && currentTrack.uri == "" ) {

        result = false;
    }

    return result;
}

function isGroupedWith( ZoneName ){
    // check if a room is still in the list, if not, set to "inactive"
    let resultArr = [];
    let CoordinatorName = getState(basePath+"."+ZoneName+".coordinator").val;
    dwmlog ("Searching group for "+ZoneName+" having coordinator "+CoordinatorName,4 );
    $("javascript.0.SonosAPI.Rooms.*.coordinator").each(function(id,index){
        let RoomName = getRoomFromObj(id);
        if (getState(id).val == CoordinatorName) resultArr.push(RoomName);
    });
    dwmlog("Group for "+ZoneName+" is "+JSON.stringify(resultArr),4);
    return resultArr;
}

function sayExtended (ZoneName, theObj ) {

    var now = new Date();
    var messagebefore = theObj.messagebefore;
    var messagebehind = theObj.messagebehind;
    var sayTime = theObj.sayTime;
    var sayTemp = theObj.sayTemp;
    var sayDate = theObj.sayDate;
    var intro   = theObj.introClip;
    var introlen = theObj.introClipLen;
    
    if (messagebefore === undefined && messagebehind===undefined){
        dwmlog("sayExtended got invalid data",2,"warn");
        return;
    }


    theTemp = Math.round(getState(TempSensorId).val);
    
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
    if (messagebehind !== undefined && messagebehind !== null) {
        if (SSMLMode=="Polly") message += '<break time="1s"/>'; else message += "; ";
        message += messagebehind;
    }

    if (SSMLMode == "Polly")
        message = '<speak><prosody rate="90%">' + message + '</prosody></speak>';
    
    dwmlog (message +" -- Länge: "+message.length,4);
    if (ZoneName=="all"){
        if (intro !== null ) {
            // setState(AdapterId+".SonosAPI.clipAll",intro);
        }
        // setStateDelayed(AdapterId+".SonosAPI.sayAll",message,messagedelay);
        setState(AdapterId+".SonosAPI.sayAll",message);
    } else {
        if (intro !== null ) {
            setState(basePath+'.'+ZoneName+".action.clip",intro);
        }
        setStateDelayed(basePath+'.'+ZoneName+".action.say",message,messagedelay);
    }
}

function createSubscribes(){
    // mute
    on({id: Array.prototype.slice.apply($(basePath+".*.action.mute")), val: true, ack: false, change:"any"}, function (obj) {
        dwmlog("Mute action from "+JSON.stringify(obj),4);
    });
    
    // play
    on({id: Array.prototype.slice.apply($(basePath+".*.action.play")), val: true, ack: false, change:"any"}, function (obj) {
        dwmlog("Play action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        let ZoneName=getRoomFromObj(obj.id);
        if (! canPlay(ZoneName) ){
            if ( pauseTVBuffer[ZoneName] !== undefined ) {
                // its a "paused" Sonos, which was in TV Mode before
                dwmlog ("TV mode workaround active - setting uri to "+pauseTVBuffer[ZoneName].uri,4);
                requestAction( getRoomFromObj(obj.id), "setavtransporturi", encodeURIComponent(pauseTVBuffer[ZoneName].uri), obj.id)
                pauseTVBuffer[ZoneName] = undefined; // delete from Buffer afterwards
            } else {
                let newfav = getState(basePath+"."+ZoneName+".settings.lastFavorite").val;
                if (newfav == ""){
                    newfav = getState(basePath+"."+ZoneName+".settings.defaultFavorite").val;   
                }
                if (newfav == ""){
                    let FavList = getState(AdapterId+".SonosAPI.FavList").val;
                    newfav=FavList.split(';')[0];
                } 
                setState(basePath+"."+ZoneName+".action.favorite",newfav,false);
            }
        }
        else requestAction( ZoneName, "play", null, obj.id );
    });

    // pause
    on({id: Array.prototype.slice.apply($(basePath+".*.action.pause")), val: true, ack: false, change:"any"}, function (obj) {
        dwmlog("Pause action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        
        // workaround: SPDIF TV mode cannot be paused, causing crashes in SonosAPI
        let ZoneName=getRoomFromObj(obj.id);
        let uri = getState(basePath+"."+ZoneName+".state.currentTrack.uri").val;
        if (isTVMode(uri)){
            requestAction( getRoomFromObj(obj.id), "setavtransporturi", "", obj.id );
            setTVModeBuffer ( ZoneName, uri, "pause" );               
        } else {
            requestAction( getRoomFromObj(obj.id), "pause", null, obj.id );
        }
    });

    // play
    on({id: Array.prototype.slice.apply($(basePath+".*.action.playpause")), val: true, ack: false, change:"any"}, function (obj) {
        dwmlog("Toggle play action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        // TODO: canPlay - muss/soll man das hier ebenfalls einbinden?
        requestAction( getRoomFromObj(obj.id), "playpause", null, obj.id );
    });

    // next
    on({id: Array.prototype.slice.apply($(basePath+".*.action.next")), val: true, ack: false, change:"any"}, function (obj) {
        dwmlog("Next action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        requestAction( getRoomFromObj(obj.id), "next", null, obj.id );
    });
    
    // previous
    on({id: Array.prototype.slice.apply($(basePath+".*.action.previous")), val: true, ack: false, change:"any"}, function (obj) {
        dwmlog("Previous action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        requestAction( getRoomFromObj(obj.id), "previous", null, obj.id );
    });

    // volume change
    on({id: Array.prototype.slice.apply($(basePath+".*.state.volume")), ack: false, change:"ne"}, function (obj) {
        dwmlog("Volume change action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        requestAction(  getRoomFromObj(obj.id), "volume", obj.state.val, obj.id)
    });

    // groupVolume change
    on({id: Array.prototype.slice.apply($(basePath+".*.state.groupVolume")), ack: false, change:"ne"}, function (obj) {
        dwmlog("Group volume change action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),3);
        requestAction(  getRoomFromObj(obj.id), "groupVolume", obj.state.val, obj.id)
    });

    // mute change
    on({id: Array.prototype.slice.apply($(basePath+".*.state.mute")), ack: false, change:"ne"}, function (obj) {
        dwmlog("Mute change action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        if (obj.state.val) 
            requestAction(  getRoomFromObj(obj.id), "mute", null, obj.id);
        else
            requestAction(  getRoomFromObj(obj.id), "unmute", null, obj.id);
    });

    // repeat
    on({id: Array.prototype.slice.apply($(basePath+".*.state.playMode.repeat")), ack: false, change:"ne"}, function (obj) {
        dwmlog("Playmode repeat action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        let valid=['none','one','all'];
        if (valid.includes(obj.state.val)){
            requestAction(  getRoomFromObj(obj.id), "repeat", obj.state.val, obj.id);
        } else {
            // revert changes if not valid
            setStateProtected(basePath+".*.state.playMode.repeat",obj.oldState.val, true);
        }
    });    

    // shuffle change
    on({id: Array.prototype.slice.apply($(basePath+".*.state.playMode.shuffle")), ack: false, change:"any"}, function (obj) {
        dwmlog("Playmode shuffle action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        if (obj.state.val){
            requestAction(  getRoomFromObj(obj.id), "shuffle", "on", obj.id)
        } else {
            requestAction(  getRoomFromObj(obj.id), "shuffle", "off", obj.id)
        }
    });

    // crossfade change
    on({id: Array.prototype.slice.apply($(basePath+".*.state.playMode.crossfade")), ack: false, change:"any"}, function (obj) {
        dwmlog("Playmode crossfade action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        if (obj.state.val){
            requestAction(  getRoomFromObj(obj.id), "crossfade", "on", obj.id)
        } else {
            requestAction(  getRoomFromObj(obj.id), "crossfade", "off", obj.id)
        }
    });
    
    // URI change
    on({id: Array.prototype.slice.apply($(basePath+".*.state.currentTrack.uri")), ack: false, change:"any"}, function (obj) {
        dwmlog("URI set action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id),4);
        requestAction(  getRoomFromObj(obj.id), "setavtransporturi", encodeURIComponent(obj.state.val), obj.id)
    });

    // say
    on({id: Array.prototype.slice.apply($(basePath+".*.action.say")), ack: false, change:"any"}, function (obj) {
        dwmlog("Say action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id)+" saying: "+encodeURIComponent(obj.state.val),4);
        let ZoneName=getRoomFromObj(obj.id);
        let vol = getState(basePath+"."+ZoneName+".settings.clipVolume").val;
        requestAction(  getRoomFromObj(obj.id), "say", encodeURIComponent(obj.state.val)+'/'+vol, obj.id)
    });

    // clip
    on({id: Array.prototype.slice.apply($(basePath+".*.action.clip")), ack: false, change:"any"}, function (obj) {
        dwmlog("Clip action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id)+" playing: "+encodeURIComponent(obj.state.val),4);
        let ZoneName=getRoomFromObj(obj.id);
        let vol = getState(basePath+"."+ZoneName+".settings.clipVolume").val;
        requestAction(  getRoomFromObj(obj.id), "clip", encodeURIComponent(obj.state.val)+'/'+vol, obj.id)
    });

    // favorite
    on({id: Array.prototype.slice.apply($(basePath+".*.action.favorite")), ack: false, change:"any"}, function (obj) {
        let ZoneName=getRoomFromObj(obj.id);
        dwmlog("Favorite action from "+JSON.stringify(obj)+" in Room "+ZoneName+" playing: "+encodeURIComponent(obj.state.val),4);
        if (obj.state.val === "TVMode") {
            requestAction(  ZoneName, "setavtransporturi", encodeURIComponent(calcTVModeUri(ZoneName) ), obj.id)
        } else if (obj.state.val !== "") {
            requestAction(  ZoneName, "favorite", encodeURIComponent(obj.state.val), obj.id)
            setState(basePath+"."+ZoneName+".settings.lastFavorite",obj.state.val,true);
        }
        
        if (resetFavoriteTime > 0)
            setStateDelayed(basePath+"."+ZoneName+".action.favorite","",true,resetFavoriteTime*1000);
    });

    // playlist
    on({id: Array.prototype.slice.apply($(basePath+".*.action.playlist")), ack: false, change:"any"}, function (obj) {
        let ZoneName=getRoomFromObj(obj.id);
        dwmlog("Playlist action from "+JSON.stringify(obj)+" in Room "+ZoneName+" playing: "+encodeURIComponent(obj.state.val),4);
        if (obj.state.val !== "") {
            requestAction(  ZoneName, "playlist", encodeURIComponent(obj.state.val), obj.id)
            setState(basePath+"."+ZoneName+".settings.lastPlaylist",obj.state.val,true);
        }
        setStateDelayed(basePath+"."+ZoneName+".action.playlist","",true,5000);
    });

    // trackseek
    on({id: Array.prototype.slice.apply($(basePath+".*.state.trackNo")), ack: false, change:"any"}, function (obj) {
        dwmlog("Trackseek action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id)+" jumping to: "+obj.state.val,4);
        requestAction(  getRoomFromObj(obj.id), "trackseek", encodeURIComponent(obj.state.val), obj.id)
    });

    // simple playbackstate
    on({id: Array.prototype.slice.apply($(basePath+".*.state.playbackStateSimple")), ack: false, change:"any"}, function (obj) {
        dwmlog("Simple playback state action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id)+" setting to: "+obj.state.val,4);
        if (obj.state.val){
            requestAction( getRoomFromObj(obj.id), "play", null, obj.id );        
        } else {
            requestAction( getRoomFromObj(obj.id), "pause", null, obj.id );
        }
    });

    // sayEx
    on({id: Array.prototype.slice.apply($(basePath+".*.action.sayEx")), ack: false, change:"any"}, function (obj) {
        dwmlog("SayEx action from "+JSON.stringify(obj)+" in Room "+getRoomFromObj(obj.id)+" saying: "+obj.state.val,4);
        sayExtended(getRoomFromObj(obj.id), JSON.parse(obj.state.val));
    });

    // pauseAll
    on({id: AdapterId+".SonosAPI.pauseAll", val: true, change: "any"}, function(obj){
        dwmlog ("PauseAll Action ",4);
        let TVModesDetected = false;
        $(basePath+'.*.state.currentTrack.uri').each( function (id,i){
            dwmlog("PauseAll checks URI: "+JSON.stringify(id),4);
            let uri=getState(id).val;
            if (isTVMode(uri)){
                let ZoneName = getRoomFromObj(id);
                requestAction( ZoneName, "setavtransporturi", "", id );
                setTVModeBuffer ( ZoneName, uri, "pauseall" );
                TVModesDetected = true;
            }
        });

        if (TVModesDetected)
            setTimeout( requestSonosAPI,200,'/pauseall'); // call after short timeout
        else 
            requestSonosAPI('/pauseall');
    });

    // resumeAll
    on({id: AdapterId+".SonosAPI.resumeAll", val: true, change: "any"}, function(obj){
        dwmlog ("resumeAll Action ",4);
        requestSonosAPI('/resumeall');

        $(basePath+'.*.name').each(function (id,i){
            let ZoneName = getState(id).val;
            if (pauseTVBuffer[ZoneName] !== undefined && pauseTVBuffer[ZoneName].sourceAction === "pauseall"){
                requestAction( ZoneName,  'setavtransporturi', pauseTVBuffer[ZoneName].uri);
                pauseTVBuffer[ZoneName] = undefined;
            }
        });
    });

    // clipAll
    on({id: AdapterId+".SonosAPI.clipAll", ack: false, change: "any"}, function(obj){
        dwmlog("Clip ALL action, playing: "+encodeURIComponent(obj.state.val),3);
        let vol=getState(AdapterId+".SonosAPI.genericSettings.clipAllVolume").val;
        requestSonosAPI("/clipall/"+encodeURIComponent(obj.state.val)+'/'+vol);        
    });

    // sayAll
    on({id: AdapterId+".SonosAPI.sayAll", ack: false, change: "any"}, function(obj){
        dwmlog("Say ALL action, playing: "+encodeURIComponent(obj.state.val),3);
        let vol=getState(AdapterId+".SonosAPI.genericSettings.clipAllVolume").val;
        requestSonosAPI("/sayall/"+encodeURIComponent(obj.state.val)+'/'+vol);        
    });

    // sayAllEx
    on({id: AdapterId+".SonosAPI.sayAllEx", ack: false, change: "any"}, function(obj){
        dwmlog("SayAllEx action, playing: "+obj.state.val,3);
        sayExtended("all", JSON.parse(obj.state.val));
    });

    // TV mode
    on({id: Array.prototype.slice.apply($(basePath+".*.action.setTVMode")), val: true, change:"any"}, function (obj) {
        let ZoneName=getRoomFromObj(obj.id);
        dwmlog("TV mode action from "+JSON.stringify(obj)+" in Room "+ZoneName,4);
        if (obj.state.val !== "")
            requestAction(  ZoneName, "setavtransporturi", encodeURIComponent(calcTVModeUri(ZoneName) ), obj.id)
    });

   // coordinator, grouping
    on({id: Array.prototype.slice.apply($(basePath+".*.coordinator")), ack:false, change:"ne"}, function (obj) {
        let ZoneName=getRoomFromObj(obj.id);
        dwmlog("Coordinator set from "+JSON.stringify(obj)+" in Room "+ZoneName,4);
        coordinators = getState(AdapterId+".SonosAPI.CoordinatorList").val.split(";");
        if (obj.state.val !== ""){
            if (coordinators.includes(obj.state.val) && obj.state.val!=ZoneName){
                dwmlog("Grouping: "+ZoneName+" joins "+obj.state.val,4);
                requestAction( ZoneName, "join", [obj.state.val], obj.id );
            } else {
                if (obj.state.val==ZoneName){
                    requestAction( ZoneName, "leave", null, obj.id );
                } else { 
                    // TODO: reset DP when input was illegal
                }
            }
        } else {
            requestAction( ZoneName, "leave", null, obj.id );
        }
    }); 
}

function processZones( AllZoneData, cbParam ) {
    forceCreate = false;

    dwmlog ("Zone Data: "+JSON.stringify(AllZoneData,null,4),4);
    ZoneListArr=[];
    ZoneListSimple=[];
    CoordListSimple=[];

    for (let i=0; i<AllZoneData.length; i++){
        let ZoneResult = initZone(AllZoneData[i])
        ZoneListArr = ZoneListArr.concat(ZoneResult);
    }

    for (let i=0; i<ZoneListArr.length; i++){
        ZoneListSimple.push(ZoneListArr[i].name);
        if (ZoneListArr[i].isCoordinator) CoordListSimple.push(ZoneListArr[i].name);
    }


    dwmlog ("ZoneListArr: "+JSON.stringify(ZoneListArr),4);
    // check if a room is still in the list, if not, set to "inactive"
    $("javascript.0.SonosAPI.Rooms.*.name").each(function(id,index){
        let RoomName=getState(id).val;
        let ZoneName=RoomName;

        if (ZoneListSimple.includes(RoomName)){
            dwmlog ("Room "+RoomName+" is active",4);
            createState(basePath+"."+ZoneName+".active",true,forceCreate,{ type: "boolean", name: "Set active state for "+RoomName});
        } else {
            dwmlog ("Room "+RoomName+" is NOT active",4);            
            createState(basePath+"."+ZoneName+".active",false,forceCreate,{ type: "boolean", name: "Set active state for "+RoomName});
        }
    });    

    dwmlog ("Zone List String: "+ZoneListSimple.join(';'),4);
    createOrSetState(AdapterId+".SonosAPI.RoomList",ZoneListSimple.join(';'),forceCreate,{ type: "string", name: "Sonos zone list"});   
    createOrSetState(AdapterId+".SonosAPI.CoordinatorList",CoordListSimple.join(';'),forceCreate,{ type: "string", name: "Sonos coordinator list"});   
    createState(AdapterId+".SonosAPI.pauseAll",true,forceCreate,{ type: "boolean", name: "Pause all players", role: "button"});   
    createState(AdapterId+".SonosAPI.resumeAll",true,forceCreate,{ type: "boolean", name: "Resume all players", role: "button"});

    createState(AdapterId+".SonosAPI.sayAll","",forceCreate,{ type: "string", name: "say on all players"}); 
    createState(AdapterId+".SonosAPI.clipAll","",forceCreate,{ type: "string", name: "clip on all players"}); 
    createState(AdapterId+".SonosAPI.sayAllEx","",forceCreate,{ type: "string", name: "say on all players, extended"});
    createState(AdapterId+".SonosAPI.genericSettings.clipAllVolume",40,forceCreate,{ type: "number", name: "SonosAPI clipAll Volume"}); 
}

function processVolumeChange ( VolumeData ){
    dwmlog ("Process Volume Data: "+JSON.stringify(VolumeData,null,4),4);
    
    var ZoneName = VolumeData.roomName;

    setStateProtected(basePath+"."+ZoneName+".state.volume",VolumeData.newVolume,true);
    if (isGroupedWith(ZoneName).length>1){
        dwmlog (ZoneName+" is grouped, requesting update of zones to get new group Volume",4);
        if (VolumeTimeout != null) clearTimeout(VolumeTimeout);
        VolumeTimeout = setTimeout(requestSonosZones,200);
    } else {
        // shortcut, reduce net traffic!
        setStateProtected(basePath+"."+ZoneName+".state.groupVolume",VolumeData.newVolume,true);
    }     
}

function processFavorites(FavData, cbParam ){
    forceCreate=false;
    if (Array.isArray(FavData)){
        var FavListStr = FavData.join(';');
        // dwmlog ("Process Favorites Data: "+JSON.stringify(FavData,null,4)+" gives List "+FavListStr,5);
        createOrSetState(AdapterId+".SonosAPI.FavList",FavListStr,forceCreate,{ type: 'string', name: "Sonos Favorites list"});
    } else {
        dwmlog("SonosAPI processFavorites got invalid data: "+JSON.stringify(FavData),2,"warn");
    }
}

function processPlaylists(PlaylistData, cbParam ){
    forceCreate=false;
    if (Array.isArray(PlaylistData)){
        var PlayListStr = PlaylistData.join(';');
        // dwmlog ("Process Favorites Data: "+JSON.stringify(FavData,null,4)+" gives List "+FavListStr,5);
        createOrSetState(AdapterId+".SonosAPI.Playlists",PlayListStr,forceCreate,{ type: 'string', name: "Sonos Playlist list"});
    } else {
        dwmlog("SonosAPI processPlaylists got invalid data: "+JSON.stringify(PlaylistData),2,"warn");
    }
}

function processMuteChange( MuteData ){
    dwmlog ("Process Mute Data: "+JSON.stringify(MuteData,null,4),4);
    
    var ZoneName = MuteData.roomName;

    setStateProtected(basePath+"."+ZoneName+".state.mute",MuteData.newMute,true);          
}

function requestSonosZones(){
    if (VolumeTimeout !== null){
        clearTimeout(VolumeTimeout);
        VolumeTimeout = null;
    }
        
    requestSonosAPI("/zones",processZones);    
}


function requestAction(room,action,parameters,triggerId ){
    let theURI = '/'+room+'/'+action;
    if ( parameters !== undefined && parameters !== null ){
        if (typeof(parameters)==='array'){
            for (let i=0; i<parameters.length; i++){
                theURI+='/'+parameters[i];
            }
        } else {
            theURI+='/'+parameters;
        }

    }
    requestSonosAPI(theURI);
}

function requestFavorites(){
    requestSonosAPI('/favorites',processFavorites);
}

function requestPlaylists(){
    requestSonosAPI('/playlists',processPlaylists);    
}

function collectRequestData(request, callback) {
    const FORM_JSONENCODED = 'application/json';
    dwmlog ("Request headers:"+JSON.stringify(request.headers),4);
    if(request.headers['content-type'] === FORM_JSONENCODED) {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });
        request.on('end', () => {
            // dwmlog ("collectRequestData got: "+body,4);
            var theObj = null;
            try {
                theObj=JSON.parse(body);
            }
            catch (theErr) { dwmlog ("JSON error: "+body+" => "+theErr.message,1,"error"); }
            callback(theObj);
        });
    }
    else {
        callback(null);
    }
}

var server = http.createServer(function(req,res){
    var url_parts = url.parse(req.url, true);

    dwmlog(JSON.stringify(url_parts),4);
    
    var pathsplit = url_parts.pathname.split("/");
    dwmlog (JSON.stringify(pathsplit),4);
    
    switch (req.method) {
        case 'POST':
            dwmlog ("Received Post",3);
            collectRequestData(req, result => {
                dwmlog("Result: "+JSON.stringify(result),3);
                let code = 200;
                let answer = { result: "success" };                
                try {
                    if (result.type) {
                        switch (result.type){
                            case "transport-state":
                                processState(result.data.roomName,result.data.state);
                                break;
                            case "topology-change":
                                processZones(result.data);
                                break;
                            case "volume-change":
                                processVolumeChange(result.data);
                                break;
                            case "mute-change":
                                processMuteChange(result.data);
                                break;
                            default:
                                code=400;
                                answer={ result: "error", message: "Unknown request type: "+result.type };
                        }
                    }
                } catch (theErr) {
                    dwmlog("Error: "+theErr.message + " from body: "+result,1,"error");
                    code=500;
                    answer={ result: "error", message: theErr.message };

                }
                res.writeHead(code, {
                    'Content-type': 'application/json' });  
                res.end(JSON.stringify(answer));                
            });

            break;
        case 'GET':
            let code = 404;
            let answer = { result: "error", message: "Unknown request"};
            if (pathsplit[0]=="" && pathsplit[1]=="info") {
                code = 200;
                answer = { code: 200, data: { version: version }};
                answer.data.sonosAPI=BaseURL;
                answer.data.SSMLMode=SSMLMode;
            }
            res.writeHead(code, {
                'Content-type': 'application/json' });  
            res.end(JSON.stringify(answer));  
            break;        
        default:
    } // switch (Method)
});

// close connection if script stopped
onStop(function (callback) {
    server.close();
}, 100 /*ms*/);

server.listen(webHookPort);
requestSonosZones();
schedule('* * * * *',requestFavorites);
schedule('13 * * * * *',requestPlaylists);

setTimeout(createSubscribes,200);
