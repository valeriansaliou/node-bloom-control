# node-bloom-control

[![Build Status](https://img.shields.io/travis/valeriansaliou/node-bloom-control/master.svg)](https://travis-ci.org/valeriansaliou/node-bloom-control) [![Test Coverage](https://img.shields.io/coveralls/valeriansaliou/node-bloom-control/master.svg)](https://coveralls.io/github/valeriansaliou/node-bloom-control?branch=master) [![NPM](https://img.shields.io/npm/v/bloom-control.svg)](https://www.npmjs.com/package/bloom-control) [![Downloads](https://img.shields.io/npm/dt/bloom-control.svg)](https://www.npmjs.com/package/bloom-control)

**Bloom Control integration for Node. Used in pair with Bloom, the HTTP REST API caching middleware.**

Bloom Control lets you control your Bloom cache, from your NodeJS code. Purge API cache on-demand, whenever your API worker updates a database model or performs some action that require cached data to be invalidated.

## Who uses it?

<table>
<tr>
<td align="center"><a href="https://crisp.im/"><img src="https://valeriansaliou.github.io/node-bloom-control/images/crisp.png" height="64" /></a></td>
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
  port  : 811,    // Default port is '811'
  shard : 0       // Specify the Bloom shard to use
                  // A Bloom instance can host multiple cache shards, eg. for different API workers

  // If Bloom is listening on an UNIX socket
  // socket : "/tmp/bloom.sock"
});
```

### 2. Purge cache collections

Use the same `bloomControl` instance to purge cache collections:

```javascript
// Purge cache for a given bucket (all authenticated users)
bloomControl.purge.bucket(`cache_bucket_id`)

// Purge all cache for an authenticated user
// Notice: identifier and token can usually be found in your Basic Auth headers
bloomControl.purge.user(`user_identifier`, `user_token`)
```

### 3. Teardown bloom

If you need to teardown an ongoing connection to Bloom, use:

```javascript
bloomControl.close();

// Note: cache purge calls will now throw an error as the connection is now closed.
```

## What is Bloom?

Wondering what Bloom is? Check out **[valeriansaliou/bloom](https://github.com/valeriansaliou/bloom)**.

## How is it linked to Bloom?

`node-bloom-control` maintains a persistent TCP connection to the Bloom Control interface that's listening on your running Bloom instance. In case `node-bloom-control` gets disconnected from Bloom, it will retry to connect once the connection is established again. Pending cache purge requests that could not be transmitted to Bloom are stacked, up to a certain limit where further cache purge requests will be dropped and not stacked. Once the connection to Bloom Control is established again, stacked cache purge requests are transmitted to Bloom for processing.

You can configure the connection details of your Bloom instance when initializing `node-bloom-control` from your code, eg. the Bloom host and port, or UNIX socket.
