
function pushEvent(Kat, Text) {
    var EventListId = "javascript.0.Ereignisse.Text";
    if (EventListId === undefined || EventListId === null ) return;
    var theText = Kat+" - "+Text;
    // dwmlog ("Eventlist - adding "+theText,4);
    setState (EventListId,theText);
}
