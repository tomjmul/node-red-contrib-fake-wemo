/**
 The MIT License (MIT)

 Copyright (c) 2016 @tomjmul

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */
'use strict';

module.exports = function(RED) {
    var WemoEmulator = require('./lib/WemoEmulator');
    var d = require('domain').create();
    var _ = require('lodash');
    var ni = require('network-interfaces');
    var bindInterfaceOptions = { internal: false, ipVersion: 4 };

    process.setMaxListeners(0);

    function FakeWemo(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var globalConfig = { debug: false };
        var connection = null;

        function getGlobalConfig() {
            return _.assign(globalConfig, node.context().global.get('fake-wemo'));
        }

        function debug() {
            if (getGlobalConfig().debug) {
                node.log.apply(node, arguments);
            }
        }

        if (config.initialStateType === 'bool') {
            config.initialState = config.initialState === 'true';
        }

        d.on('error', function(err) {
            node.error(`Emulation error: ${err.message}`, err);
            node.status({
                fill: 'red',
                shape: 'dot',
                text: err.message
            });
        });

        d.run(() => {
            WemoEmulator.build(config.friendlyName, {
                ipAddress: ni.toIp(config.interface, bindInterfaceOptions),
                httpPort: config.port,
                interface: config.interface,
                initialState: config.initialState
            }).then(wemoEmulator => {
                this.connection = wemoEmulator;
                this.status({
                    fill: 'yellow',
                    shape: 'dot',
                    text: `Listen on ${config.port} (${config.initialState ? 'on' : 'off'})`
                });
                debug(`Listening on: ${config.port}`);
                wemoEmulator
                    .on('on', function(self, sender) {
                        node.send({
                            topic: config.onTopic,
                            payload: config.onPayload,
                            sender: sender
                        });
                        node.status({
                            fill: 'green',
                            shape: 'dot',
                            text: 'on'
                        });
                        debug('Turning on');
                    })
                    .on('off', function(self, sender) {
                        node.send({
                            topic: config.offTopic,
                            payload: config.offPayload,
                            sender: sender
                        });
                        node.status({
                            fill: 'green',
                            shape: 'ring',
                            text: 'off'
                        });
                        debug('Turning off');
                    })
                    .on('close', function() {
                        node.status({
                            fill: 'red',
                            shape: 'ring',
                            text: 'closed'
                        });
                        debug('Closed');
                    });
            });
        });

        this.on('close', function() {
            debug('Closing connection');
            if (this.connection) {
                this.connection.close();
            }
            debug('Closed');
        });
    }

    RED.httpAdmin.get('/fake-wemo/:id', RED.auth.needsPermission('fake-wemo.read'), function(
        req,
        res
    ) {
        var interfaces = ni.getInterfaces(bindInterfaceOptions).reduce((acc, curr) => {
            acc.push({
                value: curr,
                text: curr + ' (' + ni.toIp(curr, bindInterfaceOptions) + ')'
            });
            return acc;
        }, []);
        res.json(interfaces);
    });

    RED.nodes.registerType('fake-wemo', FakeWemo);
};
