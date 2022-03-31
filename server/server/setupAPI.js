import {Meteor} from "meteor/meteor";
import {OAuth2Client} from "google-auth-library";
import {ApiKeys, Contacts, Devices, Messages} from "../imports/collections";
import bodyParser from "body-parser";
import {
    createMessage,
    deviceToWriteTo,
    notifyAllUserDevicesExcept, notifyAPIKey,
    phoneUtil,
    PNF, randomToken,
} from "./methods";
import {notifyUser} from "./WebNotifications";
import {Random} from "meteor/random";

const app_visible_messages_fields = {
    // Used as device key for now
    deviceId: false, // https://trello.com/c/YQ7ZPfoh/128-add-a-device-secret-field-to-make-the-device-id-public
    google_user_id: false,
    // Needs to be included to check where the message is from in message updates
    // source: true,
};

export function setupAPI(app) {
    app.use("/api", function (req, res, next) {
        console.log(req.headers["x-app-version"]);
        next();
    });

    app.use("/api/", bodyParser.json());

    app.use("/api/v1/", async (req, res, next) => {
        const couldContainKey = {...req.query, ...req.headers};

        const keyHeaderName = Object.keys(couldContainKey).filter((k) =>
            k.match(/key/gi)
        );
        if (!keyHeaderName) {
            return res
                .status(400)
                .json({error: "Please provide an API key in the x-api-key header."});
        }
        const apiKey = couldContainKey[keyHeaderName]?.trim();
        if (!apiKey) {
            return res.status(400).json({error: "The key is empty"});
        }
        const rights = ApiKeys.findOne({key: apiKey});
        if (!rights) {
            return res.status(400).json({error: "Non existing key"});
        }
        if (!rights.active) {
            return res.status(400).json({error: "Key has be revoked by user"});
        }
        req.rights = rights;
        req.source = {type: "key", id: rights._id};

        next();
    });

    app.get("/api/v1/messages/:id", async (req, res) => {
        const {rights, source} = req;
        const message = Messages.findOne(
            {source, _id: req.params.id},
            {fields: app_visible_messages_fields}
        );
        if (!message) {
            return res
                .status(404)
                .json({error: "no message matching this _id sent using this key"});
        }
        return res.status(200).json(message);
    });

    app.get("/api/v1/messages", async (req, res) => {
        const {rights, source} = req;
        const messages = Messages.find(
            {source},
            {
                fields: app_visible_messages_fields,
                limit: 100,
                sort: {createdAt: -1},
            }
        ).fetch();

        return res.status(200).json(messages);
    });
    app.post("/api/v1/messages", async (req, res) => {
        try {
            console.log("POST /api/v1/messages", req.body)
            const {rights, source} = req;

            if (!req.body) {
                return res
                    .status(400)
                    .json({error: "We could not parse the request body"});
            }
            let {to, text} = req.body || {};

            const user = Meteor.users.findOne({
                "services.google.id": rights.google_user_id,
            });

            const messageId = await createMessage({
                user,
                rawTo: to,
                text,
                source,
                seen: false,
            });


            console.log({messageId})
            ApiKeys.update(rights._id, {
                $set: {
                    lastUsed: new Date(),
                },
                $inc: {
                    uses: 1,
                },
            });

            const created= Messages.findOne(messageId, {fields: app_visible_messages_fields})

            await notifyAPIKey(req.rights, "message_created", {message: created});

            res
                .status(200)
                .json(
                   created
                );
        } catch (e) {
            res.status(500).json({
                error:  e.message || e.toString(),
            });
        }
    });
    const clientId =
        Meteor.settings.packages["service-configuration"].google.client_id;
    const client = new OAuth2Client(clientId);

    app.post("/api/app/register", async (req, res) => {
        try {
            console.log("/api/app/register", req.body);
            let {FCMToken, googleLoginToken, deviceName, androidId, userNumbers} =
                req.body;

            const ticket = await client.verifyIdToken({
                idToken: googleLoginToken,
                audience: clientId,
            });
            const payload = ticket.getPayload();
            const google_user_id = payload["sub"];

            const staleDevices = Devices.find({androidId});
            Devices.remove({_id: {$in: staleDevices.map((d) => d._id)}});
            Messages.remove({deviceId: {$in: staleDevices.map((d) => d._id)}});
            const deviceSecret= await randomToken()

            const deviceId = Devices.insert({
                deviceSecret,
                FCMToken,
                google_user_id,
                deviceName,
                first_connection: Date.now(),
                last_connection: Date.now(),
                androidId,
                lastSync: 0,
                ...parseUserNumbers(userNumbers),
            });

            console.log("Registered new device", Devices.findOne(deviceId));
            res.status(200).json({deviceId,deviceSecret});
        } catch (e) {
            console.error(e);
            res.status(500).json({error: e.message});
        }
    });

    app.post("/api/app/update_fcm", async (req, res) => {
        try {
            let {FCMToken, deviceId,deviceSecret} = req.body;

            Devices.update(
                {_id: deviceId, deviceSecret},
                {
                    $set: {
                        FCMToken,
                        last_connection: Date.now(),
                    },
                }
            );

            res.status(200).json("OK");
        } catch (e) {
            console.error(e);
            res.status(500).json({error: e.message});
        }
    });

    app.post("/api/app/synchronize", async (req, res) => {
        try {
            console.info("synchronize request : ", req.body);

            const now = Date.now();
            let {deviceId, messages, contacts, userNumbers,deviceSecret} = req.body;

            const device = Devices.findOne({_id: deviceId,deviceSecret});
            if (!device) {
                console.warn("Cound not find device " + deviceId);

                res.status(401).json({
                    error: "Device not found",
                    errorCode: "NO_DEVICE",
                });

                return;
            }

            const {google_user_id, lastSync} = device;
            const user = Meteor.users.findOne({
                "services.google.id": google_user_id,
            });

            Devices.update(
                {_id: deviceId},
                {
                    $set: {
                        last_connection: now,
                        lastSync: now,
                        ...parseUserNumbers(userNumbers),
                    },
                }
            );

            contacts.forEach((c) => {
                Contacts.update(
                    {google_user_id, number: c.number},
                    {
                        $set: {
                            name: c.name,
                            last_updated: Date.now(),
                        },
                        $setOnInsert: {
                            source: {type: "device", id: device._id},
                            createdAt: now,
                        },
                    },
                    {upsert: true}
                );
            });

            await Promise.all(
                messages.map(async (msg) => {
                    try{

                    if (msg.deviceId === "tbd") {
                        // device that cannot send the message had a request to send it, using
                        // any other device
                        try {
                            const {device, from} = deviceToWriteTo(user, msg.to);
                            msg.from = from;
                            msg.deviceId = device._id;
                        } catch (e) {
                            // TODO add status info
                            msg.status = "ERROR";
                        }
                    }

                    const {
                        _id,
                        from,
                        to,
                        outbound,
                        text,
                        status,
                        deviceId,
                        createdAt,
                        seen,
                    } = msg;
                    const {nModified} = (await Messages.rawCollection().update(
                        {deviceId, _id, google_user_id},
                        {
                            $set: {
                                from,
                                to,
                                outbound,
                                text,
                                status,
                                deviceId,
                                last_updated: now,
                                createdAt,
                                seen,
                            },
                            $setOnInsert: {
                                source: {type: "device", id: device._id},
                            },
                        },
                        {upsert: true}
                    )).result
                    console.log({
                      nModified
                    })
                    if (nModified && msg.outbound) {
                        // API source notifications
                        const updated = Messages.findOne({_id, google_user_id}, {fields: app_visible_messages_fields});
                        if (updated.source.type === "key") {
                            try {
                                const key=ApiKeys.findOne({_id:updated.source.id})
                                await notifyAPIKey(key, "message_updated", {message: updated});
                            } catch (e) {
                                console.error("notifyAPIKey error",e)
                            }
                        }
                    }
                    if (!msg.outbound) {
                        // Web notifications
                        const result = await notifyUser(google_user_id, {
                            title: "SMS from " + msg.from,
                            body: msg.text,
                            tag: "msg-from-" + msg.from,
                        });
                        console.info("Sending notification for ", msg, result);
                    }
                    }catch (e){
                        console.error("Sync error : ",e)
                    }
                })
            );

            if (messages.length) {
                await notifyAllUserDevicesExcept(google_user_id, device._id);
            }
            const updated = Messages.find({
                // deviceId,
                last_updated: {$gt: lastSync},
                _id: {$nin: messages.map((msg) => msg._id)},
            }).fetch();

            const responseJson = {
                changed: updated,
            };
            console.log("responseJson: ", responseJson);
            res.status(200).json(responseJson);
        } catch (e) {
            console.error(e);
            res.status(500).json({error: e.message});
        }
    });
}

function parseUserNumbers(userNumbers) {
    const parsed = userNumbers
        .filter((a, b, c) => c.indexOf(a) == b)
        .map((n) => phoneUtil.parse(n))
        .filter((n) => phoneUtil.isValidNumber(n));
    return {
        userNumbers: parsed.map((n) => phoneUtil.format(n, PNF.E164)),
        countryCodes: parsed
            .map((n) => n.getCountryCode())
            .filter((a, b, c) => c.indexOf(a) == b),
        regionCodes: parsed
            .map((n) => phoneUtil.getRegionCodeForNumber(n))
            .filter((a, b, c) => c.indexOf(a) == b),
    };
}
