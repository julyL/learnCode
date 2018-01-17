module.exports = function (cookieStr) {
    cookieStr = cookieStr || '';
    var arr = cookieStr.split("; "),
        cookie = {};
    arr.forEach(str => {
        var pair = str.split("=");
            cookie[pair[0]] = pair[1];
    })
    return cookie;
}