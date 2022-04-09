import { Contacts, Devices, Messages } from "/imports/collections";

Devices.rawCollection().createIndex({ google_user_id: 1, last_updated: -1 });
Devices.rawCollection().createIndex({ androidId: 1 });

Messages.rawCollection().createIndex({ google_user_id: 1, last_updated: -1 });
Messages.rawCollection().createIndex({ deviceId: -1 });
Messages.rawCollection().createIndex({ createdAt: -1 });
Messages.rawCollection().createIndex({ deviceId: 1, last_updated: -1 });
Messages.rawCollection().createIndex({
  google_user_id: 1,
  to: 1,
  createdAt: -1,
});

Contacts.rawCollection().createIndex({ google_user_id: 1, last_updated: -1 });
Contacts.rawCollection().createIndex(
  { google_user_id: 1, number: 1 },
  { unique: true }
);
