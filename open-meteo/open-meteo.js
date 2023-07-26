
var https = require('https');

var debuglevel = 4;
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
        { variable: "diffuse_radiation" },

        { variable: "precipitation" },
        { variable: "snowfall" },
        { variable: "precipitation_probability" },
        { variable: "rain" },
        { variable: "showers" },
        { variable: "weathercode" },
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
        { variable: "precipitation_probability_max" },
        { variable: "precipitation_probability_min" },
        { variable: "precipitation_probability_mean" },
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

    dwmlog('Open-Meteo - buildurl: '+url);
    return url;
}

function createStates(dp,forceInitStates){
    if (forceInitStates === undefined) forceInitStates = false;
    
    createState(ConnectedOpenMeteoId,false,forceInitStates,{type: 'boolean'});
}

function createOrSetState(name,value,forceCreate,spec){
    dwmlog("createOrSetState "+name+" to: "+value,5);
    if (value === undefined ) value = "n/a";
    let state = getState(name);
    if (state.notExist) {
        dwmlog("Variable "+name+" undefined yet",4);
        createState(name,value,forceCreate,spec);
    } else {
        if (state.val !== value || state.ack !== true )
            setState(name,value,true);
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
        createOrSetState(AreaChannelId+'.current_weather.winddirection',obj.current_weather.winddirection,false,{type: "number",name: "Open-Meteo Current Weather wind direction",unit:"°"});
        createOrSetState(AreaChannelId+'.current_weather.weathercode',obj.current_weather.weathercode,false,{type: "number",name: "Open-Meteo Current Weather Code"});
        createOrSetState(AreaChannelId+'.current_weather.is_day',obj.current_weather.is_day,false,{type: "number",name: "Open-Meteo Current Weather is daytime"});
        createOrSetState(AreaChannelId+'.current_weather.time',new Date(obj.current_weather.time).toISOString(),false,{type: "string",name: "Open-Meteo Current Weather Time"});
    }

    if (obj.hourly !== undefined){
        dwmlog("In hourly: "+obj.hourly.time.length+" entries",4)
        for (let h=0; h<obj.hourly.time.length; h++){
            let day = Math.floor(h/24);
            let hour=h % 24;
            // dwmlog("Open-Meteo hourly Day: "+day+" Hour: "+hour+" Time: "+new Date(obj.hourly.time[h]).toISOString(),4);

            createOrSetState(AreaChannelId+'.hourly.'+day+'.'+hour+'.time',new Date(obj.hourly.time[h]).toISOString(),false,{type: "string",name: "Open-Meteo Hourly Time for day "+day+" hour "+hour})
            for (let i=0; i<datapoints.hourly.length; i++){
                let theVar = datapoints.hourly[i].variable;
                let theUnit = obj.hourly_units[theVar];
                createOrSetState(AreaChannelId+'.hourly.'+day+'.'+hour+'.'+theVar,obj.hourly[theVar][h],false,{type: "number",name: 'Open-Meteo Hourly '+theVar+' for day '+day+' hour '+hour, unit: theUnit });
            }
        }
    }

    if (obj.daily !== undefined){
        dwmlog("In daily: "+obj.daily.time.length+" entries",4)
        for (let d=0; d<obj.daily.time.length; d++){
            let past_days=0;
            if (datapoints.past_days !== undefined) past_days = datapoints.past_days

            let day = d-past_days;

            dwmlog("Open-Meteo Day: "+day+" Time: "+new Date(obj.daily.time[d]).toISOString(),4);

            createOrSetState(AreaChannelId+'.daily.'+day+'.time',obj.daily.time[d],false,{type: "string",name: "Open-Meteo Daily Time for day "+day})
            for (let i=0; i<datapoints.daily.length; i++){
                let theVar = datapoints.daily[i].variable;
                let theUnit = obj.daily_units[theVar];
                createOrSetState(AreaChannelId+'.daily.'+day+'.'+theVar,obj.daily[theVar][d],false,{type: "number",name: 'Open-Meteo Daily '+theVar+' for day '+day, unit: theUnit });
            }
        }
    }

    // dwmlog (JSON.stringify(CAPdata),4);
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

function createSubscribes(){

}

createStates(datapoints);
createSubscribes();

requestOpenMeteo();

schedule ("*/5 * * * *", requestOpenMeteo);


