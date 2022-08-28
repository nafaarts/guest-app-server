const express = require("express")
const app = express()
const http = require("http")
const { Server } = require("socket.io")
app.use(express.static("public"))

var bodyParser = require("body-parser")

var jsonParser = bodyParser.json()

const server = http.createServer(app)
const io = new Server(server)
const Datastore = require("nedb")
const { sendNotification } = require("./utils/notification")

const database = new Datastore("database.db")
const devices = new Datastore("devices.db")
database.loadDatabase()
devices.loadDatabase()

app.post("/add-device", jsonParser, (req, res) => {
  const { deviceToken } = req.body
  let check = devices.find({ deviceToken })
  if (deviceToken && check) {
    devices.insert({ deviceToken })
    res.sendStatus(200)
  }
})

app.get("/room/:guestId", (req, res) => {
  res.sendFile(`${__dirname}/public/room.html`)
})

app.get("/get-guest-logs", (req, res) => {
  database.find({}, (err, docs) => {
    if (err) {
      console.log(err)
    } else {
      res.json(docs)
    }
  })
})

app.get("/get-devices", (req, res) => {
  devices.find({}, (err, docs) => {
    if (err) {
      console.log(err)
    } else {
      res.json(docs)
    }
  })
})

app.post("/send-notification", jsonParser, (req, res) => {
  const { title, body, data } = req.body
  const { guestId, status } = data

  database.find({ guestId }, (err, docs) => {
    if (err) {
      console.log(err)
      res.sendStatus(500)
    } else {
      if (docs.length > 0) {
        database.update(
          {
            guestId: guestId,
          },
          {
            $set: { status: status, timestamp: new Date().getTime() },
            $inc: { click_count: 1 },
          },
        )
      } else {
        database.insert({
          guestId,
          status: status,
          timestamp: new Date().getTime(),
          click_count: 1,
        })
      }
    }
  })

  devices.find({}, (err, docs) => {
    if (err) {
      console.log("device error", err)
    } else {
      let registeredDevices = docs.map((item) => {
        return item.deviceToken
      })
      console.log("from devices", registeredDevices)
      try {
        sendNotification(title, body, data, registeredDevices)
        return res.json({
          message: "notification sent",
        })
      } catch (error) {
        return res.json({
          message: "error",
          error,
        })
      }
    }
  })
})

io.on("connection", (socket) => {
  socket.on("user joined room", ({ guestId }) => {
    console.warn(`User joined room ${guestId}`)
    const room = io.sockets.adapter.rooms.get(guestId)
    console.info("room", room)

    if (room && room.size === 4) {
      socket.emit("server is full")
      return
    }

    const otherUsers = []

    if (room) {
      room.forEach((id) => {
        otherUsers.push(id)
      })
      console.info("otherUsers", otherUsers)
    }

    socket.join(guestId)
    socket.emit("all other users", otherUsers)
  })

  socket.on("peer connection request", ({ userIdToCall, sdp }) => {
    io.to(userIdToCall).emit("connection offer", { sdp, callerId: socket.id })
  })

  socket.on("connection answer", ({ userToAnswerTo, sdp }) => {
    io.to(userToAnswerTo).emit("connection answer", {
      sdp,
      answererId: socket.id,
    })
  })

  socket.on("ice-candidate", ({ target, candidate }) => {
    io.to(target).emit("ice-candidate", { candidate, from: socket.id })
  })

  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) => {
      socket.to(room).emit("user disconnected", socket.id)
    })
  })

  socket.on("hide remote cam", (targetId) => {
    io.to(targetId).emit("hide cam")
  })

  socket.on("show remote cam", (targetId) => {
    io.to(targetId).emit("show cam")
  })
})

server.listen(1337, () => console.log("server is running on port 1337"))
