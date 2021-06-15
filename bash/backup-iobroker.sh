#!/bin/bash

TIMESTAMP=$(date +%Y-%m-%d-%H%M%S%Z)
IOBCONTAINER=iobroker-blue

# docker run --rm --volumes-from $IOBCONTAINER -v $(pwd):/backup ubuntu tar czvf /backup/iobroker-$TIMESTAMP.tar.gz /opt/iobroker
# mysqldump -u iobroker -pkYVyYnrXC0vqc8l8 iobroker | gzip -9 > mysql-$TIMESTAMP.gz
# 
# scp iobroker-$TIMESTAMP.tar.gz werner@pelican:/ssd/data/iobroker
# scp mysql-$TIMESTAMP.gz werner@pelican:/ssd/data/iobroker

/home/werner/iobrokerctl.sh -backup IOBCONTAINER=$IOBCONTAINER BACKUP_IOBROKER=1 BACKUP_MYSQL=1