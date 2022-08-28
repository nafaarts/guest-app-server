const axios = require("axios")

const sendNotification = (title, body, data, to) => {
  var config = {
    method: "post",
    url: "https://fcm.googleapis.com/fcm/send",
    headers: {
      Authorization:
        "key=AAAAHXNRPEI:APA91bEYYv2qDVxplTB3REOyzkMYmVGAKGVcLaxN-RpomvX97z8HSFOYKN2GIVjdSesk9uXoKNJAlGURORauPjSFPe54KZe_3sgpqEUZwOfrt707lq-YzlLGiYGz-Dm4qY1KxpWwl64q",
      "Content-Type": "application/json",
    },
    data: {
      registration_ids: to,
      notification: {
        body,
        title,
        sound: "bell_ring",
        android_channel_id: "bell_ring",
      },
      data,
    },
  }

  axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data))
    })
    .catch(function (error) {
      console.log(error)
    })
}

module.exports = { sendNotification }
