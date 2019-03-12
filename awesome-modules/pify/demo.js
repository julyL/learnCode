const pify = require('pify');
const fs = require('fs');


pify(fs).readFile(__filename, 'utf-8').then(res => {
    console.log(res);
})