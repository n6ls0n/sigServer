import { io } from 'socket.io-client';

const port = process.env.PORT
const host = process.env.HOST
const https = process.env.HTTPS
const http = process.env.HTTP
if (!port || !host || !https || !http) {
  console.error('Missing required environment variables');
}
let protocol;
if (process.env.ENV === 'dev') {
  protocol = https;
} else if (process.env.ENV === 'prod') {
  protocol = http;
}
const base_url = `${protocol}://${host}:${port}`;

function generateRandomAlphaString(separator: string, ...groups: number[]): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let ns: string[] = [];
  for (let group of groups) {
    let str = '';
    for (let i = 0; i < group; i++) {
      str += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    ns.push(str);
  }
  return ns.join(separator);
}

function prepareNamespace( hash: string, set_location: boolean ): string {
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[a-z]{4}-[a-z]{4}-[a-z]{4}$/.test(ns)) {
    console.log(`Checked existing namespace '${ns}'`);
    if (set_location) window.location.hash = ns;
  } else {
    ns = generateRandomAlphaString('-', 4, 4, 4);
    console.log(`Created new namespace '${ns}'`);
    if (set_location) window.location.hash = ns;
  }
  return ns;
}

const namespace = prepareNamespace(window.location.hash, true);

document.addEventListener('DOMContentLoaded', () => {
  const socket = io(`${base_url}/${namespace}`, { autoConnect: true});

  console.log('Socket.IO client initialized');

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('connected peers', (peers: string[]) => {
    console.log(`Connected peers: ${peers.join(', ')}`);
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });
});
