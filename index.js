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
            node.error('Emulation error: ' + err.message, err);
            node.status({
                fill: 'red',
                shape: 'dot',
                text: err.message
            });
        });

        d.run(() => {
            WemoEmulator.build(config.friendlyName, debug, {
                ipAddress: ni.toIp(config.interface, bindInterfaceOptions),
                httpPort: config.port,
                interface: config.interface,
                initialState: config.initialState
            }).then(wemoEmulator => {
                this.connection = wemoEmulator;
                this.status({
                    fill: 'yellow',
                    shape: 'dot',
                    text: 'Listen on ' + config.port + ' (' + (config.initialState ? 'on' : 'off') + ')'
                });
                debug('Listening on: ' + config.port);
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
            if (this.connection) {
                debug('Closing connection');
                this.connection.close();
                debug('Closed');
            }
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
