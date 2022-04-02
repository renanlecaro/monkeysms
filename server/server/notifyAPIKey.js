import {fetch} from "meteor/fetch";
import {Meteor} from "meteor/meteor";
import {WebHookCalls} from "/imports/collections";

export async function notifyAPIKey({webhook_callback_url, google_user_id, domain}, event, data) {
    const doc = {
        domain,
        google_user_id,
        webhook_callback_url,
        event,
        data,
        created_at: Date.now(),
        failures: 0,
        status: "pending"
    }
    doc._id = WebHookCalls.insert(doc)
    await runWebHookCall(doc)
}

async function runWebHookCall({_id, webhook_callback_url, event, data, failures}) {
    try {
        WebHookCalls.update({_id}, {$set: {status: "running", last_run_at: Date.now()}, $unset: {retry_at: ""}})

        await fetch(webhook_callback_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                event,
                ...data,
            }),
        }).then((res) =>
            (res.ok) ? 'ok' : res.text().then(err => {
                throw new Meteor.Error(res.status + ' : ' + err)
            })
        );
        WebHookCalls.update({_id}, {$set: {status: "done"}})
        console.log("Webhook call done : ", event, data)
    } catch (e)  {

        // Exponential backoff, 6 attempts, starting by waiting 16 seconds all the way to 72 hours
        console.log(e)
        if (failures >= 7) {
            WebHookCalls.update({_id}, {$set: {status: "failed"}})
            console.log("Gave up on webhook call  : ", event, data)
        } else {

            WebHookCalls.update({_id}, {
                $set: {
                    retry_at: Date.now() + Math.pow(4, 2+failures) * 1000,
                    last_event: e.message,
                    status: "pending"
                }, $inc: {
                    failures: 1
                }
            })

            console.log("Will retry webhook calls: ", event, data)
        }
    }
}

Meteor.startup(function () {
    WebHookCalls._ensureIndex({status: 1, retry_at: 1})
    WebHookCalls._ensureIndex({created_at: 1})
    Meteor.setInterval(() => {
        WebHookCalls.find({status: "pending", retry_at: {$gt: Date.now()}}, {limit:100, sort:{retry_at:1}}).map(runWebHookCall)
    }, 2000)

    Meteor.setInterval(() => {
        // Erase all webhook calls that are older than 30 days , check every hour
        WebHookCalls.remove({created_at: {$lt: Date.now() -  30 * 24 * 60 * 60 * 1000}})
    }, 60 * 60 * 1000)

})