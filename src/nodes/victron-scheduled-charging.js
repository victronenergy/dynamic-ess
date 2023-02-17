module.exports = function (RED) {
  'use strict'

  const request = require('request')

  function VictronScheduledCharging (config) {
    RED.nodes.createNode(this, config)

    const node = this

    node.on('input', function (msg) {
      let  url = msg.url || 'https://vrmapi.victronenergy.com/v2'

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

      let msgsp = {
        topic: 'ideal setpoint',
        payload: null
      }

      const options = {
        url,
        qs: {
          b_max: (msg.b_max || config.b_max || 1),
          tb_max: (msg.tb_max || config.tb_max || 1),
          fb_max: (msg.fb_max || config.fb_max || 1),
          long: (msg.longitude || config.longitude),
          lat: (msg.latitude || config.latitude),
          country: (msg.country || 'nl').toUpperCase(),
          B0: 0
        },
        headers: {
          'X-Authorization': 'Token ' + config.vrmtoken,
          accept: 'application/json'
        }
      }

      if (msg.vrmid) {
        if (msg.vrmid.match(/^[0-9]+$/)) {
          options.qs.site_id = +msg.vrmid
        } else {
          options.qs.portal_id = msg.vrmid
        }
      } else {
        if (config.vrmid.match(/^[0-9]+$/)) {
          options.qs.site_id = +config.vrmid
        } else {
          options.qs.portal_id = config.vrmid
        }
      }

      if (config.verbose === true) {
        node.warn(options)
      } else {
        node.warn('not verbose')
      }

      node.status({ fill: 'yellow', shape: 'ring', text: 'Retrieving setpoint' })
      request.get(options, function (error, response, body) {
        if (error) {
          node.status({ fill: 'red', shape: 'dot', text: 'Error fetching VRM data' })
          node.warn(error)
        } else {
          if (response.statusCode === 200) {
            msg.payload = JSON.parse(body)
            node.status({ fill: 'green', shape: 'dot', text: "Ok"})
            if (msg.payload.schedule) {
              msgsp.payload = msg.payload.schedule[0] * 1000;
            }
          } else {
            node.status({ fill: 'yellow', shape: 'dot', text: response.statusCode })
          }
        }
        node.send([msgsp, msg])
      })
    })

    node.on('close', function () {
    })
  }

  RED.nodes.registerType('victron-scheduled-charging', VictronScheduledCharging)
}
