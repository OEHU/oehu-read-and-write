const P1Reader = require('p1-reader');
const BigchainOrm = require('bigchaindb-orm').default;
const OrmObject = require('bigchaindb-orm/dist/node/ormobject').default;
const Connection = require('bigchaindb-orm/dist/node/connection').default;
const BigchainDriver = require('bigchaindb-driver');
const bip39 = require('bip39');
const axios = require('axios');

class OehuReadAndWrite {

    constructor(opts) {
        this.network = opts.network;
        this.deviceId = opts.deviceId;
        this.phrase = opts.phrase;
        this.appId = opts.appId;
        this.appKey = opts.appKey;
        this.debug = opts.debug;
        this.emulator = opts.emulator;

        this.transactionsApi = 'https://api.oehu.org/transactions?deviceId=' + this.deviceId;

        //fucking bug in bigchainDriver: https://github.com/bigchaindb/js-bigchaindb-driver/issues/268
        this.seed = bip39.mnemonicToSeed(this.phrase).slice(0, 32);
        this.keypair = new BigchainDriver.Ed25519Keypair(this.seed);
        this.lastReading = 0;

        this.p1Reader = new P1Reader({debug: this.debug, emulator: this.emulator});
        this.p1Reader.on('reading', (data) => this.p1OnRead(data));
        this.p1Reader.on('error', (err) => this.p1OnError(err));
    }

    async p1OnRead(data) {
        if (Date.now() - this.lastReading > 10000) { //every 10 seconds
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
            let result = this.uploadToBigchain(reading);
            this.lastReading = Date.now();
        }
    }

    p1OnError(err) {
        console.log('Error while reading: ' + err);
    }

    async uploadToBigchain(reading) {

        let connection = new Connection(this.network, {
            app_id: this.appId,
            app_key: this.appKey
        });

        let transactions = await axios.get(this.transactionsApi)
        .then(function (response) {
            //missing: asset.data.id === deviceId
            //missing: tx.outputs[outputIndex];
            //We need an api endpoint which responds with raw transaction data (outputs, inputs, etc)
            return response.data;
        })
        .catch(function (error) {
            console.log(error);
        });

        console.log(transactions);

        let asset = new OrmObject(
            'devices',
            'https://schema.org/v1/myModel',
            connection,
            this.appId,
            [{asset: {data: {id: this.deviceId}}}] //missing: transactionHistory
        );
        console.log(asset);

        try {
            let appendedAsset = await asset.append({
                keypair: this.keypair, toPublicKey: this.keypair.publicKey, data: {
                    //...transactionHistory[0].data?
                    ...reading
                }
            });
            console.log(appendedAsset);
        } catch (e) {
            console.log(e);
        }
    }
}

let test = new OehuReadAndWrite({
    network: "http://188.166.15.225:9984/api/v1/",
    deviceId: "id:3b959424:devices:beda4fb7-c2f9-4cb3-a479-4c8038535c74",
    phrase: "penalty shine inner milk early answer ceiling twin spot blush width brick",
    appId: "3b959424",
    appKey: "30c12a0e15343d705a7e7ccb6d75f1c0",
    debug: true,
    emulator: true
});