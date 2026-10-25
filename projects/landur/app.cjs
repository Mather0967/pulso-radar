// cPanel / Passenger startup file. Keep CommonJS here; the application uses ESM.
import('./server/index.mjs').catch(error => {
  console.error('LANDUR no pudo arrancar:', error.code || error.name);
  console.error('Revisá la configuración con npm run check:host; no se imprimen secretos.');
  process.exitCode = 1;
});
