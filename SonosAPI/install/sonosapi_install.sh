#!/bin/bash

SONOSAPI_USER=sonosapi
SONOSAPI_DIR=/opt/sonosapi
SONOSAPI_SERVICE=sonosapi

SONOSAPI_SERVICE_FILE=/etc/systemd/system/$SONOSAPI_SERVICE.service

sonosapi_user(){
  useradd --system --home-dir $SONOSAPI_DIR --shell /bin/bash $SONOSAPI_USER
  mkdir -p $SONOSAPI_DIR
  chown $SONOSAPI_USER:$SONOSAPI_USER $SONOSAPI_DIR
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

# sonosapi_uninstall
sonosapi_user
sonosapi_install
sonosapi_service
