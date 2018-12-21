# Example of distributed tracing across node.js apps and AWS SQS
This is an example app where a web browser, three express/nodejs services and an AWS SQS queue collaborate on an http request. Notably, timing of these requests are recorded into [Zipkin](http://zipkin.io/) and uses ElasticSearch as the datastore. You can use Kibana to view/visualze the data, which usually runs on another instance/VM. However, you can also use [dejavu](https://github.com/appbaseio/dejavu), which is a handy UI for ES. This allows you to see the how long the whole operation took, as well how much time was spent in each service. To persist the trace context across system boundaries (in this case from the node apps to SQS), I'm stuffing the entire trace context into the message body. Probably not ideal, but it works.


# Example of what it looks like

+-------------+   +-------------+                 +---------+           +------+
| Order Create|   |API/Worker   |                 |SQS      |           |ELK   |
+-------------+   +-----+-------+                 +----+----+           +---+--+
      |Request          |                              |                    |
      +---------------> |                              |                    |
      |                 | +------------------------+   |                    |
      |                 | | trace instrumentation  |   |                    |
      |                 | +------------------------+   |                    |
      |                 |                            +-++                   |
      |                 |  enqueue                   |  |                   |
      |                 +--------------------------> |  | +--------------+  |
      |                 |                            |  | |lambda trigger|  |
      |                 |                 dequeue    |  | +--------------+  |
      |                 |  <-------------------------+  |   ...or poll which
      |                 |                            +-++   is less event   |
      |                 |                              |    driven          |
      |                 |  async record context        |                    |
      |                 +-------------------------------------------------> |
      |                 |  +-----------------------+   |                    |
      |                 |  | TraceID, SpanID       |   |                    |
      |                 |  +-----------------------+   |                    |
+-----+-------+   +-----+-------+                 +----+----+           +---+--+
| Order Create|   |API/Worker   |                 |SQS      |           |ELK   |
+-------------+   +-------------+                 +---------+           +------+



# Implementation Overview
Web requests are served by [Express](http://expressjs.com/) controllers, and tracing is automatically performed for you by [zipkin-js](https://github.com/openzipkin/zipkin-js). JavaScript used in the web browser is bundled with [browserify](http://browserify.org/). The queue is AWS SQS. The data store for zipkin is [ElasticSearch](https://github.com/elastic/elasticsearch). [Kibana](https://github.com/elastic/kibana) is optional. 


# Running the example
This example has three services: frontend, backend, poller and then the SQS queue. The node services report trace data to zipkin, which uses ElasticSearch as the datastore. To setup the demo, you need to start frontend.js, backend.js and Zipkin. And then create your SQS queue and install ElasticSearch. Out of the box zipkin does not use ES so you'll need to build zipkin locally (instructions below) and set the datastore parms (`DSTORAGE_TYPE` and `DES_HOSTS`) to use ES.   You'll also need to bundle the JavaScript used by the web browser. 

Once the services are started, and the JavaScript is bundled, open `index.html`
* This starts a trace in the browser and calls the frontend (http://localhost:8081/)
* This continues the trace and calls the backend (http://localhost:9000/api) and show the traace output, but also creates the message (in this case, an order) in SQS
* The poller gets the message off of SQS. This is a bit of an old school approach making the service kinda sticky. Ideally, to be more true to an event driven architecture, you'd use a lambda trigger to publish the message as an event to our node api. 

Next, you can view traces that went through zipkin and into ElasticSearch in Kibana or via dejavu.


## Setup
Before you start anything, you'll need to download the libraries used in this demo:
```bash
$ npm install
```

Bundle the JavaScript used by the browser:
```bash
$ npm run browserify
```

## Starting the Services
In a separate tab or window, run `npm start`, which will start both [frontend.js](./frontend.js) and [backend.js](./backend.js):
```bash
$ npm start
```

## Setup your AWS SQS
* Update the path to our `queueUrl` in backend.js
* Create your own `config.json` with your aws keys. An example is in the `config.json.dist` file

## Get zipkin
```bash
$ wget -O zipkin.jar 'https://search.maven.org/remote_content?g=io.zipkin.java&a=zipkin-server&v=LATEST&c=exec'
```

Or you can get the latest source from https://github.com/openzipkin/zipkin

## Build the server and its dependencies (requires java 8)
```bash
$ ./mvnw -DskipTests --also-make -pl zipkin-server clean install
```

## Run zipkiin
```bash
$ java -DSTORAGE_TYPE=elasticsearch -DES_HOSTS=https://pathtoyourelasticsearchinstance -DES_USERNAME=yourusername -DES_PASSWORD=whateveryourpasswordis -jar zipkin.jar
```

## Fire away
Hit the frontend and exhale
http://localhost:8081/)
