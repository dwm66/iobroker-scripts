/*
Calculates a forecast for solar power plant(s) based on the open-meteo weather report.
Special thanks to woheller69, whose solxpect app for Android provided the basic algorithm.
see https://github.com/woheller69/solxpect

The open-meteo script must be running to provide data for this forecast, with AT LEAST 
providing     direct_normal_irradiance, diffuse_radiation, shortwave_radiation, time and temperature_2m
*/

var SunCalc = require('suncalc');

var debuglevel = 4;
var debugchannel = 'info';

var AdapterId = "javascript."+instance;
var AreaChannelId = AdapterId+".SolarForecast";

var SystemConfig = getObject("system.config");
var SystemLat = SystemConfig.common.latitude;
var SystemLon = SystemConfig.common.longitude;

var forceInitStates = false;

var SolarPowerPlants = [];
var OpenMeteoBaseId  = 'javascript.0.open-meteo'; // .hourly.0.0.time'

var SolarDebugHour = null;

function createOrSetState(name,value,forceCreate,spec){
    dwmlog("createOrSetState "+name+" to: "+value,5);
    if (value === undefined ) value = "n/a";
    let state = getState(name);
    if (state.notExist) {
        dwmlog("Variable "+name+" undefined yet",5);
        createState(name,value,forceCreate,spec);
    } else {
        if (state.val !== value || state.ack !== true )
            setState(name,value,true);
    }
}

// Special thanks to wohellers69 implementation of solar power plant:
// https://github.com/woheller69/solxpect/blob/main/app/src/main/java/org/woheller69/weather/SolarPowerPlant.java
// This is a direct port to JavaScript.
class SolarPowerPlant {
    constructor(name, latitude, longitude, cellsMaxPower, cellsArea, cellsEfficiency, cellsTempCoeff, diffuseEfficiency, inverterPowerLimit, inverterEfficiency, azimuthAngle, tiltAngle, shadingElevation, shadingOpacity, albedo) {
        this.name = name;
        this.albedo = albedo;
        this.latitude = latitude;
        this.longitude = longitude;
        this.cellsMaxPower = cellsMaxPower;
        this.cellsArea = cellsArea;
        this.cellsEfficiency = cellsEfficiency / 100;
        this.diffuseEfficiency = diffuseEfficiency / 100;
        this.inverterPowerLimit = inverterPowerLimit;
        this.inverterEfficiency = inverterEfficiency / 100;
        this.azimuthAngle = azimuthAngle;
        this.tiltAngle = tiltAngle;
        this.shadingElevation = shadingElevation;
        this.shadingOpacity = shadingOpacity;
        this.cellsTempCoeff = cellsTempCoeff / 100;
    }

    getPower(solarPowerNormal, solarPowerDiffuse, shortwaveRadiation, epochDate, ambientTemperature) {
        const sunPosition = SunCalc.getPosition(epochDate, this.latitude, this.longitude);

        const solarAzimuth = sunPosition.azimuth+Math.PI;
        const solarElevation = sunPosition.altitude;

        dwmlog("SolarForecast - sun position at "+epochDate.toISOString()+": Azimuth "+solarAzimuth*180/Math.PI+", Elevation: "+solarElevation*180/Math.PI,4);

        const directionSun = [
            Math.sin(solarAzimuth) * Math.cos(solarElevation),
            Math.cos(solarAzimuth) * Math.cos(solarElevation),
            Math.sin(solarElevation),        
        ];

        dwmlog("SolarForecast - sun vector "+JSON.stringify(directionSun),4);

        const normalPanel = [
            Math.sin((this.azimuthAngle / 180) * Math.PI) * Math.cos(((90 - this.tiltAngle) / 180) * Math.PI),
            Math.cos((this.azimuthAngle / 180) * Math.PI) * Math.cos(((90 - this.tiltAngle) / 180) * Math.PI),
            Math.sin(((90 - this.tiltAngle) / 180) * Math.PI),
        ];

        dwmlog("SolarForecast - panel vector "+JSON.stringify(normalPanel),4);

        let efficiency = 0;
        if (solarPowerNormal > 0) {
            for (let j = 0; j < directionSun.length; j++) {
                efficiency += directionSun[j] * normalPanel[j];
            }

            efficiency = Math.max(0, efficiency);

            if (efficiency > 0) {
                const shadingIndex = ((((Math.round((solarAzimuth + 5) / 10)) - 1) % 36 + 36) % 36);
                if (this.shadingElevation[shadingIndex] > solarElevation) {
                    efficiency *= (100 - this.shadingOpacity[shadingIndex]) / 100;
                }
            }
        }

        dwmlog("Solar forecast: Direct efficiency: "+efficiency,4);

        const totalRadiationOnCell = solarPowerNormal * efficiency + solarPowerDiffuse * this.diffuseEfficiency + shortwaveRadiation * (0.5 - 0.5 * Math.cos((this.tiltAngle / 180) * Math.PI)) * this.albedo;
        const cellTemperature = this.calcCellTemperature(ambientTemperature, totalRadiationOnCell);
        let dcPower;
        if (this.cellsEfficiency !== 0 && this.cellsArea !== 0) {
            dcPower = totalRadiationOnCell * (1 + (cellTemperature - 25) * this.cellsTempCoeff) * this.cellsEfficiency * this.cellsArea;
        } else {
            dcPower = (totalRadiationOnCell / 1000) * (1 + (cellTemperature - 25) * this.cellsTempCoeff) * this.cellsMaxPower;
        }

        const acPower = Math.min(dcPower * this.inverterEfficiency, this.inverterPowerLimit);

        return {
            DCPower: dcPower,
            ACPower: acPower
        };
    }

    static calcDiffuseEfficiency(tilt) {
        return 50 + 50 * Math.cos((tilt / 180) * Math.PI);
    }

    calcCellTemperature(ambientTemperature, totalIrradiance) {
		// Ross model: https://www.researchgate.net/publication/275438802_Thermal_effects_of_the_extended_holographic_regions_for_holographic_planar_concentrator
        // assuming "not so well cooled" : 0.0342
        const cellTemperature = ambientTemperature + 0.0342 * totalIrradiance;
        return cellTemperature;
    }
}

SolarPowerPlants.push(
    new SolarPowerPlant( 'Dach Ost',
        SystemLat, // latitude, 
        SystemLon, // longitude, 
        8*370,  // cellsMaxPower, 
        0, // cellsArea, 
        19.3, // cellsEfficiency, //
        -0.4, // cellsTempCoeff, 
        96, // diffuseEfficiency, // 
        10000, // inverterPowerLimit, 
        95, // inverterEfficiency, 
        76, // azimuthAngle, 
        20, // tiltAngle, 
        0, // shadingElevation, 
        0, // shadingOpacity, 
        0 // albedo
    )
);
SolarPowerPlants.push(
    new SolarPowerPlant( 'Dach West',
        SystemLat, // latitude, 
        SystemLon, // longitude, 
        9*370,  // cellsMaxPower, 
        0, // cellsArea, 
        19.3, // cellsEfficiency, //
        -0.4, // cellsTempCoeff, 
        96, // diffuseEfficiency, // 
        10000, // inverterPowerLimit, 
        95, // inverterEfficiency, 
        256, // azimuthAngle, 
        20, // tiltAngle, 
        0, // shadingElevation, 
        0, // shadingOpacity, 
        0 // albedo
    )
);

function calcPowerHourly(day,hour){
    let solarPowerNormal    = getState(OpenMeteoBaseId+'.hourly.'+day+'.'+hour+'.'+'direct_normal_irradiance').val;
    let solarPowerDiffuse   = getState(OpenMeteoBaseId+'.hourly.'+day+'.'+hour+'.'+'diffuse_radiation').val;
    let shortwaveRadiation  = getState(OpenMeteoBaseId+'.hourly.'+day+'.'+hour+'.'+'shortwave_radiation').val;
    let epochDate = new Date(getState(OpenMeteoBaseId+'.hourly.'+day+'.'+hour+'.'+'time').val);
    // let epochTimeSeconds = epochDate.getTime()/1000;
    let ambientTemperature = getState(OpenMeteoBaseId+'.hourly.'+day+'.'+hour+'.'+'temperature_2m').val;

    dwmlog ("SolarForcast calcPower for Time: "+epochDate.toISOString(),4);
    dwmlog ("SolarForcast calcPower - temperature: "+ambientTemperature,4);
    dwmlog ("SolarForcast calcPower - solarPowerNormal:   "+solarPowerNormal,4);
    dwmlog ("SolarForcast calcPower - solarPowerDiffuse:  "+solarPowerDiffuse,4);
    dwmlog ("SolarForcast calcPower - shortwaveRadiation: "+shortwaveRadiation,4);

    let result = {};
    result.day=day;
    result.hour=hour;
    result.time=epochDate.toISOString();

    let energyTime = new Date(epochDate);
    energyTime.setSeconds(energyTime.getSeconds()-1800);
    dwmlog("SolarForecast calcPower Energy time: "+energyTime.toISOString(),4);

    result.sumDCPower = 0;
    result.sumACPower = 0;
    result.ACEnergy = 0;

    result.plants=[];

    for (let i=0; i<SolarPowerPlants.length; i++){
        let pwr = SolarPowerPlants[i].getPower(solarPowerNormal, solarPowerDiffuse, shortwaveRadiation, epochDate, ambientTemperature);
        let baseName = SolarPowerPlants[i].name.replace(/ /g, '_');
        dwmlog("Power Calculation for "+SolarPowerPlants[i].name+" at "+epochDate.toISOString()+": DC: "+pwr.DCPower+" AC: "+pwr.ACPower,4);

        let plantEnergy = SolarPowerPlants[i].getPower(solarPowerNormal, solarPowerDiffuse, shortwaveRadiation, energyTime, ambientTemperature);
        
        dwmlog("SolarForecast: plantEnergy: "+JSON.stringify(plantEnergy),4);
        result.plants.push({id: baseName, pwr: pwr, ACEnergy: plantEnergy.ACPower});        
        result.sumDCPower += pwr.DCPower;
        result.sumACPower += pwr.ACPower;
        result.ACEnergy   += plantEnergy.ACPower;
    }

    dwmlog("Solarforecast - calcPowerHourly: "+JSON.stringify(result),3);
    return result;
}

// stores hourly results to datapoints, taking result from calcPowerHourly(...)
function storePowerResultsHourly( pwrResult){
    dwmlog("SolarForeCast: Store: "+JSON.stringify(pwrResult),4);
    createOrSetState(AreaChannelId+'.Total.hourly.'+pwrResult.day+'.'+pwrResult.hour+'.time',new Date(pwrResult.time).toISOString(),false,{type: "string"});
    createOrSetState(AreaChannelId+'.Total.hourly.'+pwrResult.day+'.'+pwrResult.hour+'.DCPower',pwrResult.sumDCPower,false,{type: "number", unit:"W"});
    createOrSetState(AreaChannelId+'.Total.hourly.'+pwrResult.day+'.'+pwrResult.hour+'.ACPower',pwrResult.sumACPower,false,{type: "number", unit:"W"});
    createOrSetState(AreaChannelId+'.Total.hourly.'+pwrResult.day+'.'+pwrResult.hour+'.ACEnergy',pwrResult.ACEnergy,false,{type: "number", unit:"Wh"});

    for (let i=0; i<pwrResult.plants.length; i++){
        createOrSetState(AreaChannelId+'.'+pwrResult.plants[i].id+'.hourly.'+pwrResult.day+'.'+pwrResult.hour+'.time',new Date(pwrResult.time).toISOString(),false,{type: "string"});
        createOrSetState(AreaChannelId+'.'+pwrResult.plants[i].id+'.hourly.'+pwrResult.day+'.'+pwrResult.hour+'.DCPower',pwrResult.plants[i].pwr.DCPower,false,{type: "number", unit:"W"});
        createOrSetState(AreaChannelId+'.'+pwrResult.plants[i].id+'.hourly.'+pwrResult.day+'.'+pwrResult.hour+'.ACPower',pwrResult.plants[i].pwr.ACPower,false,{type: "number", unit:"W"});
        createOrSetState(AreaChannelId+'.'+pwrResult.plants[i].id+'.hourly.'+pwrResult.day+'.'+pwrResult.hour+'.energy',pwrResult.plants[i].ACEnergy,false,{type: "number", unit:"Wn"});
    }
}

function createForecastGraph(resArray){
    let result = {};

    let plantColors=['green','yellow','blue'];

    result.axisLabels=[];
    result.graphs=[{
            data: [],
            legendText: 'Gesamt (W)',
            type: 'line',
            color: 'orange',
            displayorder: 0,
            
			tooltip_AppendText: " W",
            datalabel_show: false,

            yAxis_show: true,
			yAxis_gridLines_show: true,
			yAxis_gridLines_ticks_length: 5,
			yAxis_min: 0,
			yAxis_max: 6000,
			yAxis_step: 500,
			yAxis_position: "left",
			yAxis_appendix: " W",
			yAxis_zeroLineWidth: 0.5,
			yAxis_zeroLineColor: "gray",
        }
    ];

    for (let i=0; i<resArray[0].plants.length; i++){
        result.graphs.push({
            data: [],
            legendText: 'DC '+resArray[0].plants[i].id+' (W)',
            type: 'line',
            color: plantColors[i],
            displayorder: i+1,
            
			tooltip_AppendText: " W",
            datalabel_show: false,

            yAxis_show: false,
			yAxis_gridLines_show: true,
			yAxis_gridLines_ticks_length: 5,
			yAxis_min: 0,
			yAxis_max: 6000,
			yAxis_step: 500,
			yAxis_position: "left",
			yAxis_appendix: " W",
			yAxis_zeroLineWidth: 0.5,
			yAxis_zeroLineColor: "gray",
        });
    }

    result.graphs.push({
            data: [],
            legendText: 'Gesamterzeugung (Wh)',
            type: 'bar',
            color: 'lightblue',
            displayorder: 5,
            
			tooltip_AppendText: " Wh",
            datalabel_show: false,

            yAxis_show: true,
			yAxis_gridLines_show: true,
			yAxis_gridLines_ticks_length: 5,
			yAxis_min: 0,
			yAxis_max: 6000,
			yAxis_step: 500,
			yAxis_position: "right",
			yAxis_appendix: " Wh",
			yAxis_zeroLineWidth: 0.5,
			yAxis_zeroLineColor: "gray",

    });

    let pwrSum=0;
    let pwrIndex = resArray[0].plants.length+1;

    for (let h=0;h<24;h++){
        result.axisLabels.push(h+'h');
        result.graphs[0].data.push(resArray[h].sumACPower);
        for (let i=0; i<resArray[0].plants.length; i++){
            result.graphs[i+1].data.push(resArray[h].plants[i].pwr.DCPower);
        }
        
        result.graphs[pwrIndex].data.push(resArray[h].ACEnergy);
        pwrSum+=resArray[h].ACEnergy/1000;
    }
    result.graphs[pwrIndex].legendText="Erzeugt: "+pwrSum.toFixed(1)+"kWh";

    return JSON.stringify(result);
}

function WeekDayString( d ){
    let DaysLong = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
    let DaysShort = ["So","Mo","Di","Mi","Do","Fr","Sa"];
    
    let wd = d.getDay();
    return {long: DaysLong[wd], short: DaysShort[wd]};
}

function calcPower(foreCastDays=7){
    for (let d=0; d<foreCastDays; d++){
        let resArray = [];
        let ACEnergyDay=0;
        for (let h=0; h<24; h++){
            let res = calcPowerHourly(d,h);
            resArray.push(res);
            storePowerResultsHourly( res );
            if (h==0){
                resArray.time=res.time;
                let wd=WeekDayString(new Date(resArray.time))
                resArray.WeekDay=wd.long;
                resArray.WeekDayShort=wd.short;
            }
            ACEnergyDay+=res.ACEnergy;
        }
        let grph=createForecastGraph(resArray);
        createOrSetState(AreaChannelId+'.daily.'+d+'.weekDay',resArray.WeekDay,{type:'string'});
        createOrSetState(AreaChannelId+'.daily.'+d+'.weekDayShort',resArray.WeekDayShort,{type:'string'});
        createOrSetState(AreaChannelId+'.daily.'+d+'.forecastGraph',grph,{type:'string'});
        createOrSetState(AreaChannelId+'.daily.'+d+'.hourlyJSON',JSON.stringify(resArray),{type:'string'});
        createOrSetState(AreaChannelId+'.daily.'+d+'.ACEnergy',ACEnergyDay,{type:'number',unit:"Wh"});
    }
}


if (SolarDebugHour !== null ){
    calcPowerHourly(0,11);

} else {
    calcPower();
    subscribe ({id: 'javascript.0.open-meteo.Connected', val: true, change: 'any'},function(dp){
        setTimeout(function(){
            dwmlog("Updating Solar forecast!",3);
            calcPower();
        },15000); // give the meteo update 15s
    });

}
