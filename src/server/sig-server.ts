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

// ############### Imports ###############
import { networkInterfaces, NetworkInterfaceInfo } from 'os';
import * as fs from 'fs';
import express, { Request, Response, NextFunction, Application } from 'express';
import logger from 'morgan';
import * as https from 'https';
import { createServer } from 'https';
import * as http from 'http';
import { createServer as createHTTPServer } from 'http';
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
const https_config: ServerConfig = {
  key: fs.readFileSync(key_path),
  cert: fs.readFileSync(cert_path),
};

// ############### Express Setup ###############
// express_app.use(logger('dev'));

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
    const server = createServer({ key: https_config.key, cert: https_config.cert }, express_app);
    return server;
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

function createHttpServer(express_app: Application): http.Server {
  try {
    const server = createHTTPServer(express_app);
    return server;
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

function createFinalServer(): https.Server | http.Server | undefined {
  if(process.env.ENV === 'dev'){
    const https_server = createHttpsServer(express_app); // Create a HTTPS server and attach the Express app
    https_server.listen(port);
    https_server.on('error', handleError); // Used to handle errors during server start
    https_server.on('listening', handleListening); // Used to handle successful server start
    return https_server;
  } else if(process.env.ENV === 'prod'){
    const http_server = createHttpServer(express_app);
    http_server.listen(port);
    http_server.on('error', handleError);
    http_server.on('listening', handleListening);
    return http_server;
  }
  return undefined;
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
  console.log(`Server listening on port ${port}`);
}

const finalServer = createFinalServer();

// ############### Socket Server Setup ###############
const socket_server: Server = new Server(finalServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const mp_namespaces = socket_server.of(/^\/[a-z]{4}-[a-z]{4}-[a-z]{4}$/);

mp_namespaces.on('connect', function(socket: Socket) {

  const namespace = socket.nsp;

  console.log(`    Socket namespace: ${namespace.name}`);
  console.log(`    Socket connected: ${socket.id}`);

  const peers: string[] = [];

  for (let peer of namespace.sockets.keys()) {
    peers.push(peer);
  }

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




