var connect = require('connect');
var http = require('http');

var app = connect();
var excuteFn = [];

app.use('/', (req, res, next) => {
  excuteFn.push('[request-handling] middleware-1');
  console.log('[request-handling] middleware-1');
  next();
});

app.use('/', (err, req, res, next) => {
  excuteFn.push('[error-handling] middleware-2');
  console.log('[error-handling] middleware-2');
  next();
});

app.use('/', (req, res, next) => {
  excuteFn.push('[request-handling] middleware-3');
  console.log('[request-handling] middleware-3');
  next('some error in [request-handling] middleware-3');
});

app.use('/', (req, res, next) => {
  excuteFn.push('[request-handling] middleware-4');
  console.log('[request-handling] middleware-4');
  next();
});

app.use('/', (err, req, res, next) => {
  excuteFn.push('[error-handling] middleware-5');
  console.log(`deal with error: [${err}]`);
  next();
});

app.use('/', (req, res, next) => {
  excuteFn.push('request-handling middleware-6');
  console.log('request-handling middleware-6');
  res.end(`excuteFn:  ${excuteFn.join(' => ')}`);
});

//create node.js http server and listen on port
http.createServer(app).listen(3000);
console.log('open localhost:3000');