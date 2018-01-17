const http = require("http");
const parseCookie = require("./parseCookie");
const setCookie = require("./setCookie");

var sessions = {};
var key = 'session_id';
var EXPIRES = 10 * 1000;
var generate = function () {
    var session = {};
    session.id = (new Date()).getTime() + Math.random();
    session.cookie = {
        expire: (new Date()).getTime() + EXPIRES
    };
    sessions[session.id] = session;
    return session;
};

var returnWord;
var handle = function (req, res) {
    req.cookies = parseCookie(req.headers.cookie);
    res.setHeader("content-type","text/plain;charset=utf8");
    var id = req.cookies[key],
        needSetSessionIdInCookie = true;
    if (!id) {
        req.session = generate();
        returnWord = "第一次访问,在cookie中存储session_id";
    } else {
        var session = sessions[id];
        if (session) {
            if (session.cookie.expire > (new Date()).getTime()) {
                session.cookie.expire = new Date(+new Date() + EXPIRES);
                returnWord = "再次访问,更新session有效期";
                needSetSessionIdInCookie = false;
            } else {
                delete sessions[id];
                req.session = generate();
                returnWord = "session 已过期,已重新设置cookie";
            }
        } else {
            req.session = generate();
            returnWord = "session值不匹配";
        }
    }
    if (needSetSessionIdInCookie) {
        res.setHeader("Set-Cookie", setCookie({
            session_id: req.session.id
        }));
    }
    res.writeHead(200);
    res.end(returnWord)
};

http.createServer(handle).listen(3000, () => {
    console.log("listen 3000");
});