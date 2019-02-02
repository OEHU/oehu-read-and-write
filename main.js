const P1Reader = require('p1-reader');
const BigchainUploader = require('veh-bigchaindb-uploader').default;
const BigchainOrm = require('bigchaindb-orm').default;
const BigchainDriver = require('bigchaindb-driver');
const bip39 = require('bip39');
const axios = require('axios');
let config = require('./config');

//fucking bug in bigchainDriver: https://github.com/bigchaindb/js-bigchaindb-driver/issues/268
const seed = bip39.mnemonicToSeed(config.bigchain.phrase).slice(0, 32);
const keypair = new BigchainDriver.Ed25519Keypair(seed);

const p1Reader = new P1Reader({debug: false, emulator: true});
const bigchainUploader = new BigchainUploader({network: config.bigchain.network, keypair: keypair});

let lastReading = 0;


p1Reader.on('reading', async function(data) {
    if (Date.now() - lastReading > 10000) { //every 10 seconds
        console.log('Reading and uploading');
        const reading = {
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
        let result = uploadToBigchain(reading);
        lastReading = Date.now();
    }
});

p1Reader.on('error', function(err) {
    console.log('Error while reading: ' + err);
});

async function uploadToBigchain(reading) {
    const orm = new BigchainOrm(config.bigchain.network, {
            app_id: '3b959424',
            app_key: '30c12a0e15343d705a7e7ccb6d75f1c0'
        });

    orm.define("devices", "https://schema.org/v1/myModel");

    try {
        const updatedAsset = await orm.models.devices.create({
            keypair: keypair,
            data: {
                "deviceType": "OEHU",
                "location": {
                    "type": "Point",
                    "coordinates": [
                        "1",
                        "1"
                    ]
                },
                "locationAccuracy": "1",
                "householdType": "Factory",
                "occupants": "2",
                ...reading
            },
        });
        console.log(updatedAsset);
    } catch (e) {
        console.log(e);
    }

    // const api = config.bigchain.network + '';
    // axios.get(api)
    // .then(function (response) {
    //     console.log(response);
    // })
    // .catch(function (error) {
    //     console.log(error);
    // });
}