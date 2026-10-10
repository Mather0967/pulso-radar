# Monitor local

Iniciar `npm start` y, en otra terminal, ejecutar `npm run monitor`. También se puede revisar desde Agente de mercado en la interfaz. No hay tarea automática activada.

El monitor compara negocios y publicaciones, guarda historial en data/market/latest.json y conserva la última captura válida si una fuente falla. La primera revisión establece una base. Los resultados son acotados y no prueban demanda comercial.

Se usa el servidor como único escritor: no iniciar varios procesos con el mismo DATA_DIR. Para limpiar un entorno de prueba, detener el servidor y mover data/ a una carpeta de respaldo. No versionar capturas de desarrollo o secretos.

