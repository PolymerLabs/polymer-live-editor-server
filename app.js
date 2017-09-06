/**
 * Copyright 2017, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const express = require('express');
const fs = require('fs');

const privateKey = fs.readFileSync('key.pem').toString();
const certificate = fs.readFileSync('cert.pem').toString();
const credentials = {key: privateKey, cert: certificate};

const app = express();

const https = require('https').Server(credentials, app);
const io = require('socket.io')(https);

app.use('/src', express.static(__dirname + '/src'));
app.use('/bower_components', express.static(__dirname + '/src/bower_components'));
app.use('/node_modules', express.static(__dirname + '/src/node_modules'));

app.get('/', (req, res) => {
  // TODO (eblaine): load whitelisted domains from file once the editor is live
  var options = {
    headers: {
      'Content-Security-Policy': "frame-ancestors 'self'"
    }
  }
  options = {};
  res.sendFile(__dirname + '/src/index.html', options);
});

app.get('/update-demo/:socketId/:filename', (req, res) => {
  const socketId = req.params.socketId;
  const filename = req.params.filename;
  let socket = io.sockets.connected[socketId];
  if (!socket) {
    return res.status(400).send('Demo does not exist or was not initialized');
  }

  socket.emit('html-import-request', filename);

  function responseCallback(fileData) {
    if (filename !== fileData.filename) return;

    res.status(200).send(fileData.content);
    socket.removeListener('html-import-response', responseCallback);
    socket.removeListener('html-import-error', errorCallback);    
  };

  function errorCallback(errorData) {
    if (filename !== errorData.filename) return;
  
    res.status(404).send(errorData.message);
    socket.removeListener('html-import-error', errorCallback);
    socket.removeListener('html-import-response', responseCallback);
  };

  socket.on('html-import-response', responseCallback);
  socket.on('html-import-error', errorCallback);
});

app.get('*', (req, res) => {
  res.status(404).send('Not found');
});

// connection made when client loads
// initializes socket for handling HTML imports in user code
io.on('connection', function(socket){
  socket.on('client-connection', function() {
    socket.emit('server-acknowledgement', socket.id);
    socket.join(socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
https.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
