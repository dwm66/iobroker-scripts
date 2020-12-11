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
- BACKUPDIR_DEFAULT Default directory for storing backups. Default is ~/iobroker_backups
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

The backup will store the volume backup in iobroker-$TIMESTAMP.tar.gz, the mySQL backup in mysql-$TIMESTAMP.tar.gz

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

### Create
Creates a new IOBroker container. This functionality is supporting heavily a blue/green deployment scheme.

Parameters for create are:
- IOBIMAGE  Image for container creation.
- IOBCONTAINER  Name for the new container. This is a prefixed variable. 
- IOBVOLUME Name for the iobroker volume to be used. The default is determined from the running configuration, see below.
- BACKUPDIR Backup directory on the host, used inside the container to mount for the backupmodule. Default is BACKUPDIR_DEFAULT
- SSH_DIR Direcory on the host containing SSH keys, mounted to the container. Default is SSH_DIR_DEFAULT
- VOLUMEOPION Determine behavior if the volume name already exists.
  - 0 do nothing
  - 1 create auto backup (default)
  - 2 clone volume and use new one (default if container name is "iobroker-blue", supporting blue/green)
  


### clonevol
Clone an existing volume.
Parameters for clonevol are:
- 


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
