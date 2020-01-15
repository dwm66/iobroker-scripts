// helper function - convert a date to a string hh:mm
function getTimeAsStr( theDate )
{
    var result = ("0" + (theDate.getHours()).toString(10)).slice(-2) + ':' +
                 ("0" + (theDate.getMinutes()).toString(10)).slice(-2);
    
    dwmlog ("Zeit: "+result,4);
    return result;
}

function sayItTimeTempMessage( messagebefore, messagebehind, sayTime, sayTemp, sayDate ) {
    sayItTimeTempMessageIntro ( messagebefore, messagebehind, sayTime, sayTemp, sayDate );
}


function sayItTimeTempMessageIntro( messagebefore, messagebehind, sayTime, sayTemp, sayDate,intro, introlen, targetZone ) {
    if ( targetZone === undefined ) targetZone = "all";
    
    if (targetZone == "all"){
        setState(   "javascript.0.SonosAPI.sayAllEx",
                    JSON.stringify({
                        messagebefore: messagebefore,
                        messagebehind: messagebehind,
                        sayTime: sayTime,
                        sayTemp: sayTemp,
                        sayDate: sayDate,
                        introClip: intro,
                        introClipLen: introlen
                    })
                );
    } else {
        setState(   "javascript.0.SonosAPI.Rooms."+targetZone+".action.sayEx",
                    JSON.stringify({
                        messagebefore: messagebefore,
                        messagebehind: messagebehind,
                        sayTime: sayTime,
                        sayTemp: sayTemp,
                        sayDate: sayDate,
                        introClip: intro,
                        introClipLen: introlen
                    })
                );
    }
}
