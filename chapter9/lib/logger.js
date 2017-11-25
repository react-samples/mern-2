var winston = require('winston')

function Logger(){
  return winston.add(winston.transports.File, {
    filename: "log/warning.log",
    maxsize: 1048576,
    level: "warn"
  });
}

module.exports = new Logger();
