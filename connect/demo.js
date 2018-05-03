var connect = require('connect');
var http = require('http');

var app = connect();

app.use('/a', function (req, res, next) {
  res.end('req.url:', req.url)
  next();
})

app.use(function (req, res) {
  res.end('Hello from Connect!\n');
});

//create node.js http server and listen on port
http.createServer(app).listen(3000);
console.log('open localhost:3000');