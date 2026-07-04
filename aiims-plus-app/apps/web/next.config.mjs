/** @type {import('next').NextConfig} */
export default {
  // BFF pattern (SDR-0001): tokens live server-side; the browser never holds
  // long-lived secrets. Route handlers under app/api act as the BFF layer
  // when the frontend stage lands.
  reactStrictMode: true,
};
