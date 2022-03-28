import { toast } from "./toast";

export function callMethod(...args) {
  console.log("callMethod(" + JSON.stringify(args).slice(1, -1) + ")");
  return new Promise((resolve, reject) =>
    Meteor?.call(...args, (err, res) => (err ? reject(err) : resolve(res)))
  ).catch((err) => {
    toast(err.message || err.toString(), "error");
    throw err;
  });
}

callMethod.noToast = function (...args) {
  return new Promise((resolve, reject) =>
    Meteor?.call(...args, (err, res) => (err ? reject(err) : resolve(res)))
  );
};
