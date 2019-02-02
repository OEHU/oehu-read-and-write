
const P1Reader = require('p1-reader');
const BigchainUploader = require('veh-bigchaindb-uploader');

let config = {};
let lastReading = 0;

config.debug = true;
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
const bigchainNetwork = 'http://188.166.15.225:9984/api/v1/';

let p1Reader = new P1Reader(config);
// let bigchainUploader = new BigchainUploader({keyPair: bigchainKeypair, network: bigchainNetwork});

p1Reader.on('connected', portConfig => {
    console.log('Connection with the Smart Meter has been established on port: ' + portConfig.port
        + ' (BaudRate: ' + portConfig.baudRate + ', Parity: ' + portConfig.parity + ', Databits: '
        + portConfig.dataBits + 'Stopbits: ' + portConfig.stopBits + ')');
});

p1Reader.on('reading', data => {
    const time = new Date().getTime();
    if (time > lastReading + (30 * 1000)) {
        console.log('Reading from smart meter');

        let reading = {
            lastUpdate: Date.now(),
            electricityReceived: {
                total: data.electricity.received.tariff1.reading + data.electricity.received.tariff2.reading,
                tariff1: data.electricity.received.tariff1.reading,
                tariff2: data.electricity.received.tariff2.reading
            },
            electricityDelivered: {
                total: data.electricity.delivered.tariff1.reading + data.electricity.delivered.tariff2.reading,
                tariff1: data.electricity.delivered.tariff1.reading,
                tariff2: data.electricity.delivered.tariff2.reading
            },
            gasReceived: data.gas.reading
        };

        console.log(reading);
        uploadReadingToBigchain(reading);
        lastReading = time;
    }
});

p1Reader.on('error', error => {
    console.log(error);
});

p1Reader.on('close', () => {
    console.log('Connection closed');
});

process.on('uncaughtException', error => {
    console.error(error);
});

function uploadReadingToBigchain (reading) {

}