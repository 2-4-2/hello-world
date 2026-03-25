const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function createLogger(level = 'info') {
  const currentLevel = levels[level] ?? levels.info;

  const shouldLog = (targetLevel) => levels[targetLevel] <= currentLevel;

  const log = (targetLevel, message, meta) => {
    if (!shouldLog(targetLevel)) return;
    const now = new Date().toISOString();
    const text = `[${now}] [${targetLevel.toUpperCase()}] ${message}`;
    if (meta) {
      console[targetLevel === 'debug' ? 'log' : targetLevel](text, meta);
      return;
    }
    console[targetLevel === 'debug' ? 'log' : targetLevel](text);
  };

  return {
    error: (message, meta) => log('error', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    info: (message, meta) => log('info', message, meta),
    debug: (message, meta) => log('debug', message, meta),
  };
}

module.exports = { createLogger };
