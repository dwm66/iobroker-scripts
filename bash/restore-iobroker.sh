#!/bin/bash

TIMESTAMP=$(date +%Y-%m-%d-%H%M%S%Z)
IOBCONTAINER=iobroker-blue

TARGETVOLUME=TARGETVOLUME=iobroker-data-`date +%Y-%m-%d`

BACKUPFILE=$1

if [ -z $BACKUPFILE ]; then
    echo -e "Usage: $0 <BACKUPFILE>"
    exit 255
fi

if [ -f $BACKUPFILE ]; then
    echo -e "Restoring file $BACKUPFILE to $IOBCONTAINER ... Proceed?"
else
    echo -e "Backupfile $BACKUPFILE does not exist!"
    exit 255
fi

echo -e "Restoring file $BACKUPFILE to $IOBCONTAINER ... Proceed?"

./iobrokerctl.sh -restore BACKUPFILE=$BACKUPFILE TARGETVOLUME=$TARGETVOLUME
./iobrokerctl.sh -create IOBVOLUME=IOBCONTAINER=iobroker-blue IOB_OLDCONTAINER=iobroker-blue-$TIMESTAMP IOB_USE_GREEN_VOLUME=0 VOLUMEOPTION=0
