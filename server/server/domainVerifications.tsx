import { Meteor } from "meteor/meteor";
import { DomainVerifications } from "/imports/collections";

import dns from "dns";
import { txtRecordForUser } from "../imports/lib/txtRecordForUser";

Meteor.methods({
  "profile.developper.set"(mode) {
    Meteor.users.update(
      { _id: Meteor.userId() },
      { $set: { "profile.developper": mode } }
    );
  },
  "domain.verify.start": async function (domain) {
    const google_user_id = Meteor.user().services.google.id;
    if (DomainVerifications.findOne({ domain, google_user_id })) {
      throw new Meteor.Error(
        "already-listed",
        "You already have a verification for this domain"
      );
    }
    const verification = {
      domain,
      google_user_id,
      status: "pending",
      createdAt: new Date(),
      failures: 0,
    };

    verification._id = DomainVerifications.insert(verification);
    return await verifyDomain(verification);
  },
  async "domain.verify.recheck"(_id) {
    const dv = DomainVerifications.findOne({
      _id,
      google_user_id: Meteor.user().services.google.id,
    });
    return await verifyDomain(dv);
  },
  async "domain.remove"(_id) {
    return DomainVerifications.remove({
      _id,
      google_user_id: Meteor.user().services.google.id,
    });
  },
});

async function verifyDomain(verification) {
  let result = null;
  try {
    const records = (await resolveTXT(verification.domain)).flat();
    if (records.length > 100) {
      throw new Meteor.Error(
        "too-many-records",
        "Too many TXT records on domain (max 100)"
      );
    }
    console.log(records);
    const expected = txtRecordForUser(verification.google_user_id);
    const verified = !!records.find((record) => record.trim() === expected);
    if (verification.failures > 6 && !verified) {
      result = {
        verified,
        status: "error",
        error: "Too many failures",
        records,
        failures: verification.failures + 1,
      };
    } else {
      result = {
        verified,
        status: verified ? "verified" : "pending",
        records,
        error: null,
        failures: verified ? 0 : verification.failures + 1,
      };
    }
  } catch (e) {
    result = {
      verified: false,
      status: "error",
      error: e.message,
      records: [],
      failures: verification.failures + 1,
    };
  }
  DomainVerifications.update(
    { _id: verification._id },
    {
      $set: {
        last_check: Date.now(),
        ...result,
      },
    }
  );
  return result;
}

Meteor.publish("domain.list", function () {
  return DomainVerifications.find({
    google_user_id: Meteor.user()?.services.google.id,
  });
});

export function resolveTXT(domain) {
  return new Promise((resolve, reject) => {
    dns.resolveTxt(domain, (err, records) => {
      if (err) {
        reject(new Meteor.Error(err.message));
      } else {
        resolve(records);
      }
    });
  });
}

Meteor.setInterval(() => {
  DomainVerifications.find(
    {
      status: "pending",
      last_check: { $lt: new Date(Date.now() - 1000 * 60 * 60 * 12) },
    },
    {
      limit: 30,
    }
  ).forEach((dv) => {
    verifyDomain(dv);
  });
}, 1000 * 60 * 60);
