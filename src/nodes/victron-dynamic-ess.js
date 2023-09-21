module.exports = function (RED) {
  'use strict'

  const axios = require('axios')
  const curlirize = require('axios-curlirize')
  const path = require('path')
  const packageJson = require(path.join(__dirname, '../../', 'package.json'))

  function VictronDynamicEss (config) {
    RED.nodes.createNode(this, config)

    const node = this
    this.config = config

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
        const currentHour = currentDateTime.getHours()
        for (let schedule = 0; schedule <= 3; schedule++) {
          let schedulePick = currentHour + schedule
          if (schedulePick > Object.keys(dess.output.SOC).length) {
            schedulePick -= 24
          }
          output.push({
            topic: `Schedule ${schedule}`,
            soc: Number((dess.output.SOC[schedulePick])),
            feed_in: config.feed_in_possible ? 1 : 0,
            duration: 3600,
            start: unixTimestamp + (schedule * 3600)
          })
        }
      }

      node.send(output)
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

      const msg = {}
      msg.topic = 'VRM dynamic ess'
      msg.payload = null

      const options = {
        vrm_id: (config.vrm_id).toString(),
        b_max: (config.b_max).toString(),
        tb_max: (config.tb_max).toString(),
        fb_max: (config.fb_max).toString(),
        tg_max: (config.tg_max).toString(),
        fg_max: (config.fg_max).toString(),
        b_cost: (config.b_cost).toString(),
        buy_price_formula: (config.buy_price_formula).toString(),
        sell_price_formula: (config.sell_price_formula).toString(),
        feed_in_possible: (config.feed_in_possible).toString(),
        feed_in_control_on: (config.feed_in_control_on).toString(),
        country: (config.country).toUpperCase()
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

    const outputHourlyScheduleId = setInterval(outputHourlySchedule, 1000)
    // Retrieve the latest schedule 5 times an hour
    const fetchVRMScheduleId = setInterval(fetchVRMSchedule, 12 * 60 * 1000)

    // And once on deploy / restart
    fetchVRMSchedule()

    node.on('input', function (msg) {
      if (msg.url) {
        url = msg.url
      }

      outputDESSSschedule()
    })

    node.on('close', function () {
      clearInterval(outputHourlyScheduleId)
      clearInterval(fetchVRMScheduleId)
    })

    if (config.verbose === true) {
      curlirize(axios)
    }
  }

  RED.nodes.registerType('victron-dynamic-ess', VictronDynamicEss)
}
