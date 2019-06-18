FROM node

WORKDIR /opt/kaltura/manager
ADD . ./

RUN npm install

CMD npm start

ARG VERSION
LABEL version=${VERSION}