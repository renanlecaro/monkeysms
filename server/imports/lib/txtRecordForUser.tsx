export function txtRecordForUser(google_user_id) {
  if (!google_user_id) throw new Meteor.Error("user-not-found");
  return "monkeysms_belongs_to_user_" + google_user_id;
}
