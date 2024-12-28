#!/usr/bin/env node
'use strict';

// ############### Types ###############

type ServerConfig = {
  key: Buffer,
  cert: Buffer,
};

type SignalEvent = {
  recipient: string;
  sender: string;
  signal: any;
};

// ############### Logging ###############
import dotenv from 'dotenv';
dotenv.config();
import debug from 'debug';
debug.enable(process.env.DEBUG || "");

// ############### Imports ###############
import { networkInterfaces, NetworkInterfaceInfo } from 'os';
import * as fs from 'fs';
import express, { Request, Response, NextFunction, Application } from 'express';
import logger from 'morgan';
import * as https from 'https';
import { createServer } from 'https';
import { fileURLToPath } from 'url';
import path, { dirname, join} from 'path';
import { Server, Socket, Namespace } from 'socket.io';

// ############### SSL Setup ###############
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ssl_folder = join(__dirname, '..', 'ssl_certs');
const key_path = join(ssl_folder, 'localhost.key');
const cert_path = join(ssl_folder, 'localhost.crt');


// ############### Server Initialization ###############
const port = 3000;
const express_app = express(); // Create an Express app
express_app.set('port', port);
const config: ServerConfig = {
  key: fs.readFileSync(key_path),
  cert: fs.readFileSync(cert_path),
};

// ############### Express Setup ###############
express_app.use(logger('dev'));

// Serve static files from the 'public' directory
express_app.use(express.static(join(__dirname, '..')));

// Serve the index.html file for the root route
express_app.get('/', function(req: Request, res: Response) {
  res.sendFile(join(__dirname, '..', 'index.html'));
});

// Handle 404 errors using the default Express error handler
express_app.use(function(req: Request, res: Response, next: NextFunction) {
  res.status(404).send('Not Found');
});

// ############### HTTPS Server Function Definitions ###############
function createHttpsServer(express_app: Application): https.Server {
  try {
    const server = createServer({ key: config.key, cert: config.cert }, express_app);
    return server;
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}


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
  const network_interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces();
  const interfaces: string[] = [];
  // dev holds all the network interfaces on which the server is listening
  // details holds all the details for each object on that interface
  Object.keys(network_interfaces).forEach(function(dev) {
    if (network_interfaces[dev]) {
      network_interfaces[dev].forEach(function(details) {
        /**
         * Node v. 18+ returns a number (4, 6) for family;
         * earlier versions returned IPv4 or IPv6. This handles
         * both cases.
         */
        if (details.family.toString().endsWith('4')) {
          interfaces.push(`-> https://${details.address}:${port}/`);
          console.log(interfaces.join('\n'));
        }
      });
    }
  });
}

const https_server = createHttpsServer(express_app); // Create a HTTPS server and attach the Express app
https_server.listen(port);
https_server.on('error', handleError); // Used to handle errors during server start
https_server.on('listening', handleListening); // Used to handle successful server start


// function handleListening() {
//   const address = https_server.address();

//   const interfaces: string[] = [];
//   // dev holds all the network interfaces on which the server is listening
//   // details holds all the details for each object on that interface
//   Object.keys(networkInterfaces).forEach(function(dev) {
//     networkInterfaces[dev].forEach(function(details) {
//       /**
//        * Node v. 18+ returns a number (4, 6) for family;
//        * earlier versions returned IPv4 or IPv6. This handles
//        * both cases.
//        */
//       if (details.family.toString().endsWith('4')) {
//         interfaces.push(`-> ${config.protocol}://${details.address}:${port}/`);
//       }
//     });
//   });
//   debug(
//     `  ** Serving from the ${public_dir}/ directory. **

//   App available in your browser at:

//     ${interfaces.join('\n    ')}

//   Hold CTRL + C to stop the server.\n\n `
//   );
// }

// ############### Socket Server Setup ###############

const socket_server: Server = new Server(https_server);

const mp_namespaces = socket_server.of(/^\/[a-z]{4}-[a-z]{4}-[a-z]{4}$/);

mp_namespaces.on('connect', function(socket: Socket) {

  const namespace: Namespace = mp_namespaces;

  const peers: string[] = [];

  for (let peer of namespace.sockets.keys()) {
    peers.push(peer);
  }
  console.log(`    Socket namespace: ${namespace.name}`);

  // Send the array of connected-peer IDs to the connecting peer
  socket.emit('connected peers', peers);

  // Send the connecting peer ID to all connected peers
  socket.broadcast.emit('connected peer', socket.id);

  socket.on('signal', function({ recipient, sender, signal }: SignalEvent) {
    socket.to(recipient).emit('signal', { recipient, sender, signal });
  });

  socket.on('disconnect', function() {
    namespace.emit('disconnected peer', socket.id);
  });

});




