#!/bin/bash

if [ -z $IOBCTL_CONFIGFILE ]; then
  IOBCTL_CONFIGFILE=~/.iobrokerctl.config
fi

IOBIMAGE_DEFAULT="buanet/iobroker:v4.2.0"

if [ -f $IOBCTL_CONFIGFILE ]; then
    # echo -e "Reading config $IOBCTL_CONFIGFILE"
    source $IOBCTL_CONFIGFILE
else
    echo -e "Configuration file $IOBCTL_CONFIGFILE not found"
fi

if [ -z $GPIMAGE ]; then
    # echo -e "Setting GPIMAGE to alpine"
    GPIMAGE=alpine
fi

if [ -z $TIMESTAMP ]; then
    TIMESTAMP=$(date +%Y-%m-%d-%H%M%S%Z)
fi

if [ -z $IOBVOLUME_DEFAULT]; then
    IOBVOLUME_DEFAULT=iobroker-data-$(date +%Y%m%d)
fi

if [ -z $IOBCONTAINER_DEFAULT ]; then
    IOBCONTAINER_DEFAULT=iobroker-blue
fi

# this is the container internal backup directory, not the one for 
# the backup command!
if [ -z $BACKUPDIR_DEFAULT ]; then
    BACKUPDIR_DEFAULT=~/iobroker_backups
fi
if [ -z $SSH_DIR_DEFAULT ]; then
    SSH_DIR_DEFAULT=~/ssh_iobroker
fi

if [ -z $IOB_PREFIX ]; then
   IOB_PREFIX="iobroker"
fi

if [ -z $MYSQL_HOST ]; then
    BACKUP_MYSQL=0
fi

if [ -z $MYSQL_USER ]; then
    BACKUP_MYSQL=0
fi

if [ -z $MYSQL_PASSWORD ]; then
    BACKUP_MYSQL=0
fi

IMMEDIATE_RUN=1

# IOBCONTAINER=iobroker
# BACKUP_IOBROKER=1
# BACKUP_MYSQL=1

# BACKUPDIR=/opt/backups
# IOBIMAGE=buanet/iobroker:v3.1.0
# IOBCONTAINER=iobroker
# SSH_DIR=/home/werner/ssh_io

print_config(){
    echo -e "\nConfiguration:"
    echo -e "\tConfig file: $IOBCTL_CONFIGFILE"
    echo -e "\tTimestamp: $TIMESTAMP"
    echo -e "\tIOB_PREFIX: $IOB_PREFIX"
    echo -e "\tGPIMAGE: $GPIMAGE"
    echo -e "\tIOBIMAGE_DEFAULT: $IOBIMAGE_DEFAULT"
    echo -e "\tIOBVOLUME_DEFAULT: $IOBVOLUME_DEFAULT"
    echo -e "\tIOBCONTAINER_DEFAULT: $IOBCONTAINER_DEFAULT"
    
    echo -e "\tBACKUP_MYSQL: $BACKUP_MYSQL"
}

# get the variable requested
getVariable()
{
    local input=$1
    local default=$2

    # check if variable empty
    if [ -z "${!input}" ];
    then
        # is empty
        echo -n -e "Please input $input ($2): "
        read $1
    fi

    if [ -z "${!input}" ];
    then
        echo -n -e "Setting $1 to default $2\n"
        export $1=$2
    fi

}

getPrefixedVariable() {
    local input=$1
    
    getVariable $1 $2

    local content=${!input}

    if [ -z $IOB_PREFIX ]; then
        export $1=$content
    elif [[ $content != $IOB_PREFIX-* ]]; then
        export $input=$IOB_PREFIX-$content
    else
        export $1=$content
    fi
}

# get the variable requested without showing the input
getVariableHidden()
{
    input=$1

    # check if variable empty
    if [ -z "${!input}" ];
    then
        # is empty
        echo -n -e "Please input $input: "
        read -s $1
    fi
}

# parse arguments from the commandline
parseArguments()
{
    for var in "$@"
    do
        if [[ $var == -* ]]
        then
            INTERNAL_MODE=$var
        elif [[ $var == *=* ]]
        then
            sperateAt=$(expr index "$var" '=')
            property=${var:0:$sperateAt - 1}
            value=${var:$sperateAt}
            declare -g ${property}=$value
        fi
    done
}

########################################################################

determineContainerDefault() {
    
    if [ "$(docker container ls --filter name=^/$IOB_PREFIX --format=\"{{.ID}}\")" != "" ]; then
        # echo -e "Running container ..."
        IOBCONTAINER_DEFAULT=$(docker container ls --filter name=^/$IOB_PREFIX --format="{{.Names}}")
    elif [ "$(docker container ls -a --filter name=^/$IOB_PREFIX --format=\"{{.ID}}\")" != "" ]; then
        IOBCONTAINER_DEFAULT=$(docker container ls -a -l --filter name=^/$IOB_PREFIX --format="{{.Names}}")    
    fi
    # echo -e "Container default is $IOBCONTAINER_DEFAULT"
}

determineVolumeDefault() {
    if [ "$(docker container ls -a --filter name=^/$IOBCONTAINER$ --format=\"{{.ID}}\")" != "" ] ; then
        # container exists
        IOBVOLUME_DEFAULT=$(docker container inspect -f '{{json .Mounts}}' $IOBCONTAINER | jq -r '.[] | select(.Type == "volume").Name')
        if [ "$IOBCONTAINER" = "iobroker-blue" ]; then
            VOLUMEOPTION_DEFAULT=2
        fi
    fi
}

determineContainerDefault
determineVolumeDefault

########################################################################

cloneVolume() {
    #Author: Guido Diepen

    #Convenience script that can help me to easily create a clone of a given
    #data volume. The script is mainly useful if you are using named volumes

    #First check if the user provided all needed arguments
    if [ "$1" = "" ]
    then
            echo "Please provide a source volume name"
            exit
    fi

    if [ "$2" = "" ] 
    then
            echo "Please provide a destination volume name"
            exit
    fi

    #Check if the source volume name does exist
    docker volume inspect $1 > /dev/null 2>&1
    if [ "$?" != "0" ]
    then
            echo "The source volume \"$1\" does not exist"
            exit
    fi

    #Now check if the destinatin volume name does not yet exist
    docker volume inspect $2 > /dev/null 2>&1

    if [ "$?" = "0" ]
    then
            echo "The destination volume \"$2\" already exists"
            exit
    fi

    echo "Creating destination volume \"$2\"..."
    docker volume create --name $2  
    echo "Copying data from source volume \"$1\" to destination volume \"$2\"..."
    docker run --rm \
               -i \
               -t \
               -v $1:/from \
               -v $2:/to \
               $GPIMAGE ash -c "cd /from ; cp -av . /to"

}

createIOBContainer() {
    # check if volume exists
   
    VOLUMEOPTION_DEFAULT=1
    
    getVariable IOBIMAGE $IOBIMAGE_DEFAULT
    getPrefixedVariable IOBCONTAINER $IOBCONTAINER_DEFAULT

    if [ "$(docker container ls --filter name=^/$IOBCONTAINER$ --format='{{.ID}}')" != "" ] ; then
        # container is running!
        echo -e "Container is active, stopping ..."
        docker stop $IOBCONTAINER
    fi
    
    determineVolumeDefault
    
    IOB_GREEN_RUNNING=$(docker container ls --filter name=^/$IOB_PREFIX-green$ --format='{{.Names}}')
    
    if [ "$IOBCONTAINER" == "$IOB_PREFIX-blue" ]; then
        if [  "$IOB_GREEN_RUNNING" != "" ]; then
            echo -e "Container $IOB_GREEN_RUNNING is running!"
            IOB_GREEN_VOLUME=$(docker container inspect -f '{{json .Mounts}}' $IOB_GREEN_RUNNING | jq -r '.[] | select(.Type == "volume").Name')
            echo -e "Container $IOB_GREEN_RUNNING has volume $IOB_GREEN_VOLUME attached!"
            echo -e "Use $IOB_GREEN_VOLUME as copy template instead of default $IOBVOLUME_DEFAULT?"
            getVariable IOB_USE_GREEN_VOLUME 1
        fi
    fi
    
    if [ "$IOB_USE_GREEN_VOLUME" == "1" ]; then
        IOBVOLUME=$IOB_GREEN_VOLUME
        VOLUMEOPTION_DEFAULT=2
    else
        getPrefixedVariable IOBVOLUME $IOBVOLUME_DEFAULT
    fi
    
    getVariable BACKUPDIR $BACKUPDIR_DEFAULT
    getVariable SSH_DIR $SSH_DIR_DEFAULT
    
    # stop all iobroker containers
    IOB_RUNNING=$(docker container ls -q --filter name=^/$IOB_PREFIX)
    if [ "$IOB_RUNNING" != "" ]; then 
        echo -e "Stopping running containers: $IOB_RUNNING"
        docker stop $IOB_RUNNING
    fi
    
    
    # find out volume
    if [ -z $(docker volume ls --filter name=^$IOBVOLUME$ --format="{{ .Name }}") ] ; then 
        echo "    ... Creating ioBroker volume $IOBVOLUME ..."
        docker volume create $IOBVOLUME
        sleep 1
    else
        echo "    ... Docker volume $IOBVOLUME already exists!"
        echo -e "Volume handling:\n\t0: do nothing\n\t1: create auto backup\n\t2: clone volume and use new one"
        getVariable VOLUMEOPTION $VOLUMEOPTION_DEFAULT
        
        if [ "$VOLUMEOPTION" = "1" ]; then
            cloneVolume $IOBVOLUME $IOB_PREFIX-autobackup-$TIMESTAMP
        elif [ "$VOLUMEOPTION" = "2" ]; then
            NEWVOLUME_DEFAULT=$IOB_PREFIX-data-$(date +%Y%m%d)
            if [ "$(docker volume ls --filter name=^$NEWVOLUME_DEFAULT$ --format="{{ .Name }}")" != "" ] ; then 
                NEWVOLUME_DEFAULT=$IOB_PREFIX-data-$TIMESTAMP
            fi
            
            getPrefixedVariable NEWVOLUME $NEWVOLUME_DEFAULT
            
            if [ "$(docker volume ls --filter name=^$NEWVOLUME$ --format="{{ .Name }}")" != "" ] ; then 
                echo -e "$NEWVOLUME must not already exist!"
                exit 255
            fi
            cloneVolume $IOBVOLUME $NEWVOLUME
            IOBVOLUME=$NEWVOLUME
        fi
    fi
    
    if [ -z $(docker container ls -a --filter name=^/$IOBCONTAINER$ --format="{{.ID}}") ] ; then 
        echo -e "starting ... $IOBCONTAINER did not yet exist!"
    else
        IOB_OLDCONTAINER_DEFAULT=$IOBCONTAINER-$TIMESTAMP
        if [ "$IOBCONTAINER" = "$IOB_PREFIX-blue" ]; then
            if [ -z $IOB_GREEN_RUNNING ] ; then
                IOB_OLDCONTAINER_DEFAULT="$IOB_PREFIX-green"
            else
                echo -e "$IOB_PREFIX-green was currently running - so container backup will be $IOB_OLDCONTAINER_DEFAULT"
            fi
        fi
        
        echo "    ... Docker container $IOBCONTAINER already exists - have to rename!"        
        getPrefixedVariable IOB_OLDCONTAINER $IOB_OLDCONTAINER_DEFAULT
        
        if [ "$(docker container ls -a --filter name=^/$IOB_OLDCONTAINER$ --format=\"{{.ID}}\")" != "" ] ; then 
            docker rename $IOB_OLDCONTAINER $IOB_OLDCONTAINER-$TIMESTAMP
        fi
        docker rename $IOBCONTAINER $IOB_OLDCONTAINER
    fi

    getVariable IMMEDIATE_RUN 1
    if [ "$IMMEDIATE_RUN" = "1" ]; then
        run_iobroker
    fi
}

run_iobroker(){
    # create container
    
    getVariable IOBIMAGE $IOBIMAGE_DEFAULT
    getPrefixedVariable IOBCONTAINER $IOBCONTAINER_DEFAULT

    if [ "$(docker container ls --filter name=^/$IOBCONTAINER$ --format='{{.ID}}')" != "" ] ; then
        # container is running!
        echo -e "Container is active, stopping ..."
        docker stop $IOBCONTAINER
    fi    

    NETPARAMS_HOST='--network host'
    NETPARAMS_ADMIN='--cap-add=NET_ADMIN'
    
    # https://buanet.de/knowledge-base/verwendete-ports-in-iob/
    NETPARAMS_BASE='-p 8081:8081 -p 8082:8082'
    NETPARAMS_SIMPLEAPI='-p 8087:8087'
    NETPARAMS_HOMEMATIC='-p 2000:2000 -p 2001:2001 -p 2010:2010 -p 8701:8701'
    NETPARAMS_SCRIPTS='-p 1883:1883 -p 1884:1884'
    NETPARAMS_MULTIHOST='-p 9000:9000 -p 9001:9001'

    NETPARAMS_BRIDGED="$NETPARAMS_BASE $NETPARAMS_HOMEMATIC $NETPARAMS_SCRIPTS $NETPARAMS_SIMPLEAPI"
    
    if [ -f /dev/ttyACM0 ]; then
        PARAMS_ZIGBEE="--device /dev/ttyACM0"
    else
        echo -e "No Zigbee device configured!"
    fi

    PARAMS_DEVICES=$PARAMS_ZIGBEE

    docker run $NETPARAMS_BRIDGED \
               --restart unless-stopped \
               --name $IOBCONTAINER \
               -d \
               $PARAMS_DEVICES \
               -v $IOBVOLUME:/opt/iobroker \
               -v $BACKUPDIR:/opt/iobroker/backups \
               -v $SSH_DIR:/opt/iobroker/.ssh \
               -e AVAHI=false \
               -e "PACKAGES=joe mc jq net-tools libfontconfig1 mysql-client" \
               -e "NODE_TLS_REJECT_UNAUTHORIZED=0" \
               -e "OPENSSL_CONF=/etc/ssl/" \
               $IOBIMAGE
}

iobroker-do-upgrade-host(){
    if [ "$(docker container ls --filter name=^/$IOBCONTAINER$ --format='{{.ID}}')" != "" ] ; then
        # container is running!
        echo -e "Container is active, stopping ..."
        docker stop $IOBCONTAINER
    fi
    
    @echo docker run --rm -v $IOBVOLUME:/opt/iobroker --entrypoint iobroker $IOBIMAGE upgrade self
}

backup_iob(){
    echo -e "\n Backup "
    getPrefixedVariable IOBCONTAINER $IOBCONTAINER_DEFAULT
    getVariable BACKUP_IOBROKER 1
    getVariable BACKUP_MYSQL 1

    if [ "$BACKUP_IOBROKER" = "1" ]; then
    echo -e "\nBacking up ioBroker container $IOBCONTAINER ..."
      docker run --rm --volumes-from $IOBCONTAINER -v $(pwd):/backup $GPIMAGE tar czvf /backup/iobroker-$TIMESTAMP.tar.gz --exclude '/opt/iobroker/backups' /opt/iobroker
      # scp iobroker-$TIMESTAMP.tar.gz werner@pelican:/ssd/data/iobroker
    fi
    if [ "$BACKUP_MYSQL" = "1" ]; then
    echo -e "\nBacking up mySQL ... "
      mysqldump -u $MYSQL_USER -p$MYSQL_PASSWORD -h$MYSQL_HOST --quick --single-transaction iobroker | gzip -9 > mysql-$TIMESTAMP.gz
      # scp mysql-$TIMESTAMP.gz werner@pelican:/ssd/data/iobroker
    fi
}

restore_iob(){
    echo -e "\n Restore "
    getVariable BACKUPFILE
    getPrefixedVariable TARGETVOLUME iobroker-$TIMESTAMP

    docker volume create $TARGETVOLUME
    docker run --rm -v $TARGETVOLUME:/recover/opt/iobroker/ -v $(pwd):/backup $GPIMAGE bash -c "cd /recover && tar xvf /backup/$BACKUPFILE" > restore-$TIMESTAMP.log
}

restore_mysql(){
    echo -e "\n Restore MYSQL"
    getVariable MYSQL_BACKUPFILE

    
}



create_mysql_container(){
    getVariable MYSQL_CONTAINER mysql-iobroker
    MYSQL_VOLUME=mysql-iobroker-$TIMESTAMP
    MYSQL_IMAGE="mysql:5.7"
    INITFILE=/tmp/init.sql
    
    MYSQL_ROOT_PASS=TemProSp
    
    if [ -z MYSQL_USER ]; then
        echo "MYSQL_USER not defined"
        exit 1
    fi

    docker run -d --name mysql-iobroker -p 3306:3306 \
        -e MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASS \
        -e MYSQL_USER=$MYSQL_USER \
        -e MYSQL_PASSWORD=$MYSQL_PASSWORD \
        -e MYSQL_DATABASE=iobroker \
        $MYSQL_IMAGE
}

purge(){
    echo -e "\n !!! PURGE ioBroker installation\n"
    getPrefixedVariable IOBCONTAINER
    getPrefixedVariable IOBVOLUME
    echo -e "\nReally Purge? Type in \"YES\" if you want to purge container AND volume!"
    getVariable VERIFYPURGE "NO"
    
    if [ "$VERIFYPURGE" = "YES" ]; then
        echo -e "Stopping container $IOBCONTAINER ... " 
        docker stop $IOBCONTAINER
        sleep 1
        echo -e "Removing container $IOBCONTAINER ... " 
        docker rm $IOBCONTAINER
        sleep 1
        echo -e "Removing volume $IOBVOLUME ... "
        docker volume rm $IOBVOLUME
    fi
}

status(){
    echo -e "\nStatus:"
    echo -e "Running Container: "
    docker container ls --filter name="^$IOB_PREFIX" --format="{{.Names}}\t{{.Image}}"
    echo -e "\nAvailable Containers: "
    docker container ls -a --filter name="^$IOB_PREFIX" --format="{{.Names}}\t{{.Image}}"
    
    echo -e "\n Available Volumes: "
    docker volume ls --filter name="^$IOB_PREFIX"
}



########################################################################

# start with parsing the arguments
parseArguments "$@"


# find the right mode
if [ "$INTERNAL_MODE" = "-backup" ];
then
    backup_iob
elif [ "$INTERNAL_MODE" = "-restore" ];
then
    # restore volume
    restore_iob
elif [ "$INTERNAL_MODE" = "-mysql_restore" ];
then
    # restore volume
    create_mysql_container
elif [ "$INTERNAL_MODE" = "-create" ];
then
    createIOBContainer
elif [ "$INTERNAL_MODE" = "-clonevol" ];
then
    echo -e "\Clone volume! Target Volume must not exist yet!"
    getPrefixedVariable SOURCEVOL $IOBVOLUME_DEFAULT
    getPrefixedVariable TARGETVOL iobroker-data-backup-$TIMESTAMP
    cloneVolume $SOURCEVOL $TARGETVOL

elif [ "$INTERNAL_MODE" = "-status" ];
then
    status
elif [ "$INTERNAL_MODE" = "-devel" ];
then
    getPrefixedVariable IOB_TESTVAR test
    echo -e "Test variable is $IOB_TESTVAR"
elif [ "$INTERNAL_MODE" = "-purge" ];
then
    purge
elif [ -z "$INTERNAL_MODE" ];
then
  echo -e "~~~~~~~~~~~~~~~~~~~~ INFO ~~~~~~~~~~~~~~~~~~~~~~~~~"
	echo -e "Backup ioBroker:"
	echo -e "\t$0 -backup"
  echo -e "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  print_config
else
  echo -e "ERROR: unknown mode ${INTERNAL_MODE}"
fi
