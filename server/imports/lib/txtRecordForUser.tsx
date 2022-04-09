import { Meteor } from "meteor/meteor";
export function txtRecordForUser(google_user_id) {
  if (!google_user_id)
    throw new Meteor.Error(
      "user-not-found",
      "no user for google id " + google_user_id
    );
  return "monkeysms_belongs_to_user_" + google_user_id;
}
