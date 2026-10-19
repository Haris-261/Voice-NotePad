import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url) });
const { default: app } = await import('./app.js');
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, () => console.log(`API running on http://localhost:${port}`));
server.ref();
server.on('error', error => {
  console.error(`Backend failed to start on port ${port}:`, error.message);
  process.exitCode = 1;
});
const shutdown = signal => {
  console.log(`${signal} received. Closing API server…`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
