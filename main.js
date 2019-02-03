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

        this.transactionsApi = 'https://api.oehu.org/transactions?raw=true&deviceId=' + this.deviceId;

        // bug in bigchainDriver: https://github.com/bigchaindb/js-bigchaindb-driver/issues/268. Needs to be looked
        // at later. ATM make a change to a node-modules file. See link above.
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

        //Create connection
        let connection = new Connection(this.network, {
            app_id: this.appId,
            app_key: this.appKey
        });

        //Get 'CREATE' transaction
        let assetCreateTransaction;
        try {
            assetCreateTransaction = await connection.listTransactions("f4afc17b6a9ff1ad12c52b5ca8737f4f06094e3b34ad4dee7e4f7f0ae6fa4b54", 'CREATE');
        } catch (e) {
            console.log(e);
        }

        //Get latest transaction of asset
        let tx = await axios.get(this.transactionsApi)
        .then(function (response) {
            return response.data[0];
        })
        .catch(function (error) {
            console.log(error);
        });

        //Create transfer transaction, sign and send to Bigchain
        this.createTransferTransaction(connection, assetCreateTransaction[0].metadata, reading);
    }
    async createTransferTransaction(connection, oldMetadata, reading) {
        let newAssetTransaction;
        try {
            newAssetTransaction = await connection.transferTransaction(
                tx,
                this.keypair.publicKey,
                this.keypair.privateKey,
                this.keypair.publicKey,
                {
                    ...oldMetadata,
                    ...reading
                }
            );
            console.log(newAssetTransaction);
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