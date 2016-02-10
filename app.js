/*
 *  Example node.js EMDR client
 */

var zmq = require('zmq');
var zlib = require('zlib');
var _ = require('underscore');
var fs = require('fs');
var http = require('http');
//var io = require('socket.io');

var sock = zmq.socket('sub');
var wstream = fs.createWriteStream('text.txt');
var plex = 29668;
var theForge = 10000002;
var jita4_4 = 60003760;
var bid = true;
var notBid = false;
var plexSell = 0;
var plexBuy = 0;
var plexPrices = [];
var plexBids = [];


// HTTP server
var server = http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-type': 'text/html'});
    res.end(fs.readFileSync(__dirname + '/index.html'));
}).listen(8080, function() {
    console.log('Listening at: http://localhost:8080');
});
/*io.listen(server).on('connection', function (socket) {
    socket.on('message', function (msg) {
        console.log('Message Received: ', msg);
        socket.broadcast.emit('message', msg);
    });
});*/
var io = require('socket.io')(server);
//var listener = io.listen(server);

// Connect to the first publicly available relay.
// http://www.eve-emdr.com/en/latest/access.html
sock.connect('tcp://relay-us-west-1.eve-emdr.com:8050');
// Disable filtering
sock.subscribe('');

sock.on('message', function(msg){
  // Receive raw market JSON strings.
  zlib.inflate(msg, function(err, market_json) {
    // Un-serialize the JSON data.
    var market_data = JSON.parse(market_json);
    // look for PLEX
    if (market_data.rowsets[0].typeID === plex && market_data.rowsets[0].regionID === theForge) {

      var minMix = _.after(market_data.rowsets[0].rows.length, function(){
        var plexPrice = _.min(plexPrices);
        var plexBid = _.max(plexBids);
        if (plexSell !== plexPrice) {
          plexSell = plexPrice;
          console.log('plex min: ' + plexPrice);
          io.sockets.emit('plexMin', plexPrice);
        }
        if (plexBuy !== plexBid) {
          plexBuy = plexBid;
          console.log('plex max: ' + plexBid);
          io.sockets.emit('plexMax', plexBid);
        }
        plexPrices = [];
        plexBids = [];
      });

      _.each(market_data.rowsets[0].rows, function(row){
        // limit to Jita 4-4
        if (row[9] === jita4_4) {
          // look for sales
          if (row[6] === notBid) {
            // push value to price array
            plexPrices.push(row[0]);
          }
          // look for bids
          else {
            // push value to bid array
            plexBids.push(row[0]);
          }
        }
        minMix();
      });

      //console.log(market_data.rowsets[0].rows);
      //var market_string = JSON.stringify(market_data);
      //wstream.write(market_string + '\n\n');
    }
  });
});
