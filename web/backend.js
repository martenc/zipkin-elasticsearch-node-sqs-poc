/* eslint-disable import/newline-after-import */
// initialize tracer
const express = require('express');
const CLSContext = require('zipkin-context-cls');
const {Tracer} = require('zipkin');
const {recorder} = require('./recorder');
const aws = require('aws-sdk');
// replace with your queue url
const queueUrl = "https://sqs.us-west-1.amazonaws.com/12345679800/order-tracer-queue"; 

const ctxImpl = new CLSContext('zipkin');
const localServiceName = 'order service';
const request = require('request');
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const app = express();
aws.config.loadFromPath(__dirname + '/config.json');


// instrument the server
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;
app.use(zipkinMiddleware({tracer}));

const Consumer = require('sqs-consumer');

// polls sqs for the message
// https://www.npmjs.com/package/sqs-consumer
const poller = Consumer.create({
  queueUrl: queueUrl,
  handleMessage: (message, done) => {
    done();
    request('http://localhost:9000/recieved', function (error, response, body) {
      if (!error) {
        console.log('message retrieved from SQS');
      }
    });
  }
});

poller.on('error', (err) => {
  console.log(err.message);
});

const sqs = new aws.SQS();

app.get('/api', (req, res) => {

  var params = {
      MessageBody: JSON.stringify(tracer._ctxImpl),
      QueueUrl: queueUrl,
      DelaySeconds: 0
  };

  sqs.sendMessage(params, function(err, data) {
      if(err) {
          res.send(err);
      }
      else {
          res.send(new Date().toString())
      }
  });
});

app.get('/recieved', (req, res) => {
  res.send('Message Received')
});


app.listen(9000, () => {
  console.log('order service listening on port 9000');
  poller.start();
});
