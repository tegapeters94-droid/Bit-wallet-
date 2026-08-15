// js/address.js
// Generates realistic-looking but entirely fake addresses for display
// purposes. These are NOT real wallet addresses and correspond to no
// real private key.

const HEX_CHARS = '0123456789abcdef';
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BECH32_CHARS = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function randomFrom(charset, length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out;
}

export function generateSimulatedAddress(format) {
  switch (format) {
    case 'hex40':
      return `0x${randomFrom(HEX_CHARS, 40)}`;
    case 'bech32':
      return `bc1q${randomFrom(BECH32_CHARS, 38)}`;
    case 'base58':
      return randomFrom(BASE58_CHARS, 44);
    default:
      return `0x${randomFrom(HEX_CHARS, 40)}`;
  }
}

export function generateSimulatedTxHash() {
  return `0x${randomFrom(HEX_CHARS, 64)}`;
}

export function shortenAddress(address, chars = 5) {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
