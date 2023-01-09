Changelog
=========

## 1.3.9 (2023-01-09)

### New Features

* Automate the package release process via GitHub Actions (ie. `npm publish`) [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.3.8 (2022-06-21)

### Changes

* Process wire protocol lines as soon as they are received on the buffer, this avoids deferring the processing of responses until we reach a line feed character [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.3.7 (2022-06-21)

### Changes

* Improve further the wire protocol line splitter system [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.3.6 (2022-06-21)

### Changes

* Improve the performance of data buffer splitter, by skipping pre-trimming [[@valeriansaliou](https://github.com/valeriansaliou)].
* Improve the performance of the wire protocol handler, by moving away from regex-based parsing [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.3.5 (2022-06-21)

### Changes

* Improve performance of all commands, by removing the callback function builder [[@valeriansaliou](https://github.com/valeriansaliou)].
* Improve performance and traceability of connection event handlers [[@valeriansaliou](https://github.com/valeriansaliou)].
* Remove performance-killer try/catch block [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.3.4 (2022-06-20)

### Bug Fixes

* Fix misplaced timeout cancellation [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.3.3 (2022-06-20)

### Bug Fixes

* Prevent the bubbling-up of a custom handler error in the disconnection handler, which was breaking internal reconnection mechanism [[@valeriansaliou](https://github.com/valeriansaliou)].

### Changes

* Clear all pending commands on connection close [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.3.2 (2022-06-20)

### Bug Fixes

* Harden reconnection flow by making sure that all registered timeouts and intervals are bailed out [[@valeriansaliou](https://github.com/valeriansaliou)].

### Changes

* Add the ability to disable emit queue and offline stack by setting their options to zero [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.3.1 (2022-06-16)

### Changes

* Improve performance when the Bloom Control client is disconnected, by throwing string objects intead of stack-capturing errors [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.3.0 (2021-10-31)

### Bug Fixes

* Fix examples with the new Bloom Control API [[@valeriansaliou](https://github.com/valeriansaliou)].
* Fix infinite reconnect loop in examples [[@valeriansaliou](https://github.com/valeriansaliou)].

### Changes

* Move project CI/CD from Travis to GitHub Actions [[@valeriansaliou](https://github.com/valeriansaliou)].
* Removed Coveralls coverage analysis [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.2.0 (2019-02-15)

### Changes

* Add a "Crafted" label in the README [[@valeriansaliou](https://github.com/valeriansaliou)].
* Add a "Buy Me A Coffee" button in the README [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.1.0 (2017-09-02)

### New Features

* Add more connection handlers to event listeners that can be registered [[@valeriansaliou](https://github.com/valeriansaliou)].
* Periodically ping the Bloom server to make sure an idle Bloom Control connection is maintained in any network environment [[@valeriansaliou](https://github.com/valeriansaliou)].

### Bug Fixes

* Improve wire protocol data buffer line splitting system [[@valeriansaliou](https://github.com/valeriansaliou)].
* Last commands internal object is now an array implemented as a sliding window, fixing an issue where some commands would be skipped in registered event listeners [[@valeriansaliou](https://github.com/valeriansaliou)].

### Changes

* Fix Bloom Control port in examples, from `811` to `8811` [[@valeriansaliou](https://github.com/valeriansaliou)].

## 1.0.0 (2017-07-08)

### New Features

* Initial `node-bloom-control` release [[@valeriansaliou](https://github.com/valeriansaliou)].
