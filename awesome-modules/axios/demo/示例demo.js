const axios = require('../lib/axios');
// const axios = require("axios");

axios.defaults.baseURL = 'http://localhost:3000';

// console.log('start');

// 1.get请求
// axios.get("/get").then(d => {
//   console.log(d.data);
// })


// 2.手动取消请求
// var CancelToken = axios.CancelToken;
// var source = CancelToken.source();
// axios.get('/get', {
//   cancelToken: source.token
// }).then(d => {
//   console.log(d.data);
// }, function (thrown) {
//   if (axios.isCancel(thrown)) {
//     console.log('[请求取消]:', thrown.message);
//   } else {
//     console.log('[请求error]:', thrown);
//     // handle error
//   }
// });
// source.cancel('手动取消');


// 3.请求超时
// axios.get("/delay/3", {
//   timeout: 2
// }).then(d => {
//   console.log("success:", d.data);
// }, err => {
//   console.log('error:', err);
// })