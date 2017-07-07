/*
 * node-bloom-control
 *
 * Copyright 2017, Valerian Saliou
 * Author: Valerian Saliou <valerian@valeriansaliou.name>
 */


"use strict";


var BloomControl = require("../").BloomControl;
var assert = require("assert");


describe("node-bloom-control", function() {
  describe("constructor", function() {
    it("should succeed creating a limiter with valid options", function() {
      assert.doesNotThrow(
        function() {
          new BloomControl({
            shard               : 7,
            host                : "::1",
            port                : 811,
            offlineStackMaxSize : 0
          });
        },

        "BloomControl should not throw on valid options"
      );
    });

    it("should fail creating a limiter with missing shard", function() {
      assert.throws(
        function() {
          new BloomControl({
            host  : "::1",
            port  : 811
          });
        },

        "BloomControl should throw on missing shard"
      );
    });

    it("should fail creating a limiter with invalid shard", function() {
      assert.throws(
        function() {
          new BloomControl({
            shard : 256,
            host  : "::1",
            port  : 811
          });
        },

        "BloomControl should throw on invalid shard"
      );
    });

    it("should fail creating a limiter with missing host", function() {
      assert.throws(
        function() {
          new BloomControl({
            shard : 7,
            port  : 811
          });
        },

        "BloomControl should throw on missing host"
      );
    });

    it("should fail creating a limiter with missing port", function() {
      assert.throws(
        function() {
          new BloomControl({
            shard : 7,
            host  : "::1"
          });
        },

        "BloomControl should throw on missing port"
      );
    });

    it("should fail creating a limiter with invalid port", function() {
      assert.throws(
        function() {
          new BloomControl({
            shard : 7,
            host  : "::1",
            port  : -40
          });
        },

        "BloomControl should throw on invalid port"
      );
    });

    it("should fail creating a limiter with missing socket", function() {
      assert.throws(
        function() {
          new BloomControl({
            shard : 7
          });
        },

        "BloomControl should throw on missing socket"
      );
    });

    it("should fail creating a limiter with invalid offlineStackMaxSize",
      function() {
        assert.throws(
          function() {
            new BloomControl({
              shard               : 7,
              host                : "::1",
              port                : 811,
              offlineStackMaxSize : "20"
            });
          },

          "BloomControl should throw on invalid offlineStackMaxSize"
        );
      }
    );
  });

  describe("purgeBucket method", function() {
    it("should defer purgeBucket on cacheBucketID when offline", function() {
      var bloomControl = new BloomControl({
        shard  : 0,
        socket : "/var/run/bloom.sock"
      });

      assert.ok(
        !(bloomControl.purgeBucket("bucket_id_1")),
        "Bucket purge should be deferred for 'bucket_id_1'"
      );

      assert.ok(
        !(bloomControl.purgeBucket(["bucket_id_2", "bucket_id_3"])),
        "Bucket purge should be deferred for 'bucket_id_2' + 'bucket_id_3'"
      );
    });
  });

  describe("purgeUser method", function() {
    it("should defer purgeUser on userIdentifier when offline", function() {
      var bloomControl = new BloomControl({
        shard  : 0,
        socket : "/var/run/bloom.sock"
      });

      assert.ok(
        !(bloomControl.purgeUser("user_id_1")),
        "User purge should be deferred for 'user_id_1'"
      );

      assert.ok(
        !(bloomControl.purgeUser(["user_id_2", "user_id_3"])),
        "User purge should be deferred for 'user_id_2' + 'user_id_3'"
      );
    });
  });

  describe("close method", function() {
    it("should not close twice already closed channel", function() {
      var bloomControl = new BloomControl({
        shard  : 0,
        socket : "/var/run/bloom.sock"
      });

      assert.ok(
        !(bloomControl.close()), "Channel close should not be executed"
      );
    });
  });
});
