module.exports = function (obj, opt) {
    var arr = [];
    opt = opt || {};
    for (var k in obj) {
        arr.push(k + "=" + obj[k]);
    }

    if (opt.maxAge) arr.push("Max-Age=" + opt.maxAge);
    if (opt.domain) arr.push("Domain=" + opt.domain);
    if (opt.path) arr.push("Path=" + opt.path);
    if (opt.expires) arr.push("Expires=" + opt.expires.toUTCString());
    if (opt.httpOnly) arr.push("HttpOnly");
    if (opt.secure) arr.push("Secure");
    return arr.join("; ");
}