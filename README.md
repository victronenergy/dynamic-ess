Scheduled charging comes down to setting the setpoint of your ESS system to the
optimal value, determined by several factors, implemented on VRM.

These factors are:

- the VRM id
- your (dynamic) energy contract price
- the solar prediction
- your battery size
- the charge speed
- the discharge speed
- your predicted consumption

If all of these values are known, VRM can make a calculated optimum setpoint.
Where optimum means the setting that should result in the lowest energy costs.

Some of the information is deducted from set parameters. Like the country determines
the energy price (as retrieved from ENTSOE) and the longitude and latitude determine
the solar forecast.

# Configuration

As the information is being retrieved via the [VRM API](https://vrm-api-docs.victronenergy.com/#/),
a token is needed to be able to get the required information. This token will
then be used instead of your VRM credentials.


