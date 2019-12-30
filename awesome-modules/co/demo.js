const co = require('./index');

function delay(seconds) {
    console.log('delay:', seconds);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(seconds)
        }, seconds * 1000);
    });
}

co(function* () {
    const r1 = yield delay(1);
    console.log(r1);
    const r2 = yield delay(2);
    const r3 = yield delay(3);
    const r4 = yield delay(4);
})
