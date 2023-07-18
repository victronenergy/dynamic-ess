module.exports = function (RED) {
  'use strict'

  const axios = require('axios')
  const curlirize = require('axios-curlirize')
  const path = require('path')
  const packageJson = require(path.join(__dirname, '../../', 'package.json'))

  function VictronDynamicEss (config) {
    RED.nodes.createNode(this, config)

    const node = this

    let url = 'https://vrm-dynamic-ess-api.victronenergy.com'
    let FeedInPossible = config.feed_in_possible
    let UseGridSetpointMinMax = true
    let justDeployed = true

    function outputDESSSschedule() {
      /* This function actually sends out the active schedule. This can be either
         triggered via an input node, but will also be triggered on each whole hour.
         If there is no schedule (yet), fetch a new one.
      */
      justDeployed = false
      const d = new Date()
      const hour = d.getHours()

      var target_soc = { topic: 'Target SOC' }
      var feed_in_enabled = { topic: 'Feed-in enabled'}
      var context = node.context().flow;
      var dess = context.get('dess')

      if (dess === undefined) {
        node.status({ fill: 'red', shape: 'dot', text: `Schedule unavailable in node context` })
        fetchVRMSchedule()
        return      
      }

      if (dess.output) {
        target_soc.payload = Number((dess.output.SOC[hour]).toFixed(1))
        feed_in_enabled.payload = dess.output.feed_in[hour]
      }

      node.send([target_soc, feed_in_enabled]);
    }

    function outputHourlySchedule() {
      /* On each whole hour trigger sending out the latest schedule
      */
      var currentTime = new Date();
      if (currentTime.getMinutes() === 0 && currentTime.getSeconds() === 0) {
        if (config.warn) { 
          node.warn("Hourly output of schedule")
        }
        outputDESSSschedule()
      }

      /* Also check if the last valid update has been to too long ago, in
      which case we disable Dynamic ESS. Only check on the whole minute.
      */
      if (currentTime.getSeconds() === 0) {
        var context = node.context().flow;

        if (context.get('lastValidUpdate') && (currentTime - context.get('lastValidUpdate')) > 3600000) {
          node.warn('Unable to connect to VRM for more than an hour, disabling dynamic ESS')
          node.send([{ payload: 0 }, { payload: { output_idle_b: Array(24).fill(false) } }, { payload: false }, { payload: 'Unable to connect to VRM for more than an hour, disabling dynamic ESS' }])
        }  
      }
    }

    function fetchVRMSchedule() {
      node.warn("Fetching VRM Schedule");
      let flowContext = node.context().flow;

      const nextUpdate = 290 - ((Date.now() - flowContext.get('lastValidUpdate')) / 1000).toFixed(0) || 0
      if (nextUpdate > 0 && !justDeployed) {
        node.status({ fill: 'red', shape: 'dot', text: `Trying to update too quickly, wait ${nextUpdate} seconds` })
        return
      }

      if (!config.vrmtoken) {
        node.status({ fill: 'red', shape: 'dot', text: 'No VRM token set' })
        return
      }

      if (!config.site_id) {
        node.status({ fill: 'red', shape: 'dot', text: 'No VRM ID token set' })
        return
      }

      let msg = {}
      msg.topic = 'VRM dynamic ess'
      msg.payload = null

      const msgsp = {
        topic: 'ideal setpoint',
        payload: null
      }

      let context = node.context()

      const options = {
        site_id: (context.get('site_id') || config.site_id).toString(),
        B_max: (config.b_max || 1).toString(),
        tb_max: (config.tb_max || 1).toString(),
        fb_max: (config.fb_max || 1).toString(),
        tg_max: (config.tg_max || 0).toString(),
        fg_max: (config.fg_max || 1).toString(),
        b_cost: (config.b_cost || 0).toString(),
        buy_price_formula: (config.buy_price_formula || 'p').toString(),
        sell_price_formula: (config.sell_price_formula || 'p').toString(),
        feed_in_possible: (config.feed_in_possible || true).toString(),
        feed_in_control_on: (config.feed_in_control_on || true).toString(),
        country: (config.country || 'nl').toUpperCase()
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

          let data = response.data
          data.options = options
          flowContext.set('dess', data)

          node.status({ fill: 'green', shape: 'dot', text: 'Ok' })
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

    setInterval(outputHourlySchedule, 1000);
    // Retrieve the latest schedule 5 times an hour
    setInterval(fetchVRMSchedule, 12 * 60 * 1000)

    node.on('input', function (msg) {
      var context = node.context()

      if (msg.url) {
        url = msg.url
      }
      if (msg.site_id) {
        context.set('site_id', msg.site_id)
      }
      outputDESSSschedule()
    })

    node.on("close", function() {
      clearInterval(outputHourlySchedule)
      clearInterval(fetchVRMSchedule)
    });


    if (config.verbose === true) {
      curlirize(axios)
    }
  }

  RED.nodes.registerType('victron-dynamic-ess', VictronDynamicEss)
}
