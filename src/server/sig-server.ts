#!/usr/bin/env node
'use strict';

/**
 *  Types
 */
type Protocol = 'https';
type ServerConfig = {
  protocol: Protocol,
  key: Buffer,
  cert: Buffer,
};
type NetworkInterfaceInfo = {
  address: string;
  netmask: string;
  family: string;
  mac: string;
  internal: boolean;
  cidr: string;
  scopeid?: number;
};

type NetworkInterfaces = {
  [key: string]: NetworkInterfaceInfo[];
};

/**
 *  Logging
 */
require('dotenv').config();
const debug = require('debug')(process.env.DEBUG);

/**
 *  Imports
 */
const networkInterfaces: NetworkInterfaces = require('os').networkInterfaces(); // Get network interfaces for this machine
const fs = require('fs');
const io = require('socket.io')
const express = require('express');
const logger = require('morgan');
import * as https from 'https';
import { Request, Response, NextFunction, Application } from 'express';
import createHttpError from 'http-errors';
import { Socket } from 'dgram';

/**
 *  SSL Setup
 */
const path = require('path');
const ssl_folder = path.join(__dirname, 'ssl_certs');
const key_path = path.join(ssl_folder, 'localhost.key');
const cert_path = path.join(ssl_folder, 'localhost.crt');


/**
 *  Server Initializations
 */
const io_app = io();
const express_app = express(); // Create an Express app
const https_server = createHttpsServer(express_app); // Create a HTTPS server and attach the Express app
const port = 3000;
const public_dir = __dirname; // Set the public directory to serve from
const config: ServerConfig = {
  protocol: 'https',
  key: fs.readFileSync(key_path),
  cert: fs.readFileSync(cert_path),
};

/**
 *  Socket.io Setup
 */
const mp_namespaces = io_app.of(/^\/[a-z]{4}-[a-z]{4}-[a-z]{4}$/);

mp_namespaces.on('connect', function(socket: Socket) {

  const namespace = mp_namespaces;

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


/**
 *  Express Setup
 */


express_app.use(logger('dev')); // Log activity to the console
express_app.use(express.static(public_dir)); // Serve static files from the script directory

// Catch 404 errors and forward them to error handler
express_app.use(function(req: Request, res: Response, next: NextFunction) {
  next(createHttpError(404));
});

// Handle errors with the error handler
express_app.use(function(err: createHttpError.HttpError, req: Request, res: Response, next: NextFunction) {
  // Set the error code
  res.status(err.status || 500);
  // Respond with a static error page (404 or 500)
  res.sendFile(`error/${err.status}.html`, { root: __dirname });
});

/**
 *  HTTPS Server Function Definitions
 */

function createHttpsServer(express_app: Application): https.Server {
  try {
    const server = require(config.protocol).createServer({key: config.key, cert: config.cert}, express_app);
    return server;
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

/**
 * Handle errors from the HTTPS server.
 *
 * This function is called when the HTTPS server encounters an error
 * while listening on a port. If the error is not a listen error, it
 * is re-thrown. If the error is a listen error, the function prints
 * an error message (depending on the error code) and exits the
 * process with a status code of 1.
 *
 * @param {NodeJS.ErrnoException} error - the error from the HTTPS server.
 */
function handleError(error: NodeJS.ErrnoException) {
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

function handleListening() {
  const address = https_server.address();

  const interfaces: string[] = [];
  // dev holds all the network interfaces on which the server is listening
  // details holds all the details for each object on that interface
  Object.keys(networkInterfaces).forEach(function(dev) {
    networkInterfaces[dev].forEach(function(details) {
      /**
       * Node v. 18+ returns a number (4, 6) for family;
       * earlier versions returned IPv4 or IPv6. This handles
       * both cases.
       */
      if (details.family.toString().endsWith('4')) {
        interfaces.push(`-> ${config.protocol}://${details.address}:${port}/`);
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


express_app.set('port', port);
io_app.attach(https_server);
https_server.listen(port);
https_server.on('error', handleError);
https_server.on('listening', handleListening);
