# Bash scripts for IOBroker containers

## Basics

This section contains bash scripts for managing iobroker containers. The intended setup is

- Linux computer, having docker installed
- having iobroker setup inside a containers
- having iobroker stored inside a volume
- manage different versions of iobroker

The docker image these scripts rely on are the "buanet" iobroker image, please refer here to https://github.com/buanet/docker-iobroker

IOBroker is not really perfect for running from docker - as the separation between the user configuration, data and
the iobroker software is not really clear. In fact, the whole thing is installed inside the
/opt/iobroker
directory.
So, the container image is basically "just" the basic installation, providing the node.js environment.
The iobroker itself is in /opt/iobroker, which has e.g. to be propagated between updates. The separation is given
through the "backup" mechanism.
If you want to propagate the full /opt/iobroker directory, you have to run updates on the iobroker installation to
have version consistency on node.js, the node modules and iobroker.

In this scripts, we store /opt/iobroker in a docker volume. So, the script mostly operates on the volumes!

# iobrokerctl.sh

This script has to be called from the command line, using

```
>$ ./iobrokerctl.sh [command] [parameter list]
```

Basically, the commands always need some parameters set. The parameters can be set inside the parameter list,
if not given there they are interactively asked on the terminal.

Commands can be:
- -backup Backup an iobroker container - which is backing up the volume and database
- -restore Restore a backup
- -create Create a new IOB container
- -clonevol Clone a docker volume
- -purge Purge a container and according volume. Attention: ITs GONE AFTERWARDS!!!
- -status Show current status

## Configuration, configuration file
There are a few settings which can be set in a configuration file. If a configuration file does not exist, a default is taken which is defined
inside the script. The default file name for the config file is "~/.iobrokerctl.config", so its located in the users home directory.

- TIMESTAMP The timestamp format. Default is set to $(date +%Y-%m-%d-%H%M%S%Z), which is Year-Month-Day-HourMinuteSeconds
- IOBVOLUME_DEFAULT Default name for IOBroker volumes. This is set by default to iobroker-data-$(date +%Y%m%d), so its containing the creation date.
- IOBCONTAINER_DEFAULT Default name for the container. Default is "iobroker-blue", to support a "blue/green" deployment scheme.
- BACKUPDIR_DEFAULT Default directory for storing backups. Default is ~/iobroker_backups. This is the backup directory which will be mounted as a volume to the iobroker container,
  not for the backup option of this script.
- SSH_DIR_DEFAULT Default directory for SSH keys. See below.
- IOB_PREFIX Prefix for "prefixed variables", default "iobroker"
- MYSQL_USER  User for mySQL database backup. If not set, database backups are disabled.
- MYSQL_PASSWORD  Password for mysql database backup. If not set, database backups are disabled.

## Commands
### Backup
Parameters for backup are:
- IOBCONTAINER  name of the container for backup, prefixed variable.
- BACKUP_IOBROKER if set to 1, will backup the volume of the container
- BACKUP_MYSQL  if set to 1, will backup the mySQL database

In order for the mySQL backup to work, the parameters MYSQL_HOST, MYSQL_USER and MYSQL_PASSWORD have to be set, either in the config or as environment variables.

The backup will store the volume backup in iobroker-$TIMESTAMP.tar.gz, the mySQL backup in mysql-$TIMESTAMP.gz

Example:
```
$ ./iobrokerctl.sh -backup IOBCONTAINER=iobroker-blue BACKUP_IOBROKER=1 BACKUP_MYSQL=1
```

[ ] TODO: Make result filenames configurable, or at least make them dependent to container name

### Restore
This will restore a VOLUME from a backup file.

Parameters for restore are:
- BACKUPFILE  Name of the backup file (.tar.gz)
- TARGETVOLUME  Name of the volume restored. This is a prefixed variable, the default is iobroker-$TIMESTAMP

### Purge

Purges a container and its associated volume. Attention: This is NOT recoverable.

### Create
Creates a new IOBroker container. This functionality is supporting heavily a blue/green deployment scheme.

Parameters for create are:
- IOBIMAGE  Image for container creation.
- IOBCONTAINER  Name for the new container. This is a prefixed variable. 
- IOBVOLUME Name for the iobroker volume to be used. The default is determined from the running configuration, see below.
- BACKUPDIR Backup directory on the host, used inside the container to mount for the backupmodule. Default is BACKUPDIR_DEFAULT
- SSH_DIR Direcory on the host containing SSH keys, mounted to the container. Default is SSH_DIR_DEFAULT
- VOLUMEOPION Determine behavior if the volume name already exists.
  - 0 do nothing and simply use it
  - 1 create auto backup (default)
  - 2 clone volume and use new one (default if container name is "iobroker-blue", supporting blue/green)

There are some more advanced options:
- IOB_USE_GREEN_VOLUME  In the case a "iobroker-green" container is running, you can set this option to "1"
  in order to use the volume attached to this container instead of IOBVOLUME. VOLUMEOPTION will be set to 2 
  automatically in this case.
- IOB_OLDCONTAINER If the container name already exists, it will be renamed to IOB_OLDCONTAINER. If set, this name
  should contain e.g. the timestamp in order to be unique.


### clonevol

Clone an existing volume.
Parameters for clonevol are:
- SOURCEVOL Source volume
- TARGETVOL Target volume
Defaults asked will be the IOB default volume, and a target volume called iobroker-data-backup-$TIMESTAMP.

### Status
This will return the current status of iobroker containers:
```
$ ./iobrokerctl.sh -status

Status:
Running Container: 
iobroker-blue	buanet/iobroker:v4.2.0

Available Containers: 
iobroker-blue	buanet/iobroker:v4.2.0
iobroker-green	buanet/iobroker:v4.1.0
iobroker-green-2020-06-02-112916CEST	buanet/iobroker:v3.1.0

 Available Volumes: 
DRIVER              VOLUME NAME
local               iobroker-data-20200215
local               iobroker-data-20200225
local               iobroker-data-20200602
local               iobroker_data
local               iobroker_data_2
```

## Common tasks and use cases

In general, this section will always assume the system is using some blue/green
deployment scheme. What does this mean?

The actual configuration is to be the "blue" version. This is where all the 
daily work, updates etc. go.
A configuration consists of the iobroker-container with its associated volume.
Please be aware all the iobroker stuff, including the software is in the volume.
The container gives basically the OS and node installation.

In the "green" configuration, we keep the "last good" version. This is a 
fallback: If something - anything goes wrong with the blue config, we simply
switch over to green and have a working system back.
Lets say you did some updates before you're going into a three week vacation
and after two days you realize, the system broke down. You most likely have
neither time nor possibility to dig into and find the problem.
But you can easily switch to the last good version:

```
$ docker stop iobroker-blue
$ docker run iobroker-green
```

### Daily backup

A daily backup can store the current state of the iobroker volume in a tar.gz
file and recover from there.

```
./iobrokerctl.sh -backup IOBCONTAINER=iobroker-blue BACKUP_IOBROKER=1 BACKUP_MYSQL=1
```

### Restore a backup

The restore option recovers a .tar.gz file into a volume. Most likely, you want
to run that in a new container, which ... also most likely, should replace
the blue configuration.

```
export TIMESTAMP=$(date +%Y-%m-%d-%H%M%S%Z)
export IOBCONTAINER=iobroker-blue

./iobrokerctl.sh -restore BACKUPFILE=iobroker-2021-01-03.tar.gz TARGETVOLUME=iobroker-data-2020-07-01
./iobrokerctl.sh -create IOBCONTAINER=iobroker-blue IOB_USE_GREEN_VOLUME=0 VOLUMEOPTION=0

```

### Update to a newer version of buanet/iobroker

First of all, clone the volume of your running iobroker container. A version update (which is normally a version jump in nodejs) will have major impact, and should be done apart from the running system. So first, find out which volume is attached to your container (iobroker-blue, normally) and clone it:

```
./iobrokerctl.sh -clonevol SOURCEVOL=iobroker-data-2023-03-20 TARGETVOL=iobroker-data-2023-08-30
```
The names for source and target volume are examples, of course.

Having the cloned container, we have now the possibility to start the new version of the container. We use a temporary container for that:

```
docker run --rm -it -v iobroker-data-2023-08-30:/opt/iobroker --entrypoint /bin/bash buanet/iobroker:v8.1.0
```
Using the --entrypoint option, we have now a shell on the temporary container, without starting iobroker.
We can use now the reinstall.sh script to get everything up to date. Afterwards, the fixer should run:

```
> ./reinstall.sh
> npm rebuild
> ./iobroker fix
```

Afterwards, the new container can be started with a

```
./iobrokerctl.sh -create
```


### Scratchpad
```
docker run --rm -it --volumes-from iobroker-blue --entrypoint ./iobroker buanet/iobroker:v4.2.0 upgrade self
docker run --rm -it -v iobroker-data-2021-06-21:/opt/iobroker --entrypoint ./iobroker buanet/iobroker:v4.2.0 upgrade self
```
