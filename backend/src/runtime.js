function createShutdownHandler({ server, database, stopScheduler, logger = console, timeoutMs = 10000 }) {
  let shutdownPromise;
  return function shutdown(signal = 'shutdown') {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      logger.info(JSON.stringify({ type: 'lifecycle', event: 'shutdown_start', signal }));
      stopScheduler();
      let timer;
      try {
        await Promise.race([
          new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Graceful shutdown timed out.')), timeoutMs); timer.unref?.(); }),
        ]);
        await database.end();
        logger.info(JSON.stringify({ type: 'lifecycle', event: 'shutdown_complete' }));
      } catch (error) {
        logger.error(JSON.stringify({ type: 'lifecycle', event: 'shutdown_failure', code: error.code || error.name }));
        throw error;
      } finally { clearTimeout(timer); }
    })();
    return shutdownPromise;
  };
}

module.exports = { createShutdownHandler };
