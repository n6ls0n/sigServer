#!/usr/bin/env node
'use strict';

/**
 *  Logging
 */
require('dotenv').config();
const debug = require('debug')(process.env.DEBUG);

/**
 *  SSL Setup
 */
const ssl_folder = path.join(__dirname, 'ssl_certs');
const key_path = path.join(ssl_folder, 'localhost.key');
const cert_path = path.join(ssl_folder, 'localhost.crt');
const {server, protocol} = selectServer(key_path, cert_path);

const ifaces = require('os').networkInterfaces();
const fs = require('fs');


const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const io = require('socket.io')();


// Create an Express app
const app = express();

// Set the public directory to serve from
const public_dir = process.env.PUBLIC ?? 'www';


// Log activity to the console
app.use(logger('dev'));

// Serve static files from the `www/` directory
app.use(express.static(path.join(__dirname, public_dir)));

// Catch 404 errors and forward them to error handler
app.use(function(req, res, next) {
  next(createError(404));
});
// Handle errors with the error handler
app.use(function(err, req, res, next) {
  // Set the error code
  res.status(err.status || 500);
  // Respond with a static error page (404 or 500)
  res.sendFile(`error/${err.status}.html`, { root: __dirname });
});


const mp_namespaces = io.of(/^\/[a-z]{4}-[a-z]{4}-[a-z]{4}$/);

mp_namespaces.on('connect', function(socket) {

  const namespace = socket.nsp;

  const peers = [];

  for (let peer of namespace.sockets.keys()) {
    peers.push(peer);
  }
  console.log(`    Socket namespace: ${namespace.name}`);

  // Send the array of connected-peer IDs to the connecting peer
  socket.emit('connected peers', peers);

  // Send the connecting peer ID to all connected peers
  socket.broadcast.emit('connected peer', socket.id);

  socket.on('signal', function({ recipient, sender, signal }) {
    socket.to(recipient).emit('signal', { recipient, sender, signal });
  });

  socket.on('disconnect', function() {
    namespace.emit('disconnected peer', socket.id);
  });

});

app.set('port', '3030');

/**
 *  Attach socket.io to the web server.
 */
io.attach(server);

/**
 *  Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', handleError);
server.on('listening', handleListening);

/**
 *  Look for keys and set the server accordingly.
 */

function selectServer(k, c) {
  const config = {};
  if (k && c) {
    try {
      const key = fs.readFileSync(k);
      const cert = fs.readFileSync(c);
      config.protocol = 'https';
      config.server = require(config.protocol).createServer({key: key, cert: cert }, app);
    } catch(e) {
      console.error(e);
      process.exit(1);
    }
  } else {
    debug(' WARNING: Your server is using \'http\', not \'https\'.\n Some things might not work as expected.\n');
    config.protocol = 'http';
    config.server = require(config.protocol).createServer(app);
  }
  return config;
}

/**
 *  Event listener for HTTP server "error" event.
 */

function handleError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  switch (error.code) {
  case 'EADDRINUSE':
    console.error(`Port ${port} is already being used`);
    process.exit(1);
    break;
  case 'EACCES':
    console.error(`Port ${port} requires elevated user privileges (sudo)`);
    process.exit(1);
    break;
  default:
    throw error;
  }
}

/**
 *  Callback for server listen event
 */

function handleListening() {
  const address = server.address();
  // Inspired by https://github.com/http-party/http-server/blob/master/bin/http-server#L163
  const interfaces = [];
  Object.keys(ifaces).forEach(function(dev) {
    ifaces[dev].forEach(function(details) {
      /**
       * Node v. 18+ returns a number (4, 6) for family;
       * earlier versions returned IPv4 or IPv6. This handles
       * both cases.
       */
      if (details.family.toString().endsWith('4')) {
        interfaces.push(`-> ${protocol}://${details.address}:${address.port}/`);
      }
    });
  });
  debug(
    `  ** Serving from the ${public_dir}/ directory. **

  App available in your browser at:

    ${interfaces.join('\n    ')}

  Hold CTRL + C to stop the server.\n\n `
  );
}
