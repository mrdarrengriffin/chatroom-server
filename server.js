var app = require('express')()
var http = require('http').Server(app)
var io = require('socket.io')(http)
var port = process.env.PORT || 8001

var app = {
    rooms: {},
    users: {},
    antiSpam: {
        maxMessagesPerTimeFrame: 10,
        timeFrame: 5 * 1000,
        cooldown: 3 * 1000,
        userCounts: {}
    }
}

io.on('connection', function (socket) {
    // On user connection, store the user in the app variable
    app.users[socket.id] = { id: socket.id, username: false, room: false }
    app.antiSpam.userCounts[socket.id] = { messageCount: 0, refreshTime: false, blocked: false, blockedUntil: false }

    // On user join room
    socket.on('joinRoom', data => {
        // Check to see if the user is already in a room. Leave the current first
        var userRoom = app.rooms[app.users[socket.id].room]
        if (userRoom != undefined && userRoom.users[socket.id] != undefined) {
            // If user in a room
            if (userRoom.name == data.room) {
                // If user is in a room, but they are trying to join the same room, return with an error
                socket.emit('joinedRoomAlreadyIn')
                return
            }

            // Remove user from rooms array and emit to all clients that user left
            delete app.rooms[userRoom.name].users[socket.id]
            socket.leave(userRoom.name)
            io.to(userRoom.name).emit('userLeftRoom', socket.id)
        }

        // If room does not exist, create with empty data
        if (app.rooms[data.room] == undefined) { app.rooms[data.room] = { name: data.room, users: {} } }

        // Add user to array of users in room object
        app.rooms[data.room].users[socket.id] = { username: data.username, id: socket.id }

        // Update the user in the users array with the username and room
        app.users[socket.id].username = data.username
        app.users[socket.id].room = data.room

        // Join the room and emit to clients that user has joined
        socket.join(data.room)
        socket.emit('joinRoomInit', app.rooms[data.room])
        socket.to(data.room).emit('userJoinedRoom', app.users[socket.id])
    })

    // When user safely leaves room
    socket.on('leaveRoom', () => {
        // Check to see if user is actually in the room
        var userRoom = app.rooms[app.users[socket.id].room]
        if (userRoom != undefined && userRoom.users[socket.id] != undefined) {
            // If user is in a room, remove from array and emit to all users in room that user has left
            delete app.rooms[userRoom.name].users[socket.id]
            socket.leave(userRoom.name)
            socket.to(userRoom.name).emit('userLeftRoom', socket.id)
        }
    })

    // When a user sends a message
    socket.on('sendMessage', message => {
        // If message blank, ignore
        if (!message || message.length == 0 || message == "") { return }
        // Get the room of the user and emit the message to the users
        var userRoom = app.rooms[app.users[socket.id].room]
        // Abort if user isn't part of a room
        if (userRoom == undefined) { return }

        var now = Date.now()

        // If user already blocked
        if (app.antiSpam.userCounts[socket.id].blocked == true) {
            // Check to see if the user can be unblocked
            if (now >= app.antiSpam.userCounts[socket.id].blockedUntil) {
                // Then unblock
                //console.log("%s is now unblocked",socket.id)
                app.antiSpam.userCounts[socket.id].blocked = false
                app.antiSpam.userCounts[socket.id].refreshTime = now + app.antiSpam.timeFrame
                app.antiSpam.userCounts[socket.id].messageCount = 0
            } else {
                // Otherwise, abort
                return
            }
        }

        // If user hasn't had a refresh time set (usually if not sent a message yet)
        if (app.antiSpam.userCounts[socket.id].refreshTime == false) {
            // Set a future time
            app.antiSpam.userCounts[socket.id].refreshTime = now + app.antiSpam.timeFrame
        }

        // Check to see if time slot is in the future
        if (now >= app.antiSpam.userCounts[socket.id].refreshTime) {
            // Refresh time to future
            app.antiSpam.userCounts[socket.id].refreshTime = now + app.antiSpam.timeFrame
            app.antiSpam.userCounts[socket.id].messageCount = 0
        }

        // Add message count
        app.antiSpam.userCounts[socket.id].messageCount++

        // If message count over threshold
        if (app.antiSpam.userCounts[socket.id].messageCount >= app.antiSpam.maxMessagesPerTimeFrame) {
            // Block user until future time
            app.antiSpam.userCounts[socket.id].blocked = true
            app.antiSpam.userCounts[socket.id].blockedUntil = (now + app.antiSpam.cooldown)
            io.to(socket.id).emit('antiSpamEnforced',app.antiSpam.cooldown)
            return
        }
        // If user passes anti-spam, continue

        io.in(userRoom.name).emit('receiveMessage', { user: socket.id, message })
    })

    // On user surprise disconnect
    socket.on('disconnect', () => {
        if (app.users[socket.id] == undefined) { return }

        // Check to see if user was in a room
        var userRoom = app.rooms[app.users[socket.id].room]
        if (userRoom != undefined) {
            // If user was in a room, leave, update the array and emit to clients that user left
            delete app.rooms[userRoom.name].users[socket.id]
            socket.leave(userRoom.name)
            io.to(userRoom.name).emit('userLeftRoom', socket.id)
        }
    })
})


http.listen(port, function () {
    console.log('listening on *:' + port)
})