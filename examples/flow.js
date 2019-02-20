/*
 * node-bloom-control
 *
 * Copyright 2017, Valerian Saliou
 * Author: Valerian Saliou <valerian@valeriansaliou.name>
 */


"use strict";


var BloomControl = require("../").BloomControl;


var bloomControl = new BloomControl({
  host  : "::1",
  port  : 8811,
  shard : 0
}).connect({
  connected : function() {
    // Connected handler
    console.info("Bloom Control succeeded to connect to host.");
    console.info("Running flow...");

    setTimeout(function() {
      // Test purge bucket
      var purgeBucket = bloomControl.purgeBucket("b_id");

      console.info("Sent: purgeBucket", purgeBucket);

      // Test purge bucket multiple
      var purgeBucketMultiple = bloomControl.purgeBucket(["b_id_1", "b_id_2"]);

      console.info("Sent: purgeBucketMultiple", purgeBucketMultiple);

      // Test purge auth
      var purgeAuth = bloomControl.purgeAuth("a_id", "a_to");

      console.info("Sent: purgeAuth", purgeAuth);

      // Test purge auth multiple
      var purgeAuthMultiple = bloomControl.purgeAuth([
        ["a_id_1", "a_to_1"],
        ["a_id_2", "a_to_2"]
      ]);

      console.info("Sent: purgeAuthMultiple", purgeAuthMultiple);

      console.info("Hold on...");

      setTimeout(function() {
        // Test close (#1)
        var close1 = bloomControl.close();

        console.info("Sent: close#1", close1);

        // Test close (#2)
        var close2 = bloomControl.close();

        console.info("Sent: close#2", close2);

        // Test purge bucket (after close)
        var purgeBucketAfterClose = bloomControl.purgeBucket("b_id");

        console.info("Sent: purgeBucketAfterClose", purgeBucketAfterClose);

        console.info("Hold on...");

        setTimeout(function() {
          console.info("Reconnecting...");

          // Reconnect
          bloomControl.connect(
            function() {
              console.info("Reconnected.");

              console.info("Hold on...");

              setTimeout(function() {
                console.info("Disconnecting...");

                bloomControl.close(function() {
                  console.info("Disconnected...");
                  console.info("Done running flow.");

                  process.exit(0);
                });
              }, 1000);
            },

            function(error_reco) {
              console.error("Failed reconnecting.", error_reco);
            }
          );
        }, 1000);
      }, 4000);
    }, 500);
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

process.stdin.resume();
