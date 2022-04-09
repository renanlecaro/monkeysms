export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function cleanPhoneNumber(num = "") {
  return num.replace(/[^+0-9]/gi, "");
}
