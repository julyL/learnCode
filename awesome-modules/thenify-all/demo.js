var thenifyAll = require('thenify-all');

var fs = thenifyAll(require('fs'), {}, [
    'readFile',
    'writeFile',
]);

fs.readFile(__filename).then(function (buffer) {
    console.log(buffer.toString());
});

// console.log(fs)