const fs = require('fs');

function readJSON(filename, callback) {
    var data = fs.readFileSync(filename, 'utf8');
    callback(null, JSON.parse(data));
};

// readJSON是同步执行的,内部抛出的异常可以被直接try catch
try {       
    readJSON("./data.json", (err, data) => {
        console.log(err, data);
    });
} catch (err) {
    console.log('catch error: JSON parsing exception\n',err);
}

console.log("log: 0");
setTimeout(() => {
  console.log("log: 1");
}, 1000);

process.on("uncaughtException", err => {
  console.log("uncaughtException:", err);
  process.exit(1);
});