
var debuglevel = 2;
var debugchannel = 'info';

var AdapterId = "javascript."+instance;
var ChannelId = AdapterId+".moon";

var forceInitStates = false;

var SunCalc = require('suncalc');
var Astronomy=require('astronomy-engine');

var SysConfigObj = getObject("system.config");

var MoonLocations=[];

var MoonlightIndex = MoonlightIndexAstro;

MoonLocations.push(new createMoonLocation(SysConfigObj.common.city, SysConfigObj.common.latitude, SysConfigObj.common.longitude,500));
// ========== Add here more locations ===============

function createMoonLocation(name, latitude, longitude, height ){
    this.name=name;
    this.latitude=parseFloat(latitude);
    this.longitude=parseFloat(longitude);
    if (height===undefined){
        this.height=0;
    } else {
        this.height=parseFloat(height);
    }
    this.dpBase=ChannelId+"."+this.name;
}

function MoonlightIndexSuncalc(timeAndDate,latitude,longitude) {
    dwmlog("MoonlightIndex Time: "+timeAndDate.toISOString(),4);
    let MoonIllumination = SunCalc.getMoonIllumination(timeAndDate);
    dwmlog ("Moon Illumination: "+JSON.stringify(MoonIllumination),4);

    let MoonPosition = SunCalc.getMoonPosition(/*Date*/ timeAndDate, /*Number*/ latitude, /*Number*/ longitude)
    dwmlog ("Moon position: "+JSON.stringify(MoonPosition)+" Elevation: "+MoonPosition.altitude*180/Math.PI,4);

    let MoonIndex = 0;

    if (MoonPosition.altitude>0){
        MoonIndex=Math.round(100*Math.sin(MoonPosition.altitude)*MoonIllumination.fraction)/10;
        dwmlog("Calculated Index: "+MoonIndex,4);
    }

    let result={};
    result.MoonIndex=MoonIndex;
    
    result.Position={};
    result.Position.Azimuth=Math.round(MoonPosition.azimuth*1800/Math.PI)/10+180;
    if (result.Position.Azimuth>=360) result.Position.Azimuth=result.Position.Azimuth-360;

    result.Position.Altitude=Math.round(MoonPosition.altitude*1800/Math.PI)/10;

    // result.Illumination=MoonIllumination;
    dwmlog("MoonlightIndex Result (Suncalc): "+JSON.stringify(result),4);

    return result;
}

function MoonPosition(timeAndDate,latitude,longitude,height){
    if (height===undefined) height=0;
    latitude=parseFloat(latitude);
    longitude=parseFloat(longitude);
    timeAndDate=getDateObject(timeAndDate);
    
    const adt = new Astronomy.MakeTime(timeAndDate);
    // dwmlog("MoonlightIndex AstroTime: "+JSON.stringify(adt),4);

    const observer = new Astronomy.Observer(latitude, longitude, height);    
    let equ_ofdate = Astronomy.Equator('Moon', adt, observer, true, true);

    let MoonPosition = Astronomy.Horizon(adt, observer, equ_ofdate.ra, equ_ofdate.dec, 'normal');

    let result={};
    
    result.Position={};
    result.Position.Azimuth=Math.round(MoonPosition.azimuth*10)/10.0;
    result.Position.Altitude=Math.round(MoonPosition.altitude*10)/10.0;
    dwmlog("MoonPosition Result: "+JSON.stringify(result),4);

    return result;
}

function MoonlightIndexAstro(timeAndDate,latitude,longitude,height) {
    if (height===undefined) height=0;
    latitude=parseFloat(latitude);
    longitude=parseFloat(longitude);
    timeAndDate=getDateObject(timeAndDate);

    const adt = new Astronomy.MakeTime(timeAndDate);
    // dwmlog("MoonlightIndex AstroTime: "+JSON.stringify(adt),4);

    let result = MoonPosition( timeAndDate, latitude, longitude, height);

    let MoonIllumination = Astronomy.Illumination('Moon',adt);
    // dwmlog ("Moon Illumination: "+JSON.stringify(MoonIllumination),4);

    let MoonIndex = 0;

    if (result.Position.Altitude>0){
        MoonIndex=Math.round(100*Math.sin(result.Position.Altitude*Math.PI/180)*MoonIllumination.phase_fraction)/10;
        // dwmlog("Calculated Index: "+MoonIndex,4);
    }

    result.MoonIndex=MoonIndex;
        
    // result.Illumination=MoonIllumination;
    dwmlog("MoonlightIndex Result: "+JSON.stringify(result),4);
    return result;
}

function MoonDaySuncalc(date,latitude,longitude){
    
    let duration=14; // hours

    let theDate = new Date(date);
    theDate.setHours(17);
    theDate.setMinutes(0);
    theDate.setSeconds(0);

    let result = {};

    result.day=date.toLocaleDateString();
    let MoonTimes=SunCalc.getMoonTimes(date,latitude,longitude);
    dwmlog("MoonDay: Moon Times for "+result.day+" => "+JSON.stringify(MoonTimes),4);
    result.rise=MoonTimes.rise;
    if (MoonTimes.rise.getTime()>MoonTimes.set.getTime()){
        let MoonTimesNext = SunCalc.getMoonTimes(new Date(date.getTime()+86400000),latitude,longitude);
        dwmlog("MoonDay: Moon Times for next day => "+JSON.stringify(MoonTimesNext),4);
        result.set=MoonTimesNext.set;
    } else {
        result.set=MoonTimes.set;
    }

    result.hours={};
    
    for (let i=0; i<=duration; i++){
        let calcDate=new Date(theDate);
        if (i!=0){
            calcDate=new Date(theDate.getTime()+i*3600000);
        }

        dwmlog("MoonDay calculation time: "+getTimeAsStr(calcDate),4);

        result.hours[getTimeAsStr(calcDate)]=MoonlightIndexSuncalc(calcDate,latitude,longitude);
    }

    dwmlog("MoonDay Result: "+JSON.stringify(result),4);

    return result;
}

function MoonDayAstro(date,latitude,longitude,height ){
    if (height===undefined) height=0;
    latitude=parseFloat(latitude);
    longitude=parseFloat(longitude);

    let duration=14; // hours

    let theDate = new Date(date);
    theDate.setHours(17);
    theDate.setMinutes(0);
    theDate.setSeconds(0);

    let result = {};

    result.day=date.toISOString();

    const observer = new Astronomy.Observer(latitude, longitude, height);    
    dwmlog("MoonDayAstro: Observer: "+JSON.stringify(observer),5);


    let riseSetTime=new Date(date);
    riseSetTime.setHours(0);
    riseSetTime.setMinutes(0);
    riseSetTime.setSeconds(0);

    dwmlog("Rise date: "+riseSetTime.toISOString(),5);

    let MoonRise = Astronomy.SearchRiseSet(Astronomy.Body.Moon,observer,1,getDateObject(riseSetTime),1)
    dwmlog ("MoonDayAstro - MoonRise: "+JSON.stringify(MoonRise)+ " for "+JSON.stringify(getDateObject(riseSetTime)),3);

    if (MoonRise == null) {
        dwmlog ("MoonRise: "+JSON.stringify(MoonRise)+ " for "+JSON.stringify(getDateObject(riseSetTime)),2,'warn');
        result.MoonRise = null;
        // riseSetTime = new Date(MoonRise.date);
        // return null;
    } else {
        riseSetTime = MoonRise.date;
        result.MoonRise={};
        result.MoonRise.Time=MoonRise.date.toISOString();
    }
    

    let MoonSet = Astronomy.SearchRiseSet(Astronomy.Body.Moon,observer,-1,getDateObject(riseSetTime),1)
    result.MoonSet={};
    result.MoonSet.Time=MoonSet.date.toISOString();

    result.hours={};
    
    for (let i=0; i<=duration; i++){
        let calcDate=new Date(theDate);
        if (i!=0){
            calcDate=new Date(theDate.getTime()+i*3600000);
        }

        dwmlog("MoonDay calculation time: "+getTimeAsStr(calcDate),4);

        result.hours[getTimeAsStr(calcDate)]=MoonlightIndexAstro(calcDate,latitude,longitude);
    }

    dwmlog("MoonDay Result: "+JSON.stringify(result),3);

    return result;
}

var dirstrng=['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];


function calcCompassDir( a ){
    // Richtung   
    // ... wird bestimmt über die gesamte Kompassrose
    // mit 0 = Nord in 2-Strich Intervallen
    // die entsprechende Richtung ist die MITTE des Segments

    let _position=null;
    
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

    return { index: _position, str: dirstrng[_position]};  
}

/**
 * 
    --bgBody: #41464D;
    --DarkYellow: #EBBA31; 
    --DarkRed: #990000; 
    --Blue: #0D6EFD; 
    --colBackDark: #272a2d; 
    --colBackGray: #484848; 
    --colBackLGray: #E0E0E0; 
    --colFontBright: #F8F8F8; 
    --colFontDark: #272a2d; 
    --colLabeling: #fff5e6; 
    --colSunday: #484848; 
    --colAlternate: #333333; 
    --colDateTimeWeekend: #ffa500;
    --colLightBlue: #0D6EFD; 
    --colWhite: #FFFFFF;

    --colSunBL: #fff7cc;
    --colSunAU: #ffd700;

    --colToday: #a6001a;
    --colMidnight: #fff7cc;
    --colNight: #24415b;
    --colMoonMP: #ffffff;
    --colMoonAU: #a3c1db;
    --COL_MOON_STAGE1: #325c81;
    --COL_MOON_STAGE2: #5a90bf;
    --COL_MOON_STAGE3: #a3c1db;
    --COL_MOON_STAGE4: #edf3f8;
    --COL_MOON_FONT1: #E0E0E0;
    --COL_MOON_FONT2: #E0E0E0;
    --COL_MOON_FONT3: #272A2D;
    --COL_MOON_FONT4: #272A2D;
}
 
 */

function calcMoonHTMLTableLine( MoonResult ){
    if (MoonResult==null) {
        dwmlog("MoonResult invalid!",2,'warn');
        return ('<tr><tr/>');
    }
    
    let result = '<tr>'
    result += '<td style="background-color: #fff5e6; text-align: center; border:solid 1px #050505; color: #272a2d;">';
    result += formatDate(MoonResult.day,"W, T.M.")
    result += '</td>';

    Object.keys(MoonResult['hours']).forEach(function(h){
        let bgCol = '#24415b';
        let cellCol = '#E0E0E0';

        if (MoonResult['hours'][h]['MoonIndex'] > 7.5)
        {
            bgCol = '#edf3f8';

        }
        else if (MoonResult['hours'][h]['MoonIndex'] > 5.0){
            bgCol = '#a3c1db'

        }
        else if (MoonResult['hours'][h]['MoonIndex'] > 3.5){
            bgCol = '#5a90bf'

        }
        else if (MoonResult['hours'][h]['MoonIndex'] > 0 ){
            bgCol = '#325c81'

        }

        let theStyle = 'background-color: '+bgCol+'; text-align: center; border:solid 1px #050505; color: '+cellCol+'; ';
            theStyle += 'padding: 3px 3px 1px 2px;';

        // dwmlog('hour: '+h+" Index: "+MoonResult['hours'][h]['MoonIndex']);
        result = result + '<td style="' + theStyle + '">'+MoonResult['hours'][h]['MoonIndex']+'</td>';
    });
    result += '</tr>';

    return result;
}

function calcMoonHTML( MoonResults ){
    let result = '<table style="line-height:150%; font-size:0.7rem; width:100%; border-collapse: collapse;">';

    // dwmlog(JSON.stringify(MoonResult['hours']),3);

    result += '<tr><td style="background-color: #fff5e6; text-align: center; border:solid 1px #050505; color: #272a2d;"></td>';

    Object.keys(MoonResults[0]['hours']).forEach(function(h){            
        let theStyle = 'background-color: #fff5e6; text-align: center; border:solid 1px #050505; color: #272a2d; ';

        // dwmlog('hour: '+h+" Index: "+MoonResult['hours'][h]['MoonIndex']);
        result = result + '<td style="' + theStyle + '">'+h+'</td>';
    });

    result += '</tr>\n';

    for (let i=0; i<MoonResults.length; i++){
        result += calcMoonHTMLTableLine( MoonResults[i]);
    }

    result += '</table>';
    dwmlog ("calcMoonHTML Result: "+result,5);
    return result;
}

function calcMoonContinousSingle( dpPath, latitude, longitude, height ){
    let date = new Date();

    let MoonData=MoonlightIndexAstro( date, latitude, longitude, height );

    setState(dpPath+'.Position.Azimuth',MoonData.Position.Azimuth,true);
    setState(dpPath+'.Position.Altitude',MoonData.Position.Altitude,true);
    setState(dpPath+'.Position.CompassDir',calcCompassDir( MoonData.Position.Azimuth ).index,true);

    calcMoonPhaseData ( dpPath );
}

function calcMoonContinous(){
    MoonLocations.forEach(function(loc){
        calcMoonContinousSingle( loc.dpBase, loc.latitude, loc.longitude, loc.height );
    });    
}

function MoonPhaseText( phase ){
    let txt='';
    
    if (phase>=0 && phase<22.5)         txt = 'Neumond';
    if (phase>=22.5 && phase<67.5)      txt = '1/4 Mond (zunehmend)';
    if (phase>=67.5 && phase<112.5)     txt = 'Halbmond (zunehmend)';
    if (phase>=112.5 && phase<157.5)    txt = '3/4 Mond (zunehmend)';
    if (phase>=157.5 && phase<202.5)    txt = 'Vollmond';
    if (phase>=202.5 && phase<247.5)    txt = '3/4 Mond (abnehmend)';
    if (phase>=247.5 && phase<292.5)    txt = 'Halbmond (abnehmend)';
    if (phase>=292.5 && phase<337.5)    txt = '1/4 Mond (abnehmend)';
    if (phase>=337.5 && phase<=360)     txt = 'Neumond';

    return txt;    
}

function calcMoonPhaseData(dpPath){
    let now=new Date();

    const phase = Astronomy.MoonPhase(getDateObject(now));
    dwmlog("Mond Phasenwinkel für "+now.toISOString()+": "+phase.toFixed(6),4);      
    setState( dpPath+".Phase.Aktuell",MoonPhaseText(phase),true);
    setState( dpPath+".Phase.Winkel",Math.round(phase*10)/10,true);
}

function calcMoonDailySingle(dpPath, latitude, longitude, height ){
    
    const observer = new Astronomy.Observer(latitude, longitude, height); 

    let riseSetTime=new Date();
    riseSetTime.setHours(0);
    riseSetTime.setMinutes(0);
    riseSetTime.setSeconds(0);


    let MoonRise = Astronomy.SearchRiseSet('Moon',observer,1,getDateObject(riseSetTime),1)
    let MoonSet =  Astronomy.SearchRiseSet('Moon',observer,-1,getDateObject(riseSetTime),1)

    setState( dpPath+".Tag.Aufgang",getTimeAsStr( MoonRise.date ),true);
    setState( dpPath+".Tag.Untergang",getTimeAsStr( MoonSet.date ),true);

    /*
    let date = new Date();

    dwmlog('The next 10 lunar quarters are:',3);
    const QuarterName = ['New Moon', 'First Quarter', 'Full Moon', 'Third Quarter'];
    let mq;
    for (let i=0; i < 10; ++i) {
        if (mq === undefined) {
            // The first time around the for loop, we search forward
            // from the current date and time to find the next quarter
            // phase, whatever it might be.
            dwmlog("First quarter before",3);
            mq = Astronomy.SearchMoonQuarter(date);
            dwmlog("First quarter after",3);
        } else {
            // Use the previous moon quarter information to find the next quarter phase event.
            dwmlog("Next quarter",3);
            mq = Astronomy.NextMoonQuarter(mq);
        }
        // console.log(`${FormatDate(mq.time.date)} : ${QuarterName[mq.quarter]}`);
    }
    dwmlog("Huhu 2",3);
    */
}

function calcMoon30DaysTable( dpPath, latitude, longitude, height){
    let today = new Date();
    today.setHours(12);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);

    let daysBefore = 0;
    let daysAfter = 30;
    
    let first = new Date( today.getTime()-daysBefore*86400000);
    let last  = new Date( today.getTime()+daysAfter*86400000); 

    let mp = calcMoonPeriod(first,last,latitude, longitude, height);
    setState(dpPath+'.Illumination.30DaysTable',JSON.stringify(mp));
}

function calcMoonMonth( dpPath, latitude, longitude, height ){
    let first = new Date();
    first.setHours(12);
    first.setMinutes(0);
    first.setSeconds(0);
    first.setMilliseconds(0);

    first.setDate(1);

    let last = new Date(first.getFullYear(), first.getMonth() +1, 0);
    last.setHours(13);
    
    dwmlog ("Moon month start: "+first.toISOString(),5);
    dwmlog ("Moon month end: "+last.toISOString(),5);

    let mp = calcMoonPeriod(first,last,latitude, longitude, height);
    setState(dpPath+'.HTML.MonthTable',calcMoonHTML( mp ));
}

function calcMoonFloatingTable(daysBefore, daysAfter, dpPath, latitude, longitude, height){
    let today = new Date();
    today.setHours(12);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);
    
    let first = new Date( today.getTime()-daysBefore*86400000);
    let last  = new Date( today.getTime()+daysAfter*86400000);

    dwmlog ("Moon floating table start: "+first.toISOString(),4);
    dwmlog ("Moon floating end: "+last.toISOString(),4);    

    let mp = calcMoonPeriod(first,last,latitude, longitude, height);
    dwmlog("calcMoonFloatingTable: Moon Period object "+JSON.stringify(mp),5);
    setState(dpPath+'.HTML.FloatingTable',calcMoonHTML( mp ));
}

function calcMoonPeriod( start, end, latitude, longitude, height ){
    let MoonPeriodTable = [];

    let theDate = new Date(start);
    let endDate = new Date(end);

    let aa=theDate.getTime();
    let bb=endDate.getTime();

    let count = 0;

    while (aa<bb) {
        let theDate = new Date(aa);

        // dwmlog ("Moon month current: "+theDate.toISOString(),3);

        MoonPeriodTable.push(MoonDayAstro(theDate, latitude, longitude, height ));
        count++;
        aa+=86400000;
        if (count>100) break;
    }

    dwmlog("Calculated Moon Period: "+JSON.stringify(MoonPeriodTable),5);

    return MoonPeriodTable;

    // setState(dpPath,calcMoonHTML( MoonPeriodTable ));
}

function calcMoonDaily(){
    dwmlog("calcMoonDaily for locations: "+JSON.stringify(MoonLocations),2);
    MoonLocations.forEach(function(loc){
        dwmlog("calcMoonDaily for "+JSON.stringify(loc),3);
        calcMoonDailySingle( loc.dpBase, loc.latitude, loc.longitude, loc.height );
        calcMoonMonth(loc.dpBase, loc.latitude, loc.longitude, loc.height );
        calcMoonFloatingTable( 2, 12, loc.dpBase, loc.latitude, loc.longitude, loc.height );
        calcMoon30DaysTable(loc.dpBase, loc.latitude, loc.longitude, loc.height );
    });
}

function createStatesArr(){
    var MondStates=[];
    
    MoonLocations.forEach( function(loc, i, arr){
        MondStates.push( [ loc.dpBase+".Tag.Aufgang",{ name:'Mondaufgang', type:'string', read:true, write:false, role:'info', def:'' } ] );
        MondStates.push( [ loc.dpBase+'.Tag.Untergang', { name:'Monduntergang', type:'string', read:true, write:false, role:'info', def:''}] );
        MondStates.push( [ loc.dpBase+'.Phase.Aktuell', { name:'Mondphase (Text)', type:'string', read:true, write:false, role:'info', def:''}] );
        MondStates.push( [ loc.dpBase+'.Phase.Winkel', { name:'Mondphase (Phasenwinkel, 0=Neumond)', type:'number', read:true, write:false, role:'info', def:0}] );
        MondStates.push( [ loc.dpBase+'.Position.Azimuth', { name:'Mond Azimuth (Himmelsrichtung)', type:'number', unit: '°',read:true, write:false, role:'info', def:0 }] );
        MondStates.push( [ loc.dpBase+'.Position.Altitude', { name:'Mond Altitude (Höhe über Horizont)', type:'number', unit: '°', read:true, write:false, role:'info', def:0 }] );
        MondStates.push( [ loc.dpBase+'.Position.CompassDir',{ name:'Mond Kompassrichtung', type: 'number', min: 0, max: dirstrng.length-1, states: dirstrng, read: true, write: false, role: 'info', def: 0 }] );
        MondStates.push( [ loc.dpBase+'.Illumination.30DaysTable',{ name:'30 Tage Tabelle Illumination', type: 'string', read: true, role: 'info', def: '[]' }] );
        MondStates.push( [ loc.dpBase+'.HTML.MonthTable',{ name:'Monatstabelle Illumination', type: 'string', read: true, role: 'info', def: '' }] );
        MondStates.push( [ loc.dpBase+'.HTML.FloatingTable',{ name:'Tabelle Illumination', type: 'string', read: true, role: 'info', def: '' }] );
    });

    dwmlog("createStatesArr: "+JSON.stringify(MondStates),4);
    return MondStates;
}

createUserStates(AdapterId, false, createStatesArr(), function(){
    calcMoonDaily();
    calcMoonContinous();
});

schedule("1 0 * * *",calcMoonDaily);
schedule("* * * * *",calcMoonContinous);
