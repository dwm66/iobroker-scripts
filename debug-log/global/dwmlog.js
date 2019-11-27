// var debuglevel = 4;
// var debugchannel = 'info';

function dwmlog( message, level, channel) {
    if (typeof channel === 'undefined') {
        channel = debugchannel;
    }
    if ( typeof level === 'undefined')
    {
        level = debuglevel;
    }
    if ( debuglevel >= level ) {
        log (message, channel );
    }
}
