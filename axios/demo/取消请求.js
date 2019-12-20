const axios = require('../lib/axios');
axios.defaults.baseURL = 'http://localhost:3000';

var CancelToken = axios.CancelToken;
var source = CancelToken.source();
axios.get('/get', {
    cancelToken: source.token
}).then(d => {
    console.log(d.data);
}, function (thrown) {
    if (axios.isCancel(thrown)) {
        console.log('[请求取消]:', thrown.message);
    } else {
        console.log('[请求error]:', thrown);
    }
});
source.cancel('手动取消');