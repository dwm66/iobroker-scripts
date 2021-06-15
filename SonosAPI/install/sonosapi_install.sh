#!/bin/bash

SONOSAPI_USER=sonosapi
SONOSAPI_DIR=/opt/sonosapi
SONOSAPI_SERVICE=sonosapi

# get the variable requested
getVariable()
{
  input=$1

  # check if variable empty
  if [ -z "${!input}" ];
  then
    # is empty
    echo -n -e "Please input $input: "
    read $1
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

# start with parsing the arguments
parseArguments "$@"

sonosapi_user(){
  # $1 - Username
  # $2 - Directory
  useradd --system --home-dir $2 --shell /bin/bash $1
  mkdir -p $2
  chown $1:$1 $2
}


sonosapi_install() {
  cd $SONOSAPI_DIR
  su -c 'wget https://github.com/jishi/node-sonos-http-api/archive/master.zip' $SONOSAPI_USER
  su -c 'unzip master.zip' $SONOSAPI_USER
  su -c 'cd node-sonos-http-api-master && npm install --production' $SONOSAPI_USER
  rm master.zip
}

sonosapi_service() {
echo Writing $SONOSAPI_SERVICE_FILE
cat << EOF > $SONOSAPI_SERVICE_FILE
[Unit]
Description=Sonos HTTP API Daemon
After=syslog.target network.target

[Service]
Type=simple
User=$SONOSAPI_USER
ExecStart=/usr/bin/node $SONOSAPI_DIR/node-sonos-http-api-master/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl enable $SONOSAPI_SERVICE
systemctl start $SONOSAPI_SERVICE
}

sonosapi_uninstall() {
    systemctl stop $SONOSAPI_SERVICE
    systemctl disable $SONOSAPI_SERVICE
    rm -rf $SONOSAPI_DIR
    userdel $SONOSAPI_USER
    rm $SONOSAPI_SERVICE_FILE
}

if [ "$INTERNAL_MODE" = "-install" ];
then 
  echo -e "\nInstalling Sonos API"

  getVariable SONOSAPI_USER
  getVariable SONOSAPI_DIR
  getVariable SONOSAPI_SERVICE
  SONOSAPI_SERVICE_FILE=/etc/systemd/system/$SONOSAPI_SERVICE.service
  
  sonosapi_user $SONOSAPI_USER $SONOSAPI_DIR
  sonosapi_install
  sonosapi_service

elif [ "$INTERNAL_MODE" = "-remove" ];
then
  echo -e "\nRemoving Sonos API"
  getVariable SONOSAPI_USER
  getVariable SONOSAPI_DIR
  getVariable SONOSAPI_SERVICE
  SONOSAPI_SERVICE_FILE=/etc/systemd/system/$SONOSAPI_SERVICE.service
  sonosapi_uninstall
fi


