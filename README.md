# node-red-contrib-fake-wemo

Node red contribution to create fake Wemo devices. 

It's probably the simplest way to hook up your Echo device to Node Red, allowing you to give simple on/off commands to start your flows running.

It only works on versions of Node supporting es6 as of now. I may update it in future to be more widely compatible, or PRs welcome

### Installation

Change directory to your node red installation:

    $ npm install node-red-contrib-fake-wemo

### Configuration

Drag the node on to your workspace, configure it as below and then ask Alexa to discover devices.

| Config          | Description                                                                                                                                                                                                                                  
| --------------- | ------------    
| `Node Name`     | This is the name of the node as it appears in the Node-RED workspace                                                                     
| `Initial State` | The node maintains an internal state flag so that it can report to Alexa whether your node is currently on or off. When you redeploy, this state is lost. You can set the implicitly state implicitly or get it from another flow or global variable                                                                                                |
| `Friendly Name` | This is the name that you'll see in the list of devices discovered by Alexa, it's also the name that you'll use in voice commands to turn your node on or off
| `Bind`          | The interface and port to bind an internal http server to, that allows Alexa to send commands to your node                                                                                                                                        
| `On Topic`      | This is the topic sent when you ask Alexa to turn your thing on                                                                                                                                                          
| `On Payload`    | This is the payload sent when you ask Alexa to turn your thing on                                                                                                                                                        
| `Off Topic`     | This is the topic sent when you ask Alexa to turn your thing off                                                                                                                                                         
| `Off Payload`   | This is the payload sent when you ask Alexa to turn your thing off                                                                                                                                                       

### Troubleshooting

If Alexa can't discover the devices faked by this node, please check you don't have a firewall blocking the port you've selected above and also port 1900/udp

### Enabling extra debugging

Install `node-red-contrib-config` and drag a config node into your workspace. Configure the node to set a global variable called `fake-wemo`
with a JSON value of `{"debug": true}`. Also make sure that the config tickbox for `active` is unchecked. Redeploy. Now click the button on the config node.
This will trigger all instances of `fake-wemo` to write extra logging to the os syslog next time they're invoked.

### Credits

This contribution was inspired by, and in some areas uses code from the excellent [node-red-contrib-wemo-emulator](https://github.com/biddster/node-red-contrib-wemo-emulator#readme) by [@biddster](https://github.com/biddster) that worked so well for so long. 
Unfortunately of late, due to some changes Amazon made to the protocol, it no longer works as it should.

