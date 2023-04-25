module.exports = function (RED) {
  function IdleBatteryNode (config) {
    RED.nodes.createNode(this, config)
    const node = this

    this.configNode = RED.nodes.getNode('victron-client-id')
    this.client = this.configNode.client
    let ready = false

    // Subscribe to retrieve the active SOC
    const activeSOC = (x) => {
      const services = x.client.client.services
      for (const key in services) {
        if (services[key].name.startsWith('com.victronenergy.battery')) {
          this.subscription = this.client.subscribe('com.victronenergy.battery/' + services[key].deviceInstance, '/Soc', (msg) => {
            this.activeSOC = msg.value
            if (!ready) {
              node.status({ fill: 'green', shape: 'dot', text: 'Ready' })
              ready = true
            }
          })

          break
        }
      }
    }

    setTimeout(activeSOC, 1000, this)

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
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Soc', this.activeSOC - 5)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Day', 7)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Start', diff)

        node.status({ fill: 'yellow', shape: 'dot', text: 'Battery in idle state' })
      } else {
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/AllowDischarge', 1)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Day', -7)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Duration', 0)
        this.client.publish('com.victronenergy.settings',
          '/Settings/CGwacs/BatteryLife/Schedule/Charge/0/Soc', 100)

        node.status({ fill: 'green', shape: 'dot', text: 'Battery in active state' })
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
