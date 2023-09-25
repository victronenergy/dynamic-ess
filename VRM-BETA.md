# VRM (beta) implementation

At the moment Dynamic ESS is also roled out on (beta) VRM, which is more user-friendly in use but less flexible if you like to tinker yourself.

This document describes how to switch between the two versions, as you can only have one of the versions running at the same time.

Also make sure to check out the community post on this: https://community.victronenergy.com/articles/232720/dynamic-ess-on-beta-vrm.html and the [manual](https://www.victronenergy.com/live/drafts:dynamic_ess) for more information.

## Check which version is running

The running version of Dyanmice ESS is stored in `com.victronenergy.settings`, path `/Settings/DynamicEss/Mode`.

There are 5 different modes possible:  
| Mode | Function |
|---|---|
| 0 | Off |
| 1 | Auto / VRM |
| 2 | Buy |
| 3 | Sell |
| 4 | Node-RED |

The following flow will show the mode.  
```
[{"id":"2418189bd7f33e84","type":"victron-input-custom","z":"b9bfd7d55fb5c6e4","service":"com.victronenergy.settings","path":"/Settings/DynamicEss/Mode","serviceObj":{"service":"com.victronenergy.settings","name":"com.victronenergy.settings"},"pathObj":{"path":"/Settings/DynamicEss/Mode","name":"/Settings/DynamicEss/Mode","type":"number"},"name":"","onlyChanges":false,"x":330,"y":540,"wires":[["79031088efbb3a73"]]},{"id":"79031088efbb3a73","type":"debug","z":"b9bfd7d55fb5c6e4","name":"Dynamic ESS mode","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","targetType":"msg","statusVal":"","statusType":"auto","x":730,"y":540,"wires":[]}]
```

From VRM you cannot set the mode to Node-RED.  

## Disabe the Node-RED version

Easiest way to do this is by double-clicking the flow tab, pressing the "Enabled" box on the lower left corner to show "Disabled",
clicking _Done_ and deploying the flow again.

## Enable the (beta) VRM version

In order to enable the (beta) VRM version of Dynamic ESS, please follow the instructions in the [the manual](https://www.victronenergy.com/live/drafts:dynamic_ess).

## Issues

We'd like to seperate the issuse considering the VRM version of Dynamic ESS with the ones running the Node-RED version. The 
Node-RED ones can be filed [here](https://github.com/victronenergy/dynamic-ess/issues), the VRM ones can be filed [here](https://github.com/victronenergy/dynamic-ess/issues) as well, tagging them with the _VRM_ tag. They can also be reported in
community, in [this post](https://community.victronenergy.com/articles/232720/dynamic-ess-on-beta-vrm.html) or more general in the [modification space](https://community.victronenergy.com/spaces/31/index.html).
