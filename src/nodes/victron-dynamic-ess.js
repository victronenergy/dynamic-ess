module.exports = function (RED) {
  'use strict'

  const axios = require('axios')
  const curlirize = require('axios-curlirize')
  const path = require('path')
  const packageJson = require(path.join(__dirname, '../../', 'package.json'))
  let deployed = false

  function VictronDynamicEss (config) {
    RED.nodes.createNode(this, config)

    const node = this

    let url = 'https://vrm-dynamic-ess-api.victronenergy.com'

    function outputDESSSschedule () {
      /* This function actually sends out the active schedule. This can be either
         triggered via an input node, but will also be triggered on each whole hour.
         If there is no schedule (yet), fetch a new one.
      */
      const context = node.context().flow
      const dess = context.get('dess')

      if (dess === undefined) {
        node.status({ fill: 'red', shape: 'dot', text: 'Schedule unavailable in flow context' })

        fetchVRMSchedule()
        return
      }

      const output = []
      if (dess.output) {
        const currentDateTime = new Date()
        currentDateTime.setMinutes(0, 0, 0)
        const unixTimestamp = Math.floor(currentDateTime.getTime() / 1000)
        let currentHour = currentDateTime.getHours()
        for (let schedule = 0; schedule <= 3; schedule++) {
          let schedulePick = currentHour + schedule
          if (schedulePick > Object.keys(dess.output.SOC).length) {
            schedulePick -= 24
          }
          output.push({
            topic: `Schedule ${schedule}`,
            soc : Number((dess.output.SOC[schedulePick])),
            feed_in: dess.output.feed_in[schedulePick] ? 1 : 0,
            duration: 3600,
            start: unixTimestamp + (schedule*3600)
          })
        }
      }

      node.send(output)
      deployed = false
    }

    function outputHourlySchedule () {
      /* On each whole hour trigger sending out the latest schedule
      */
      const currentTime = new Date()
      if (currentTime.getMinutes() === 0 && currentTime.getSeconds() === 0) {
        if (config.verbose === true) {
          node.warn('Hourly output of schedule')
        }
        outputDESSSschedule()
      }

      /* Also check if the last valid update has been to too long ago, in
      which case we disable Dynamic ESS. Only check on the whole minute.
      */
      if (currentTime.getSeconds() === 0) {
        const context = node.context().flow

        if (context.get('lastValidUpdate') && (currentTime - context.get('lastValidUpdate')) > 3600000) {
          node.warn('Unable to connect to VRM for more than an hour')
          // No need to actually disable the schedule, as it will run out automatically
        }
      }
    }

    function fetchVRMSchedule () {
      // node.warn("fetchVRMSchedule called by " + (new Error()).stack.split("\n")[2].trim().split(" ")[1])

      if (!config.vrmtoken) {
        node.status({ fill: 'red', shape: 'dot', text: 'No VRM token set' })
        return
      }

      if (!config.vrm_id) {
        node.status({ fill: 'red', shape: 'dot', text: 'No VRM ID set' })
        return
      }

      const flowContext = node.context().flow

      const nextUpdate = 290 - ((Date.now() - flowContext.get('lastValidUpdate')) / 1000).toFixed(0) || 0
      if (nextUpdate > 0) {
        node.status({ fill: 'yellow', shape: 'dot', text: `Trying to update too quickly, wait ${nextUpdate} seconds` })
        return
      }

      const msg = {}
      msg.topic = 'VRM dynamic ess'
      msg.payload = null

      const context = node.context()
      const dess_config = flowContext.get('dess_config') || {}

      const options = {
        vrm_id: (dess_config.vrm_id || config.vrm_id || '').toString(),
        b_max: (dess_config.b_max || config.b_max || 1).toString(),
        tb_max: (dess_config.tb_max || config.tb_max || 1).toString(),
        fb_max: (dess_config.fb_max || config.fb_max || 1).toString(),
        tg_max: (dess_config.tg_max || config.tg_max || 0).toString(),
        fg_max: (dess_config.fg_max || config.fg_max || 1).toString(),
        b_cost: (dess_config.b_cost || config.b_cost || 0).toString(),
        buy_price_formula: (dess_config. buy_price_formula || config.buy_price_formula || 'p').toString(),
        sell_price_formula: (dess_config.sell_price_formula || config.sell_price_formula || 'p').toString(),
        feed_in_possible: (dess_config.feed_in_possible || config.feed_in_possible || true).toString(),
        feed_in_control_on: (dess_config.feed_in_control || config.feed_in_control_on || true).toString(),
        country: (dess_config.country || config.country || 'nl').toUpperCase()
      }
      const headers = {
        'X-Authorization': 'Token ' + config.vrmtoken,
        accept: 'application/json',
        'User-Agent': 'dynamic-ess/' + packageJson.version
      }

      if (config.verbose === true) {
        node.warn({
          url,
          options,
          headers
        })
      }

      node.status({ fill: 'yellow', shape: 'ring', text: 'Retrieving setpoint' })
      axios.get(url, { params: options, headers }).then(function (response) {
        if (response.status === 200) {
          const data = response.data
          data.options = options
          flowContext.set('dess', data)

          node.status({ fill: 'green', shape: 'dot', text: 'Ok' })

          outputDESSSschedule()
        } else {
          node.status({ fill: 'yellow', shape: 'dot', text: response.status })
        }

        if (response.data.warnings && response.data.warnings.length > 0) {
          node.warn(response.data.warnings)
        }
        flowContext.set('lastValidUpdate', Date.now())
      }).catch(function (error) {
        node.warn(error)
        if (error.response && error.response.data && error.response.data.detail) {
          node.status({ fill: 'red', shape: 'dot', text: error.response.data.detail })
        } else {
          node.status({ fill: 'red', shape: 'dot', text: 'Error fetching VRM data' })
        }
      })
    }

    // Also retrieve the VRM schedule on deploy
    RED.events.on("runtime-event", function(event) {
      if (event.id === "runtime-deploy") {
        // Remove the lastValidUpdate field, so we can fetch
        const flowContext = node.context().flow
        flowContext.set('lastValidUpdate', 0)

        flowContext.set('dess_config', {
          vrm_id: config.vrm_id,
          country: config.country,
          b_max: config.b_max,
          tb_max: config.tb_max,
          fb_max: config.fb_max,
          tg_max: config.tg_max,
          fg_max: config.fg_max,
          b_cost: config.b_cost,
          buy_price_formula: config.buy_price_formula,
          sell_price_formula: config.sell_price_formula,
          feed_in_possible: config.feed_in_possible,
          feed_in_control_on: config.feed_in_control_on
        })

        // Trick to only call this function once
        if (deployed) {
          return
        }

        setInterval(outputHourlySchedule, 1000)
        // Retrieve the latest schedule 5 times an hour
        setInterval(fetchVRMSchedule, 12 * 60 * 1000)

        deployed = true

        fetchVRMSchedule()
      }
    })

    node.on('input', function (msg) {
      const context = node.context()

      if (msg.url) {
        url = msg.url
      }

      const flowContext = node.context().flow
      let dess_config = flowContext.get('dess_config') || {}
      let changed = false

      const propertiesToCopy = ['vrm_id', 'country', 'b_max', 'tb_max', 'fb_max', 'tg_max', 'fg_max', 'b_cost',
       'buy_price_formula', 'sell_price_formula', 'feed_in_possible', 'feed_in_control_on'
      ];
      for (const property of propertiesToCopy) {
        if (typeof msg[property] !== 'undefined') {
          dess_config[property] = msg[property]
          changed = true
        }
      }

      if (changed) {
        flowContext.set('dess_config', dess_config)
      }

      outputDESSSschedule()
    })

    node.on('close', function () {
      clearInterval(outputHourlySchedule)
      clearInterval(fetchVRMSchedule)
    })

    if (config.verbose === true) {
      curlirize(axios)
    }
  }

  RED.nodes.registerType('victron-dynamic-ess', VictronDynamicEss)
}
