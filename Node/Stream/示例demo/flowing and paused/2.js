var fs = require("fs"),
    rs = fs.createReadStream("../../music.mp3");

rs.pause(); // 此时readable._readableState.flowing = false
rs.on("data", function (chunk) {
    // 只有readable._readableState.flowing == null时, 绑定data事件才会使readable._readableState.flowing=true
    console.log(chunk);
});

setTimeout(()=>{
    console.log('3s later, excute rs.resume');
    rs.resume();
},3000)

rs.on("end", function (err) {
    console.log("rs end");
});