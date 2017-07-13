/*
 * node-bloom-control
 *
 * Copyright 2017, Valerian Saliou
 * Author: Valerian Saliou <valerian@valeriansaliou.name>
 */


"use strict";


var net       = require("net");
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
  if (typeof options.host !== "string" || !options.host) {
    throw new Error("Invalid or missing options.host");
  }
  if (typeof options.port !== "number" || options.port < 0 ||
        options.port > 65535) {
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

  // Patterns
  this.__responsePattern = /^([A-Z]+)(?:\s(.*))?$/;

  // Storage space
  this.__options         = {
    shard               : options.shard,
    host                : (options.host   || null),
    port                : (options.port   || null),

    offlineStackMaxSize : (
      typeof options.offlineStackMaxSize === "number" ?
        options.offlineStackMaxSize : offlineStackMaxSizeDefault
    )
  };

  this.__client          = null;
  this.__isClosing       = false;
  this.__retryTimeout    = null;

  this.__connectHandlers = {};

  this.__offlineStack    = [];
};


/**
 * BloomControl.prototype.connect
 * @public
 * @param  {function} handleSuccess
 * @param  {function} handleError
 * @return {object}   Bloom Control instance
 */
BloomControl.prototype.connect = function(handleSuccess, handleError) {
  var self = this;

  // Flush any scheduled retry timeout
  if (self.__retryTimeout !== null) {
    clearTimeout(self.__retryTimeout);

    self.__retryTimeout = null;
  }

  if (self.__client === null) {
    var isConnected = false;

    // Register connect handlers
    self.__connectHandlers = {
      success : handleSuccess,
      error   : handleError
    };

    try {
      // Setup client
      var client = new net.Socket();

      client.setKeepAlive(true, 60000);  // Keep-alive every 60s
      client.setNoDelay(true);           // Disable Nagle algorithm
      client.setTimeout(300000);         // Time-out after 5m

      // Connect to Bloom Control endpoint
      client.connect(
        {
          port : self.__options.port,
          host : self.__options.host
        },

        function() {
          isConnected = true;
        }
      );

      client.on("data", function(data) {
        if (data) {
          var lines = data.toString().split("\n");

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            if (line) {
              self.__handle_data_line.bind(self)(client, line);
            }
          }
        }
      });

      client.on("timeout", function() {
        client.end();
      });

      client.on("error", function(error) {
        if (isConnected === false) {
          client.destroy();

          // Failure (unknown)
          self.__triggerConnectHandler("error", error);
        }
      });

      client.on("close", function(hadError) {
        if (isConnected === true) {
          client.destroy();

          // Failure (closed)
          self.__handle_disconnected.bind(self)();
        }
      });
    } catch (error) {
      // Failure (could not connect)
      self.__triggerConnectHandler("error", error);
    }
  } else {
    // Immediate success (already connected)
    self.__triggerConnectHandler("success");
  }

  return self;
};


/**
 * BloomControl.prototype.purgeBucket
 * @public
 * @param  {string|object} cacheBucketID
 * @param  {function}      done
 * @return {boolean}       Whether bucket purge was executed now or deferred
 */
BloomControl.prototype.purgeBucket = function(cacheBucketID, done) {
  var executeResult = true;

  // Acquire arguments
  var purgeList = (
    (cacheBucketID instanceof Array) ? cacheBucketID : [cacheBucketID]
  );

  // Aggregate done in a single callback for multiple purge values
  var doneSingleAggregate = this.__buildHandlerAggregator(
    purgeList.length, done
  );

  for (var i = 0; i < purgeList.length; i++) {
    var purgeItem = purgeList[i];

    if (!purgeItem) {
      throw new Error("Missing cacheBucketID");
    }

    executeResult = (
      this.__executeOrDefer(
        "purgeBucket", [purgeItem, doneSingleAggregate]
      ) && executeResult
    );
  }

  return executeResult;
};


/**
 * BloomControl.prototype.purgeAuth
 * @public
 * @param  {string|object} authIdentifier
 * @param  {string}        authToken
 * @param  {function}      done
 * @return {boolean}       Whether auth purge was executed now or deferred
 */
BloomControl.prototype.purgeAuth = function(authIdentifier, authToken, done) {
  var executeResult = true;

  // Acquire arguments
  var purgeList  = (
    (authIdentifier instanceof Array) ? authIdentifier :
      [[authIdentifier, authToken]]
  );
  var doneHandle = (typeof authToken === "function") ? authToken : done;

  // Aggregate done in a single callback for multiple purge values
  var doneSingleAggregate = this.__buildHandlerAggregator(
    purgeList.length, doneHandle
  );

  for (var i = 0; i < purgeList.length; i++) {
    var purgeItem = purgeList[i];

    if (!purgeItem || !purgeItem[0] || !purgeItem[1]) {
      throw new Error("Missing authIdentifier or authToken");
    }

    executeResult = (
      this.__executeOrDefer(
        "purgeAuth", [purgeItem[0], purgeItem[1], doneSingleAggregate]
      ) && executeResult
    );
  }

  return executeResult;
};


/**
 * BloomControl.prototype.close
 * @public
 * @param  {function} done
 * @return {boolean}  Whether connection was closed now or not
 */
BloomControl.prototype.close = function(done) {
  if (this.__client !== null) {
    this.__execute("close", [done]);

    // Unbind client immediately
    this.__client = null;

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
  this.__emit(
    ("FLUSHB " + this.__hash(cacheBucketID)), done
  );
};


/**
 * BloomControl.prototype.__operation_$purgeAuth
 * @private
 * @param  {string|object} authIdentifier
 * @param  {string}        authToken
 * @param  {function}      done
 * @return {undefined}
 */
BloomControl.prototype.__operation_$purgeAuth = function(
  authIdentifier, authToken, done
) {
  // Generate pristine HTTP authorization header
  let authHeader = (
    "Basic " + new Buffer(authIdentifier + ":" + authToken).toString("base64")
  );

  this.__emit(
    ("FLUSHA " + this.__hash(authHeader)), done
  );
};


/**
 * BloomControl.prototype.__operation_$close
 * @private
 * @param  {function} done
 * @return {undefined}
 */
BloomControl.prototype.__operation_$close = function(done) {
  if (this.__client !== null) {
    this.__isClosing = true;

    this.__emit("QUIT", done);
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
    parseInt(farmhash.fingerprint32(value), 10).toString(16)
  );
};


/**
 * BloomControl.prototype.__emit
 * @private
 * @param  {string}   command
 * @param  {function} done
 * @param  {object}   [client]
 * @return {undefined}
 */
BloomControl.prototype.__emit = function(command, done, client) {
  var result;

  if (this.__client !== null || client) {
    (client || this.__client).write(command + "\n");
  } else {
    result = new Error("Channel closed");
  }

  if (typeof done === "function") {
    done(result);
  }
};


/**
 * BloomControl.prototype.__triggerConnectHandler
 * @private
 * @param  {string} type
 * @param  {object} data
 * @return {undefined}
 */
BloomControl.prototype.__triggerConnectHandler = function(type, data) {
  if (typeof this.__connectHandlers[type] === "function") {
    this.__connectHandlers[type](data);

    this.__connectHandlers = {};
  }
};


/**
 * BloomControl.prototype.__buildHandlerAggregator
 * @private
 * @param  {number}   count
 * @param  {function} done
 * @return {function} Handler aggregator
 */
BloomControl.prototype.__buildHandlerAggregator = function(type, done) {
  var doneCount = 0;

  return function(error) {
    doneCount++;

    if (doneCount === type) {
      if (typeof done === "function") {
        done(error);
      }
    }
  };
};


/**
 * BloomControl.prototype.__handle_connected
 * @private
 * @param  {object} client
 * @return {undefined}
 */
BloomControl.prototype.__handle_connected = function(client) {
  var self = this;

  if (self.__client === null) {
    self.__client = client;

    // Unstack pending offline operations (after an hold time)
    if (self.__offlineStack.length > 0) {
      setTimeout(function() {
        while (self.__offlineStack.length > 0) {
          self.__execute.apply(self, self.__offlineStack.shift());
        }
      }, 500);
    }
  }

  // Success (now connected)
  self.__triggerConnectHandler("success");
};


/**
 * BloomControl.prototype.__handle_disconnected
 * @private
 * @return {undefined}
 */
BloomControl.prototype.__handle_disconnected = function() {
  var self = this;

  self.__client = null;

  // Schedule retry?
  if (self.__isClosing !== true && self.__retryTimeout === null) {
    self.__retryTimeout = setTimeout(function() {
      self.__retryTimeout = null;

      self.connect(
        undefined,

        function() {
          // Failed retrying, schedule next retry
          self.__handle_disconnected();
        }
      );
    }, 2000);
  }

  // Not closing anymore
  self.__isClosing = false;
};


/**
 * BloomControl.prototype.__handle_data_line
 * @private
 * @param  {object} client
 * @param  {string} line
 * @return {undefined}
 */
BloomControl.prototype.__handle_data_line = function(client, line) {
  // Ensure line matches recognized pattern
  var match = line.match(this.__responsePattern);

  if (match && match[1]) {
    // Route response command to handler
    var handler = this["__handle_data_line_" + match[1].toLowerCase()];

    if (typeof handler === "function") {
      handler.bind(this)(client, match[2]);
    }
  } else {
    throw new Error("Handled invalid data line");
  }
};


/**
 * BloomControl.prototype.__handle_data_line_hashreq
 * @private
 * @param  {object} client
 * @param  {string} argument
 * @return {undefined}
 */
BloomControl.prototype.__handle_data_line_hashreq = function(client, argument) {
  this.__emit(
    ("HASHRES " + this.__hash(argument)), undefined, client
  );
};


/**
 * BloomControl.prototype.__handle_data_line_started
 * @private
 * @param  {object} client
 * @param  {string} argument
 * @return {undefined}
 */
BloomControl.prototype.__handle_data_line_started = function(client, argument) {
  // Select shard
  this.__emit(
    ("SHARD " + this.__options.shard.toString()), undefined, client
  );

  // Now connected
  this.__handle_connected(client);
};


/**
 * BloomControl.prototype.__handle_data_line_ended
 * @private
 * @param  {object} client
 * @param  {string} argument
 * @return {undefined}
 */
BloomControl.prototype.__handle_data_line_ended = function(client, argument) {
  // Incompatible hasher? (critical error)
  if (argument === "incompatible_hasher") {
    throw new Error(
      "Local hasher is not compatible with remote Bloom hasher, " +
        "please double-check your architecture. Aborting there."
    );
  }

  client.destroy();
};


exports.BloomControl = BloomControl;
