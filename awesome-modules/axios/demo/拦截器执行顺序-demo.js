const axios = require("../lib/axios");
// const axios = require("axios");

axios.interceptors.request.use(function (config) {
  console.log('[request interceptors]', 1);
  return config;
}, function (error) {
  return Promise.reject(error);
});

axios.interceptors.request.use(function (config) {
  console.log('[request interceptors]', 2);
  return config;
}, function (error) {
  return Promise.reject(error);
});
axios.interceptors.response.use(function (config) {
  console.log('[response interceptors]', 3);
  return config;
}, function (error) {
  return Promise.reject(error);
});

axios.interceptors.response.use(function (config) {
  console.log('[response interceptors]', 4);
  return config;
}, function (error) {
  return Promise.reject(error);
});

axios.get('http://localhost:3000/get')
  .then(function (response) {
    // console.log(response);
  })
  .catch(function (error) {
    // console.log(error);
  });