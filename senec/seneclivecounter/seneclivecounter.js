var debuglevel = 4;
var debugchannel = 'info';
var AdapterId = "javascript."+instance;
var ChannelId = AdapterId+".Senec";

var SenecAnlagenNr      = 12345;

var IdSet = {
    LIVE_PV_GEN: {
        jsId:               ChannelId+'.Statistic.LIVE_PV_GEN',
        senecStatisticLegacyId:   'senec.0.STATISTIC.LIVE_PV_GEN'/*PV Generation*/,
        senecAPIDailyId:    'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Dashboard.heute.stromerzeugung'/*Stromerzeugung*/,

        startupCorrectionOldId: 'senec.0._calc.LIVE_PV_GEN.year', 
        startupCorrectionNewId: 'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Statistik.This Year.stromerzeugung'
    },
    LIVE_BAT_CHARGE: {
        jsId:               ChannelId+'.Statistic.LIVE_BAT_CHARGE',
        senecStatisticLegacyId:   'senec.0.STATISTIC.LIVE_BAT_CHARGE',
        senecAPIDailyId:    'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Dashboard.heute.speicherbeladung',

        startupCorrectionOldId: 'senec.0._calc.LIVE_BAT_CHARGE_MASTER.year', 
        startupCorrectionNewId: 'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Statistik.This Year.speicherbeladung'
    },
    LIVE_BAT_DISCHARGE: {
        jsId:               ChannelId+'.Statistic.LIVE_BAT_DISCHARGE',
        senecStatisticLegacyId:   'senec.0.STATISTIC.LIVE_BAT_DISCHARGE',
        senecAPIDailyId:    'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Dashboard.heute.speicherentnahme',

        startupCorrectionOldId: 'senec.0._calc.LIVE_BAT_DISCHARGE_MASTER.year', 
        startupCorrectionNewId: 'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Statistik.This Year.speicherentnahme'
    },
    LIVE_GRID_EXPORT: {
        jsId:               ChannelId+'.Statistic.LIVE_GRID_EXPORT',
        senecStatisticLegacyId:   'senec.0.STATISTIC.LIVE_GRID_EXPORT',
        senecAPIDailyId:    'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Dashboard.heute.netzeinspeisung',

        startupCorrectionOldId: 'senec.0._calc.LIVE_GRID_EXPORT.year', 
        startupCorrectionNewId: 'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Statistik.This Year.netzeinspeisung'
    },
    LIVE_GRID_IMPORT: {
        jsId:               ChannelId+'.Statistic.LIVE_GRID_IMPORT',
        senecStatisticLegacyId:   'senec.0.STATISTIC.LIVE_GRID_IMPORT',
        senecAPIDailyId:    'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Dashboard.heute.netzbezug',

        startupCorrectionOldId: 'senec.0._calc.LIVE_GRID_IMPORT.year', 
        startupCorrectionNewId: 'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Statistik.This Year.netzbezug'
    },
    LIVE_HOUSE_CONS: {
        jsId:               ChannelId+'.Statistic.LIVE_HOUSE_CONS',
        senecStatisticLegacyId:   'senec.0.STATISTIC.LIVE_HOUSE_CONS',
        senecAPIDailyId:    'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Dashboard.heute.stromverbrauch',

        startupCorrectionOldId: 'senec.0._calc.LIVE_LIVE_HOUSE_CONS.year', 
        startupCorrectionNewId: 'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Statistik.This Year.stromverbrauch'
    }
}

// var LivePVGenId         = ChannelId+'.Statistic.LIVE_PV_GEN';
// var LivePVGenSenecId    = 'senec.0.STATISTIC.LIVE_PV_GEN'/*PV Generation*/;
// var LivePVGenDailyAPIId = 'senec.0._api.Anlagen.'+SenecAnlagenNr+'.Dashboard.heute.stromerzeugung'/*Stromerzeugung*/

var LiveCounters=[];

class LiveStatisticCounter {
    constructor (idRecord, hasSQL){
        this.liveAPIId = idRecord.senecAPIDailyId;
        this.liveDataId = idRecord.jsId;
        this.senecLiveId = idRecord.senecStatisticLegacyId;
        this.hasSQL     = hasSQL;
        this.sqlAdapter = 'sql.0';

        this.senecLiveFactor = 1000;

        this.startupCorrectionOldId = idRecord.startupCorrectionOldId;
        this.startupCorrectionNewId = idRecord.startupCorrectionNewId;

        this.calcLiveData = this.calcLiveData.bind(this)
        this.forceCreate = false;

        let stateExists = existsState(this.liveDataId);

        if (!stateExists || this.forceCreate){
            // this.createStates(this.forceCreate,stateExists);
            this.createStates(false,true);
        }

        this.createSubscribes();
    }

    async createStates( forceCreateStates = false, doCatchup = false ){
        try {
            if (!existsState(this.liveDataId) || forceCreateStates) {
                var theId = this.liveDataId;
                dwmlog('Senec LiveCounter '+this.liveDataId+' creating state',2);
                await createStateAsync( this.liveDataId,
                    0,
                    forceCreateStates,
                    {
                        type: 'number',
                        name: 'SENEC Statistic Value for '+this.liveAPIId
                    }
                );
                dwmlog("created state "+theId,4);
                if (this.hasSQL){
                    await sendToAsync(this.sqlAdapter, 'enableHistory', {
                        id: theId,
                        options: {
                            changesOnly:  true,
                            debounce:     0,
                            retention:    31536000,
                            maxLength:    3,
                            changesMinDelta: 0.1,
                            aliasId: ''
                        }
                    });
                }

                doCatchup = doCatchup && this.hasSQL;
                if (doCatchup){
                    let offset = 0;
                    let liveStatState=getState(this.senecLiveId);

                    // can we calculate missing offset?
                    if (this.startupCorrectionOldId !== null && this.startupCorrectionNewId !== null ){
                        offset = await this.getCatchUpStartCorrection(this.startupCorrectionOldId, this.startupCorrectionNewId, this.senecLiveFactor);
                    }
                    let catchupRecs = await this.createCatchUpRecs(liveStatState.val*this.senecLiveFactor+offset, liveStatState.ts);
                    dwmlog('LiveCounter : '+this.liveDataId+' catchup last rec: '+JSON.stringify(catchupRecs[catchupRecs.length-1]),4)
                    await this.writeCatchupRecs(catchupRecs);
                }
            } // state does not exist
        } catch (err ){
            dwmlog("Error while initializing SenecLiveCounter "+err.message+" --> "+err.stack,2,"warn");
        }
    }

    createSubscribes(){
        let cld = this.calcLiveData;
        subscribe({id: this.liveAPIId, change: "any"}, function(dp){
            cld(dp);
        }); // subscribe    
    }

    async getCatchUpStartCorrection (oldCalcId, newAPIId, oldCalcFactor=1000){
        let LiveStatState=getState(this.senecLiveId);
        
        let history1 = await this.createCatchUpRecs(0, LiveStatState.ts);
        dwmlog("history1: "+JSON.stringify(history1[0]),4)
        dwmlog("Seit: "+new Date(history1[1].ts).toISOString()+" -> "+history1[history1.length-1].sumVal,4);
        
        let yearly1 = getState(oldCalcId).val*oldCalcFactor;
        let yearly2 = getState(newAPIId).val;

        // dwmlog("Jährlich 2023 bis jetzt 1: "+yearly1,4);
        // dwmlog("Jährlich 2023 bis jetzt 2: "+yearly2,4);
        // dwmlog("Jährlich 2023 bis jetzt 3: "+(yearly1+history1[history1.length-1].sumVal),4);
        let Offset = yearly2-yearly1-history1[history1.length-1].sumVal;
        dwmlog("Fehlbetrag:                "+Offset,4);
        return Offset;
    }

    getDay( yourDate){
        const offset = yourDate.getTimezoneOffset();
        yourDate = new Date(yourDate.getTime() - (offset*60*1000));
        return yourDate.toISOString().split('T')[0];        
    }

    calcDiffDaily(lastVal, lastTs, currentVal, currentTs){
        let lastDay =  this.getDay(new Date(lastTs));
        let currentDay = this.getDay(new Date(currentTs));
        let diff = 0;

        if (lastDay == currentDay){
            diff=currentVal-lastVal;
        } else {
            diff = currentVal;
        }

        return diff;
    }

    async createCatchUpRecs (startVal, startTs){
        dwmlog("called createCatchUpRecs with start value "+startVal+" catching up since "+new Date(startTs).toLocaleString(),4)
        let t=this;
        let res = [];

        try {
            let apiHistory = await sendToAsync(this.sqlAdapter, 'getHistory', {
                id: t.liveAPIId,
                options: {
                    start:     startTs-600000,
                    end:       Date.now()+500,
                    aggregate: 'onchange',
                    addId: true
                }
            });

            dwmlog("catchup - api history first rec: "+new Date(apiHistory.result[0].ts).toLocaleString(),4);

            let SumVal  = startVal;
            let LastVal = startVal;
            let LastTs  = startTs;

            // dwmlog("API History: "+JSON.stringify(apiHistory),4);

            // @ts-ignore
            for (let i=0; i<apiHistory.result.length; i++) {
                if (apiHistory.result[i].val !== null){
                    
                    if (startTs - apiHistory.result[i].ts > 200 ){
                        LastVal = apiHistory.result[i].val;
                        LastTs  = apiHistory.result[i].ts;
                    } else {
                        let rec = {
                            index: i,
                            val: apiHistory.result[i].val,
                            ts: apiHistory.result[i].ts,
                            timestring: new Date(apiHistory.result[i].ts).toISOString(),
                            diff: 0,
                            timediff: 0,
                            sumVal: null
                        };


                        rec.diff = this.calcDiffDaily(LastVal, LastTs, rec.val, rec.ts);
                        rec.timediff = rec.ts - LastTs;

                        rec.sumVal = SumVal + rec.diff;
                        SumVal += rec.diff;
                        
                        LastVal = rec.val;
                        LastTs  = rec.ts;

                        // dwmlog("apiHistory "+JSON.stringify(rec),4)
                        res.push(rec);
                    }
                }
            }
            dwmlog("catchup Result"+JSON.stringify(res),4);
            return res;

        } catch (err) {
            dwmlog("Catchup error: "+err.message+" --> "+err.stack,2)
            return null;    
        }         
    }

    async writeCatchupRecs( theRecs ){
        let result = { firstTs: theRecs[0].ts, lastTs: theRecs[theRecs.length-1].ts };

        dwmlog("Senec LiveCounter for "+this.liveDataId+' catchup writing: '+JSON.stringify(result),2);
        let writeRecs = [];
        for (let i=0; i<theRecs.length; i++){
            writeRecs.push({
                ts:     theRecs[i].ts,
                val:    theRecs[i].sumVal,
                ack:    false,
                from:   'system.adapter.'+AdapterId+'.SenecLiveCounter'
            })
        }

        let dbresult = null;
        try {
            dwmlog("Senec LiveCounter for "+this.liveDataId+' writing record: '+JSON.stringify(writeRecs[writeRecs.length-1]),4);

            dbresult = await sendToAsync(this.sqlAdapter, 'storeState', {
                id: this.liveDataId,
                state: writeRecs
            });
        } catch (err) {
            dwmlog("writeCatchup error: "+err.message+" --> "+err.stack,2)
            return null;    
        }
        dwmlog("Senec LiveCounter for "+this.liveDataId+' catchup writing result: '+JSON.stringify(dbresult),4);

        return result;
    }

    async calcLiveData(data){
        let t=this;
        let lastTrackState = getState(t.liveDataId);
        let lastTrackVal = lastTrackState.val;
        let lastTrackTs  = lastTrackState.ts;

        let lastDataVal = data.oldState.val;
        let lastDataTs  = data.oldState.ts;

        let now=new Date();

        // check against database
        if (t.hasSQL){
            try {
                // check if track state is up-to-date
                let track_result = await latestRecords(t.liveDataId, 0, this.sqlAdapter);

                dwmlog("Senec "+t.liveDataId+" DB results for track: "+JSON.stringify(track_result),4);
                let dbStateVal = null; // result.result[0].val;
                let dbStateTs  = null; // result.result[0].ts;

                if (track_result!==null){
                    dbStateVal = track_result.val;
                    dbStateTs  = track_result.ts;
                }

                if (dbStateTs !== null && (dbStateTs > lastTrackTs || dbStateVal > lastTrackVal) ){
                    dwmlog("SENEC live calculation: Database has newer data for tracking!",2)
                    lastTrackVal = dbStateVal;
                    lastTrackTs  = dbStateTs;
                }

                // check if DATA state is up-to-date
                let data_result = await latestRecords(t.liveAPIId,1,this.sqlAdapter);

                dwmlog("Senec "+t.liveDataId+" DB data results: "+JSON.stringify(data_result),4);
                let dbDataStateVal = null; // result.result[0].val;
                let dbDataStateTs  = null; // result.result[0].ts;

                if (data_result !== null){
                    dbDataStateVal = data_result.val;
                    dbDataStateTs  = data_result.ts;
                }

                if (dbDataStateTs !== null && dbDataStateTs > lastDataTs){
                    dwmlog("SENEC live calculation: Database has newer data in "+t.liveAPIId+" datapoint "+lastDataTs+" database: "+dbDataStateTs,2)                    
                    lastDataVal = dbDataStateVal;
                    lastDataTs  = dbDataStateTs;
                }
            }
            catch (err){

            }
        } // hasSQL

        if (lastDataTs - lastTrackTs > 500){            
            dwmlog('Senec live calculation for '+this.liveDataId+' Zeitdifferenz Tracking/Daten: '+(lastDataTs-lastTrackTs) ,2,'warn');
            dwmlog('LastTrackVal: '+lastTrackVal+' LastTrackTs: '+new Date(lastTrackTs).toLocaleString(),4);
            dwmlog('LastDataVal:  '+lastDataVal+' LastDataTs : '+new Date(lastDataTs).toLocaleString(),4);

            let catchupRecs = await this.createCatchUpRecs(lastTrackVal, lastTrackTs);
            // let tempRecs = catchupRecs.slice(0,-1);
            let lastRec  = catchupRecs.pop();

            dwmlog('catching up ... '+JSON.stringify(catchupRecs),4);
            dwmlog('last record: '+JSON.stringify(lastRec),4);
            await this.writeCatchupRecs( catchupRecs);
            setState(this.liveDataId,lastRec.sumVal);
        } else {
            let diff = this.calcDiffDaily(lastDataVal, lastDataTs, data.state.val, data.state.ts);
            let newVal = lastTrackVal+diff;
            dwmlog("Senec live calculation for "+this.liveDataId+" - old Value: "+lastTrackVal+' new Value: '+newVal,4);    
            setState(this.liveDataId,newVal);
        }

    } // calcLiveData
};

async function latestRecords(id,back=0, sqlAdapter='sql.0'){
    // check if DATA state is up-to-date
    let data_result = null;
    try {   
        data_result = await sendToAsync(sqlAdapter, 'getHistory', {
            id: id,
            options: {
                limit:      10,
                aggregate: 'none',
                addId:     true,
                from:      true,
                returnNewestEntries: true,
                ignoreNull: true
            }});

        let recs = data_result.result;
        recs.sort((a,b) => (b.ts - a.ts) );

        dwmlog("records retrieved: "+JSON.stringify(recs),5);

        let r=null;
        let cnt=0;

        for (let i=0; i<recs.length; i++){
            r=recs[i];
            if (r.val !== null ){
                if (cnt==back) break; else cnt++;
            }
        }

        dwmlog("DB latest record: "+JSON.stringify(r)+" from "+new Date(r.ts).toLocaleString(),4);
        return r;
    } catch (err) {
        dwmlog("latestRecord: Error occured: "+err.message+' --> '+err.stack,2,'warn');
    }
    return null;
}

LiveCounters.push(new LiveStatisticCounter( IdSet.LIVE_PV_GEN, true ));
LiveCounters.push(new LiveStatisticCounter( IdSet.LIVE_BAT_CHARGE, true ));
LiveCounters.push(new LiveStatisticCounter( IdSet.LIVE_BAT_DISCHARGE, true ));
LiveCounters.push(new LiveStatisticCounter( IdSet.LIVE_HOUSE_CONS, true ));
LiveCounters.push(new LiveStatisticCounter( IdSet.LIVE_GRID_EXPORT, true ));
LiveCounters.push(new LiveStatisticCounter( IdSet.LIVE_GRID_IMPORT, true ));
