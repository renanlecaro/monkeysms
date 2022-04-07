import { Mongo } from "meteor/mongo";
import { Meteor } from "meteor/meteor";
import type webPush from "web-push";

export function wipeCollections(google_user_id) {
  Devices.remove({ google_user_id });
  Messages.remove({ google_user_id });
  Contacts.remove({ google_user_id });
  ApiKeys.remove({ google_user_id });
  WebHookCalls.remove({ google_user_id });
  NotificationReceivers.remove({ google_user_id });
  DomainVerifications.remove({ google_user_id });
}

type DeviceId = string;
type ContactId = string;
type ApiKeyId = string;
// Numbers should always be in an explicit international format
type InternationalNumber = string;
type PhoneNumberPrefix = number;
type PhoneNumberRegionCode = string;
type MessageId = string;
type GoogleUserId = string;
type TimeStamp = number;
type ContactName = string;
type Url = string;
type WebHookDomain = string;
type NotificationReceiverId = string;

//Each item represents the rights to notify a user about incoming messages, via web notifications
export interface NotificationReceiver {
  _id?: NotificationReceiverId;
  google_user_id: GoogleUserId;
  endpoint: Url;
  userDeviceDescription: string;
  content: webPush.PushSubscription;
}

// Represents a grant to an external app to send messages in the name of a user. The app is then notified of changes to those
// messages by webhook calls
export interface ApiKey {
  _id?: ApiKeyId;
  // The actual secret
  key: string;
  // user id of the account giving the rights
  google_user_id: GoogleUserId;
  createdAt: TimeStamp;
  lastUsed: TimeStamp;
  // number of calls to the api with this key,
  uses: Number;

  // false if the key has been deleted, in which case it can't be user
  active: boolean;

  webhook_callback_url: Url;
  domain: WebHookDomain;
}

//  Represents a (phone number - name) pair. Imported from the user's phone, and used in the UI
export interface Contact {
  _id?: ContactId;
  // this is the google user id of the person that has this contact in their adress book, not the google id of the contact
  google_user_id: GoogleUserId;
  // Should be an international number
  number: InternationalNumber;
  createdAt: TimeStamp;
  last_updated: TimeStamp;
  name: ContactName;
  // Which device created this contact
  source: Source;
}

// Represents a physical android phone or tablet, with the android app installed.
export interface Device {
  // Unique id, generated by the backend
  _id?: DeviceId;
  // Random chain of character that verifies the device
  deviceSecret: string;
  // Firebase cloud messaging token, to notify the phone when something's new
  FCMToken: string;
  // Google id of the user who logged in on this phone
  google_user_id: GoogleUserId;
  // Automatically provided by the phone, used in the UI
  deviceName: string; // Provided by the android system, used to avoid listing the same phone
  // multiple times
  androidId: string;
  first_connection: TimeStamp;
  last_connection: TimeStamp;
  lastSync: TimeStamp;
  // Phone numbers of the different SIM cards of the phone
  userNumbers: InternationalNumber[];
  // phone prefixes corresponding to the userNumbers
  countryCodes: PhoneNumberPrefix[];

  // region codes corresponding to the userNumbers
  regionCodes: PhoneNumberRegionCode[];
}
export interface Source {
  // Type of source that created the object
  type: // created by the web app
  | "dashboard"
    // created by the android app
    | "device"
    // created by a connected app
    | "key";
  id: null | DeviceId | ApiKeyId;
}

// An SMS message that was either received or sent by one of the devices
export interface Message {
  _id?: MessageId;
  status:
    | "PENDING"
    | "ON_DEVICE"
    | "SENDING"
    | "RECEIVED"
    | "SENT"
    | "CANCELLED"
    | "ERROR";
  // Device that's responsible for *sending* this message, can be "tbd" in cases where
  // the sender doesn't know where to send it from. Source of the message for incoming messages
  from: InternationalNumber | "tbd";
  to: InternationalNumber;
  text: string;
  deviceId: DeviceId | "tbd";
  outbound: boolean;
  // not used yet, means that the user saw this message already
  seen: boolean;
  // Who asked for this message to be sent
  source: Source;
  google_user_id: GoogleUserId;
  createdAt: TimeStamp;
  last_updated: TimeStamp;
}

export const Devices = new Mongo.Collection<Device>("Devices");
export const Messages = new Mongo.Collection<Message>("Messages");
export const Contacts = new Mongo.Collection<Contact>("Contacts");
export const ApiKeys = new Mongo.Collection<ApiKey>("ApiKeys");
export const NotificationReceivers = new Mongo.Collection<NotificationReceiver>(
  "NotificationReceivers"
);

type WebHookEvent = string;

export interface WebHookCall {
  _id?: string;
  api_key_id: ApiKeyId;
  domain: WebHookDomain;
  google_user_id: GoogleUserId;
  webhook_callback_url: Url;
  event: WebHookEvent;
  data: any;
  created_at: TimeStamp;
  failures: number;
  status: "pending" | "running" | "done" | "failed";
}
export const WebHookCalls = new Mongo.Collection<WebHookCall>("WebHookCalls");

type DomainVerificationId = string;

export interface DomainVerification {
  verified?: boolean;
  error?: string;
  records?: string[];
  _id?: DomainVerificationId;
  domain: WebHookDomain;
  google_user_id: GoogleUserId;
  status: "pending" | "error" | "verified";
  createdAt: TimeStamp;
  failures: number;
}
export const DomainVerifications = new Mongo.Collection<DomainVerification>(
  "DomainVerifications"
);

export interface Conversation {
  createdAt: TimeStamp;
  to: InternationalNumber;
  contactName: ContactName;
  text: string;
}

export interface MonkeyUser extends Meteor.User {
  profile: {
    developper: boolean | undefined;
  };
}
