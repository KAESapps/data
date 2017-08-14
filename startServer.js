const watchable = require("./watchableStore")

module.exports = (storeReady, WebSocketServer) => {
  return storeReady.then(
    store =>
      new Promise((resolve, reject) => {
        const wss = new WebSocketServer({ port: 3000 })
        wss.on("connection", ws => {
          const watchableStore = watchable(store, ws.send.bind(ws))
          ws.on("message", str =>
            new Promise(resolve => {
              const data = JSON.parse(str)
              const { callId, method, arg } = data
              return watchableStore
                [method](arg)
                .then(
                  res => ws.send(JSON.stringify({ callId, res })),
                  err => {
                    console.error("error responding to method call", err)
                    return ws.send({ callId, err: err.message })
                  }
                )
                .then(resolve)
            }).catch(err => {
              console.error("error handling message", err)
            })
          )
          ws.on("close", () => {
            console.log("connection closed", ws.id)
            watchableStore.destroy()
          })
        })
        wss.on("error", reject)
        wss.on("listening", () => resolve(wss))
      })
  )
}
