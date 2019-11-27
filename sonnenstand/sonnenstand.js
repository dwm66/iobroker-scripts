/* System Sonnenstand

Sonne Azimut und Elevation in Variablen schreiben

erstellt: 06.07.2015 nach ioBroker Forum http://forum.iobroker.net/viewtopic.php?f=21&amp;t=975&amp;sid=6f0ba055de5f82eed6809424f49ca93b#p7635
*/

var debuglevel = 1;
var debugchannel = 'info';

var suncalc = require('suncalc');

var result = getObject("system.config");
var lat = result.common.latitude;
var lon = result.common.longitude;
    
dwmlog (lat+" "+lon,3);

createState('Sonnenstand.Elevation', 0, {unit: '°'});
createState('Sonnenstand.Azimut', 0, {unit: '°'});

createState( 'Sonnenstand.Tagesabschnitt',                          // name
             0,                                                     // initial value
             // true,
             { min: 0, max: 9, type: 'number', states: ['n/a','Nacht','Frühmorgens','Morgendämmerung','Morgen','Vormittag','Nachmittag','Spätnachmittag','Abenddämmerung','Abend']
		     }
                // callback
           );

createState( 'Sonnenstand.Richtung',                          // name
             0,                                               // initial value
             // true,
             { min: 0, max: 15, type: 'number', 
				 states: ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW']
			 },
             function() { log('created Richtung','info'); }   // callback
           );

createState( 'Sonnenstand.Morgendaemmerung', 0, {type: 'string'});
createState( 'Sonnenstand.Sonnenaufgang', 0, {type: 'string'});
createState( 'Sonnenstand.Sonnenuntergang', 0, {type: 'string'});
createState( 'Sonnenstand.Abenddaemmerung', 0, {type: 'string'});
createState( 'Sonnenstand.Höchststand', 0, {type: 'string'});

function Sonnenstand_berechnen () {
    var now = new Date();
    var day_night_ext = 0;
    var _position = 0;

        
    // log("latitude : " + result.native.latitude,'debug');
    // log("longitude: " + result.native.longitude,'debug');

    var sunpos = suncalc.getPosition(now, lat, lon);
    // log("sunpos: " + sunpos,'debug');

    var h = sunpos.altitude * 180 / Math.PI,
        a = sunpos.azimuth * 180 / Math.PI + 180;


    setState("javascript.0.Sonnenstand.Elevation",h.toFixed(1));
    setState("javascript.0.Sonnenstand.Azimut",a.toFixed());
    
    var _now = getTimeAsStr ( now );
    var times = suncalc.getTimes ( now, lat, lon);

    if (_now < getTimeAsStr ( times.nauticalDawn ) ) {
        day_night_ext = 1; // Nacht - die Zeit vor der Nautischen Daemmerung
    } else if (_now < getTimeAsStr ( times.dawn )) {
        day_night_ext = 2; // Fruehmorgens - zwischen nautischer und buergerlicher Daemmerung
    } else if (_now < getTimeAsStr ( times.sunrise )) {
        day_night_ext = 3; // Morgendaemmerung - die blaue Stunde
    } else if (_now < getTimeAsStr ( times.goldenHourEnd )) {
        day_night_ext = 4; // Morgen - die goldene Stunde
    } else if (_now < getTimeAsStr ( times.solarNoon )) {
        day_night_ext = 5; // Vormittags - die Zeit bis zum Sonnenhoechststand
    } else if (_now < getTimeAsStr ( times.goldenHour )) {
        day_night_ext = 6; // Nachmittags - die Zeit bis zur goldenen Stunde
    } else if (_now < getTimeAsStr ( times.sunset )) {
        day_night_ext = 7; // Spaetnachmittag - die Zeit der goldenen Stunde bis Sonnenuntergang
    } else if (_now < getTimeAsStr ( times.dusk )) {
        day_night_ext = 8; // Daemmerung - die buergerliche Abenddaemmerung - blaue Stunde
    } else if (_now < getTimeAsStr ( times.nauticalDusk )) {
        day_night_ext = 9; // Abend - die nautische Daemmerung
    } else {
        day_night_ext = 1;
    }
    
    // Richtung   
    // ... wird bestimmt über die gesamte Kompassrose
    // mit 0 = Nord in 2-Strich Intervallen
    // die entsprechende Richtung ist die MITTE des Segments
    
    if (a > 348.25 && a < 360) {
        _position = 0; // zwischen NzW und N - also N
    }
    else if (a >= 0 && a < 11.25) {
        _position = 0; // zwischen N und NzO - also N
    }
    else if (a >= 11.25 && a < 33.75) {
        _position = 1; // NNO
    }
    else if (a >= 33.75 && a < 56.25) {
        _position = 2; // NO
    }
    else if (a >= 56.25 && a < 78.75) {
        _position = 3;  // ONO
    }
    else if (a >= 78.75 && a < 101.25) {
        _position = 4;  // O
    }
    else if (a >= 101.25 && a < 123.75) {
        _position = 5;  // OSO
    }
    else if (a >= 123.75 && a < 146.25) {
        _position = 6;  // SO
    }
    else if (a >= 146.25 && a < 168.75) {
        _position = 7;  // SSO
    }
    else if (a >= 168.75 && a < 191.25) {
        _position = 8;  // S
    }
    else if (a >= 191.25 && a < 213.75) {
        _position = 9; // SSW
    }
    else if (a >= 213.75 && a < 236.25) {
        _position = 10; // SW
    }
    else if (a >= 236.25 && a < 258.75) {
        _position = 11; // WSW
    }
    else if (a >= 258.75 && a < 281.25) {
        _position = 12; // W
    }
    else if (a >= 281.25 && a < 303.75) {
        _position = 13; // WNW
    }
    else if (a >= 303.75 && a < 326.25) {
        _position = 14; // NW
    }
    else if (a >= 326.25 && a < 348.75) {
        _position = 15; // NNW
    }
     
    setState('Sonnenstand.Tagesabschnitt',day_night_ext);
    setState('Sonnenstand.Morgendaemmerung',getTimeAsStr(times.dawn));    
    setState('Sonnenstand.Sonnenaufgang',   getTimeAsStr(times.sunrise));    
    setState('Sonnenstand.Sonnenuntergang',getTimeAsStr(times.sunset));    
    setState('Sonnenstand.Abenddaemmerung',getTimeAsStr(times.dusk));    
    setState('Sonnenstand.Höchststand',getTimeAsStr(times.solarNoon));
    setState('Sonnenstand.Richtung',_position);   
}

schedule("*/1 * * * *", Sonnenstand_berechnen);
Sonnenstand_berechnen(); // bei Scriptstart
