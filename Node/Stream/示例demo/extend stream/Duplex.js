const {
    Duplex
} = require("stream");
class myDuplex extends Duplex {
    constructor(createData, options) {
        super(options);
        this.createData = createData;
    }
    _write(data) {
        // this.write
    }

    _read(data) {
        // this.push
    }
}