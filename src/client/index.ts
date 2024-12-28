import { io } from 'socket.io-client';

interface GenerateRandomAlphaStringOptions {
  separator: string;
  groups: number[];
}
interface PrepareNamespaceOptions {
  hash: string;
  set_location: boolean;
}

function generateRandomAlphaString(separator: string, ...groups: number[]): string {
  const alphabet = 'bcdfghjklmnpqrstvwxyz1234567890';
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

function prepareNamespace({ hash, set_location }: PrepareNamespaceOptions): string {
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[a-z]{4}-[a-z]{4}-[a-z]{4}$/.test(ns)) {
    console.log(`Checked existing namespace '${ns}'`);
    return ns;
  }
  ns = generateRandomAlphaString('-', 4, 4, 4);
  console.log(`Created new namespace '${ns}'`);
  if (set_location) window.location.hash = ns;
  return ns;
}

document.addEventListener('DOMContentLoaded', () => {
    const namespace = prepareNamespace({hash:window.location.hash, set_location: true});

    const socket = io(`https://localhost:3000/${namespace}`, { autoConnect: false });

    console.log('Socket.IO client initialized');

    socket.on('connect', () => {
      console.log('Connected to server');
    });
  });
