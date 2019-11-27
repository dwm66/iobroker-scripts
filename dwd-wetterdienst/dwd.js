var debuglevel = 2;
var debugchannel = 'info';

var AdapterId = "javascript."+instance;
var ChannelId = "dwd";

var forceInitStates = false;
var numOfWarnings = 3;

var url='https://maps.dwd.de/geoserver/dwd/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dwd:Warnungen_Gemeinden&outputFormat=application/json&CQL_FILTER=WARNCELLID%20IN%20(XXXAREAXXX)';

// warncellids can be found through https://www.dwd.de/DE/leistungen/gds/help/warnungen/cap_warncellids_csv.html
// Hier Gemeinde Ainring nach https://www.dwd.de/DE/wetter/warnungen_aktuell/objekt_einbindung/einbindung_karten_geowebservice.pdf?__blob=publicationFile&v=11
var warncellids=["809172111"];

var warnsearch= warncellids.reduce(function(result, item) {
  if (result!=="") result+="%2C";
  result+="%27"+item+"%27";
  return result;
}, "");

url=url.replace("XXXAREAXXX",warnsearch);

dwmlog (url,4);

var jsond1 = '{"type":"FeatureCollection","totalFeatures":1,"features":[{"type":"Feature","id":"Warnungen_Gemeinden.fid-570a7e9a_15d605bceb2_-4b2d","geometry":{"type":"Polygon","coordinates":[[[11.854232,48.208979],[11.847522,48.206589],[11.832407,48.181957],[11.83774,48.177249],[11.857127,48.181619],[11.881832,48.177545],[11.886709,48.19194],[11.881543,48.204296],[11.854232,48.208979]]]},"geometry_name":"THE_GEOM","properties":{"AREADESC":"Markt Schwaben","NAME":"Gemeinde Markt Schwaben","WARNCELLID":809175127,"IDENTIFIER":"2.49.0.1.276.DWD.PVW.1500560208311.59","SENDER":"CAP@dwd.de","SENT":"2017-07-20T14:17:00Z","STATUS":"Actual","MSGTYPE":"Alert","SOURCE":"PVW","SCOPE":"Public","LANGUAGE":"de-DE","CATEGORY":"Met","EVENT":"STARKES GEWITTER","RESPONSETYPE":"Prepare","URGENCY":"Immediate","SEVERITY":"Moderate","CERTAINTY":"Observed","EC_PROFILE":"2.1","EC_LICENSE":"Geobasisdaten: Copyright Bundesamt für Kartographie und Geodäsie, Frankfurt am Main, 2013","EC_II":"38","EC_GROUP":"THUNDERSTORM;WIND;RAIN;HAIL","EC_AREA_COLOR":"255 153 0","EFFECTIVE":"2017-07-20T13:54:00Z","ONSET":"2017-07-20T13:54:00Z","EXPIRES":"2017-07-20T15:00:00Z","SENDERNAME":"DWD / Nationales Warnzentrum Offenbach","HEADLINE":"Amtliche WARNUNG vor STARKEM GEWITTER","DESCRIPTION":"Von Südwesten ziehen örtlich Gewitter auf. Dabei gibt es Sturmböen mit Geschwindigkeiten um 70 km/h (20m/s, 38kn, Bft 8) sowie Starkregen mit Niederschlagsmengen zwischen 15 l/m² und 25 l/m² pro Stunde und kleinkörnigen Hagel.","INSTRUCTION":"ACHTUNG! Hinweis auf mögliche Gefahren: Örtlich kann es Blitzschlag geben. Bei Blitzschlag besteht Lebensgefahr! Vereinzelt können beispielsweise Bäume entwurzelt und Dächer beschädigt werden. Achten Sie besonders auf herabstürzende Äste, Dachziegel oder Gegenstände. Während des Platzregens sind kurzzeitig Verkehrsbehinderungen möglich.","WEB":"http://www.wettergefahren.de","CONTACT":"Deutscher Wetterdienst","PARAMETERNAME":"Böen","PARAMATERVALUE":"~70 [km/h]","ALTITUDE":0,"CEILING":9842.5197,"bbox":[11.832407,48.177249,11.886709,48.208979]}}],"crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:EPSG::4326"}},"bbox":[11.832407,48.177249,11.886709,48.208979]}';
var jsond2 = '{"type":"FeatureCollection","totalFeatures":0,"features":[],"crs":null}';
var jsond3 = '{"type":"FeatureCollection","totalFeatures":1,"features":[{"type":"Feature","id":"Warnungen_Gemeinden.fid-41da0a5e_15d69623604_-7d58","geometry":{"type":"Polygon","coordinates":[[[11.854232,48.208979],[11.847522,48.206589],[11.832407,48.181957],[11.83774,48.177249],[11.857127,48.181619],[11.881832,48.177545],[11.886709,48.19194],[11.881543,48.204296],[11.854232,48.208979]]]},"geometry_name":"THE_GEOM","properties":{"AREADESC":"Markt Schwaben","NAME":"Gemeinde Markt Schwaben","WARNCELLID":809175127,"IDENTIFIER":"2.49.0.1.276.DWD.PVW.1500711608168.3","SENDER":"CAP@dwd.de","SENT":"2017-07-22T08:21:00Z","STATUS":"Actual","MSGTYPE":"Alert","SOURCE":"PVW","SCOPE":"Public","LANGUAGE":"de-DE","CATEGORY":"Met","EVENT":"VORABINFORMATION SCHWERES GEWITTER","RESPONSETYPE":"Prepare","URGENCY":"Future","SEVERITY":"Severe","CERTAINTY":"Observed","EC_PROFILE":"2.1","EC_LICENSE":"Geobasisdaten: Copyright Bundesamt für Kartographie und Geodäsie, Frankfurt am Main, 2013","EC_II":"40","EC_GROUP":"THUNDERSTORM","EC_AREA_COLOR":"255 128 128","EFFECTIVE":"2017-07-22T07:41:00Z","ONSET":"2017-07-22T14:00:00Z","EXPIRES":"2017-07-23T02:00:00Z","SENDERNAME":"DWD / Nationales Warnzentrum Offenbach","HEADLINE":"VORABINFORMATION UNWETTER vor SCHWEREM GEWITTER","DESCRIPTION":"Ab dem Nachmittag treten zunächst nur einzelne schwere Gewitter mit heftigem Starkregen um 30 mm in kurzer Zeit, großem Hagel mit Korngrößen um 3 cm und schweren Sturmböen auf. In den Nachtstunden breiten sich von Frankreich und der Schweiz  verbreiteter heftige Gewitter ostwärts und nordostwärts aus. Dabei geht die Hauptgefahr neben heftigem Starkregen von verbreiteten Sturmböen um 85 km/h und lokalen orkanartigen Böen um 105 km/h aus.","INSTRUCTION":"Dies ist ein erster Hinweis auf erwartete Unwetter. Er soll die rechtzeitige Vorbereitung von Schutzmaßnahmen ermöglichen. Die Prognose wird in den nächsten 12 Stunden konkretisiert. Bitte verfolgen Sie die weiteren Wettervorhersagen mit besonderer Aufmerksamkeit.","WEB":"http://www.wettergefahren.de","CONTACT":"Deutscher Wetterdienst","PARAMETERNAME":null,"PARAMATERVALUE":null,"ALTITUDE":0,"CEILING":9842.5197,"bbox":[11.832407,48.177249,11.886709,48.208979]}}],"crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:EPSG::4326"}},"bbox":[11.832407,48.177249,11.886709,48.208979]}';


function createStates(n){
    for (var j=0; j<warncellids.length;j++){
        AreaChannelId=ChannelId+"."+warncellids[j];        
        for (var i=0; i<n; i++) {
            createState(AreaChannelId+".warning."+i+".name","",forceInitStates,{type: 'string'});
            createState(AreaChannelId+".warning."+i+".text","",forceInitStates,{type: 'string'});
            createState(AreaChannelId+".warning."+i+".headline","",forceInitStates,{type: 'string'});
            createState(AreaChannelId+".warning."+i+".description","",forceInitStates,{type: 'string'});
            createState(AreaChannelId+".warning."+i+".object","",forceInitStates,{type: 'string'});
            createState(AreaChannelId+".warning."+i+".begin",0,forceInitStates,{type: 'number'});
            createState(AreaChannelId+".warning."+i+".end",0,forceInitStates,{type: 'number'});
            createState(AreaChannelId+".warning."+i+".severity",0,forceInitStates,{min:0, max: 4, type: 'number', states:["None","Minor","Moderate","Severe","Extreme"]});
            createState(AreaChannelId+".warning."+i+".urgency",0,forceInitStates,{min:0, max: 2, type: 'number', states:["n/a","Future","Immediate"]});
            createState(AreaChannelId+".warning."+i+".category",0,forceInitStates,{min:0, max: 2, type: 'number', states:["n/a","Health","Met"]});
            createState(AreaChannelId+".warning."+i+".eventcode",0,forceInitStates,{type: 'number'});
            createState(AreaChannelId+".warning."+i+".color",0,forceInitStates,{type: 'number'});
            createState(AreaChannelId+".warning."+i+".mdui-style","",forceInitStates,{type: 'string'});
			createState(AreaChannelId+".warning."+i+".HTMLlong","",forceInitStates,{type: 'string'});
        }
    }

}

/** Parse CAP profile
 *  according to https://werdis.dwd.de/tools/CAP-DWD-Profil.pdf
 */
function processCAP(w) {
    this.name=w.NAME;
    this.warncellid=w.WARNCELLID;
    this.begin=new Date(w.ONSET).getTime();
    this.end=new Date(w.EXPIRES).getTime();
    
    this.text=w.EVENT;
    this.headline=w.HEADLINE;
    this.description=w.DESCRIPTION;
    this.instruction=w.INSTRUCTION;
    this.object = JSON.stringify(w);
    
    switch (w.SEVERITY) {
        case "Minor":       this.severity = 1; break;
        case "Moderate":    this.severity = 2; break;
        case "Severe":      this.severity = 3; break;
        case "Extreme":     this.severity = 4; break;
        default:            this.severity = 0;
    }
    
    switch (w.URGENCY) {
        case "Future":      this.urgency = 1; break;
        case "Immediate":   this.urgency = 2; break;
        default:            this.urgency = 0; break;
    }
    
    switch (w.CATEGORY) {
        case "Health":      this.category = 1; break;
        case "Met":         this.category = 2; break;
    }
    
    cols = w.EC_AREA_COLOR.split(" ");
    this.color = cols[0]*65536+cols[1]*256+cols[2]*1;
    
    this.eventcode = parseInt(w.EC_II);

    this.HTMLlong    = '<div style="color: black; font-family: Arial, Helvetica, sans-serif; background: #'+this.color.toString(16)+'">';
    this.HTMLlong   += '<h3>'+this.headline+'</h3>';
    this.HTMLlong   += '<p>Zeitraum von: '+formatDate(this.begin,"DD.MM.YYYY hh:mm")+' bis: '+formatDate(this.end,"DD.MM.YYYY hh:mm")+"</p>";
    this.HTMLlong   += '<p>'+this.description+'</p>';
    this.HTMLlong   += w.SENDERNAME;
    this.HTMLlong   += '</div>';
}

/*
.mdui-dwd-green-glow {
  filter: drop-shadow(0px 0px 2px #c5e566) drop-shadow(0px 0px 2px #c5e566) drop-shadow(0px 0px 4px #c5e566)
}

.mdui-dwd-yellow-glow {
  filter: drop-shadow(0px 0px 2px #ffeb3b) drop-shadow(0px 0px 2px #ffeb3b) drop-shadow(0px 0px 4px #ffeb3b)
}

.mdui-dwd-orange-glow {
  filter: drop-shadow(0px 0px 2px #fb8c00) drop-shadow(0px 0px 2px #fb8c00) drop-shadow(0px 0px 4px #fb8c00)
}

.mdui-dwd-red-glow {
  filter: drop-shadow(0px 0px 2px #e53935) drop-shadow(0px 0px 2px #e53935) drop-shadow(0px 0px 4px #e53935)
}

.mdui-dwd-darkred-glow {
  filter: drop-shadow(0px 0px 2px #880e4f) drop-shadow(0px 0px 2px #880e4f) drop-shadow(0px 0px 4px #880e4f)
}

.mdui-dwd-violet-hitze-glow {
  filter: drop-shadow(0px 0px 2px #c9f) drop-shadow(0px 0px 2px #c9f) drop-shadow(0px 0px 4px #c9f)
}

.mdui-dwd-violet-uv-glow {
  filter: drop-shadow(0px 0px 2px #fe68fe) drop-shadow(0px 0px 2px #fe68fe) drop-shadow(0px 0px 4px #fe68fe)
}
*/
function iconMaterialStyle(dwdcolor){
    dwmlog ("iconMaterialStyle: "+dwdcolor.toString(16),4);
    var result = "mdui-blue-pulse";
    switch (dwdcolor){
        case 0:
            result = "";
            break;
        case 0xc5e566:
            result = "mdui-dwd-green-glow";
            break;
        case 0xffeb3b:
        case 0xffff00:
            result = "mdui-dwd-yellow-glow";
            break;
        case 0xfb8c00:
        case 0xff9900:
            result = "mdui-dwd-orange-glow";
            break;
        case 0xe53935:
        case 0xff0000:
            result = "mdui-dwd-red-glow";
            break;
        case 0x880e4f:
        case 0xAD0063:
            result = "mdui-dwd-darkred-glow";
            break;
        case 0xc9f:
            result = "mdui-dwd-violet-hitze-glow";
            break;
        case 0xfe68fe:
            result = "mdui-dwd-violet-uv-glow";
            break;
        case 0xff8080: // Vorabinformation Unwetter
            result = "mdui-blue-pulse";
            break;
    }
    dwmlog(result,4);
    return result;
}

function processData(data) {
    if (!data) {
       return;
    }
   
    var warnings= warncellids.reduce(function(result, item) {
      result[item] = []; //a, b, c
      return result;
    }, {});
    
    var thedata = null;
    var e = null;
    
    try {
        thedata = JSON.parse(data); 
    } catch (e) {
        dwmlog("ERROR: Not able to parse DWD data: \n"+thedata,1);        
    }

    if (thedata === null) return;

    var theWarn = null;
    var AreaChannelId = null;
    
    
    if (thedata.totalFeatures>0) {
        for (i=0; i<thedata.totalFeatures; i++) {
            theWarn = new processCAP(thedata.features[i].properties);
            warnings[theWarn.warncellid].push(theWarn);
        }
    }
    
    dwmlog (JSON.stringify(warnings),4);
    
    for (var j=0; j<warncellids.length; j++){
        warnings[warncellids[j]].sort(function(a,b){
            var asort = a.urgency*10000+a.category*1000+a.severity*100+a.eventcode; 
            var bsort = b.urgency*10000+b.category*1000+b.severity*100+b.eventcode;
            
            return bsort-asort;
        });

        AreaChannelId=ChannelId+"."+warncellids[j]; 
        for (i=0; i<numOfWarnings; i++) {
            if (i<warnings[warncellids[j]].length) {
                setState(AreaChannelId+".warning."+i+".name",warnings[warncellids[j]][i].name);
                setState(AreaChannelId+".warning."+i+".text",warnings[warncellids[j]][i].text);
                setState(AreaChannelId+".warning."+i+".headline",warnings[warncellids[j]][i].headline);
                setState(AreaChannelId+".warning."+i+".description",warnings[warncellids[j]][i].description);
                setState(AreaChannelId+".warning."+i+".object",warnings[warncellids[j]][i].object);
                setState(AreaChannelId+".warning."+i+".begin",warnings[warncellids[j]][i].begin);
                setState(AreaChannelId+".warning."+i+".end",warnings[warncellids[j]][i].end);
                setState(AreaChannelId+".warning."+i+".severity",warnings[warncellids[j]][i].severity);
                setState(AreaChannelId+".warning."+i+".urgency",warnings[warncellids[j]][i].urgency);
                setState(AreaChannelId+".warning."+i+".category",warnings[warncellids[j]][i].category);
                setState(AreaChannelId+".warning."+i+".eventcode",warnings[warncellids[j]][i].eventcode);
                setState(AreaChannelId+".warning."+i+".color",warnings[warncellids[j]][i].color);
                setState(AreaChannelId+".warning."+i+".mdui-style",iconMaterialStyle(warnings[warncellids[j]][i].color));
                setState(AreaChannelId+".warning."+i+".HTMLlong",warnings[warncellids[j]][i].HTMLlong);
            } else {
                setState(AreaChannelId+".warning."+i+".name","");
                setState(AreaChannelId+".warning."+i+".text","");
                setState(AreaChannelId+".warning."+i+".headline","");
                setState(AreaChannelId+".warning."+i+".description","");
                setState(AreaChannelId+".warning."+i+".object","{}");
                setState(AreaChannelId+".warning."+i+".begin",0);
                setState(AreaChannelId+".warning."+i+".end",0);
                setState(AreaChannelId+".warning."+i+".severity",0);
                setState(AreaChannelId+".warning."+i+".urgency",0);
                setState(AreaChannelId+".warning."+i+".category",0);
                setState(AreaChannelId+".warning."+i+".eventcode",0);
                setState(AreaChannelId+".warning."+i+".color",0);
                setState(AreaChannelId+".warning."+i+".mdui-style","");
				setState(AreaChannelId+".warning."+i+".HTMLlong","");					
            }
        }
    }
}

function requestDWD(){
    var request = require('request');
    request({  
        uri: url,
        method: "GET",
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10
    }, function(error, response, body) {
        dwmlog("DWD Error " + error,4);
        dwmlog("DWD Response: " + JSON.stringify(response),4);
        dwmlog("DWD Body: " + body,4);
        if (error === null) {
            processData(body);    
        }
    });        
}

createStates(numOfWarnings);
// processData(jsond2);
requestDWD();

schedule ("*/3 * * * *", function(){
    requestDWD();
});

subscribe({id: AdapterId+"."+ChannelId+".809175127.warning.0.eventcode", change:"ne"}, function(dp){
    var severity = getState(ChannelId+".809175127.warning.0.severity").val;
    var urgency  = getState(ChannelId+".809175127.warning.0.urgency").val;
    var headline = getState(ChannelId+".809175127.warning.0.headline").val;
    var text = getState(ChannelId+".809175127.warning.0.text").val;
    
    if (urgency == 2 && severity == 3 ) {
        pushEvent("INFO","Unwetterwarnung: "+text);
        sayItTimeTempMessageIntro("Achtung: Unwetterwarnung vor "+headline,"",false,false,false,null,null);
    } else if (urgency == 2 && severity == 4 ) {
        pushEvent("WARNUNG","Extreme Unwetterwarnung: "+text);
        sayItTimeTempMessageIntro("Achtung: Extreme Unwetterwarnung vor "+headline,"",false,false,false,null,null);
    }
});
