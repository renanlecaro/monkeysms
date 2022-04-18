import { Meteor } from "meteor/meteor";
import { ApiKeys, Contacts, Devices, Messages } from "../imports/collections";
// @ts-ignore
import { ReactiveAggregate } from "meteor/jcbernack:reactive-aggregate";

Meteor.publish(null, function () {
  return Devices.find({
    google_user_id: Meteor.user()?.services.google.id || "NONO",
  });
});

Meteor.publish("conversations", function () {
  const google_user_id = Meteor.user()?.services.google.id || "NONO";
  ReactiveAggregate(
    this,
    Messages,
    [
      {
        $match: {
          google_user_id,
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $group: {
          // FIXME from
          _id: { $cond: ["$outbound", "$to", "$from"] },
          lastMessage: { $first: "$$ROOT" },
        },
      },
      {
        $addFields: {
          "lastMessage._id": "$_id",
        },
      },
      {
        $lookup: {
          from: Contacts,
          let: { number: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$number", "$$number"],
                },
                google_user_id,
              },
            },
          ],
          as: "contact",
        },
      },
      {
        $addFields: {
          contact: { $first: "$contact" },
        },
      },
      {
        $addFields: {
          "lastMessage.contactName": { $ifNull: ["$contact.name", ""] },
        },
      },
      {
        $replaceRoot: { newRoot: "$lastMessage" },
      },
    ],
    {
      clientCollection: "conversations",

      lookupCollections: {
        Messages: {
          observeSelector: {
            google_user_id,
          },
          observeOptions: {
            limit: 1,
            sort: { last_updated: -1 },
          },
        },
        Contacts: {
          observeSelector: {
            google_user_id,
          },
          observeOptions: {
            limit: 1,
            sort: { last_updated: -1 },
          },
        },
      },
    }
  );
});
Meteor.publish("contactsCount", function () {
  const google_user_id = Meteor.user()?.services.google.id || "NONO";
  ReactiveAggregate(
    this,
    Contacts,
    [
      {
        $match: {
          google_user_id,
        },
      },
      {
        $group: {
          _id: "count",
          val: { $sum: 1 },
        },
      },
    ],
    {
      clientCollection: "contactsCount",

      lookupCollections: {
        Contacts: {
          observeSelector: {
            google_user_id,
          },
          observeOptions: {
            limit: 1,
            sort: { last_updated: -1 },
          },
        },
      },
    }
  );
});

Meteor.publish(null, function () {
  return Meteor.users.find(
    { _id: this.userId },
    {
      fields: {
        "services.google.id": 1,
        "services.google.email": 1,
        "services.google.name": 1,
        "services.google.picture": 1,
      },
    }
  );
});

Meteor.publish("lastMessages", function (to) {
  return Messages.find(
    {
      google_user_id: Meteor.user()?.services.google.id || "NONO",
      $or: [
        { to, outbound: true },
        { from: to, outbound: false },
      ],
    },
    { limit: 50, sort: { createdAt: -1 } }
  );
});

Meteor.publish("allContacts", function () {
  return Contacts.find({
    google_user_id: Meteor.user()?.services.google.id || "NONO",
  });
});

Meteor.publish("ApiKeys", function () {
  return ApiKeys.find({
    google_user_id: Meteor.user()?.services.google.id || "NONO",
    active: true,
  });
});
