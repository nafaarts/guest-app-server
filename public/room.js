const peers = {}
const chatContainer = document.getElementById("left")
const remoteVideoContainer = document.getElementById("right")
const toggleButton = document.getElementById("toggle-cam")
const guestId = window.location.pathname.split("/")[2]
const userVideo = document.getElementById("user-video")
const waiting = document.getElementById("waiting")
const detik = document.querySelector("#detik")
let interval

const urlParams = new URLSearchParams(window.location.search)
const type = urlParams.get("type")

let userStream
let isGuest = false
const socket = io("/")

//get parameter from current url then store in variabel as array
function callOtherUsers(otherUsers, stream) {
  if (!otherUsers.length) {
    isGuest = true
  }

  console.log("isGuest :", isGuest)
  otherUsers.forEach((userIdToCall, i) => {
    console.log("index:", i)
    const peer = createPeer(userIdToCall, i)
    peers[userIdToCall] = peer
    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream)
    })
  })
}

function createPeer(userIdToCall, i) {
  console.log("Peers: ", Object.keys(peers).length)

  const peer = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:openrelay.metered.ca:80",
      },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  })

  peer.onnegotiationneeded = () =>
    userIdToCall ? handleNegotiationNeededEvent(peer, userIdToCall) : null
  peer.onicecandidate = handleICECandidateEvent

  peer.ontrack = (e) => {
    if (e.track.kind === "video") {
      if (i === 0 || isGuest) {
        // goes to guest!
        const container = document.createElement("div")
        const video = document.createElement("video")
        video.srcObject = e.streams[0]
        video.autoplay = true
        video.playsInline = true
        video.classList.add("guest-video")
        container.appendChild(video)
        container.id = userIdToCall
        document.getElementById("left").appendChild(container)
      } else {
        const container = document.createElement("div")
        container.classList.add("remote-video-container")
        const video = document.createElement("video")
        video.srcObject = e.streams[0]
        video.autoplay = true
        video.playsInline = true
        video.classList.add("remote-video")
        container.appendChild(video)
        container.id = userIdToCall
        remoteVideoContainer.appendChild(container)
      }
    }
  }
  return peer
}

async function handleNegotiationNeededEvent(peer, userIdToCall) {
  const offer = await peer.createOffer()
  await peer.setLocalDescription(offer)
  const payload = {
    sdp: peer.localDescription,
    userIdToCall,
  }

  socket.emit("peer connection request", payload)
}

async function handleReceiveOffer({ sdp, callerId }, stream) {
  const peer = createPeer(callerId)
  peers[callerId] = peer
  const desc = new RTCSessionDescription(sdp)
  await peer.setRemoteDescription(desc)

  stream.getTracks().forEach((track) => {
    peer.addTrack(track, stream)
  })

  const answer = await peer.createAnswer()
  await peer.setLocalDescription(answer)

  const payload = {
    userToAnswerTo: callerId,
    sdp: peer.localDescription,
  }

  socket.emit("connection answer", payload)
}

function handleAnswer({ sdp, answererId }) {
  const desc = new RTCSessionDescription(sdp)
  peers[answererId].setRemoteDescription(desc).catch((e) => console.log(e))
}

function handleICECandidateEvent(e) {
  if (e.candidate) {
    Object.keys(peers).forEach((id) => {
      const payload = {
        target: id,
        candidate: e.candidate,
      }
      socket.emit("ice-candidate", payload)
    })
  }
}

function handleReceiveIce({ candidate, from }) {
  const inComingCandidate = new RTCIceCandidate(candidate)
  peers[from].addIceCandidate(inComingCandidate)
}

function handleDisconnect(userId) {
  delete peers[userId]
  document.getElementById(userId).remove()
}

toggleButton.addEventListener("click", () => {
  const videoTrack = userStream
    .getTracks()
    .find((track) => track.kind === "video")
  if (videoTrack.enabled) {
    videoTrack.enabled = false
  } else {
    videoTrack.enabled = true
  }
})

remoteVideoContainer.addEventListener("click", (e) => {
  if (e.target.innerHTML.includes("Hide")) {
    e.target.innerHTML = "show remote cam"
    socket.emit("hide remote cam", e.target.getAttribute("user-id"))
  } else {
    e.target.innerHTML = `Hide user's cam`
    socket.emit("show remote cam", e.target.getAttribute("user-id"))
  }
})

function hideCam() {
  const videoTrack = userStream
    .getTracks()
    .find((track) => track.kind === "video")
  videoTrack.enabled = false
}

function showCam() {
  const videoTrack = userStream
    .getTracks()
    .find((track) => track.kind === "video")
  videoTrack.enabled = true
}

async function init() {
  socket.on("connect", async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    })
    userStream = stream
    userVideo.srcObject = stream

    socket.emit("user joined room", { guestId })

    socket.on("all other users", (otherUsers) =>
      callOtherUsers(otherUsers, stream),
    )

    socket.on("connection offer", (payload) =>
      handleReceiveOffer(payload, stream),
    )

    socket.on("connection answer", handleAnswer)

    socket.on("answered", clearWaiting)

    socket.on("ice-candidate", handleReceiveIce)

    socket.on("user disconnected", (userId) => handleDisconnect(userId))

    socket.on("hide cam", hideCam)

    socket.on("show cam", showCam)

    socket.on("server is full", () => alert("chat is full"))

    socket.on("client count", () => {
      let size = Object.keys(peers).length
      if (size === 0) window.location.href = "/finish.html"
    })
  })
}

init()

function sendNotification(message, guestId = null, status = null) {
  fetch("/send-notification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Ada Tamu!",
      body: message,
      data: {
        guestId,
        status,
      },
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log(data)
    })
    .catch((err) => {
      console.log(err)
    })
}

if (type === "guest") {
  console.log("waiting...")

  var guest = localStorage.getItem("guest")
  let data = JSON.parse(guest)

  if (data.click < 3) {
    // update click in data then update local storage
    data.click += 1
    data.expired = new Date().getTime()
    localStorage.setItem("guest", JSON.stringify(data))
    let message = ""
    if (data.click > 1) {
      message = `tamu telah menekan tombol ${data.click} kali`
    } else {
      message = "ada tamu berkunjung ke rumah anda"
    }
    sendNotification(message, guestId, "waiting")
  } else {
    localStorage.removeItem("guest")
    sendNotification("tamu telah di reject", guestId, "reject")
    window.location.href = "/rejected.html"
  }

  let count = 30
  interval = setInterval(() => {
    if (count > 0) {
      detik.innerText = count
      count--
    } else {
      alert("Tidak ada response dari pemilik rumah")
      window.location.href = "/"
    }
  }, 1000)
} else {
  waiting.classList.add("d-none")
}

function clearWaiting() {
  clearInterval(interval)
  waiting.classList.add("d-none")
}
