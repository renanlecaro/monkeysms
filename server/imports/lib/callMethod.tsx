import { showToast } from "../ui/toast";

import { Meteor } from "meteor/meteor";

export function callMethod<T>(name: string, ...args): Promise<T> {
  console.log(
    "callMethod(" + JSON.stringify([name, ...args]).slice(1, -1) + ")"
  );
  return new Promise<T>((resolve, reject) =>
    Meteor?.call(name, ...args, (err, res) =>
      err ? reject(err) : resolve(res)
    )
  ).catch((err) => {
    showToast(err.message || err.toString(), "error");
    throw err;
  });
}
