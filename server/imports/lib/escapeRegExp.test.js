import { cleanPhoneNumber, escapeRegExp } from "./escapeRegExp";

describe("escapeRegExp", () => {
  it("should escape regexp special characters to search in full text", () => {
    const text = "?*ù$^";
    const escapedText = escapeRegExp(text);
    const asRegexp = new RegExp(escapedText);
    expect(asRegexp.test(text)).toBe(true);
  });
});

describe("cleanPhoneNumber", () => {
  it("should keep all numeric characters", () => {
    const text = "+33 6 12 34 56 78";
    const cleanedText = cleanPhoneNumber(text);
    expect(cleanedText).toBe("+33612345678");
  });
});
