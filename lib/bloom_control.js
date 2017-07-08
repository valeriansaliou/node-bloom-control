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

  // Patterns
  this.__responsePatterns = {
    all     : /^([A-Z]+)(?:\s(.*))?$/,

    ok      : /^(OK)$/,
    hashreq : /^(HASHREQ)(?:\s(.*))?$/,
    ended   : /^(ENDED)(?:\s(.*))?$/
  };

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

  this.__client        = null;
  this.__retry_timeout = null;

  this.__offlineStack  = [];
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
  if (this.__retry_timeout !== null) {
    clearTimeout(this.__retry_timeout);

    this.__retry_timeout = null;
  }

  if (this.__client === null) {
    var client      = new net.Socket();
    var isConnected = false;

    // TODO: configure timeouts or is it set by the server at any point?
    // TODO: support for UNIX sockets

    try {
      client.connect(
        {
          port : self.__options.port,
          host : self.__options.host
        },

        function() {
          isConnected = true;

          // Success (now connected)
          if (typeof handleSuccess === "function") {
            handleSuccess();
          }
        }
      );

      client.on("data", function(data) {
        if (data) {
          var lines = data.toString().split("\n");

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            if (line) {
              self.__handle_data_line(client, line);
            }
          }
        }
      });

      client.on("error", function(error) {
        if (isConnected === false) {
          client.destroy();

          // Failure (unknown)
          if (typeof handleError === "function") {
            handleError(error);
          }
        }
      });

      client.on("close", function(hadError) {
        if (isConnected === true) {
          client.destroy();

          // Failure (closed)
          self.__handle_disconnected();
        }
      });
    } catch (error) {
      // Failure (could not connect)
      if (typeof handleError === "function") {
        handleError(error);
      }
    }
  } else {
    // Immediate success (already connected)
    if (typeof handleSuccess === "function") {
      handleSuccess();
    }
  }

  return this;
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
  this.__emitHandle(
    ("FLUSHB " + this.__hash(cacheBucketID)),
    this.__responsePatterns.ok,
    done
  );
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
  this.__emitHandle(
    ("FLUSHA " + this.__hash(userIdentifier)),
    this.__responsePatterns.ok,
    done
  );
};


/**
 * BloomControl.prototype.__operation_$close
 * @private
 * @return {undefined}
 */
BloomControl.prototype.__operation_$close = function() {
  if (this.__client !== null) {
    // TODO do not schedule connect retry after quit, once socket is closed

    this.__emitHandle(
      "QUIT", this.__responsePatterns.ended
    );
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
 * BloomControl.prototype.__emit
 * @private
 * @param  {string}   command
 * @param  {function} done
 * @param  {object}   [client]
 * @return {undefined}
 */
BloomControl.prototype.__emit = function(command, done, client) {
  if (this.__client !== null || client) {
    // TODO
    console.info("write", command);

    // TODO: new line neccessary?
    (client || this.__client).write(command + "\\n");

    // TODO

    // TODO: block if last command was not executed yet (is the channel \
    //   synchronous?)
    // TODO: done(response, error)
  } else {
    if (typeof done === "function") {
      done(null, new Error("Channel closed"));
    }
  }
};


/**
 * BloomControl.prototype.__emitHandle
 * @private
 * @param  {string}   command
 * @param  {object}   responsePattern
 * @param  {function} done
 * @param  {object}   [client]
 * @return {undefined}
 */
BloomControl.prototype.__emitHandle = function(
  command, responsePattern, done, client
) {
  this.__emit(
    command,

    function(response, error) {
      var hasError = (
        (!error && response && responsePattern.test(response) === true) ?
          false : true
      );

      if (typeof done === "function") {
        done(hasError);
      }
    },

    client
  );
};


/**
 * BloomControl.prototype.__handle_connected
 * @private
 * @param  {object} client
 * @return {undefined}
 */
BloomControl.prototype.__handle_connected = function(client) {
  if (this.__client === null) {
    // TODO
    console.log('now connected');

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
 * @return {undefined}
 */
BloomControl.prototype.__handle_disconnected = function() {
  var self = this;

  // TODO: what if timeout on TCP connect?

  // TODO
  console.log('now disconnected');

  this.__client = null;

  // Schedule retry
  if (this.__retry_timeout === null) {
    // TODO
    console.log('retrying...');

    this.__retry_timeout = setTimeout(function() {
      this.__retry_timeout = null;

      self.connect(
        undefined,

        function() {
          // Failed retrying, schedule next retry
          self.__handle_disconnected();
        }
      );
    }, 2000);
  }
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
  var match = line.match(this.__responsePatterns.all);

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
