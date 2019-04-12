var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 8001;


var app = {
    rooms: {},
    users: {}
}

io.on('connection', function (socket) {

    app.users[socket.id] = {id:socket.id,username:false,room:false}
    
    socket.on('joinRoom', data => {

        if (app.rooms[data.room] == undefined) { app.rooms[data.room] = {name:data.room,users: {} } }
        app.rooms[data.room].users[socket.id] = { username: data.username, id: socket.id }

        app.users[socket.id].username = data.username
        app.users[socket.id].room = data.room
        
        socket.join(data.room)
        io.to(data.room).emit('userJoinedRoom',app.users[socket.id])
        
    })

    socket.on('disconnect', () => {
        if(app.users[socket.id] == undefined){return}
        var userRoom = app.rooms[app.users[socket.id].room]
        socket.leave(userRoom.name)
        io.to(userRoom.name).emit('userLeftRoom',socket.id)
    })

});

http.listen(port, function () {
    console.log('listening on *:' + port);
});