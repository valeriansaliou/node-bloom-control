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
    it("should succeed creating a connector", function() {
      assert.doesNotThrow(
        function() {
          new BloomControl();
        },

        "BloomControl should not throw on valid options"
      );
    });
  });
});
