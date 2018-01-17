const http = require("http");
const parseCookie = require("./parseCookie");
const setCookie = require("./setCookie");

var handle = function (req, res) {
    var expriresTime = new Date(+new Date() + 30 * 1000);
    req.cookies = parseCookie(req.headers.cookie);
    res.setHeader("content-type", 'text/plain;charset=utf8')
    if (!req.cookies.isVisit) {
        res.setHeader("Set-Cookie", setCookie({
            isVisit: 1
        }, {
            expires: expriresTime,
            path: "/"
        }));
        res.writeHead(200);
        res.end('第一次访问');
    } else {
        res.writeHead(200);
        res.end('再次访问');
    }
};

http.createServer(handle).listen(3000, () => {
    console.log('listen 3000');
});