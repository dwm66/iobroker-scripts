var AdapterId   = "javascript."+instance;
var EventListId = AdapterId+"."+"Ereignisse.Text";
var EventListHTMLId = AdapterId+"."+"Ereignisse.HTMLListe";
var EventListTextId = AdapterId+"."+"Ereignisse.TextListe";
var FilterStatesListeId = AdapterId+"."+"Ereignisse.FilterStatus.Liste";
var FilterStatesTelegramId = AdapterId+"."+"Ereignisse.FilterStatus.Telegram";

var debuglevel=2;
var debugchannel="info";

function createStates() {
    createState( EventListId,
               "",
               false,
               {
                    type: 'string',
               }
               );
    
    sendTo('history.0', 'enableHistory', {
    id: EventListId,
    options: {
        "enabled": true,
        "changesOnly": false,
        "debounce": 10,
        "maxLength": 0,
        "retention": 63072000,
        "changesRelogInterval": 0,
        "changesMinDelta": 0
    }

}, function (result) {
    if (result.error) {
        console.log(result.error);
    }
    if (result.success) {
        //successfull enabled
    }
});
    
    createState( EventListHTMLId+".10",
               "",
               false,
               {
                    type: 'string',
               }
        );

    
    createState( EventListTextId+".10",
           "",
           false,
           {
                type: 'string',
           }
         );
    
    createState( FilterStatesListeId,
           1,
           false,
            {
                type: 'number',
                states: ["DEBUG","INFO","WARNUNG","ALARM"],
                name: "Filtert die Ereignisliste."
            }
         );
    createState( FilterStatesTelegramId,
           1,
           false,
            {
                type: 'number',
                states: ["DEBUG","INFO","WARNUNG","ALARM"],
                name: "Filtert die Ereignisliste für Telegram."
            }
         );
    
} // createStates function ends

function formatEventsToHTML( list, num ) {
    var html = "<table>";

    var listentry;
    var states = ["DEBUG","INFO","WARNUNG","ALARM"];    var filter = getState(FilterStatesListeId).val;    var entries = 0;        html += "<tr><th style=\"text-align:left\">Uhrzeit</th><th style=\"text-align:left\">Ereignis</th></tr>";
    for (var i = 0; i < list.length; i++) {        if (list[i].val !== null) {            listentry = list[i].val.split(" - ");            if (states.indexOf (listentry[0]) >= filter) {                    html+="<tr><td width=\"150px\">"+formatDate( new Date(list[i].ts), "DD.MM.YYYY hh:mm:ss")+"</td><td style=\"padding-left:10px;\">"+list[i].val+"</td></tr>";                entries++;            }        }        if (entries>=num) break;    }    html+="</table>";        return html;}
function formatEventsToText (list,num) {    var text = "";    var listentry;    var states = ["DEBUG","INFO","WARNUNG","ALARM"];    var filter = getState(FilterStatesListeId).val;    var entries = 0;
    text += "Uhrzeit             Ereignis\n";    for (var i = 0; i < list.length; i++) {        dwmlog(JSON.stringify(list[i]),4);        if (list[i].val !== null) {            listentry = list[i].val.split(" - ");            if (states.indexOf (listentry[0]) >= filter) {                    text+=formatDate( new Date(list[i].ts), "DD.MM.YYYY hh:mm:ss")+" "+list[i].val+"\n";                entries++;            }        }        if (entries>=num) break;    }
    return text;    }
function formatEventsToTelegram (list) {    var text = "";    var listentry;    var states = ["DEBUG","INFO","WARNUNG","ALARM"];    var filter = getState(FilterStatesListeId).val;
    text += "Uhrzeit             Ereignis\n";    for (var i = 0; i < list.length; i++) {        dwmlog(JSON.stringify(list[i]),4);        if (list[i].val !== null) {            listentry = list[i].val.split(" - ");            if (states.indexOf (listentry[0]) >= filter) {                    text+=formatDate( new Date(list[i].ts), "DD.MM.YYYY hh:mm:ss")+" "+list[i].val+"\n";            }        }    }
    return text;    }
function getCountAsHTML(number,datapoint) {
    getHistory("history.0",{
            id:         "javascript.0.Ereignisse.Text"/*Ereignisse.Text*/,
            aggregate:  'none',
            count:      50
        }, function (err, result) {
            if (err) console.error(err);
            if (result) {
                result.reverse();
                var html = formatEventsToHTML( result, number );
                // dwmlog("Events:"+html,4);
                setState(datapoint,html);
            }
        });    
}

function getCountAsText(number,datapoint) {
    getHistory("history.0",{
            id:         "javascript.0.Ereignisse.Text"/*Ereignisse.Text*/,
            aggregate:  'none',
            count:      50
        }, function (err, result) {
            if (err) console.error(err);
            if (result) {
                result.reverse();
                var text = formatEventsToText( result,number );
                dwmlog("Events:"+text,4);
                setState(datapoint,text);
            }
        });    
}

createStates();

subscribe({id: EventListId, valNe:""},function(data){
    setTimeout (function (){
        dwmlog ("Subscribe triggered",4);
        getCountAsHTML(10,EventListHTMLId+".10");
        getCountAsText(10,EventListTextId+".10");
        
        var listentry=data.state.val.split(" - ");
        var states = ["DEBUG","INFO","WARNUNG","ALARM"];
        var filter = getState(FilterStatesTelegramId).val;
        var theIndex = states.indexOf (listentry[0]);
        if ( theIndex >= filter) {
            var theMessage = "";
            if (theIndex > 1) theMessage += "*"+listentry[0]+"*"; else theMessage+=listentry[0];
            theMessage += " - "+listentry[1];
            sendTo('telegram.0', {
                text:       theMessage,
                parse_mode: "Markdown",
                disable_notification: (theIndex <= 1)
            });            
        }
    },500);
});

subscribe({id: FilterStatesListeId, change:"ne"}, function(){
    getCountAsHTML(10,EventListHTMLId+".10");
    getCountAsText(10,EventListTextId+".10");    
});

getCountAsHTML(10,EventListHTMLId+".10");
getCountAsText(10,EventListTextId+".10");
