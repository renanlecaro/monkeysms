import { Mongo } from "meteor/mongo";

export function wipeCollections(google_user_id) {
  Devices.remove({ google_user_id });
  Messages.remove({ google_user_id });
  Contacts.remove({ google_user_id });
  ApiKeys.update(
    { google_user_id },
    { $set: { active: false } },
    { multi: true }
  );
  NotificationReceivers.remove({ google_user_id });
}

/*
  FCMToken  : token for notification
  google_user_id : user id, string
  deviceName : "Mi A1",
  last_connection:new Date(),
  androidId : zefiozejfoze
*/
export const Devices = new Mongo.Collection("Devices");

/*
"_id" : "xgdy4ZKGRSfh2tNoZ",
"deviceId" : "icTCXZZKpycw4XboW",
"google_user_id" : "100181150342250387898",
"to" : "+33628350114",
"text" : "Hello from MonkeySMS",
"outbound" : true,
"status" : "PENDING",
"createdAt" : 1643161355952,
"last_updated" : 1643161355952

*/
export const Messages = new Mongo.Collection("Messages");

/*
_id:String,
google_user_idString,
number:String,
name:String,
last_updated:Int,
*/
export const Contacts = new Mongo.Collection("Contacts");

/*
  key,
  google_user_id:
  domain ?
  createdAt:Date.now(),
  uses:0,
  lastUsed:null,
  active:true,
  webhook_callback_url
*/
export const ApiKeys = new Mongo.Collection("ApiKeys");

/*
  google_user_id,
  content,
  endpoint,
*/
export const NotificationReceivers = new Mongo.Collection(
  "NotificationReceivers"
);
