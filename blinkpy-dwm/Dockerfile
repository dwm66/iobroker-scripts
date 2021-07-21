FROM dockerhub.gemalto.com/gemalto/alpine.python3:3.9.5-874-alpine.3.14

USER root

# install packages
RUN apk add python3-dev build-base linux-headers pcre-dev libffi-dev openssl-dev

# upgrade pip
RUN pip3 install --upgrade pip

# Copy the requirements for prod in order to update the baseimage if required
COPY requirements_prod.txt requirements_prod.txt
RUN pip3 install -r requirements_prod.txt

USER trent

# Copy stuff
COPY --chown=bob:gemalto src/server/conf.ini ${APP_LIB}/src/server/
COPY src/server/*.py ${APP_LIB}/src/server/

ENV FLASK_APP=app

# start
USER bob
WORKDIR ${APP_LIB}
EXPOSE 5000
CMD uwsgi src/server/conf.ini
