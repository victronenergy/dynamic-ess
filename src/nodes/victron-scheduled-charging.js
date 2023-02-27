module.exports = function (RED) {
  'use strict'

  const axios = require('axios')

  function VictronScheduledCharging (config) {
    RED.nodes.createNode(this, config)

    const node = this

    node.on('input', function (msg) {
      const url = msg.url || 'https://vrmapi.victronenergy.com/v2'

      if (!config.vrmtoken && !msg.vrmtoken) {
        node.status({ fill: 'red', shape: 'dot', text: 'No VRM token set' })
        return
      }

      if (!config.vrmid && !msg.vrmid) {
        node.status({ fill: 'red', shape: 'dot', text: 'No VRM ID token set' })
        return
      }

      if (!config.longitude && !msg.longitude) {
        node.status({ fill: 'red', shape: 'dot', text: 'No longitude set' })
        return
      }

      if (!config.latitude && !msg.latitude) {
        node.status({ fill: 'red', shape: 'dot', text: 'No latitude token set' })
        return
      }
      msg.topic = 'VRM scheduled charging'
      msg.payload = null

      const msgsp = {
        topic: 'ideal setpoint',
        payload: null
      }

      const options = {
        b_max: (msg.b_max || config.b_max || 1),
        tb_max: (msg.tb_max || config.tb_max || 1),
        fb_max: (msg.fb_max || config.fb_max || 1),
        tg_max: (msg.tg_max || config.tg_max || 1),
        fg_max: (msg.fg_max || config.fg_max || 1),
        long: (msg.longitude || config.longitude),
        lat: (msg.latitude || config.latitude),
        country: (msg.country || 'nl').toUpperCase(),
        B0: 0
      }
      const headers = {
        'X-Authorization': 'Token ' + config.vrmtoken,
        accept: 'application/json'
      }

      if (msg.vrmid) {
        if (msg.vrmid.match(/^[0-9]+$/)) {
          options.site_id = +msg.vrmid
        } else {
          options.portal_id = msg.vrmid
        }
      } else {
        if (config.vrmid.match(/^[0-9]+$/)) {
          options.site_id = +config.vrmid
        } else {
          options.portal_id = config.vrmid
        }
      }

      if (config.verbose === true) {
        node.warn({
          url,
          options,
          headers
        })
      } else {
        node.warn('not verbose')
      }

      node.status({ fill: 'yellow', shape: 'ring', text: 'Retrieving setpoint' })
      axios.get(url, { options, headers }).then(function (response) {
        if (response.status === 200) {
          msg.payload = response.data
          node.status({ fill: 'green', shape: 'dot', text: 'Ok' })
          if (msg.payload.schedule) {
            msgsp.payload = msg.payload.schedule[0] * 1000
          }
        } else {
          node.status({ fill: 'yellow', shape: 'dot', text: response.status })
        }

        node.send([msgsp, msg])
      }).catch(function (error) {
        node.status({ fill: 'red', shape: 'dot', text: 'Error fetching VRM data' })
        node.warn(error)
      })
    })

    node.on('close', function () {
    })
  }

  RED.nodes.registerType('victron-scheduled-charging', VictronScheduledCharging)
}
