/*
 * node-bloom-control
 *
 * Copyright 2017, Valerian Saliou
 * Author: Valerian Saliou <valerian@valeriansaliou.name>
 */


"use strict";


var farmhash  = require("farmhash");


/**
 * BloomControl
 * @class
 * @classdesc  Instanciates a new Bloom Control connector.
 * @param      {object} options
 */
var BloomControl = function(options) {
  // Sanitize options
  if (typeof options !== "object") {
    throw new Error("Invalid or missing options");
  }
  if (typeof options.shard !== "number" || options.shard < 0 ||
        options.shard > 255) {
    throw new Error("Invalid or missing options.shard");
  }
  if (!options.host && !options.socket) {
    throw new Error("Missing either options.host or options.socket");
  }
  if (options.host && (typeof options.port !== "number" || options.port < 0 ||
        options.port > 65535)) {
    throw new Error(
      "Invalid or missing options.port (because options.host is set)"
    );
  }
  if (typeof options.offlineStackMaxSize !== "undefined"  &&
        (typeof options.offlineStackMaxSize !== "number" ||
          options.offlineStackMaxSize < 0)) {
    throw new Error("Invalid options.offlineStackMaxSize");
  }

  // Environment
  var offlineStackMaxSizeDefault = 10000;

  // Storage space
  this.__options       = {
    shard               : options.shard,
    host                : (options.host   || null),
    port                : (options.port   || null),
    socket              : (options.socket || null),

    offlineStackMaxSize : (
      typeof options.offlineStackMaxSize === "number" ?
        options.offlineStackMaxSize : offlineStackMaxSizeDefault
    )
  };

  this.__client       = null;

  this.__offlineStack = [];

  // Connection
  this.__connect();
};


/**
 * BloomControl.prototype.purgeBucket
 * @public
 * @param  {string|object} cacheBucketID
 * @param  {function}      done
 * @return {boolean}       Whether bucket purge was executed now or deferred
 */
BloomControl.prototype.purgeBucket = function(cacheBucketID, done) {
  return this.__executeOrDefer("purgeBucket", [cacheBucketID, done]);
};


/**
 * BloomControl.prototype.purgeUser
 * @public
 * @param  {string|object} userIdentifier
 * @param  {function}      done
 * @return {boolean}       Whether user purge was executed now or deferred
 */
BloomControl.prototype.purgeUser = function(userIdentifier, done) {
  return this.__executeOrDefer("purgeUser", [userIdentifier, done]);
};


/**
 * BloomControl.prototype.close
 * @public
 * @return {boolean} Whether connection was closed now or not
 */
BloomControl.prototype.close = function() {
  if (this.__client !== null) {
    this.__execute("close");

    return true;
  }

  return false;
};


/**
 * BloomControl.prototype.__executeOrDefer
 * @private
 * @param  {string}  operation
 * @param  {object}  args
 * @return {boolean} Whether was executed now or deferred
 */
BloomControl.prototype.__executeOrDefer = function(operation, args) {
  // Execute now?
  if (this.__client !== null) {
    this.__execute(operation, args);

    return true;
  }

  // Defer.
  this.__defer(operation, args);

  return false;
};


/**
 * BloomControl.prototype.__execute
 * @private
 * @param  {string} operation
 * @param  {object} args
 * @return {undefined}
 */
BloomControl.prototype.__execute = function(operation, args) {
  // Execute operation now.
  this["__operation_$" + operation].apply(this, (args || []));
};


/**
 * BloomControl.prototype.__defer
 * @private
 * @param  {string} operation
 * @param  {object} args
 * @return {undefined}
 */
BloomControl.prototype.__defer = function(operation, args) {
  // Offline stack is full?
  if (this.__offlineStack.length >= this.__options.offlineStackMaxSize) {
    throw new Error(
      "Offline stack is full, cannot stack more operations until " +
        "Bloom Control connection is restored (maximum size set to: " +
        this.__options.offlineStackMaxSize + " entries)"
    );
  }

  // Push to offline stack
  this.__offlineStack.push([operation, (args || [])]);
};


/**
 * BloomControl.prototype.__operation_$purgeBucket
 * @private
 * @param  {string|object} cacheBucketID
 * @param  {function}      done
 * @return {undefined}
 */
BloomControl.prototype.__operation_$purgeBucket = function(
  cacheBucketID, done
) {
  // TODO
};


/**
 * BloomControl.prototype.__operation_$purgeUser
 * @private
 * @param  {string|object} userIdentifier
 * @param  {function}      done
 * @return {undefined}
 */
BloomControl.prototype.__operation_$purgeUser = function(
  userIdentifier, done
) {
  // TODO
};


/**
 * BloomControl.prototype.__operation_$close
 * @private
 * @return {undefined}
 */
BloomControl.prototype.__operation_$close = function() {
  if (this.__client !== null) {
    // TODO
    // TODO: pass isClose=true to handle_disconnected while closing
  }
};


/**
 * BloomControl.prototype.__hash
 * @private
 * @param  {string} value
 * @return {string} Hexadecimal hash
 */
BloomControl.prototype.__hash = function(value) {
  // Validate input (prevents hashing DoS)
  if (!value) {
    throw new Error("Value to hash is empty");
  } else if (value.length > 2000) {
    throw new Error("Value to hash is too long");
  }

  // Hash input (hexadecimal output)
  return (
    (+farmhash.fingerprint64(value)).toString(16)
  );
};


/**
 * BloomControl.prototype.__connect
 * @private
 * @return {undefined}
 */
BloomControl.prototype.__connect = function() {
  if (this.__client === null) {
    // TODO: register => this.__handle_connected(<client>)
    // TODO: register => this.__handle_disconnected
  }
};


/**
 * BloomControl.prototype.__handle_connected
 * @private
 * @param  {object} client
 * @return {undefined}
 */
BloomControl.prototype.__handle_connected = function(client) {
  if (this.__client === null) {
    this.__client = client;

    // Unstack pending offline operations
    while (this.__offlineStack.length > 0) {
      this.__execute.apply(this, this.__offlineStack.shift());
    }
  }
};


/**
 * BloomControl.prototype.__handle_disconnected
 * @private
 * @param  {boolean} isClose
 * @return {undefined}
 */
BloomControl.prototype.__handle_disconnected = function(isClose) {
  if (this.__client !== null) {
    this.__client = null;

    // Schedule retry?
    if (isClose !== true) {
      // TODO: schedule retry
    }
  }
};


exports.BloomControl = BloomControl;
