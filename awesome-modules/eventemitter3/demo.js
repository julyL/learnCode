var EventEmitter = require('./eventemitter3');
// var EventEmitter = require('eventemitter3');
var EE = new EventEmitter();

function emitted(arg) {
    console.log('emitter args:', arg); // true
}

EE.once('event-1', emitted);
EE.on('event-2', emitted);

// EE.removeListener('event-2', emitted);
EE.emit('event-2', '22');