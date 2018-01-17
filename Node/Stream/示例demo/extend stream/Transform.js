const {
    Transform
} = require("stream");
class addTime extends Transform {
    constructor(...args) {
        super(args);
    }
    _transform(data, encode, cb) {
        this.push("time :" + new Date().toLocaleString() + ", data: " + data);
        cb();
    }
}

var stream = new addTime();
process.stdin.pipe(stream).pipe(process.stdout);
stream.on("data",function(data){
    console.log("data:", data.toString());
})