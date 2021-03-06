/*
 * Copyright PwC All Rights Reserved.
 *
 * Devloped by : Sourav Singh
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class TrackTrace extends Contract {

    async initLedger(ctx) {
        console.info('=========== Instantiated Marbles Chaincode ===========');
        let indexName = 'owner~id';
        let assetKey = await ctx.stub.createCompositeKey(indexName, ['id1']);

        let assetDetails = {};
        assetDetails.ownershipChange = null;
        assetDetails.owner = "singhsourav73@gmail.com";
        assetDetails.detail =  {
            a: "b",
            b: "c",
            d: {
                e: {
                    f: "g"
                },
                i : "j"
            }
        };
        await ctx.stub.putState(assetKey, Buffer.from(JSON.stringify(assetDetails)));

        assetKey = await ctx.stub.createCompositeKey(indexName, ['id2']);

        assetDetails.ownershipChange = null;
        assetDetails.owner = "singhsourav73@gmail.com";
        assetDetails.detail =  {
            a: "j",
            b: "k",
            l: {
                e: {
                    f: "g"
                },
                i : "m"
            }
        };
        await ctx.stub.putState(assetKey, Buffer.from(JSON.stringify(assetDetails)));
        console.info('============= END : Create Asset ===========');
    }

    async getAssetById(ctx, id) {
        console.info('============= START : Query to get asset by Id ===========');
        let indexName = 'owner~id';
        let assetKey = await ctx.stub.createCompositeKey(indexName, [id]);

        const assetAsBytes = await ctx.stub.getState(assetKey);
        if (!assetAsBytes || assetAsBytes.length === 0) {
            throw new Error(`Asset does not exist`);
        }
        console.log(assetAsBytes.toString());
        return assetAsBytes.toString();
    }

    async createAsset(ctx, owner, id, detail) {
        console.info('============= START : Create Asset ===========');
        let indexName = 'owner~id';
        let assetKey = await ctx.stub.createCompositeKey(indexName, [id]);

        let assetDetails = {};
        assetDetails.detail = detail;
        assetDetails.ownershipChange = null;
        assetDetails.owner = owner;

        await ctx.stub.putState(assetKey, Buffer.from(JSON.stringify(assetDetails)));
        console.info('============= END : Create Asset ===========');

        return JSON.stringify({txId : ctx.stub.getTxID(), id : id });
    }

    async getAssetByOwner(ctx, owner) {
        let queryString = {};
        queryString.selector = {};
        queryString.selector.owner = owner;
        
        let resultsIterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));

        let allResults = [];
        while (true) {
            let res = await resultsIterator.next();

            if (res.value && res.value.value.toString()) {
                let jsonRes = {};
                console.log(res.value.value.toString('utf8'));

                jsonRes.Key = res.value.key;
                try {
                    jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
                } catch (err) {
                    console.log(err);
                    jsonRes.Record = res.value.value.toString('utf8');
                }
                allResults.push(jsonRes);
            }
            if (res.done) {
                console.log('end of data');
                await resultsIterator.close();
                console.info(allResults);
                return allResults;
            }
        }
    }

    async transferAsset(ctx, fromOwner, toOwner, id, option) {
        let indexName = 'owner~id';
        let assetKey = await ctx.stub.createCompositeKey(indexName, [id]);

        const assetAsBytes = await ctx.stub.getState(assetKey);
        if (!assetAsBytes || assetAsBytes.length === 0) {
            throw new Error(`Asset does not exist`);
        }

        let assetDetails = JSON.parse(assetAsBytes.toString());

        assetDetails.owner = toOwner;

        let aclList = [];
        try {
            aclList = JSON.parse(option);
        } catch (err) {
            console.log(err);
            aclList = option;
        }
        /* Implementation ACL Condition
            AAR - Allow Auto Recieve
            AS - Auto Send
            AD - Auto Delay
            AAD - Allow Auto Dispute
        */
        if (!aclList.includes("AAR")) {
            assetDetails.ownershipChange = {
                status : "WaitingForApproval",
                previousOwner: fromOwner
            }
        }        
        // Require to implement AD and AAD

        await ctx.stub.putState(assetKey, Buffer.from(JSON.stringify(assetDetails)));
        return JSON.stringify({assetDetails, txId : ctx.stub.getTxID()});
    }

    async acceptAsset(ctx, id, state) {
        let indexName = 'owner~id';
        let assetKey = await ctx.stub.createCompositeKey(indexName, [id]);

        const assetAsBytes = await ctx.stub.getState(assetKey);
        if (!assetAsBytes || assetAsBytes.length === 0) {
            throw new Error(`Asset does not exist`);
        }

        let assetDetails = JSON.parse(assetAsBytes.toString());

        if (state === true || state === "true") {
            assetDetails.ownershipChange = null;
        } else {
            assetDetails.ownershipChange.status = "Rejected";
            assetDetails.ownershipChange.rejectedBy = assetDetails.owner;
            assetDetails.owner = assetDetails.ownershipChange.previousOwner;
            assetDetails.ownershipChange.previousOwner = null;
        }

        await ctx.stub.putState(assetKey, Buffer.from(JSON.stringify(assetDetails)));
        return JSON.stringify({assetDetails, txId : ctx.stub.getTxID()});
    }

    async getHistoryForAsset(ctx, id) {
        let indexName = 'owner~id';
        let assetKey = await ctx.stub.createCompositeKey(indexName, [id]);
    
        const resultsIterator = ctx.stub.getHistoryForKey(assetKey);
        
        const result = [];
        for await (const keyMod of resultsIterator) {
            const resp = {
                timestamp : keyMod.timestamp,
                txid: keyMod.tx_id
            }
            if (keyMod.is_delete) {
                resp.data = 'KEY DELETED';
            } else {
                resp.data = keyMod.value.toString('utf8');
            }
            result.push(resp);
        }
    }

    async getAllResults(iterator, isHistory) {
        let allResults = [];
        while (true) {
          let res = await iterator.next();
    
          if (res.value && res.value.value.toString()) {
            let jsonRes = {};
            console.log(res.value.value.toString('utf8'));
    
            if (isHistory && isHistory === true) {
              jsonRes.TxId = res.value.tx_id;
              jsonRes.Timestamp = res.value.timestamp;
              jsonRes.IsDelete = res.value.is_delete.toString();
              try {
                jsonRes.Value = JSON.parse(res.value.value.toString('utf8'));
              } catch (err) {
                console.log(err);
                jsonRes.Value = res.value.value.toString('utf8');
              }
            } else {
              jsonRes.Key = res.value.key;
              try {
                jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
              } catch (err) {
                console.log(err);
                jsonRes.Record = res.value.value.toString('utf8');
              }
            }
            allResults.push(jsonRes);
          }
          if (res.done) {
            console.log('end of data');
            await iterator.close();
            console.info(allResults);
            return allResults;
          }
        }
      }
}

module.exports = TrackTrace;