const { UPnpBroadcastResponder, MeWoDevice } = require('mewo');
const { EventEmitter } = require('events');
const dgram = require('dgram');
const compile = require('handlebars').compile;
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(__dirname, '../templates');
const GET_BINARY_STATE = /<u:GetBinaryState xmlns:u="urn:Belkin:service:basicevent:1"><BinaryState>([\d])<\/BinaryState>/;
const SET_BINARY_STATE = /<u:SetBinaryState xmlns:u="urn:Belkin:service:basicevent:1"><BinaryState>([\d])<\/BinaryState>/;

class Responder extends UPnpBroadcastResponder {
    init({ port, multicastAddress, ipAddress } = {}) {
        return new Promise(resolve => {
            this.address = ipAddress;
            const socket = dgram.createSocket({
                type: 'udp4',
                reuseAddr: true
            });
            socket.on('message', this.messageHandler.bind(this));
            socket.bind(port, () => {
                socket.addMembership(multicastAddress);
                this.socket = socket;
                resolve();
            });
        });
    }

    registerDevice(device, httpPort) {
        device.initServer(this.address, httpPort).then(() => {
            this.devices.push(device);
        });
    }

    close() {
        this.socket.close();
    }
}

class WemoEmulator extends MeWoDevice {
    constructor(name, responder, logger, initialState = false) {
        super(name, responder);
        this.log = logger;
        this.state = initialState;
        this.eventEmitter = new EventEmitter();
        this.emit('listening');
    }

    /**
     * Handles a non-discover request
     */
    handleRequest(body, res) {
        const setStateMatch = body.match(SET_BINARY_STATE);
        const getStateMatch = body.match(GET_BINARY_STATE);
        if (setStateMatch) {
            this.emit(setStateMatch[1] === '1' ? 'on' : 'off', this);
            res.end();
        } else if (getStateMatch) {
            this.stateResponse(res, this.state);
        } else {
            this.error('Unknown wemo request');
            res.statusCode = 404;
            res.end();
        }
    }

    close() {
        this.responder.close();
        this.server.close();
        this.emit('closed');
        this.eventEmitter.removeAllListeners();
    }

    emit(event, ...args) {
        this.eventEmitter.emit(event, args);
    }

    on(eventName, listener) {
        this.eventEmitter.on(eventName, listener);
        return this;
    }

    /**
     * Sends the response for GetBinaryState
     */
    stateResponse(res, state) {
        this.log('Responding with state information');
        res.writeHead(200, {
            'Content-Type': 'xml',
            Server: this.responder.getVersion(),
            'X-User-Agent': 'redsonic',
            Connection: 'close'
        });
        this.renderTemplate('get-binary-state.hbs', { state: state ? '1' : '0' })
            .then(data => {
                res.write(data);
                res.end();
            })
            .catch(err => {
                this.error('There was an error rendering the state template', err);
            });
    }

    renderTemplate(templateName, data) {
        return new Promise((resolve, reject) => {
            // Check for the template in the global cache
            if (!this.stateTemplate) {
                // Doesn't exist. Read the file, compile it, cache it, execute it
                const filePath = path.resolve(TEMPLATE_PATH, templateName);
                fs.readFile(filePath, (err, tpl) => {
                    if (err) {
                        reject(err);
                    } else {
                        try {
                            this.stateTemplate = compile(tpl.toString());
                            resolve(this.stateTemplate(data));
                        } catch (exc) {
                            reject(exc);
                        }
                    }
                });
            } else {
                resolve(this.stateTemplate(data));
            }
        });
    }
}

module.exports = {
    build: (name, logger, options) => {
        const responder = new Responder();
        return responder
            .init({
                port: 1900,
                multicastAddress: '239.255.255.250',
                ipAddress: options.ipAddress
            })
            .then(() => {
                // Create the new device with a name that will show up in the Alexa app
                const emulator = new WemoEmulator(name, responder, logger, options.initialState);
                responder.registerDevice(emulator, options.httpPort);
                return emulator;
            });
    }
};
