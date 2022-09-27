const peers = {}
const chatContainer = document.getElementById("left")
const remoteVideoContainer = document.getElementById("right")
const toggleButton = document.getElementById("toggle-cam")
const guestId = window.location.pathname.split("/")[2]
const userVideo = document.getElementById("user-video")
let userStream
let isAdmin = false
const socket = io("/")

//get parameter from current url then store in variabel as array
function callOtherUsers(otherUsers, stream) {
  if (!otherUsers.length) {
    isAdmin = true
  }
  console.log("isAdmin :", isAdmin)
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
  // const peer = new RTCPeerConnection({
  //   iceServers: [
  //     {
  //       urls: "stun:stun.stunprotocol.org",
  //     },
  //   ],
  // })
  const peer = new RTCPeerConnection({
    iceServers: [
      {
        urls: "turn:13.250.13.83:3478?transport=udp",
        username: "YzYNCouZM1mhqhmseWk6",
        credential: "YzYNCouZM1mhqhmseWk6",
      },
      // {
      //   urls: "stun:openrelay.metered.ca:80",
      // },
      // {
      //   urls: "turn:openrelay.metered.ca:80",
      //   username: "openrelayproject",
      //   credential: "openrelayproject",
      // },
      // {
      //   urls: "turn:openrelay.metered.ca:443",
      //   username: "openrelayproject",
      //   credential: "openrelayproject",
      // },
      // {
      //   urls: "turn:openrelay.metered.ca:443?transport=tcp",
      //   username: "openrelayproject",
      //   credential: "openrelayproject",
      // },
    ],
  })

  peer.onnegotiationneeded = () =>
    userIdToCall ? handleNegotiationNeededEvent(peer, userIdToCall) : null
  peer.onicecandidate = handleICECandidateEvent

  peer.ontrack = (e) => {
    if (e.track.kind === "video") {
      if (i === 0 || isAdmin) {
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

    socket.on("ice-candidate", handleReceiveIce)

    socket.on("user disconnected", (userId) => handleDisconnect(userId))

    socket.on("hide cam", hideCam)

    socket.on("show cam", showCam)

    socket.on("server is full", () => alert("chat is full"))

    socket.on("client count", () => {
      let size = Object.keys(peers).length
      // alert(`room size : ${size}`)
      if (size === 0) window.location.href = "/finish.html"
    })
  })
}

init()
