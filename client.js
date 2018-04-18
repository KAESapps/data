// const clientRaw = require("./client-raw")
const { Obs } = require("kobs")
const unwatchDelay = 30 * 1000 // server unwatch is called if UI is not observing during 30 seconds

module.exports = (clientRaw, authenticatedUser) => {
  const queriesCache = new Map()
  const pendingUnwatch = new Map()

  const {
    watch: rawWatch,
    unwatch,
    patch,
    query: queryOnce,
    onClose,
    close,
    call,
  } = clientRaw

  const watch = (method, arg) => {
    const watchId = JSON.stringify({ method, arg })
    let obs = queriesCache.get(watchId)
    const cancelPendingUnwatch = pendingUnwatch.get(watchId)
    if (cancelPendingUnwatch) {
      clearTimeout(cancelPendingUnwatch)
    }
    if (!obs) {
      const onUnobserved = () => {
        pendingUnwatch.set(
          watchId,
          setTimeout(() => {
            unwatch({ watchId }).catch(err => {
              console.error("Error stopping to watch", method, arg, err)
            })
            queriesCache.delete(watchId)
            pendingUnwatch.delete(watchId)
            //console.log("unwatched query", q)
          }, unwatchDelay)
        )
        //console.log("query scheduled to be unwatched", q)
      }
      obs = new Obs(
        { loaded: false, value: undefined },
        onUnobserved,
        null,
        watchId
      )
      queriesCache.set(watchId, obs)
      // start watching server
      rawWatch({ watchId, method, arg }, value => {
        // TODO: perf workaround, on ne devrait pas avoir à comparer les valeurs
        if (value !== obs.value.value) {
          obs.set({ loaded: true, value })
        }
      }).catch(err => {
        console.error("Error starting to watch", arg, err)
      })
    }
    return obs.get()
  }
  const query = q => watch("query", q)
  const clearLocalData = () => call("clearLocalData")

  return {
    authenticatedUser,
    patch,
    query,
    queryOnce,
    onClose,
    call,
    watch,
    clearLocalData,
    close,
  }
}
