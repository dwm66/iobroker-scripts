var debuglevel = 2;
var debugchannel = 'info';
var AdapterId = "javascript."+instance;

var VerbrauchsZaehler = [];

/** 
/* Hier die Verbrauchszähler definieren
*/

VerbrauchsZaehler[0]=new createVerbrauchszaehler("hm-rpc.0.ZEQ1234567.1.ENERGY_COUNTER"/*Drehstromzähler:1.ENERGY_COUNTER*/,"Drehstromzähler");


//****************** nicht ändern *****************************************************

function createStates(forceCreateStates) {
    if (forceCreateStates === undefined) forceCreateStates = false;
              
    for (var i = 0; i<VerbrauchsZaehler.length; i++){
        createState( VerbrauchsZaehler[i].VerbrauchsZaehlerGesamtId,  // name
                     0,                         // initial value
                     forceCreateStates,
                     { 
                         type: 'number'
        		     }
                   );

        createState( VerbrauchsZaehler[i].VerbrauchsZaehlerLastId,  // name
                     0,                         // initial value
                     forceCreateStates,
                     { 
                         type: 'number'
        		     }
                   );

        createState( VerbrauchsZaehler[i].VerbrauchStundeId,  // name
                     0,                         // initial value
                     forceCreateStates,
                     { 
                         type: 'number',
                         name: 'Verbrauch in der aktuellen Stunde'
        		     }
                   );

        createState( VerbrauchsZaehler[i].VerbrauchHeuteId,  // name
                     0,                         // initial value
                     forceCreateStates,
                     { 
                         type: 'number'
        		     }
                   );
        createState( VerbrauchsZaehler[i].VerbrauchWocheId,  // name
                     0,                         // initial value
                     forceCreateStates,
                     { 
                         type: 'number'
        		     }
                   );
        createState( VerbrauchsZaehler[i].VerbrauchMonatId,  // name
                     0,                         // initial value
                     forceCreateStates,
                     { 
                         type: 'number'
        		     }
                   );
       createState( VerbrauchsZaehler[i].VerbrauchJahrId,  // name
                     0,                         // initial value
                     forceCreateStates,
                     { 
                         type: 'number'
        		     }
                   );
        
        for (let j=0; j<VerbrauchsZaehler[i].additionalCounter.length; j++) {
            createState( VerbrauchsZaehler[i].additionalCounter[j].id,  // name
                        0,                         // initial value
                        forceCreateStates,
                        { 
                            type: 'number'
                        }
                    );            
            }
    }
}

function createSubscribes(){
       
    for (var i = 0; i<VerbrauchsZaehler.length; i++){
        subscribe ({id: VerbrauchsZaehler[i].id, change:"ne"},function(dp){
            for (i = 0; i<VerbrauchsZaehler.length; i++) if (dp.id == VerbrauchsZaehler[i].id) break;
            var Last   = getState(VerbrauchsZaehler[i].VerbrauchsZaehlerLastId).val;
            var LastTs = getState(VerbrauchsZaehler[i].VerbrauchsZaehlerLastId).ts;
            var StateNow = getState(VerbrauchsZaehler[i].id).val;
            if (typeof(StateNow)!=="number")
                StateNow = parseFloat(StateNow);
                
            now = new Date();
            var Diff = 0;
            
            // 0 is probably an error, don't write resets to 0 to the states
            if (StateNow === 0) return;
            
            // use that if a reset to 0 happened and and starts counting from 0 again.
            if (Last>StateNow) Diff=StateNow; else Diff=StateNow-Last;
            
            setState(VerbrauchsZaehler[i].VerbrauchsZaehlerGesamtId,getState(VerbrauchsZaehler[i].VerbrauchsZaehlerGesamtId).val+Diff);
            setState(VerbrauchsZaehler[i].VerbrauchStundeId,getState(VerbrauchsZaehler[i].VerbrauchStundeId).val+Diff);
            setState(VerbrauchsZaehler[i].VerbrauchHeuteId,getState(VerbrauchsZaehler[i].VerbrauchHeuteId).val+Diff);
            setState(VerbrauchsZaehler[i].VerbrauchWocheId,getState(VerbrauchsZaehler[i].VerbrauchWocheId).val+Diff);
            setState(VerbrauchsZaehler[i].VerbrauchMonatId,getState(VerbrauchsZaehler[i].VerbrauchMonatId).val+Diff);
            setState(VerbrauchsZaehler[i].VerbrauchJahrId,getState(VerbrauchsZaehler[i].VerbrauchJahrId).val+Diff);
            setState(VerbrauchsZaehler[i].VerbrauchsZaehlerLastId,StateNow);

            for (let j=0; j<VerbrauchsZaehler[i].additionalCounter.length; j++){
                let oldVal = getState(VerbrauchsZaehler[i].additionalCounter[j].id).val;
                setState(VerbrauchsZaehler[i].additionalCounter[j].id,oldVal + Diff);
            }
        });
    }
}

function createSchedules(){
    for (var i = 0; i<VerbrauchsZaehler.length; i++){
    schedule("0 */1 * * *", function (i) {
        setState(VerbrauchsZaehler[i].VerbrauchStundeId,0);
    }.bind(null,i));
    schedule("0 0 * * *", function (i) {
        setState(VerbrauchsZaehler[i].VerbrauchHeuteId,0);
    }.bind(null,i)); // end schedule
    schedule("0 0 * * 1", function (i) {
        setState(VerbrauchsZaehler[i].VerbrauchWocheId,0);
    }.bind(null,i)); // end schedule
    schedule("0 0 1 * *", function (i) {
        setState(VerbrauchsZaehler[i].VerbrauchMonatId,0);
    }.bind(null,i)); // end schedule
    schedule("0 0 1 1 *", function (i) {
        setState(VerbrauchsZaehler[i].VerbrauchJahrId,0);
    }.bind(null,i)); // end schedule
        
    }    
}


/******************** Verbrauchszähler ****************************************/


function createVerbrauchszaehler(id, name) {
    this.id = id;
    this.name = name;
    this.IdBase = AdapterId+".Haustechnik.Verbrauchszähler."+name.replace(/ /g, "_"); 

    this.VerbrauchsZaehlerGesamtId = this.IdBase+".Verbrauch.Gesamt";
    this.VerbrauchsZaehlerLastId = this.IdBase+".LetzerStand";

    this.VerbrauchStundeId= this.IdBase+".Verbrauch.Stunde";
    this.VerbrauchHeuteId = this.IdBase+".Verbrauch.Heute";
    this.VerbrauchWocheId = this.IdBase+".Verbrauch.Woche";
    this.VerbrauchMonatId = this.IdBase+".Verbrauch.Monat";
    this.VerbrauchJahrId  = this.IdBase+".Verbrauch.Jahr";

    this.lastTimestamp = null;
    this.additionalCounter = [];
}

function addAdditional (i,name){
    VerbrauchsZaehler[i].additionalCounter.push({"name": name, "id": VerbrauchsZaehler[i].IdBase+".Zusatzzähler."+name.replace(/ /g, "_")});
}

createStates();
createSubscribes();
createSchedules();

