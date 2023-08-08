
var https = require('https');

var debuglevel = 3;
var debugchannel = 'info';

var AdapterId = "javascript."+instance;
var AreaChannelId = AdapterId+".open-meteo";

var forceInitStates = false;

var MessageTimeout = [null,null,null];

var ConnectedOpenMeteoId = AreaChannelId+".Connected";

var SystemConfig = getObject("system.config");
var SystemLat = SystemConfig.common.latitude;
var SystemLon = SystemConfig.common.longitude;

var datapoints = {
    latitude: SystemLat,
    longitude: SystemLon,
    timezone: 'Europe/Berlin',

    forecast_days: 7,

    current_weather: true,
    hourly: [
        { variable: "temperature_2m" },
        { variable: "relativehumidity_2m" },
        { variable: "dewpoint_2m" },
        { variable: "apparent_temperature" },
        { variable: "pressure_msl" },
        { variable: "cloudcover" },
        { variable: "windspeed_10m" },
        { variable: "winddirection_10m" },
        { variable: "windgusts_10m" },

        { variable: "shortwave_radiation" },
        { variable: "direct_radiation" },
        { variable: "direct_normal_irradiance" },
        { variable: "diffuse_radiation" },

        { variable: "precipitation" },
        { variable: "snowfall" },
        { variable: "precipitation_probability" },
        { variable: "rain" },
        { variable: "showers" },
        { variable: "weathercode" },
        { variable: "is_day" },
        { variable: "snow_depth" },
        { variable: "soil_moisture_0_1cm" }

    ],
    daily: [
        { variable: "temperature_2m_max" },
        { variable: "temperature_2m_min" },
        { variable: "apparent_temperature_max" },
        { variable: "apparent_temperature_min" },
        { variable: "precipitation_sum" },
        { variable: "rain_sum" },
        { variable: "showers_sum" },
        { variable: "precipitation_hours" },
        // { variable: "precipitation_probability_max" },
        // { variable: "precipitation_probability_min" },
        // { variable: "precipitation_probability_mean" },
        { variable: "windspeed_10m_max" },
        { variable: "windgusts_10m_max" },
        { variable: "winddirection_10m_dominant" },
        { variable: "shortwave_radiation_sum" },
        { variable: "weathercode" }
    ]
}

function buildurl(dp){
    let url = 'https://api.open-meteo.com/v1/forecast';
    url = url + '?timezone='+dp.timezone+'&latitude='+dp.latitude+'&'+'&longitude='+dp.longitude;
    if (dp.current_weather) url = url+'&current_weather=true';

    if (dp.hourly !== undefined && dp.hourly.length>0){
        url=url+'&hourly='
        for (let i=0; i<dp.hourly.length; i++){
            if(i>0) url=url+',';
            url=url+dp.hourly[i].variable;
        }
    }

    if (dp.daily !== undefined && dp.daily.length>0){
        url=url+'&daily='
        for (let i=0; i<dp.daily.length; i++){
            if(i>0) url=url+',';
            url=url+dp.daily[i].variable;
        }
    }

    dwmlog('Open-Meteo - buildurl: '+url,3);
    return url;
}

function createStates(dp,forceInitStates){
    if (forceInitStates === undefined) forceInitStates = false;
    
    createState(ConnectedOpenMeteoId,false,forceInitStates,{type: 'boolean'});
    createState(AreaChannelId+".ShowForecast",0,forceInitStates,{type: 'number'});
}

async function createOrSetState(name,value,forceCreate,spec){
    dwmlog("createOrSetState "+name+" to: "+value,5);
    if (value === undefined ) value = "n/a";
    let state = getState(name);
    if (state.notExist) {
        dwmlog("Variable "+name+" undefined yet",4);
        await createStateAsync(name,value,forceCreate,spec);
    } else {
        if (state.val !== value || state.ack !== true )
            await setStateAsync(name,value,true);
    }
}

function processData(data, isJSON = false) {
    let obj=null;

    if (isJSON == false ){
        try {
            let obj = JSON.parse(data);
        } catch (e) {
            dwmlog ("Invalid JSON",2,'warn');
            // dwmlog ("Data to process: "+data,2);
            setState( ConnectedOpenMeteoId,false );
            return;
        }
    }
    else {
        obj=data;
    }
    
    dwmlog ("Processed OpenMeteo Data successfully",3);
    dwmlog ("OpenMeteo-Data: "+JSON.stringify(obj,null,4),5)
    setState( ConnectedOpenMeteoId,true);

    createOrSetState(AreaChannelId+'.generationtime_ms',obj.generationtime_ms,false,{type: 'number',name:'Open-Meteo server data generation time',unit:"ms"})

    if (obj.current_weather !== undefined){
        createOrSetState(AreaChannelId+'.current_weather.temperature',obj.current_weather.temperature,false,{type: "number",name: "Open-Meteo Current Weather Temperature", unit:"°C"});
        createOrSetState(AreaChannelId+'.current_weather.windspeed',obj.current_weather.windspeed,false,{type: "number",name: "Open-Meteo Current Weather windspeed", unit:"km/h"});
        createOrSetState(AreaChannelId+'.current_weather.windBft',WindKphToBf( obj.current_weather.windspeed ),false,{type: "number",name: "Open-Meteo Current Weather windspeed", unit:"km/h"});
        createOrSetState(AreaChannelId+'.current_weather.winddirection',obj.current_weather.winddirection,false,{type: "number",name: "Open-Meteo Current Weather wind direction",unit:"°"});
        createOrSetState(AreaChannelId+'.current_weather.weathercode',obj.current_weather.weathercode,false,{type: "number",name: "Open-Meteo Current Weather Code"});
        createOrSetState(AreaChannelId+'.current_weather.is_day',obj.current_weather.is_day,false,{type: "number",name: "Open-Meteo Current Weather is daytime"});
        createOrSetState(AreaChannelId+'.current_weather.time',new Date(obj.current_weather.time).toISOString(),false,{type: "string",name: "Open-Meteo Current Weather Time"});
    }

    if (obj.hourly !== undefined){
        dwmlog("In hourly: "+obj.hourly.time.length+" entries",4)
        let currentHour = new Date().getHours();
        for (let h=0; h<obj.hourly.time.length; h++){
            let day = Math.floor(h/24);
            let hour=h % 24;
            // dwmlog("Open-Meteo hourly Day: "+day+" Hour: "+hour+" Time: "+new Date(obj.hourly.time[h]).toISOString(),4);

            createOrSetState(AreaChannelId+'.hourly.'+day+'.'+hour+'.time',new Date(obj.hourly.time[h]).toISOString(),false,{type: "string",name: "Open-Meteo Hourly Time for day "+day+" hour "+hour})
            for (let i=0; i<datapoints.hourly.length; i++){
                let theVar = datapoints.hourly[i].variable;
                let theUnit = obj.hourly_units[theVar];
                createOrSetState(AreaChannelId+'.hourly.'+day+'.'+hour+'.'+theVar,obj.hourly[theVar][h],false,{type: "number",name: 'Open-Meteo Hourly '+theVar+' for day '+day+' hour '+hour, unit: theUnit });

                if (theVar=="weathercode"){
                    let icon = determineWeatherIconOM (obj.hourly[theVar][h],obj.hourly.is_day[h]);
                    dwmlog("Setting weather Icon"+AreaChannelId+'.hourly.'+day+'.'+hour+'.weatherIcon'+' to '+icon,4);
                    createOrSetState(AreaChannelId+'.hourly.'+day+'.'+hour+'.weatherIcon',icon,false,{type: 'string',name: 'Open-Meteo Hourly weather icon for day '+day+' hour '+hour });
                }
            }
            
            if (day == 0 && hour == currentHour){
                createOrSetState(AreaChannelId+'.hourly.now.time',new Date(obj.hourly.time[h]).toISOString(),false,{type: "string",name: "Open-Meteo Hourly Time for day "+day+" hour "+hour})
                for (let i=0; i<datapoints.hourly.length; i++){
                    let theVar = datapoints.hourly[i].variable;
                    let theUnit = obj.hourly_units[theVar];
                    createOrSetState(AreaChannelId+'.hourly.now.'+theVar,obj.hourly[theVar][h],false,{type: "number",name: 'Open-Meteo Hourly '+theVar+' for day '+day+' hour '+hour, unit: theUnit });
                }
            }
        }
    }

    if (obj.daily !== undefined){
        dwmlog("In daily: "+obj.daily.time.length+" entries",4)
        for (let d=0; d<obj.daily.time.length; d++){
            let past_days=0;
            if (datapoints.past_days !== undefined) past_days = datapoints.past_days

            let day = d-past_days;

            // dwmlog("Open-Meteo Day: "+day+" Time: "+new Date(obj.daily.time[d]).toISOString(),4);

            createOrSetState(AreaChannelId+'.daily.'+day+'.time',obj.daily.time[d],false,{type: "string",name: "Open-Meteo Daily Time for day "+day})
            for (let i=0; i<datapoints.daily.length; i++){
                let theVar = datapoints.daily[i].variable;
                let theUnit = obj.daily_units[theVar];
                createOrSetState(AreaChannelId+'.daily.'+day+'.'+theVar,obj.daily[theVar][d],false,{type: "number",name: 'Open-Meteo Daily '+theVar+' for day '+day, unit: theUnit });
                if (theVar=="weathercode"){
                    let icon = determineWeatherIconOM (obj.daily[theVar][d],true);
                    dwmlog("Setting daily weather Icon"+AreaChannelId+'.daily.'+day+'.weatherIcon'+' to '+icon,4);
                    createOrSetState(AreaChannelId+'.daily.'+day+'.weatherIcon',icon,false,{type: 'string',name: 'Open-Meteo daily weather icon for day '+day });
                }                
            }
        }
    }

    setTimeout(createGraphs,10000);
}

let options = {json: true, gzip: true, timeout: 10000 };

function requestOpenMeteo(){
    request(buildurl(datapoints), options, (error,response,body) => {
        if (!error && response.statusCode == 200) {
            // console.log(body);
            processData(body, true);
        }
        else
        {
            dwmlog("Open-Meteo Request Problem: " + error,2,'warn');
        }
    });    
}

function WindKphToBf(w){
    let result = 0;
    if (w<=1) result = 0;
    else if ( w<=5 ) result = 1;
    else if ( w<=11 ) result = 2;
    else if ( w<=19 ) result = 3;
    else if ( w<=28 ) result = 4;
    else if ( w<=38 ) result = 5;
    else if ( w<=49 ) result = 6;
    else if ( w<=61 ) result = 7;
    else if ( w<=74 ) result = 8;
    else if ( w<=88 ) result = 9;
    else if ( w<=102 ) result = 10;
    else if ( w<=117 ) result = 11;
    else result = 12;
    return result
}

function createForecastGraph1(pDay){
    if (pDay < 0 || pDay > datapoints.forecast_days-1) return;

    let result = {};
    result.axisLabels=[];
    result.graphs=[{
            data: [],
            legendText: 'Temperatur (°C)',
            type: 'line',
            color: 'gray',
            displayorder: 0,
            
			tooltip_AppendText: " °C",
			datalabel_backgroundColor: ["#2b9a44", "#2b9a44", "#3aa35b", "#2b9a44", "#2b9a44", "#1d922e", "#1d922e", "#0e8917", "#008000", "#668f00", "#668f00", "#668f00", "#338700", "#008000", "#338700", "#338700", "#668f00", "#338700", "#338700", "#008000", "#008000", "#0e8917", "#1d922e", "#1d922e"],
			datalabel_color: "white",
			datalabel_offset: -10,
			datalabel_fontFamily: "Tahoma",
			datalabel_fontSize: 10,
			datalabel_borderRadius: 6,
			datalabel_show: "auto",

            yAxis_show: false,
			yAxis_gridLines_show: false,
			yAxis_gridLines_ticks_length: 5,
			yAxis_min: 0,
			yAxis_max: 30,
			yAxis_step: 5,
			yAxis_position: "left",
			yAxis_appendix: " °C",
			yAxis_zeroLineWidth: 0.1,
			yAxis_zeroLineColor: "black",

			use_gradient_color: true,
			gradient_color: [{
					value: -20,
					color: "#5b2c6f66"
				}, {
					value: 0,
					color: "#2874a666"
				}, {
					value: 14,
					color: "#73c6b666"
				}, {
					value: 22,
					color: "#00800066"
				}, {
					value: 27,
					color: "#ffa50066"
				}, {
					value: 35,
					color: "#ff000066"
				}
			],
        },{
			data: [],
			type: "line",
			color: "#0d47a1",
			legendText: "Regenwahrscheinlichkeit",
			line_UseFillColor: true,
			line_pointSize: 2,
			line_pointSizeHover: 5,
            // line_steppedLine: true,
			yAxis_min: 0,
			yAxis_max: 100,
			yAxis_maxSteps: 10,
			yAxis_position: "left",
			yAxis_gridLines_show: false,
			yAxis_gridLines_border_show: false,
			yAxis_zeroLineWidth: 0.1,
			yAxis_zeroLineColor: "black",
			yAxis_appendix: " %",
			displayOrder: 1,
			tooltip_AppendText: " %",
			datalabel_show: false
		},{
			data: [],
			type: "bar",
			color: "#6dd600",
			legendText: "Niederschlag",
			yAxis_min: 0,
			yAxis_max: 5,
			yAxis_maxSteps: 10,
			yAxis_position: "right",
			yAxis_gridLines_show: false,
			yAxis_appendix: " mm",
			yAxis_gridLines_border_show: false,
			yAxis_zeroLineWidth: 0.1,
			yAxis_zeroLineColor: "black",
			displayOrder: 2,
			tooltip_AppendText: " mm",
			datalabel_show: false
		}

    ];
    for (let i=0;i<24;i++){
        result.axisLabels.push(i+'h');
        result.graphs[0].data.push(getState(AreaChannelId+'.hourly.'+pDay+'.'+i+'.temperature_2m').val);
        result.graphs[1].data.push(getState(AreaChannelId+'.hourly.'+pDay+'.'+i+'.precipitation_probability').val);
        result.graphs[2].data.push(getState(AreaChannelId+'.hourly.'+pDay+'.'+i+'.precipitation').val);
    }


    createOrSetState(AreaChannelId+'.forecast_graph.'+pDay+'.data',JSON.stringify(result),false,{type: 'string'});
}

function createForecastGraph2(pDay){
    if (pDay < 0 || pDay > datapoints.forecast_days-1) return;

    let result = {};
    result.axisLabels=[];
    result.graphs=[{
			data: [],
			type: "line",
			color: "lightgray",
			legendText: "Bewölkung",
			line_UseFillColor: true,
			line_pointSize: 2,
			line_pointSizeHover: 5,
            // line_steppedLine: true,
			yAxis_min: 0,
			yAxis_max: 100,
			yAxis_maxSteps: 10,
			yAxis_position: "left",
			yAxis_gridLines_show: false,
			yAxis_gridLines_border_show: false,
			yAxis_zeroLineWidth: 0.1,
			yAxis_zeroLineColor: "black",
			yAxis_appendix: " %",
			displayOrder: 1,
			tooltip_AppendText: " %",
			datalabel_show: false
		}
    ];
    for (let i=0;i<24;i++){
        result.axisLabels.push(i+'h');
        result.graphs[0].data.push(getState(AreaChannelId+'.hourly.'+pDay+'.'+i+'.cloudcover').val);
    }

    createOrSetState(AreaChannelId+'.forecast_graph.'+pDay+'.data2',JSON.stringify(result),false,{type: 'string'});
}

function createForecastTableRecord(pDay,dataName,dataLabel){
    let record={};
    for (let i=0;i<24;i++){
        if (dataLabel!==null)
            record['Daten']=dataLabel;
        let datapoint = AreaChannelId+'.hourly.'+pDay+'.'+i+'.'+dataName;
        dwmlog("Getting Datapoint: "+datapoint,4);          
        record[i+'h']=getState(datapoint).val;
    }

    return record;
}

function createForecastTable(pDay){
    if (pDay < 0 || pDay > datapoints.forecast_days-1) return;
    let result=[];
    
    result.push(createForecastTableRecord(pDay,'temperature_2m','°C'));
    createOrSetState(AreaChannelId+'.forecast_graph.'+pDay+'.table',JSON.stringify(result),false,{type: 'string'});
}

function WeekDayString( d ){
    let DaysLong = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
    let DaysShort = ["So","Mo","Di","Mi","Do","Fr","Sa"];
    
    let wd = d.getDay();
    return {long: DaysLong[wd], short: DaysShort[wd]};
}

function createGraphs() {
    for (let i = 0; i<datapoints.forecast_days; i++){
        createForecastGraph1(i);
        createForecastGraph2(i);
        createForecastTable(i);
        // createForecastGraph2(i);
    }
}

/* WMO Weather interpretation codes (WW) https://open-meteo.com/en/docs
Code	Description
0	Clear sky
1, 2, 3	Mainly clear, partly cloudy, and overcast
45, 48	Fog and depositing rime fog
51, 53, 55	Drizzle: Light, moderate, and dense intensity
56, 57	Freezing Drizzle: Light and dense intensity
61, 63, 65	Rain: Slight, moderate and heavy intensity
66, 67	Freezing Rain: Light and heavy intensity
71, 73, 75	Snow fall: Slight, moderate, and heavy intensity
77	Snow grains
80, 81, 82	Rain showers: Slight, moderate, and violent
85, 86	Snow showers slight and heavy
95 *	Thunderstorm: Slight or moderate
96, 99 *	Thunderstorm with slight and heavy hail
*/

function wmoicon(eventcode, isDay=true ){
    var ev = parseInt(eventcode);
    
    var result = null;
    var iconset = [
        {icon: "/icons-mfd-svg/weather_sun.svg", nightIcon: "/icons-mfd-svg/weather_night_starry.svg", eventcodes: [0]},
        {icon: "/icons-mfd-svg/weather_cloudy_light.svg", nightIcon: "/icons-mfd-svg/weather_night_cloudy.svg", eventcodes: [1]},
        {icon: "/icons-mfd-svg/weather_cloudy.svg", nightIcon: "/icons-mfd-svg/weather_night_cloudy.svg", eventcodes: [2]},
        {icon: "/icons-mfd-svg/weather_cloudy_heavy.svg", nightIcon: "/icons-mfd-svg/weather_night_cloudy.svg", eventcodes: [3]},
        {icon: "/icons-mfd-svg/weather_fog.svg", nightIcon: "/icons-mfd-svg/weather_night_fog.svg", eventcodes: [45]},
        {icon: "/icons-mfd-svg/weather_fog_heavy.svg", nightIcon: "/icons-mfd-svg/weather_night_fog.svg", eventcodes: [48]},
        {icon: "/icons-mfd-svg/weather_frost.svg", nightIcon: null, eventcodes: []},
        {icon: "/icons-mfd-svg/weather_rain_light.svg", nightIcon: null, eventcodes: [51,53,55,80]},
        {icon: "/icons-mfd-svg/weather_rain.svg", nightIcon: null, eventcodes: [61,63,81]},
        {icon: "/icons-mfd-svg/weather_rain_heavy.svg", nightIcon: null, eventcodes: [65,82]},
        {icon: "/icons-mfd-svg/weather_sleet.svg", nightIcon: null, eventcodes: [66,67]},
        {icon: "/icons-mfd-svg/weather_snow_light.svg", nightIcon: null, eventcodes: [71]},
        {icon: "/icons-mfd-svg/weather_snow.svg", nightIcon: null, eventcodes: [73]},
        {icon: "/icons-mfd-svg/weather_snow_heavy.svg", nightIcon: null, eventcodes: [75,77]},
        {icon: "/icons-mfd-svg/weather_snow_ice_warning.svg", nightIcon: null, eventcodes: []},
        {icon: "/icons-mfd-svg/weather_storm.svg", nightIcon: null, eventcodes: []},
        {icon: "/icons-mfd-svg/weather_thunderstorm.svg", nightIcon: null, eventcodes: [95,96]},
        {icon: "/icons-mfd-svg/weather_wind.svg", nightIcon: null, eventcodes: []},
        {icon: "/icons-mfd-svg/scene_waterfall.svg", nightIcon: null, eventcodes: []},
    ];
    
    for (var i=0; i<iconset.length; i++) {
        if (iconset[i].eventcodes.indexOf(ev) != -1) {
            if (!isDay && iconset[i].nightIcon !== null)
                result=iconset[i].nightIcon;
            else
                result = iconset[i].icon;    
        }    
    }
    return result;
}

function windIcon(speed,dir){
    
}

// Weather Icon for OpenMeteo
function determineWeatherIconOM ( wmoCode, isDay ) {
    var result = "/icons-mfd-svg/text_question_mark.svg";
        
    return wmoicon(wmoCode, isDay);    
    dwmlog ("OpenMeteo Setzt Wetter-Icon bei wmoCode "+wmoCode+": "+result,4);
}




createStates(datapoints);

requestOpenMeteo();

schedule ("*/5 * * * *", requestOpenMeteo);
