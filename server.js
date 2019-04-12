var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 8001;


var app = {
    rooms:{},
    users:{}
}

io.on('connection', function(socket){

});

http.listen(port, function(){
  console.log('listening on *:' + port);
});