// const P1Reader = require('p1-reader');
// const BigchainUploader = require('veh-bigchaindb-uploader');
let serialPort = require('serialport');

let serialPortUsed = false;
let autodiscoverList = [];
let timer = 0;

const parsePacket = require('./lib/parsePacket');
const config = require('./config.json');

function P1Reader(options) {
    if (typeof options !== 'object') {
        options = {};
    }

    serialPort.list()
    .then(ports => {
        // Create the auto discovery list with each of the possible serialport configurations per port found
        for (let i = 0; i < ports.length; i++) {
            for (let j = 0; j < config.serialPort.length; j++) {
                autodiscoverList.push({
                    port: ports[i].comName,
                    baudRate: config.serialPort[j].baudRate,
                    parity: config.serialPort[j].parity,
                    dataBits: config.serialPort[j].dataBits,
                    stopBits: config.serialPort[j].stopBits
                });
            }
        }

        console.log(autodiscoverList);
        _setupSerialConnection();
    })
    .catch(err => {
        console.error('Serialports could not be listed: ' + err);
    });
}

module.exports = P1Reader;

/**
 * Setup serial port connection
 */
function _setupSerialConnection() {
    const currentPortConfig = autodiscoverList[0];

    console.log('Trying to connect to Smart Meter via port: ' + currentPortConfig.port
        + ' (BaudRate: ' + currentPortConfig.baudRate + ', Parity: ' + currentPortConfig.parity + ', Databits: '
        + currentPortConfig.dataBits + 'Stopbits: ' + currentPortConfig.stopBits + ')');

    // Go to the next port if this one didn't respond within the timeout limit
    timer = setTimeout(() => {
        if (!serialPortUsed) {
            _tryNextSerialPort();
        }
    }, config.connectionSetupTimeout);

    // Open serial port connection
    const sp = new serialPort(currentPortConfig.port, {
        baudRate: currentPortConfig.baudRate,
        parity: currentPortConfig.parity,
        dataBits: currentPortConfig.dataBits,
        stopBits: currentPortConfig.stopBits
    });

    let received = '';

    sp.on('open', () => {
        debug.log('Serial connection established');

        sp.on('data', (data) => {
            received += data.toString();
            console.log(received);

            const startCharPos = received.indexOf(config.startCharacter);
            const endCharPos = received.indexOf(config.stopCharacter);

            // Package is complete if the start- and stop character are received
            if (startCharPos >= 0 && endCharPos >= 0) {
                const packet = received.substr(startCharPos, endCharPos - startCharPos);
                const parsedPacket = parsePacket(packet);

                received = '';

                // Verify if connected to the correct serial port at initialization
                if (!serialPortUsed) {
                    if (parsedPacket.timestamp !== null) {
                        console.log('Connection with Smart Meter established');
                        serialPortUsed = currentPortConfig.port;
                        } else {
                        _tryNextSerialPort();
                    }
                }

                console.log(parsedPacket);

                if (parsedPacket.timestamp !== null) {
                    console.log(parsedPacket);
                } else {
                    console.log('Something is wrong with the packet')
                }
            }
        });
    });

    sp.on('error', (error) => {
        // Reject this port if we haven't found the correct port yet
        if (!serialPortUsed) {
            _tryNextSerialPort();
        } else {
            // Only emit errors after we have established a connection with the Smart Meter
            debug.log('Error emitted: ' + error);

            constructor.emit('error', error);
        }
    });

    sp.on('close', () => {
        constructor.emit('close');
    });
}

/**
 * Try the next serial port if available
 */
function _tryNextSerialPort() {
    clearTimeout(timer);
    autodiscoverList.shift();

    if (autodiscoverList.length > 0) {
        console.log('Smart Meter not found yet, trying another port / configuration...');
        _setupSerialConnection();
    } else {
        console.error('Could not find a Smart Meter');
    }
}

// let config = {};
// let lastReading = 0;

// config.debug = true;
// config.emulator = true;

// config.emulatorOverrides = {
//     electricityOffset: 100,
//     electricityIncrement: 0.500,
//     gasOffset: 50,
//     gasIncrement: 0.100,
//     interval: 1,
//     intervalGas: 3 // Must be larger than 'interval'
// };

// const bigchainKeypair = await ;
// const bigchainNetwork = 'http://188.166.15.225:9984/api/v1/';
//
// let p1Reader = new P1Reader(config);
// // let bigchainUploader = new BigchainUploader({keyPair: bigchainKeypair, network: bigchainNetwork});
//
// p1Reader.on('connected', portConfig => {
//     console.log('Connection with the Smart Meter has been established on port: ' + portConfig.port
//         + ' (BaudRate: ' + portConfig.baudRate + ', Parity: ' + portConfig.parity + ', Databits: '
//         + portConfig.dataBits + 'Stopbits: ' + portConfig.stopBits + ')');
// });
//
// p1Reader.on('reading', data => {
//     const time = new Date().getTime();
//     if (time > lastReading + (30 * 1000)) {
//         console.log('Reading from smart meter');
//
//         let reading = {
//             lastUpdate: Date.now(),
//             electricityReceived: {
//                 total: data.electricity.received.tariff1.reading + data.electricity.received.tariff2.reading,
//                 tariff1: data.electricity.received.tariff1.reading,
//                 tariff2: data.electricity.received.tariff2.reading
//             },
//             electricityDelivered: {
//                 total: data.electricity.delivered.tariff1.reading + data.electricity.delivered.tariff2.reading,
//                 tariff1: data.electricity.delivered.tariff1.reading,
//                 tariff2: data.electricity.delivered.tariff2.reading
//             },
//             gasReceived: data.gas.reading
//         };
//
//         console.log(reading);
//         uploadReadingToBigchain(reading);
//         lastReading = time;
//     }
// });
//
// p1Reader.on('error', error => {
//     console.log(error);
// });
//
// p1Reader.on('close', () => {
//     console.log('Connection closed');
// });
//
// process.on('uncaughtException', error => {
//     console.error(error);
// });
//
// function uploadReadingToBigchain(reading) {
//
// }