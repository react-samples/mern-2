
var winston = require('winston')
var config = require('../configuration');
   
function Logger(){
  return winston.add(winston.transports.File, {
    filename: "log/warning.log",
    maxsize: 1048576,
    maxFiles: 3,
    level: "warn"
  });
}

module.exports = new Logger();