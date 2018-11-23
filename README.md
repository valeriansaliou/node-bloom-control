# node-bloom-control

[![Build Status](https://img.shields.io/travis/valeriansaliou/node-bloom-control/master.svg)](https://travis-ci.org/valeriansaliou/node-bloom-control) [![Test Coverage](https://img.shields.io/coveralls/valeriansaliou/node-bloom-control/master.svg)](https://coveralls.io/github/valeriansaliou/node-bloom-control?branch=master) [![NPM](https://img.shields.io/npm/v/bloom-control.svg)](https://www.npmjs.com/package/bloom-control) [![Downloads](https://img.shields.io/npm/dt/bloom-control.svg)](https://www.npmjs.com/package/bloom-control) [![Buy Me A Coffee](https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg)](https://www.buymeacoffee.com/valeriansaliou)

**Bloom Control integration for Node. Used in pair with Bloom, the HTTP REST API caching middleware.**

Bloom Control lets you control your Bloom cache, from your NodeJS code. Purge API cache on-demand, whenever your API worker updates a database model or performs some action that require cached data to be invalidated.

**🇫🇷 Crafted in Brest, France.**

## Who uses it?

<table>
<tr>
<td align="center"><a href="https://crisp.chat/"><img src="https://valeriansaliou.github.io/node-bloom-control/images/crisp.png" height="64" /></a></td>
</tr>
<tr>
<td align="center">Crisp</td>
</tr>
</table>

_👋 You use bloom-control and you want to be listed there? [Contact me](https://valeriansaliou.name/)._

## How to install?

Include `bloom-control` in your `package.json` dependencies.

Alternatively, you can run `npm install bloom-control --save`.

## How to use?

### 1. Create the connection

`node-bloom-control` can be instanciated as such:

```javascript
var BloomControl = require("bloom-control").BloomControl;

var bloomControl = new BloomControl({
  host  : "::1",  // Or '127.0.0.1' if you are still using IPv4
  port  : 8811,   // Default port is '8811'
  shard : 0       // Specify the Bloom shard to use, as \
                  //   a Bloom instance can host multiple cache shards, eg. for different API workers
}).connect({
  connected : function() {
    // Connected handler
    console.info("Bloom Control succeeded to connect to host.");
  },

  disconnected : function() {
    // Disconnected handler
    console.error("Bloom Control is now disconnected.");
  },

  timeout : function() {
    // Timeout handler
    console.error("Bloom Control connection timed out.");
  },

  retrying : function() {
    // Retry handler
    console.error("Trying to reconnect to Bloom Control...");
  },

  error : function(error) {
    // Failure handler
    console.error("Bloom Control failed to connect to host.", error);
  }
});
```

### 2. Purge cache collections

Use the same `bloomControl` instance to purge cache collections:

```javascript
// Notice: all methods return 'true' if executed immediately, 'false' if deferred (ie. TCP socket disconnected)

// Purge cache for a given bucket (all authenticated users)
bloomControl.purgeBucket(`cache_bucket_id`, function(error) {
  // Handle purge errors here
});

// Purge cache for a multiple buckets at once (all authenticated users)
bloomControl.purgeBucket([
  `cache_bucket_id_1`,
  `cache_bucket_id_2`
], function(error) {
  // Handle purge errors here
});

// Purge all cache for a given authenticated user
// Notice: identifier and token can usually be found in your Basic Auth headers
bloomControl.purgeAuth(`auth_identifier`, `auth_token`, function(error) {
  // Handle purge errors here
});

// Purge all cache for multiple authenticated users at once
bloomControl.purgeAuth([
  [`auth_identifier_1`, `auth_token_1`],
  [`auth_identifier_2`, `auth_token_2`]
], function(error) {
  // Handle purge errors here
});
```

### 3. Listen for processed commands

In the event you need to debug the commands being executed (given the result, either `NIL`, `OK`, `ERR` or `PONG`), you can register a listener as:

```javascript
// Listen for OK commands (ie. executed commands)
bloomControl.on("OK", function(command) {
  console.log("Command OK:", command);
});

// Listen for ERR commands (ie. failed commands)
bloomControl.on("ERR", function(command) {
  console.log("Command ERR:", command);
});

// Listen for NIL commands (ie. unknown commands, you won't need this)
bloomControl.on("NIL", function(command) {
  console.log("Command NIL:", command);
});

// Listen for PONG commands (ie. replies to pings)
bloomControl.on("PONG", function(command) {
  console.log("Command PONG:", command);
});
```

You can stop listening to events as such:

```javascript
bloomControl.off("OK");
bloomControl.off("ERR");
bloomControl.off("NIL");
bloomControl.off("PONG");
```

**Notice: only 1 handler can be registered at the same time for a given command result.**

### 4. Test connection

You can test your connection to Bloom anytime by sending a ping:

```javascript
bloomControl.ping(function(error) {
  // Handle ping errors here
});
```

The response to your ping will come on the event channel (register a listener for the `PONG` event).

**Notice: pings are automatically sent to maintain the connection. You will get pong events periodically on the event channel, even if you never sent a ping.**

### 5. Teardown connection

If you need to teardown an ongoing connection to Bloom, use:

```javascript
// Returns: true if proceeding close, false if already closed
bloomControl.close(function(error) {
  // Handle close errors here
});
```

## What is Bloom?

ℹ️ **Wondering what Bloom is?** Check out **[valeriansaliou/bloom](https://github.com/valeriansaliou/bloom)**.

## How is it linked to Bloom?

`node-bloom-control` maintains a persistent TCP connection to the Bloom Control interface that's listening on your running Bloom instance. In case `node-bloom-control` gets disconnected from Bloom, it will retry to connect once the connection is established again. Pending cache purge requests that could not be transmitted to Bloom are stacked, up to a certain limit where further cache purge requests will be dropped and not stacked. Once the connection to Bloom Control is established again, stacked cache purge requests are transmitted to Bloom for processing.

You can configure the connection details of your Bloom instance when initializing `node-bloom-control` from your code; via the Bloom host and port.
