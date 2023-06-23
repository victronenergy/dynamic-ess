# Dynamic ESS

A Node-RED flow that uses VRM forecasting and algorithm to optimize when to sell, buy and hold the grid to zero. For use in systems that have hourly day ahead prices, which is the case in a big part of Europe.

Do check the [about](#about) and  [disclaimer](#disclaimer) below.

# Prerequisites

In order to successfuly use this node, installations must:  
- Be an ESS (Energy Storage System)
- Have a dynamic energy contract
- Not use generators
- Not be mobile
- For best results:
  - Have 28 days of operation time
  - Have location set for at least 28 days

# QuickStart

- Install the following nodes via the palette manager:
  - `victron-dynamic-ess`
  - `node-red-dashboard`
- Set your sites location in VRM.
- Import the _fetch-dynamic-ess_ example.
- Configure the _Victron Dynamic ESS_ node.
- Deploy the flow and check [the dashboard](https://venus.local:1881/ui).

All of the parts are written down in more detail below.
If you use this and have questions, issues and/or suggestions, please ask them in the [Node-RED space](https://community.victronenergy.com/smart-spaces/71/node-red.html) of our community or file and issue on the [GitHub](https://github.com/victronenergy/dynamic-ess/issues) site.

## Installing required nodes

From the palette manager, install the following nodes:
- [victron-dynamic-ess](https://flows.nodered.org/node/victron-dynamic-ess)
- [node-red-dashboard](https://flows.nodered.org/node/node-red-dashboard)

Below is a short screen recording showing how to install them.

![Screen recording: install victron-dynamic-ess](https://raw.githubusercontent.com/victronenergy/dynamic-ess/main/doc/img/install-dynamic-ess.gif)

Node-RED also has documentation on [adding nodes](https://nodered.org/docs/user-guide/runtime/adding-nodes).

## Set your location in VRM

Make sure that you set your sites position correctly in VRM, as that is used for determining the predicted solar forecast. This can be set under _Settings -> Set location_ in VRM for your site.

## Importing the _fetch-dynamic-ess_ example

Import the [_fetch-dynamic-ess_ example](https://github.com/victronenergy/dynamic-ess/blob/main/examples/fetch-dynamic-ess.json) (ctrl-i). Once imported, double-click the _Dynamic ESS VRM_ node and fill out all required fields.

![Screen recording: import fetch-dynamic-ess](https://raw.githubusercontent.com/victronenergy/dynamic-ess/main/doc/img/import-fetch-dynamic-ess.gif)

The imported flow looks like this:

![Dynamic ESS](https://github.com/victronenergy/dynamic-ess/raw/main/doc/img/dynamic-ess-flow.png)

Note that there also another example that you can import: [_fetch-dynamic-ess-with-average-price-switching.json_](https://github.com/victronenergy/dynamic-ess/blob/main/examples/fetch-dynamic-ess-with-average-price-switching.json). This example shows how to switch on/off a relay based on the average (dynamic) price.

## Configuration of the Victron Dynamic ESS node

<img src="https://raw.githubusercontent.com/victronenergy/dynamic-ess/master/doc/img/edit-panel.png" width="428px" alt="Edit panel" />

Double click the _Dynamic ESS VRM site_ to open the edit panel to configure the node. The following
fields need to be filled out:

- VRM token - The VRM access token. See [below](#create-an-access-token) on how to create one for your site.
- VRM site ID - Note that this may not be the same as your user ID. You can find your site id in the url on your dashboard. If for example your url for your dashboard is https://vrm.victronenergy.com/installation/654321/dashboard, your Site ID is 654321.
- B\_max - Battery capacity (in kWh)
- tb\_max - Maximum Battery charge power (in kW)
- fb\_max  - Maximum Battery discharge power (in kW)
- tg\_max - Maximum Grid Export power (in kW)
- fg\_max - Maximum Grid Import power (in kW).
- Battery costs - Cost of charging or discharging battery (in €/kWh).
- Feed in possible - Can you sell back to the grid?
- Feed-in control - Allow control over the feed-in variable (turn it off automatically when the prices are negative)?

The other thing to configure is the _buy price formula_ and _sell price formula_ (if you are allowed to sell back to the grid). This formula looks typically something like: `(p+0.02+0.13)*1.21`. It this example it breaks down to:  
- p - the dynamic price / kWh
- € 0.02 - energy provider profit share
- € 0.13 - DSO working price + contributions/levy/taxes
- 21% - tax

The sell price formula looks often identical and in common cases looks something like `(p-0.02+0.13)*1.21`. So the energy provider profit share works the other way around.

With different providers, the formula will likely be different. So this does require some research on how your pricing is build up.

The default filled out values are typical values. If you think you are factors of, you might want to consult on the [community](https://community.victronenergy.com/index.html) and ask for advice on what to fill out.

Once everything is filled out, you can deploy the flow and check https://venus.local:1881/ui/ to see how the system will take its actions for the day.

# Used dbus paths

When correctly deployed, these nodes do write (and read) from the dbus (using [node-red-contrib-victron](https://github.com/victronenergy/node-red-contrib-victron) nodes).
The following services and paths are being written to:  
- `com.victronenergy.settings /Settings/CGwacs/AcPowerSetPoint` - the obvious one, for setting the grid setpoint.
- `com.victronenergy.settings /Settings/CGwacs/OvervoltageFeedIn` - to enable or disable the "Grid feed-in".
- `com.victronenergy.settings /Settings/CGwacs/BatteryLife/Schedule/Charge/0/*`  - to put the battery in "idle" mode.

# Graphs

On each input, the flow generated fresh graphs, which are displayed on the Node-RED dashboard. Light gray background on the charts display the recorded values, while the transparent background shows the estimated/planned values. The darker gray part designates the current hour.

![Overview graph](./doc/img/overview-graph.png)  
![Schedule graph](./doc/img/schedule-graph.png)  
![Price graph](./doc/img/price-graph.png)  
![Costs graph](./doc/img/costs-graph.png)  
![Energy graph](./doc/img/energy-graph.png)

# Usage

As the information is being retrieved via the [VRM API](https://vrm-api-docs.victronenergy.com/#/), a token is needed to be able to get the required information. This token will then be used instead of your VRM credentials. See [create an access token](#create_an_access_token) below on how to do that.

While it is probably possible to deduct the country based on the longitude and latitude, it is a lot easier if you fill it out yourself. So you will need to fill out the country as well. This information is used to retrieve the current energy price from ENTSO-E. ENTSO-E is the European association for the cooperation of transmission system operators (TSOs) for electricity. All EU countries use this as source for determining their next day dynamic energy prices.

# Create an access token

In order to use the _dynamic ess_ node, you will need an VRM API access token.  Creating such a token requires a two-step action, taken on the VRM API. The process is described below.

## Bearer token

First point your browser to: https://vrm-api-docs.victronenergy.com/#/operations/auth/login

On the right of the screen there is an interactive box, where you can entery your VRM credentials and push the `Send API Request` button.

![API bearer token](https://github.com/victronenergy/dynamic-ess/raw/main/doc/img/api-bearer-token.png)

Make sure to add the `"remember_me": true`, allowing some extra time to create the access token.

If you use 2-factor authentication, you can add `"sms_token": "123456"`, where the number is the token from your 2-factor authentication app.

The _Response_ should be something like:
```
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjRjMzczOTk5NDFmYWU0NDdjMWVmMmZmNzNmMzU5NTQ4In0.eyJ1aWQiOiIxMjI5MTAiLCJ0b2tlbl90eXBlIjoiZGVmYXVsdCIsImlzcyI6InZybWFwaS52aWN0cm9uZW5lcmd5LmNvbSIsImF1ZCI6Imh0dHBzOi8vdnJtYXBpLnZpY3Ryb25lbmVyZ3kuY29tLyIsImlhdCI6MTY3Njg4MjYzMSwiZXhwIjoxNjc2OTY5MDMxLCJqdGkiOiI0YzM3Mzk5OTQxZmFlNDQ3YzFlZjJmZjczZjM1OTU0OCJ9.TjrtftTjU0r4n9nCxE2l6XnxpR2_ltS8R_EBJW_MaY1bs0i1x-6wu6GVNT42sqYP8wUxUEdV2qezKPvFSuG3TJVTcK6VJ6k6nhS7fHtmQ66-wyi917HOK7uw37PuOGzdEi2SrR8vg_Qd3kF6yhki8zcphMgeNqOD2hXHSUjbb3WUTKyMMG6fu0e9VgdY35wXzHZSzdbbQlkR9e6TIqDFYGEFjL_NpXhG48fVdxjtPgZXGeOzyuRUwezveZNo1-Pr4FTOsEa3_-krxSmwvktwa0sk0EjBLArnb-z6FI2Mpg-Vhv9EdeL5jP1zL6dOdSmE1rseemf7mS45zBB-FTN0qA",
  "idUser": 122910,
  "verification_mode": "mobile",
  "verification_sent": false
}
```

The long string after the `token` word is the _Bearer token_. You will need both the _token_ and the _idUser_ for creating the access token.

## Access token

Once you have a valid _Bearer_ token, you can create an access token. Point your browser to https://vrm-api-docs.victronenergy.com/#/operations/users/idUser/accesstokens/create and fill out the parameters. Give the access token a name in the body and hit the `Send API request` button.

![Access token](https://github.com/victronenergy/dynamic-ess/raw/main/doc/img/api-access-token.png)

Store the access token in your password vault as you won't be able to retrieve it again. You will also need to fill out this token in the _dynamic ess_ node.

When you are done you can point your browser to https://vrm-api-docs.victronenergy.com/#/operations/auth/logout and `Send API Request` for logging out and invalidating the Bearer token.

You can also [list](https://vrm-api-docs.victronenergy.com/#/operations/users/idUser/accesstokens/list) and [revoke](https://vrm-api-docs.victronenergy.com/#/operations/users/idUser/accesstokens/revoke) existing tokens via the VRM API.

# About

The goal of Dynamic ESS can be formulated in the following way:  
- Minimize the costs made on the grid and battery,
- By using the grid and battery to indirectly control the energy flow,
- While taking the consumption estimates, PV yield estimates, grid limitations, battery limitations and energy prices into account.

By taking the mentioned factors into account, Dynamic ESS builds a comprehensive model of the site to be able to generate a schedule of battery and grid usage for the installation to follow throughout the day to minimize its costs.

# Disclaimer

- This is a proof of concept project. In the future this implementation in Node-RED will become obsolete as the functionality will move into VRM/Venus OS native.
- This flow uses control paths that may interfere with your normal GX device usage. It adjusts settings (setpoint) and will insert a schedule for charging in the ESS menu. If you don't want that, don't use this node. See below which dbus paths are being used.
- When the API gets updated, there is a fair change that the node also needs to be updated. The API will respond with a `426` / Please update http status code.


