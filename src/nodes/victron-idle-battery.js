const axios = require('axios')

module.exports = function (RED) {
  function IdleBatteryNode (config) {
    RED.nodes.createNode(this, config)
    const node = this

    this.configNode = RED.nodes.getNode('victron-client-id')

    if (!this.configNode) {
      node.status({ fill: 'red', shape: 'dot', text: 'Need a victron config client' })
      return
    } else {
      this.client = this.configNode.client
    }
    let ready = false

    // Check the installed version of node-red-contrib-victron
    let nrcvVersion = 'unknown'
    axios.defaults.baseURL = 'http://' + RED.settings.uiHost + ':' + RED.settings.uiPort
    const selectRoot = (RED.settings.httpNodeRoot || RED.settings.httpAdminRoot).replace(/\/$/, '') + '/nodes'
    const AuthTokens = RED.settings.get('auth-tokens')
    const headers = {
      Accept: 'application/json'
    }
    if (AuthTokens) {
      headers.Authorization = 'Bearer ' + AuthTokens.access_token
    }
    axios.get(selectRoot, {
      headers
    }).then(response => {
      nrcvVersion = (response.data.find((obj) => obj.id === '@victronenergy/node-red-contrib-victron/victron-client')).version
    })
      .catch(error => {
        console.log(error)
      })

    const SOCinfo = (x) => {
      const services = x.client.client.services
      for (const key in services) {
        // For the activeSOC
        if (services[key].name.startsWith('com.victronenergy.system')) {
          let sub = 'com.victronenergy.system/' + services[key].deviceInstance
          if (nrcvVersion === '1.4.23') {
            sub = services[key].name
          }
          this.subActiveSOC = this.client.subscribe(sub, '/Dc/Battery/Soc', (msg) => {
            this.activeSOC = msg.value
            if (!ready) {
              node.status({ fill: 'green', shape: 'dot', text: 'Ready (' + this.activeSOC.toFixed(1) + '%, minSoc ' + this.ActiveSocLimit.toFixed(1) + '%)' })
              ready = true
            }
          })
          this.subSocLimit = this.client.subscribe(sub, '/Control/ActiveSocLimit', (msg) => {
            this.ActiveSocLimit = msg.value
          })
          continue
        }
      }
      node.status({ fill: 'red', shape: 'dot', text: 'Unable to determine SOC (no battery?)' })
    }

    setTimeout(SOCinfo, 1000, this)

    const AShandlerId = this.configNode.addStatusListener(this, 'com.victronenergy.battery',
      '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/AllowDischarge')

    node.on('input', function (msg) {
      if (this.activeSOC === undefined) {
        node.status({ fill: 'red', shape: 'dot', text: 'No active SOC (yet)' })
        return
      }

      if (msg.payload) {
        const now = new Date()
        const then = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0, 0, 0)
        const diff = (now.getTime() - then.getTime()) / 1000

        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/AllowDischarge', 0)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Duration', 600)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Soc', this.ActiveSocLimit || (this.activeSOC - 5))
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Day', 7)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Start', diff)

        node.status({ fill: 'yellow', shape: 'dot', text: 'Idle (' + this.activeSOC.toFixed(1) + '%, min: ' + this.ActiveSocLimit.toFixed(1) + '%)' })
      } else {
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/AllowDischarge', 1)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Day', -7)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Duration', 0)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Soc', 100)

        node.status({ fill: 'green', shape: 'dot', text: 'Active (' + this.activeSOC.toFixed(1) + '%, min: ' + this.ActiveSocLimit.toFixed(1) + '%)' })
      }

      node.send(msg)
    })

    node.on('close', function (done) {
      this.configNode.removeStatusListener(AShandlerId)
      done()
    })
  }
  RED.nodes.registerType('victron-idle-battery', IdleBatteryNode)
}
