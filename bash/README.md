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

In this scripts, we store /opt/iobroker in a docker volume. So, the script also provides the mechanisms to clone
the volumes.

## iobrokerctl.sh

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
- -status Show current status

### Backup

Parameters for backup are:
- IOBCONTAINER  name of the container for backup.
- BACKUP_IOBROKER if set to 1, will backup the volume of the container
- BACKUP_MYSQL  if set to 1, will backup the mySQL database



