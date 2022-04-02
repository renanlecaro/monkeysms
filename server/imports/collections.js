import { Mongo } from "meteor/mongo";

export function wipeCollections(google_user_id) {
  Devices.remove({ google_user_id });
  Messages.remove({ google_user_id });
  Contacts.remove({ google_user_id });
  ApiKeys.remove({ google_user_id });
  WebHookCalls.remove({ google_user_id });
  NotificationReceivers.remove({ google_user_id });
  DomainVerifications.remove({ google_user_id });
}

export const Devices = new Mongo.Collection("Devices");

export const Messages = new Mongo.Collection("Messages");

export const Contacts = new Mongo.Collection("Contacts");

export const ApiKeys = new Mongo.Collection("ApiKeys");

export const NotificationReceivers = new Mongo.Collection(
  "NotificationReceivers"
);

export const WebHookCalls =  new Mongo.Collection("WebHookCalls");

export const DomainVerifications =  new Mongo.Collection("DomainVerifications");