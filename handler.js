'use strict';

var AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('http'));

var axios = require('axios');
var stringify = require('json-stringify-safe');

module.exports.demo = async (event, context, callback) => {

  let subsegment = AWSXRay.getSegment().addNewSubsegment("Expensive Computation");
  var start = new Date();
  var now;
  var sleepyTime = getRandomInt(1000, 2000)
  while (true) {
      now = new Date();
      if (now - start >= 1000) {
          break;
      }
  }
  subsegment.close();

  let config1 = {
    method: 'GET',
    url: 'http://service1.motyka.org/delay/' + getRandomInt(1,2),
    timeout: 2000
  };
  let config2 = {
    method: 'GET',
    url: 'http://service2.motyka.org/delay/' + getRandomInt(1,3),
    timeout: 2000
  };

  var specialValues = ['foo', 'bar', 'baz']; 
  let config3 = {
    method: 'POST',
    url: 'http://service3.motyka.org/delay/' + getRandomInt(1,4),
    data: '{"special":"' + specialValues[Math.floor(Math.random() * specialValues.length)] + '"}',
    timeout: 3000
  };

  axios.interceptors.request.use(config => {
    let data = config.data;
    if (typeof data !== "undefined" && !config.__isSpecialLogged) {
      let jsonData = JSON.parse(data);
      let subsegment = AWSXRay.getSegment().addNewSubsegment("Special Data Capture");
      subsegment.addAnnotation("special", jsonData.special);
      subsegment.close();
      config.__isSpecialLogged = true;
    }
    return config;
  }, undefined);

  let response = {};

  Promise.all([axios(config1), axios(config2), axios(config3)])
    .then((response1, response2, response3) => {
        callback(undefined, {"statusCode": 200, "body": "All is well..."});
    })
    .catch(error => {
      let subsegment = AWSXRay.getSegment().addNewSubsegment("Downstream Service Call Failure");
      subsegment.addError(error, true);
      subsegment.addAnnotation("error", "DownstreamServiceCallFailure");
      subsegment.addMetadata("error", JSON.parse(stringify(error.request)));
      subsegment.close();
      callback(undefined, {"statusCode": 500, "body": "Something isn't working..."});
    });
};

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}